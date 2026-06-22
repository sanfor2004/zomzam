import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
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
// Keep sharp and the real user model out of the test process.
class ImageUploadError extends Error {}
mock.module('@/lib/uploads', {
  namedExports: {
    processImageUpload: mock.fn(async () => '/Assets/Uploads/posts/x.webp'),
    deleteUploadFile: mock.fn(() => {}),
    ImageUploadError,
  },
});
mock.module('@/lib/models/user', { namedExports: { DEFAULT_AVATAR: '/Assets/Img/default-avatar.png' } });

let posts: typeof import('@/lib/services/posts');
before(async () => { posts = await import('@/lib/services/posts'); });

const USER_ID = 42;

// Return the given rows from successive queryOne calls, then null. (node:test's
// mockImplementationOnce doesn't FIFO-queue across multiple calls, so sequence
// explicitly.)
function seedQueryOne(...rows: any[]) {
  let i = 0;
  db.queryOne.mock.mockImplementation(async () => (i < rows.length ? rows[i++] : null));
}

// Return the given result sets from successive query() calls, then [].
function seedQuery(...resultSets: any[][]) {
  let i = 0;
  db.query.mock.mockImplementation(async () => (i < resultSets.length ? resultSets[i++] : []));
}

beforeEach(() => {
  for (const fn of [db.query, db.queryOne, db.execute, db.transaction, connExecute]) fn.mock.resetCalls();
  db.queryOne.mock.mockImplementation(async () => null);
  db.query.mock.mockImplementation(async () => []);
  db.execute.mock.mockImplementation(async () => ({ insertId: 1 }));
  connExecute.mock.mockImplementation(async () => [{ insertId: 1 }]);
});

// ── Ownership scoping on the mutating post/comment operations (finding E) ─────

test('toggleLike inserts a like scoped to the acting user', async () => {
  await posts.toggleLike(USER_ID, 5);
  // Existence probe is scoped to (post, user).
  assert.deepEqual(db.queryOne.mock.calls[0].arguments[1], [5, USER_ID]);
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /INSERT INTO post_likes \(post_id, user_id\)/);
  assert.deepEqual(params, [5, USER_ID]);
});

test('editComment refuses a comment the user does not own (403)', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null); // ownership miss
  await assert.rejects(
    () => posts.editComment(USER_ID, 8, 'hi'),
    (err: any) => err instanceof HttpError && err.status === 403
  );
  assert.equal(db.execute.mock.calls.length, 0, 'no UPDATE runs on ownership failure');
});

test('editComment scopes both the ownership check and the UPDATE to the user', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ id: 8 }));
  await posts.editComment(USER_ID, 8, 'edited');
  assert.deepEqual(db.queryOne.mock.calls[0].arguments[1], [8, USER_ID]);
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE post_comments SET content = \? WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, ['edited', 8, USER_ID]);
});

test('deletePost refuses a post the user does not own (403)', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null);
  await assert.rejects(
    () => posts.deletePost(USER_ID, 12),
    (err: any) => err instanceof HttpError && err.status === 403
  );
  assert.equal(db.execute.mock.calls.length, 0, 'no DELETE runs on ownership failure');
});

test('deletePost scopes ownership check and final row delete to the user', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ image_path: null }));
  await posts.deletePost(USER_ID, 12);
  assert.deepEqual(db.queryOne.mock.calls[0].arguments[1], [12, USER_ID]);
  const finalDelete = db.execute.mock.calls.find((c) => /DELETE FROM posts\b/.test(c.arguments[0] as string))!;
  assert.deepEqual(finalDelete.arguments[1], [12, USER_ID]);
});

test('deleteComment refuses a comment the user does not own (403)', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null);
  await assert.rejects(
    () => posts.deleteComment(USER_ID, 3),
    (err: any) => err instanceof HttpError && err.status === 403
  );
});

test('deleteComment checks ownership scoped to the user before cascading', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ id: 3 }));
  db.query.mock.mockImplementation(async () => []); // no child replies
  await posts.deleteComment(USER_ID, 3);
  assert.deepEqual(db.queryOne.mock.calls[0].arguments[1], [3, USER_ID]);
});

