import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// findOrCreateGoogleUser goes through @/lib/db — mock it so we can drive the
// link/create branches and inspect the UPDATE/INSERT it writes.
const db = {
  query: mock.fn(async (_sql: string, _params?: any[]) => [] as any[]),
  queryOne: mock.fn(async (_sql: string, _params?: any[]) => null as any),
  execute: mock.fn(async (_sql: string, _params?: any[]) => ({ insertId: 7 }) as any),
  transaction: mock.fn(async (cb: any) => cb({ execute: async () => [{ insertId: 7 }] })),
};
mock.module('@/lib/db', { namedExports: db });

let users: typeof import('@/lib/models/user');
before(async () => { users = await import('@/lib/models/user'); });

function seedQueryOne(...rows: any[]) {
  let i = 0;
  db.queryOne.mock.mockImplementation(async () => (i < rows.length ? rows[i++] : null));
}

beforeEach(() => {
  for (const fn of [db.query, db.queryOne, db.execute]) fn.mock.resetCalls();
  db.queryOne.mock.mockImplementation(async () => null);
  db.execute.mock.mockImplementation(async () => ({ insertId: 7 }));
});

const GOOGLE = {
  googleId: 'g-123',
  email: '2004sanfor@gmail.com',
  name: 'Mahmoud Sanfor',
  firstName: 'Mahmoud',
  lastName: 'Sanfor',
  picture: 'https://google/pic.jpg',
};

/** The UPDATE that links Google onto an existing account. */
function linkUpdate() {
  return db.execute.mock.calls.map((c) => c.arguments as [string, any[]]).find(([sql]) => /UPDATE users SET google_id/.test(sql))!;
}

test('linking by canonical inbox fills BLANK avatar + name from Google', async () => {
  seedQueryOne(
    null,                                                              // byGoogleId miss
    { id: 2, username: 'u', email: '2004.sanfor@gmail.com', avatar: null, first_name: null, last_name: null, is_active: 1, password: 'x' },
  );
  const res = await users.findOrCreateGoogleUser(GOOGLE);

  // It linked the EXISTING account (no INSERT), and the lookup was by canonical inbox.
  assert.match(db.queryOne.mock.calls[1].arguments[0] as string, /email_canonical = \?/);
  const [, params] = linkUpdate();
  // [google_id, avatar, first_name, last_name, id]
  assert.deepEqual(params, ['g-123', 'https://google/pic.jpg', 'Mahmoud', 'Sanfor', 2]);
  assert.equal(res.success, true);
  assert.equal((res.user as any).avatar, 'https://google/pic.jpg');
  assert.equal((res.user as any).first_name, 'Mahmoud');
});

test('linking NEVER overwrites an avatar/name the account already has', async () => {
  seedQueryOne(
    null,
    { id: 2, username: 'u', email: '2004.sanfor@gmail.com', avatar: '/Assets/Uploads/mine.webp', first_name: 'Existing', last_name: 'Name', is_active: 1, password: 'x' },
  );
  await users.findOrCreateGoogleUser(GOOGLE);

  const [, params] = linkUpdate();
  assert.deepEqual(params, ['g-123', '/Assets/Uploads/mine.webp', 'Existing', 'Name', 2], 'own data is preserved');
});

test('empty-string fields count as blank and get filled', async () => {
  seedQueryOne(
    null,
    { id: 5, username: 'u', email: 'x@gmail.com', avatar: '', first_name: '', last_name: '', is_active: 1, password: null },
  );
  await users.findOrCreateGoogleUser(GOOGLE);
  const [, params] = linkUpdate();
  assert.deepEqual(params.slice(1, 4), ['https://google/pic.jpg', 'Mahmoud', 'Sanfor']);
});

test('falls back to splitting the full name when granular claims are absent', async () => {
  seedQueryOne(
    null,
    { id: 9, username: 'u', email: 'x@gmail.com', avatar: null, first_name: null, last_name: null, is_active: 1, password: null },
  );
  await users.findOrCreateGoogleUser({ googleId: 'g', email: 'x@gmail.com', name: 'Ada Lovelace King', picture: undefined });
  const [, params] = linkUpdate();
  assert.equal(params[2], 'Ada', 'first = first token');
  assert.equal(params[3], 'Lovelace King', 'last = remaining tokens');
});

test('an existing google_id short-circuits before the email link (no profile backfill)', async () => {
  seedQueryOne({ id: 2, username: 'u', email: 'x@gmail.com', avatar: null, is_active: 1, password: 'x' }); // byGoogleId hit
  await users.findOrCreateGoogleUser(GOOGLE);
  // The only UPDATE is the last_login touch, not the link+backfill one.
  assert.equal(db.execute.mock.calls.filter((c) => /UPDATE users SET google_id/.test(c.arguments[0] as string)).length, 0);
});
