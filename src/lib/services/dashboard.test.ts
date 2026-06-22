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
