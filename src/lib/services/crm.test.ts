import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
// Real error class from its runtime-free leaf module — no Next/JWT pulled in, so
// the test asserts against exactly what the service throws (no stub drift).
import { HttpError } from '@/lib/http-error';

// Shared connection.execute so transaction-internal SQL is inspectable after run.
const connExecute = mock.fn(async (_sql: string, _params?: any[]) => [{ insertId: 1 }] as any);
const db = {
  query: mock.fn(async (_sql: string, _params?: any[]) => [] as any[]),
  queryOne: mock.fn(async (_sql: string, _params?: any[]) => null as any),
  execute: mock.fn(async (_sql: string, _params?: any[]) => ({ insertId: 1 }) as any),
  transaction: mock.fn(async (cb: any) => cb({ execute: connExecute })),
};

mock.module('@/lib/db', { namedExports: db });

// Imported after the module mocks are registered (top-level await is unavailable
// under the project's CJS transform, so this runs in a before hook).
let crm: typeof import('@/lib/services/crm');
before(async () => { crm = await import('@/lib/services/crm'); });

const USER_ID = 42;

beforeEach(() => {
  for (const fn of [db.query, db.queryOne, db.execute, db.transaction, connExecute]) fn.mock.resetCalls();
  db.queryOne.mock.mockImplementation(async () => null);
  db.execute.mock.mockImplementation(async () => ({ insertId: 1 }));
  connExecute.mock.mockImplementation(async () => [{ insertId: 1 }]);
});

// ── qualify_lead cross-suite bridge ──────────────────────────────────────────

test('qualifyLead runs the whole bridge in one transaction, all scoped to the user', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ name: 'Acme', company: 'Acme Co' }));

  await crm.qualifyLead(USER_ID, { leadId: 7, accountId: 3, amount: 1000, currency: 'USD', dueDate: null });

  // Lead ownership lookup is scoped to the caller.
  const leadLookup = db.queryOne.mock.calls[0].arguments;
  assert.match(leadLookup[0], /FROM crm_leads WHERE id = \? AND user_id = \?/);
  assert.deepEqual(leadLookup[1], [7, USER_ID]);

  assert.equal(db.transaction.mock.calls.length, 1);

  const sqls = connExecute.mock.calls.map((c) => c.arguments[0] as string);
  // Lead flipped, project created, 4 time tasks seeded, income recorded, balance bumped.
  assert.ok(sqls.some((s) => /UPDATE crm_leads SET status = 'qualified'/.test(s)), 'lead qualified');
  assert.ok(sqls.some((s) => /INSERT INTO crm_projects/.test(s)), 'project created');
  assert.equal(sqls.filter((s) => /INSERT INTO time_tasks/.test(s)).length, 4, '4 tasks seeded');
  assert.ok(sqls.some((s) => /INSERT INTO money_transactions/.test(s)), 'income transaction');
  assert.ok(sqls.some((s) => /UPDATE money_accounts SET balance = balance \+ \?/.test(s)), 'balance bumped');

  // Every write inside the bridge carries the user id — no cross-tenant leakage.
  for (const call of connExecute.mock.calls) {
    assert.ok((call.arguments[1] as any[]).includes(USER_ID), `params scoped to user: ${call.arguments[0]}`);
  }

  // The income row is an 'income' transaction for this user against the given account.
  const incomeCall = connExecute.mock.calls.find((c) => /INSERT INTO money_transactions/.test(c.arguments[0] as string))!;
  const incomeParams = incomeCall.arguments[1] as any[];
  assert.equal(incomeParams[0], USER_ID);
  assert.equal(incomeParams[1], 3); // account_id
  assert.ok(incomeParams.includes(1000)); // amount
});

test('qualifyLead seeds a Lending settlement only when a due date is given', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ name: 'Acme', company: null }));

  await crm.qualifyLead(USER_ID, { leadId: 7, accountId: 3, amount: 500, currency: 'EGP', dueDate: '2026-09-01' });

  const lendCall = connExecute.mock.calls.find((c) => /INSERT INTO money_lend/.test(c.arguments[0] as string));
  assert.ok(lendCall, 'lending row inserted when due date present');
  assert.equal((lendCall!.arguments[1] as any[])[0], USER_ID);
});

test('qualifyLead rejects invalid input with HttpError 400 before any write', async () => {
  await assert.rejects(
    () => crm.qualifyLead(USER_ID, { leadId: 0, accountId: 3, amount: 100, currency: 'EGP', dueDate: null }),
    (err: any) => err instanceof HttpError && err.status === 400
  );
  assert.equal(db.transaction.mock.calls.length, 0);
});

test('qualifyLead throws HttpError 404 when the lead is not the user\'s', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null); // lead lookup miss
  await assert.rejects(
    () => crm.qualifyLead(USER_ID, { leadId: 7, accountId: 3, amount: 100, currency: 'EGP', dueDate: null }),
    (err: any) => err instanceof HttpError && err.status === 404
  );
  assert.equal(db.transaction.mock.calls.length, 0);
});

// ── Ownership scoping on the mutating CRM operations (audit finding E) ────────

test('updateLeadStatus scopes the UPDATE to the owner', async () => {
  await crm.updateLeadStatus(USER_ID, 9, 'contacted');
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE crm_leads SET status = \? WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, ['contacted', 9, USER_ID]);
});

test('updateLead scopes the dynamic UPDATE to the owner', async () => {
  await crm.updateLead(USER_ID, 9, { name: 'New', status: 'qualified' });
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /WHERE id = \? AND user_id = \?$/);
  assert.equal(params[params.length - 1], USER_ID);
  assert.equal(params[params.length - 2], 9);
});

test('deleteLead scopes the DELETE to the owner', async () => {
  await crm.deleteLead(USER_ID, 9);
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /DELETE FROM crm_leads WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, [9, USER_ID]);
});

test('updateProjectStatus scopes the UPDATE to the owner', async () => {
  await crm.updateProjectStatus(USER_ID, 11, 'delivered');
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE crm_projects SET status = \? WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, ['delivered', 11, USER_ID]);
});
