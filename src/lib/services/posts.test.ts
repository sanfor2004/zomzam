import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

const db = {
  query: mock.fn(async (_sql: string, _params?: any[]) => [] as any[]),
  queryOne: mock.fn(async (_sql: string, _params?: any[]) => null as any),
  execute: mock.fn(async (_sql: string, _params?: any[]) => ({ insertId: 1 }) as any),
  transaction: mock.fn(async (cb: any) => cb({ execute: mock.fn(async () => [{ insertId: 1 }]) })),
};

mock.module('@/lib/db', { namedExports: db });
mock.module('@/lib/api-auth', { namedExports: { HttpError } });
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

beforeEach(() => {
  for (const fn of [db.query, db.queryOne, db.execute]) fn.mock.resetCalls();
  db.queryOne.mock.mockImplementation(async () => null);
  db.query.mock.mockImplementation(async () => []);
  db.execute.mock.mockImplementation(async () => ({ insertId: 1 }));
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
