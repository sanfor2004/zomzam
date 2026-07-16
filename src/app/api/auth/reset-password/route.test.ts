import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const db = {
  execute: mock.fn(async (_sql: string, _params?: unknown[]) => ({ insertId: 0, affectedRows: 1 })),
  query: mock.fn(async (_sql: string, _params?: unknown[]) => []),
  queryOne: mock.fn(async (_sql: string, _params?: unknown[]) => null as unknown),
};
mock.module('@/lib/db', { namedExports: db });

mock.module('@/lib/auth', {
  namedExports: {
    hashPassword: async () => 'new-hash',
    comparePassword: async () => true,
  },
});

let route: typeof import('./route');
before(async () => { route = await import('./route'); });

beforeEach(() => {
  db.execute.mock.resetCalls();
  db.queryOne.mock.resetCalls();
});

test('reset-password bumps token_version — every outstanding session dies', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ id: 42 })); // valid reset token

  const req = { json: async () => ({ token: 'valid-reset-token', new_password: 'newpass123' }) };
  const res = await route.POST(req as never);

  assert.equal(res.status, 200);
  const updateCall = db.execute.mock.calls.find((c) => /UPDATE users SET password/.test(c.arguments[0] as string))!;
  assert.ok(updateCall, 'password UPDATE ran');
  assert.match(updateCall.arguments[0] as string, /token_version = token_version \+ 1/);
});

test('invalid or expired reset token writes nothing', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null);

  const req = { json: async () => ({ token: 'bad-token', new_password: 'newpass123' }) };
  const res = await route.POST(req as never);

  assert.equal(res.status, 400);
  assert.equal(db.execute.mock.calls.length, 0, 'no write happened');
});
