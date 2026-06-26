import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// createNotification + pushStreamOrder both go through @/lib/db — mock it so we
// can assert the coalesce/insert SQL without a real connection.
const db = {
  query: mock.fn(async (_sql: string, _params?: any[]) => [] as any[]),
  queryOne: mock.fn(async (_sql: string, _params?: any[]) => null as any),
  execute: mock.fn(async (_sql: string, _params?: any[]) => ({ insertId: 7 }) as any),
  transaction: mock.fn(async (cb: any) => cb({ execute: async () => [{ insertId: 7 }] })),
};
mock.module('@/lib/db', { namedExports: db });

let users: typeof import('@/lib/models/user');
before(async () => { users = await import('@/lib/models/user'); });

const RECIPIENT = 100;

/** The INSERT/UPDATE calls createNotification made against the notifications table. */
function notifWrites() {
  return db.execute.mock.calls
    .map((c) => c.arguments as [string, any[]])
    .filter(([sql]) => /notifications/.test(sql));
}

beforeEach(() => {
  for (const fn of [db.query, db.queryOne, db.execute]) fn.mock.resetCalls();
  db.queryOne.mock.mockImplementation(async () => null);
  db.execute.mock.mockImplementation(async () => ({ insertId: 7 }));
});

test('non-aggregate notification inserts verbatim and never probes for a roster', async () => {
  await users.createNotification(RECIPIENT, 'friend_request', { from_username: 'al', message: 'sent you a friend request' });
  // No roster lookup.
  assert.equal(db.queryOne.mock.calls.length, 0);
  const writes = notifWrites();
  assert.equal(writes.length, 1);
  assert.match(writes[0][0], /INSERT INTO notifications/);
  // data column stored untouched (no actors injected for non-aggregate types).
  const stored = JSON.parse(writes[0][1][2]);
  assert.equal(stored.actors, undefined);
});

test('aggregate with no open roster inserts a fresh roster of one', async () => {
  await users.createNotification(
    RECIPIENT,
    'reposted',
    { from_user_id: 5, from_username: 'al', post_id: 9, message: 'reposted your post' },
    { aggregate: true, aggregateKey: 'post_id' },
  );
  // It probed for an existing unread roster scoped to (recipient, type, post_id)…
  const [probeSql, probeParams] = db.queryOne.mock.calls[0].arguments as [string, any[]];
  assert.match(probeSql, /JSON_EXTRACT\(data, '\$\.post_id'\)/);
  assert.deepEqual(probeParams, [RECIPIENT, 'reposted', '9']);
  // …found none, so it INSERTs a roster of one.
  const writes = notifWrites();
  assert.match(writes[0][0], /INSERT INTO notifications/);
  const stored = JSON.parse(writes[0][1][2]);
  assert.equal(stored.actor_count, 1);
  assert.deepEqual(stored.actors, [{ user_id: 5, username: 'al', avatar: '/Assets/Img/default-avatar.png' }]);
});

test('aggregate into an existing roster UPDATEs in place, prepends the actor, bumps the count', async () => {
  db.queryOne.mock.mockImplementation(async () => ({
    id: 55,
    data: JSON.stringify({ post_id: 9, actors: [{ user_id: 1, username: 'prev', avatar: '/p.png' }], actor_count: 1 }),
  }));
  await users.createNotification(
    RECIPIENT,
    'reposted',
    { from_user_id: 5, from_username: 'al', post_id: 9, message: 'reposted your post' },
    { aggregate: true, aggregateKey: 'post_id' },
  );
  const writes = notifWrites();
  const update = writes.find(([sql]) => /UPDATE notifications/.test(sql))!;
  assert.ok(update, 'expected an UPDATE, not an INSERT');
  assert.match(update[0], /is_read = 0/); // re-surfaced as unread
  assert.equal(update[1][1], 55);          // scoped to the existing row id
  const merged = JSON.parse(update[1][0]);
  assert.equal(merged.actor_count, 2);
  assert.equal(merged.actors[0].username, 'al');   // newest actor leads
  assert.equal(merged.actors[1].username, 'prev');
});

test('a repeat action from the same actor re-orders rather than double-counting', async () => {
  db.queryOne.mock.mockImplementation(async () => ({
    id: 55,
    data: JSON.stringify({ post_id: 9, actors: [{ user_id: 5, username: 'al', avatar: '/a.png' }], actor_count: 1 }),
  }));
  await users.createNotification(
    RECIPIENT,
    'reposted',
    { from_user_id: 5, from_username: 'al', post_id: 9 },
    { aggregate: true, aggregateKey: 'post_id' },
  );
  const update = notifWrites().find(([sql]) => /UPDATE notifications/.test(sql))!;
  const merged = JSON.parse(update[1][0]);
  assert.equal(merged.actor_count, 1); // still one distinct actor
  assert.equal(merged.actors.length, 1);
});

test('aggregate without a key buckets by type alone (e.g. followers, no target id)', async () => {
  await users.createNotification(
    RECIPIENT,
    'new_follower',
    { from_user_id: 5, from_username: 'al', message: 'started following you' },
    { aggregate: true },
  );
  const [probeSql, probeParams] = db.queryOne.mock.calls[0].arguments as [string, any[]];
  assert.doesNotMatch(probeSql, /JSON_EXTRACT/); // no per-target scoping
  assert.deepEqual(probeParams, [RECIPIENT, 'new_follower']);
});
