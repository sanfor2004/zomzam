import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// drainLiveSync reaches the DB through @/lib/db (transaction for the atomic
// queue drain, query for contacts presence, queryOne via getOnlineStatus) —
// mock it so grouping and validation can be asserted without a connection.
let queueRow: any = null;
const conn = {
  execute: mock.fn(async (sql: string) =>
    /SELECT/.test(sql) ? [queueRow ? [queueRow] : []] : [{}]
  ),
};
const db = {
  query: mock.fn(async (_sql: string, _params?: any[]) => [] as any[]),
  queryOne: mock.fn(async (_sql: string, _params?: any[]) => null as any),
  execute: mock.fn(async (_sql: string, _params?: any[]) => ({ insertId: 1 }) as any),
  transaction: mock.fn(async (cb: any) => cb(conn)),
};
mock.module('@/lib/db', { namedExports: db });

let live: typeof import('@/lib/live-sync');
before(async () => { live = await import('@/lib/live-sync'); });

beforeEach(() => {
  queueRow = null;
  for (const fn of [db.query, db.queryOne, db.execute, db.transaction]) fn.mock.resetCalls();
  conn.execute.mock.resetCalls();
  db.query.mock.mockImplementation(async () => []);
  db.queryOne.mock.mockImplementation(async () => null);
});

// mysql2 returns DATETIME columns as Date objects in production; a full ISO
// string round-trips through computeOnlineFields identically.
const nowIso = () => new Date().toISOString();

// ── parseViewingUserId: strict allowlist, never trust the client ─────────────

test('parseViewingUserId accepts only plain positive decimal integers', () => {
  assert.equal(live.parseViewingUserId('42'), 42);
  assert.equal(live.parseViewingUserId(7), 7);
  assert.equal(live.parseViewingUserId(' 15 '), 15); // trimmed
});

test('parseViewingUserId rejects every non-integer shape', () => {
  for (const bad of ['abc', '-1', '1.5', '0x10', '', '0', '12345678901', '1e3', null, undefined, {}, [], true, NaN, 3.7, -5]) {
    assert.equal(live.parseViewingUserId(bad as any), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// ── drainLiveSync: grouping, hygiene, anonymous path ──────────────────────────

test('drains the queue atomically and groups orders into typed sections', async () => {
  queueRow = {
    last_seen: nowIso(),
    stream_queue: JSON.stringify([
      { order_name: 'new_message', params: { conversation_id: 1 } },
      { order_name: 'typing', params: { sender_id: 2 } },
      { order_name: 'message_read', params: { reader_id: 3 } },
      { order_name: 'new_notification', params: { id: 9, type: 'friend_request' } },
      { order_name: 'new_post', params: { post_id: 4, by_user: 'al' } },
      { order_name: 'social_update', params: { kind: 'connect_request' } },
      { order_name: 'totally_unknown', params: { evil: true } },
    ]),
  };

  const payload = await live.drainLiveSync(100, null);

  assert.deepEqual(payload.messages.map((m) => m.kind), ['new_message', 'typing', 'message_read']);
  assert.equal(payload.notifications.length, 1);
  assert.equal(payload.notifications[0].id, 9);
  assert.deepEqual(payload.posts, [{ post_id: 4, by_user: 'al' }]);
  assert.equal(payload.social.length, 1);
  // Unknown order names are dropped, never forwarded blind.
  const all = [...payload.messages.map((m) => m.params), ...payload.notifications, ...payload.posts, ...payload.social];
  assert.ok(!all.some((p: any) => p?.evil));

  // The queue was cleared inside the same transaction that read it.
  const updates = conn.execute.mock.calls.filter((c) => /UPDATE user_online_status SET stream_queue = NULL/.test(c.arguments[0] as string));
  assert.equal(updates.length, 1);
});

test('a stale queue drops transient typing pings but keeps real messages', async () => {
  const old = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  queueRow = {
    last_seen: old,
    stream_queue: JSON.stringify([
      { order_name: 'typing', params: { sender_id: 2 } },
      { order_name: 'new_message', params: { conversation_id: 1 } },
    ]),
  };
  const payload = await live.drainLiveSync(100, null);
  assert.deepEqual(payload.messages.map((m) => m.kind), ['new_message']);
});

test('anonymous callers get viewed-user status only and never touch the queue', async () => {
  db.queryOne.mock.mockImplementation(async () => ({ last_seen: nowIso(), is_idle: 0 }));
  const payload = await live.drainLiveSync(null, 55);
  assert.equal(db.transaction.mock.calls.length, 0); // no drain for anonymous
  assert.ok(payload.viewed_user_status);
  assert.equal(payload.viewed_user_status.is_online, true);
  assert.equal(payload.messages.length, 0);
});

test('contacts presence is only sampled when explicitly requested', async () => {
  queueRow = null;
  await live.drainLiveSync(100, null);
  assert.equal(db.query.mock.calls.length, 0);

  db.query.mock.mockImplementation(async () => [
    { user_id: 7, last_seen: nowIso(), is_idle: 0 },
    { user_id: 8, last_seen: null, is_idle: null },
  ]);
  const payload = await live.drainLiveSync(100, null, { includeContacts: true });
  assert.equal(payload.contacts_presence?.length, 2);
  assert.equal(payload.contacts_presence![0].is_online, true);
  assert.equal(payload.contacts_presence![0].online_label, 'Online');
  assert.equal(payload.contacts_presence![1].is_online, false);
  assert.equal(payload.contacts_presence![1].online_label, 'Offline');
});

test('isEmptySync flags frames with nothing to emit', async () => {
  const empty = await live.drainLiveSync(100, null);
  assert.equal(live.isEmptySync(empty), true);

  queueRow = { last_seen: nowIso(), stream_queue: JSON.stringify([{ order_name: 'new_post', params: { post_id: 1 } }]) };
  const full = await live.drainLiveSync(100, null);
  assert.equal(live.isEmptySync(full), false);
});

test('a corrupt queue is treated as empty and still cleared', async () => {
  queueRow = { last_seen: nowIso(), stream_queue: '{not json[' };
  const payload = await live.drainLiveSync(100, null);
  assert.equal(live.isEmptySync(payload), true);
  const updates = conn.execute.mock.calls.filter((c) => /stream_queue = NULL/.test(c.arguments[0] as string));
  assert.equal(updates.length, 1);
});
