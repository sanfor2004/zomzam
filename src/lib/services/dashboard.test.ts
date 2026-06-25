import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '@/lib/http-error';

const db = {
  query: mock.fn(async (_sql: string, _params?: any[]) => [] as any[]),
  queryOne: mock.fn(async (_sql: string, _params?: any[]) => null as any),
};

mock.module('@/lib/db', { namedExports: db });

let dashboard: typeof import('@/lib/services/dashboard');
before(async () => { dashboard = await import('@/lib/services/dashboard'); });

const USER_ID = 42;

beforeEach(() => {
  db.query.mock.resetCalls();
  db.queryOne.mock.resetCalls();
  db.query.mock.mockImplementation(async () => []);
  // One stub that satisfies both the user-settings row (has primary_currency)
  // and every COUNT/SUM row (count/total_mins) the rollup reads.
  db.queryOne.mock.mockImplementation(async () => ({
    username: 't', email: 't@t', role: 'user', avatar: null, bio: null,
    primary_currency: 'EGP', secondary_currency: 'USD',
    count: 0, total_mins: '0',
  }));
});

test('getDashboardSummary scopes every read to the requesting user (no cross-tenant leak)', async () => {
  await dashboard.getDashboardSummary(USER_ID);

  const allCalls = [...db.queryOne.mock.calls, ...db.query.mock.calls];
  assert.ok(allCalls.length > 0, 'the rollup issued reads');
  for (const call of allCalls) {
    const params = (call.arguments[1] as any[]) || [];
    assert.ok(params.includes(USER_ID), `read not scoped to user: ${call.arguments[0]}`);
  }
});

test('getDashboardSummary throws HttpError 404 when the user row is missing', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null); // user-settings lookup miss
  await assert.rejects(
    () => dashboard.getDashboardSummary(USER_ID),
    (err: any) => err instanceof HttpError && err.status === 404
  );
});

test('getDashboardSummary returns the blended rate buckets', async () => {
  const summary = await dashboard.getDashboardSummary(USER_ID);
  assert.ok('rates' in summary && 'hourlyRateIncome' in summary.rates);
  assert.ok('profile' in summary && 'time' in summary && 'money' in summary && 'crm' in summary);
});

test('rates.perClient ranks live clients by realized $/hr, sinks $0-income to the bottom, and drops deleted leads', async () => {
  // Route only the three per-client rollup reads by their SQL shape; every other
  // read falls through to [] (no accounts/projects/etc. needed for this assertion).
  db.query.mock.mockImplementation(async (sql: string) => {
    if (/JOIN crm_projects[\s\S]*GROUP BY p\.lead_id/.test(sql)) {
      return [
        { lead_id: 1, minutes: '1500' }, // 25h
        { lead_id: 2, minutes: '7200' }, // 120h
        { lead_id: 3, minutes: '600' },  // 10h, but no income yet
        { lead_id: 99, minutes: '300' }, // hours against a since-deleted lead
      ];
    }
    if (/money_transactions[\s\S]*type = 'income'[\s\S]*GROUP BY lead_id, currency/.test(sql)) {
      return [
        { lead_id: 1, currency: 'EGP', amount: '2000' },
        { lead_id: 2, currency: 'EGP', amount: '1500' },
        { lead_id: 99, currency: 'EGP', amount: '500' }, // deleted lead → must not surface
      ];
    }
    if (/SELECT id, name, company FROM crm_leads/.test(sql)) {
      return [
        { id: 1, name: 'Acme', company: 'Acme Co' },
        { id: 2, name: 'Globex', company: null },
        { id: 3, name: 'Initech', company: null },
      ];
    }
    return [];
  });

  const { perClient } = (await dashboard.getDashboardSummary(USER_ID)).rates as any;

  assert.equal(perClient.length, 3, 'lead 99 (deleted) dropped; the three live leads remain');
  assert.deepEqual(perClient.map((c: any) => c.leadId), [1, 2, 3], 'sorted by rate desc, in-progress last');
  assert.equal(perClient[0].realizedRate, 80);   // 2000 / 25h
  assert.equal(perClient[1].realizedRate, 12.5); // 1500 / 120h
  assert.equal(perClient[2].realizedRate, null); // $0 income → no rate, never a divide-by-zero
});