test('createPost rejects an empty post (no text, no image) with HttpError 400', async () => {
  await assert.rejects(
    () => posts.createPost(USER_ID, { contentHtml: '   ', visibility: 'public', imageFile: null }),
    (err: any) => err instanceof HttpError && err.status === 400
  );
  assert.equal(db.execute.mock.calls.length, 0);
});

// ── Favor economy: accept_answer bridge + resolve_ask ────────────────────────

test('acceptAnswer resolves the ask, logs a helpful_event, and returns the helper id', async () => {
  seedQueryOne({ id: 50, type: 'ask' }, { id: 9, user_id: 77 }); // owned ask, then answer -> helper 77

  const { result, helperUserId } = await posts.acceptAnswer(USER_ID, 50, 9);

  assert.equal(helperUserId, 77);
  assert.equal(result.postId, 50);
  assert.equal(result.commentId, 9);

  const sqls = connExecute.mock.calls.map((c) => c.arguments[0] as string);
  assert.ok(sqls.some((s) => /UPDATE posts SET accepted_answer_id = \?, resolved_at = \? WHERE id = \? AND user_id = \?/.test(s)), 'ask resolved + scoped to owner');
  const logCall = connExecute.mock.calls.find((c) => /INSERT INTO helpful_events/.test(c.arguments[0] as string))!;
  // (post_id, comment_id, helper_user_id, asker_user_id)
  assert.deepEqual(logCall.arguments[1], [50, 9, 77, USER_ID]);
});

test('acceptAnswer refuses a post the user does not own (403)', async () => {
  seedQueryOne(); // post lookup -> null
  await assert.rejects(
    () => posts.acceptAnswer(USER_ID, 50, 9),
    (err: any) => err instanceof HttpError && err.status === 403
  );
  assert.equal(db.transaction.mock.calls.length, 0);
});

test('acceptAnswer rejects a non-ask post (400)', async () => {
  seedQueryOne({ id: 50, type: 'status' });
  await assert.rejects(
    () => posts.acceptAnswer(USER_ID, 50, 9),
    (err: any) => err instanceof HttpError && err.status === 400
  );
});

test('acceptAnswer 404s when the comment is not on the post', async () => {
  seedQueryOne({ id: 50, type: 'ask' }); // ask found; answer lookup then returns null
  await assert.rejects(
    () => posts.acceptAnswer(USER_ID, 50, 9),
    (err: any) => err instanceof HttpError && err.status === 404
  );
  assert.equal(db.transaction.mock.calls.length, 0);
});

test('findAskNotifyRecipients returns only skill-matched connections under the daily cap', async () => {
  seedQuery(
    // connected friends/followers + their tags
    [
      { id: 1, tags: ['uiux', 'react'] },
      { id: 2, tags: ['seo'] },          // no skill match -> dropped
      { id: 3, tags: ['uiux'] },         // matches but over cap -> dropped
    ],
    // today's new_help_request counts: user 3 already at the cap
    [{ user_id: 3, c: 3 }]
  );

  const recipients = await posts.findAskNotifyRecipients(99, 'uiux', 3);
  assert.deepEqual(recipients, [1]);
});

test('findAskNotifyRecipients returns nothing for a tagless ask', async () => {
  const recipients = await posts.findAskNotifyRecipients(99, '', 3);
  assert.deepEqual(recipients, []);
  assert.equal(db.query.mock.calls.length, 0, 'no DB hit when there is no skill tag');
});

test('resolveAsk scopes the UPDATE to the owner and writes no helpful_event', async () => {
  seedQueryOne({ id: 50, type: 'ask' });
  await posts.resolveAsk(USER_ID, 50);
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE posts SET resolved_at = \? WHERE id = \? AND user_id = \?/);
  assert.equal(params[1], 50);
  assert.equal(params[2], USER_ID);
  assert.equal(db.transaction.mock.calls.length, 0, 'resolve-self touches no helpful_events');
});
