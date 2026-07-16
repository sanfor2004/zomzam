import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// signSession (real module) gates on JWT_SECRET at load.
process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef-0123456789abcdef';

const db = {
  execute: mock.fn(async (_sql: string, _params?: unknown[]) => ({ insertId: 1, affectedRows: 1 })),
  query: mock.fn(async (_sql: string, _params?: unknown[]) => []),
  queryOne: mock.fn(async (_sql: string, _params?: unknown[]) => null as unknown),
};
mock.module('@/lib/db', { namedExports: db });

const comparePassword = mock.fn(async () => true);
mock.module('@/lib/auth', {
  namedExports: {
    hashPassword: async () => 'new-hash',
    comparePassword,
  },
});

const apiAuth = {
  withAuth: (handler: (req: unknown, user: unknown, ctx: unknown) => Promise<Response>) =>
    async (req: unknown) => handler(req, { id: 42, username: 'tester', email: 't@t.t', role: 'user' }, {}),
};
mock.module('@/lib/api-auth', { namedExports: apiAuth });

let route: typeof import('./route');
before(async () => { route = await import('./route'); });

beforeEach(() => {
  db.execute.mock.resetCalls();
  db.queryOne.mock.resetCalls();
});

test('change-password bumps token_version and re-issues a fresh session cookie', async () => {
  // 1st queryOne: password hash fetch; 2nd: the bumped token_version.
  db.queryOne.mock.mockImplementationOnce(async () => ({ password: 'old-hash' }));
  db.queryOne.mock.mockImplementationOnce(async () => ({ token_version: 6 }));

  const req = { json: async () => ({ current_password: 'oldpass123', new_password: 'newpass123' }) };
  const res = await route.POST(req as never);

  assert.equal(res.status, 200);

  // The password UPDATE revokes every other session in the same statement.
  const updateCall = db.execute.mock.calls.find((c) => /UPDATE users SET password/.test(c.arguments[0] as string))!;
  assert.ok(updateCall, 'password UPDATE ran');
  assert.match(updateCall.arguments[0] as string, /token_version = token_version \+ 1/);

  // The changing device stays signed in via a fresh encrypted cookie.
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/ZOMZAM_SESSION=([^;]+)/);
  assert.ok(match, 'fresh ZOMZAM_SESSION cookie set on the response');
  assert.equal(match![1].split('.').length, 5, 'cookie value is a 5-segment JWE');
  assert.match(setCookie, /HttpOnly/i);
});

test('wrong current password does not bump token_version', async () => {
  comparePassword.mock.mockImplementationOnce(async () => false);
  db.queryOne.mock.mockImplementationOnce(async () => ({ password: 'old-hash' }));

  const req = { json: async () => ({ current_password: 'wrong', new_password: 'newpass123' }) };
  const res = await route.POST(req as never);

  assert.equal(res.status, 400);
  assert.equal(db.execute.mock.calls.length, 0, 'no write happened');
});
