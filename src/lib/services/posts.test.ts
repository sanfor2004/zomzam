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
// Keep sharp and the real user model out of the test process. Hoisted so the
// upload/cleanup calls editPost makes are inspectable after a run.
class ImageUploadError extends Error {}
const uploads = {
  processImageUpload: mock.fn(async () => '/Assets/Uploads/posts/new.webp'),
  deleteUploadFile: mock.fn((_path?: any) => {}),
  ImageUploadError,
};
mock.module('@/lib/uploads', { namedExports: uploads });
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
  for (const fn of [db.query, db.queryOne, db.execute, db.transaction, connExecute, uploads.processImageUpload, uploads.deleteUploadFile]) fn.mock.resetCalls();
  db.queryOne.mock.mockImplementation(async () => null);
  db.query.mock.mockImplementation(async () => []);
  db.execute.mock.mockImplementation(async () => ({ insertId: 1 }));
  connExecute.mock.mockImplementation(async () => [{ insertId: 1 }]);
  uploads.processImageUpload.mock.mockImplementation(async () => '/Assets/Uploads/posts/new.webp');
  uploads.deleteUploadFile.mock.mockImplementation(() => {});
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

test('createPost normal-post fetch omits repost_of so a fresh post never mis-renders as a tombstone', async () => {
  // Regression (2026-06-26): the create return selected p.repost_of, which is
  // NULL for a normal post; PostCard reads `repost_of !== undefined`, so the null
  // flagged a brand-new post as a deleted-original repost ("You reposted" +
  // "This post is no longer available") until a refresh re-fetched via the feed.
  db.queryOne.mock.mockImplementation(async () => ({ id: 1, user_id: USER_ID, avatar: null }));
  await posts.createPost(USER_ID, { contentHtml: '<p>hi</p>', visibility: 'public', imageFile: null });
  const fetchCall = db.queryOne.mock.calls.find((c) => /0 AS like_count/.test(c.arguments[0] as string))!;
  assert.doesNotMatch(fetchCall.arguments[0] as string, /repost_of/, 'a normal create return must not carry repost_of');
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

// ── Favor economy: reopen_ask (undo) ─────────────────────────────────────────

test('reopenAsk clears both columns and deletes the ledger row, scoped to the owner', async () => {
  seedQueryOne({ id: 50, type: 'ask' });

  const out = await posts.reopenAsk(USER_ID, 50);
  assert.deepEqual(out, { reopened: true });

  // Both side effects run inside one transaction.
  assert.equal(db.transaction.mock.calls.length, 1, 'reopen is transactional');
  const clear = connExecute.mock.calls.find((c) => /UPDATE posts SET accepted_answer_id = NULL, resolved_at = NULL/.test(c.arguments[0] as string))!;
  assert.deepEqual(clear.arguments[1], [50, USER_ID], 'clear is scoped to the owner');
  const del = connExecute.mock.calls.find((c) => /DELETE FROM helpful_events WHERE post_id = \?/.test(c.arguments[0] as string))!;
  assert.deepEqual(del.arguments[1], [50], 'ledger row deleted by post id');
});

test('reopenAsk refuses a post the user does not own (403)', async () => {
  seedQueryOne(); // post lookup -> null
  await assert.rejects(
    () => posts.reopenAsk(USER_ID, 50),
    (err: any) => err instanceof HttpError && err.status === 403
  );
  assert.equal(db.transaction.mock.calls.length, 0, 'no writes on ownership failure');
});

test('reopenAsk rejects a non-ask post (400)', async () => {
  seedQueryOne({ id: 50, type: 'status' });
  await assert.rejects(
    () => posts.reopenAsk(USER_ID, 50),
    (err: any) => err instanceof HttpError && err.status === 400
  );
  assert.equal(db.transaction.mock.calls.length, 0);
});

// ── Post editing: editPost (text + image + visibility) ───────────────────────

test('editPost keeps the current image when no new file and no remove flag', async () => {
  seedQueryOne({ id: 7, image_path: '/Assets/Uploads/posts/old.webp' });

  await posts.editPost(USER_ID, 7, { contentHtml: 'updated', imageFile: null, removeImage: false });

  assert.deepEqual(db.queryOne.mock.calls[0].arguments[1], [7, USER_ID], 'ownership check scoped to user');
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE posts SET content_html = \?, image_path = \? WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, ['updated', '/Assets/Uploads/posts/old.webp', 7, USER_ID]);
  assert.equal(uploads.processImageUpload.mock.calls.length, 0, 'no re-upload when image is kept');
  assert.equal(uploads.deleteUploadFile.mock.calls.length, 0, 'kept image is not deleted');
});

test('editPost replaces the image: stores the new one and deletes the old', async () => {
  seedQueryOne({ id: 7, image_path: '/Assets/Uploads/posts/old.webp' });

  await posts.editPost(USER_ID, 7, { contentHtml: 'x', imageFile: { size: 100 } as any, removeImage: false });

  assert.equal(uploads.processImageUpload.mock.calls.length, 1, 'new image processed');
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE posts SET content_html = \?, image_path = \?/);
  assert.equal(params[1], '/Assets/Uploads/posts/new.webp', 'row points at the new image');
  assert.deepEqual(uploads.deleteUploadFile.mock.calls[0].arguments[0], '/Assets/Uploads/posts/old.webp', 'old blob removed');
});

test('editPost removes the image: nulls image_path and deletes the old file', async () => {
  seedQueryOne({ id: 7, image_path: '/Assets/Uploads/posts/old.webp' });

  await posts.editPost(USER_ID, 7, { contentHtml: 'still text', imageFile: null, removeImage: true });

  const [, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.equal(params[1], null, 'image_path nulled');
  assert.equal(uploads.processImageUpload.mock.calls.length, 0, 'nothing uploaded on remove');
  assert.deepEqual(uploads.deleteUploadFile.mock.calls[0].arguments[0], '/Assets/Uploads/posts/old.webp');
});

test('editPost persists visibility when provided (and only then)', async () => {
  seedQueryOne({ id: 7, image_path: null });

  await posts.editPost(USER_ID, 7, { contentHtml: 'hi', visibility: 'public', imageFile: null, removeImage: false });

  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /UPDATE posts SET content_html = \?, image_path = \?, visibility = \? WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, ['hi', null, 'public', 7, USER_ID]);
});

test('editPost refuses a post the user does not own (403)', async () => {
  seedQueryOne(); // ownership miss
  await assert.rejects(
    () => posts.editPost(USER_ID, 7, { contentHtml: 'x', imageFile: null, removeImage: false }),
    (err: any) => err instanceof HttpError && err.status === 403
  );
  assert.equal(db.execute.mock.calls.length, 0, 'no UPDATE on ownership failure');
});

test('editPost rejects an edit that would leave the post empty (400)', async () => {
  seedQueryOne({ id: 7, image_path: null }); // no existing image to fall back on
  await assert.rejects(
    () => posts.editPost(USER_ID, 7, { contentHtml: '   ', imageFile: null, removeImage: false }),
    (err: any) => err instanceof HttpError && err.status === 400
  );
  assert.equal(db.execute.mock.calls.length, 0);
});

// ── getFeed: chat-style unseen-first keyset feed ─────────────────────────────
// A minimal feed row shaped like the SELECT in getFeed; override what a test cares about.
function feedRow(over: Partial<Record<string, any>> = {}) {
  return {
    id: 1, user_id: 9, content_html: '<p>hi</p>', image_path: null, visibility: 'public',
    type: 'status', skill_tag: null, accepted_answer_id: null, resolved_at: null,
    created_at: '2026-06-01T00:00:00Z', username: 'u', first_name: '', last_name: '',
    avatar: null, author_tags: null, like_count: 0, comment_count: 0, liked_by_me: 0,
    ...over,
  };
}

test('getFeed unseen landing page ranks tag-matched posts above non-matching, over the unseen set', async () => {
  seedQueryOne({ tags: ['react'] }); // viewer tags
  // One window result set; embedTopComments then sees [] (no comments).
  seedQuery([
    feedRow({ id: 1, content_html: '<p>nothing relevant</p>' }),           // score 0
    feedRow({ id: 2, content_html: '<span data-tag="react">#react</span>' }), // score 10
  ]);

  const res = await posts.getFeed(USER_ID, {});

  assert.equal(res.tier, 'unseen');
  assert.deepEqual(res.posts.map((p: any) => p.id), [2, 1], 'tag-matched post outranks the irrelevant one');
  // Landing page reads the unseen pool, not the seen one, as a bounded scored window.
  const windowSql = db.query.mock.calls[0].arguments[0] as string;
  assert.match(windowSql, /NOT EXISTS \(SELECT 1 FROM post_views/);
  assert.match(windowSql, /LIMIT 300/);
  assert.equal(res.has_more, false);
  assert.equal(res.next_cursor, null);
});

test('getFeed deeper page is a recency keyset (id < cursor) and returns the smallest delivered id as next_cursor', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({ id: 90 }), feedRow({ id: 80 })]); // exactly `limit` rows ⇒ more to come

  const res = await posts.getFeed(USER_ID, { tier: 'unseen', cursor: 100, limit: 2 });

  const sql = db.query.mock.calls[0].arguments[0] as string;
  const params = db.query.mock.calls[0].arguments[1] as any[];
  assert.match(sql, /p\.id < \?/, 'keyset predicate present');
  assert.match(sql, /ORDER BY p\.id DESC\s+LIMIT 2/);
  assert.equal(params[params.length - 1], 100, 'cursor bound last');
  assert.equal(res.has_more, true);
  assert.equal(res.next_cursor, 80, 'smallest id delivered seeds the next page');
});

test('getFeed seen tier selects already-seen posts (EXISTS, not NOT EXISTS)', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({ id: 5 })]);

  const res = await posts.getFeed(USER_ID, { tier: 'seen' });

  const sql = db.query.mock.calls[0].arguments[0] as string;
  assert.equal(res.tier, 'seen');
  assert.match(sql, /EXISTS \(SELECT 1 FROM post_views/);
  assert.doesNotMatch(sql, /NOT EXISTS \(SELECT 1 FROM post_views/);
});

test('getFeed help filter constrains to asks in SQL (stays keyset-stable)', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({ id: 5, type: 'ask' })]);

  await posts.getFeed(USER_ID, { filter: 'help' });

  assert.match(db.query.mock.calls[0].arguments[0] as string, /p\.type = 'ask'/);
});

test('getFeed help_matches with no viewer tags short-circuits to empty without querying', async () => {
  seedQueryOne({ tags: null }); // viewer has no tags

  const res = await posts.getFeed(USER_ID, { filter: 'help_matches' });

  assert.deepEqual(res, { posts: [], next_cursor: null, has_more: false, tier: 'unseen' });
  assert.equal(db.query.mock.calls.length, 0, 'no candidate query issued for an impossible match');
});

// ── markPostsSeen: sanitized, deduped, bounded batch upsert ───────────────────

test('markPostsSeen dedupes, drops non-positive ids, and upserts one row per (post, viewer)', async () => {
  const res = await posts.markPostsSeen(USER_ID, [5, 5, '7' as any, -1, 0, NaN as any]);

  assert.deepEqual(res, { marked: 2 });
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /INSERT INTO post_views [\s\S]*VALUES \(\?, \?, 1\), \(\?, \?, 1\)/);
  assert.deepEqual(params, [5, USER_ID, 7, USER_ID]);
});

test('markPostsSeen with no valid ids writes nothing', async () => {
  const res = await posts.markPostsSeen(USER_ID, []);
  assert.deepEqual(res, { marked: 0 });
  assert.equal(db.execute.mock.calls.length, 0);
});

// ── getFeedAudience: who receives the live "new posts" pill ───────────────────

test('getFeedAudience returns friend+follower ids, every clause scoped to the author', async () => {
  seedQuery([{ id: 3 }, { id: 4 }]);

  const ids = await posts.getFeedAudience(USER_ID);

  assert.deepEqual(ids, [3, 4]);
  const [sql, params] = db.query.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /type = 'friend'/);
  assert.match(sql, /type = 'follow'/);
  assert.ok(params.every((p) => p === USER_ID), 'audience query never reaches outside the author');
});

// ── Bookmark: private, id-scoped toggle ──────────────────────────────────────

test('toggleBookmark inserts a bookmark scoped to the acting user when none exists', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => null); // not yet bookmarked
  const res = await posts.toggleBookmark(USER_ID, 5);
  assert.deepEqual(res, { bookmarked: true });
  assert.deepEqual(db.queryOne.mock.calls[0].arguments[1], [5, USER_ID], 'existence probe scoped to (post, user)');
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /INSERT INTO post_bookmarks \(post_id, user_id\)/);
  assert.deepEqual(params, [5, USER_ID]);
});

test('toggleBookmark deletes the bookmark (scoped to user) when it already exists', async () => {
  db.queryOne.mock.mockImplementationOnce(async () => ({ id: 1 })); // already bookmarked
  const res = await posts.toggleBookmark(USER_ID, 5);
  assert.deepEqual(res, { bookmarked: false });
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /DELETE FROM post_bookmarks WHERE post_id = \? AND user_id = \?/);
  assert.deepEqual(params, [5, USER_ID]);
});

// ── Repost: plain toggle (public-only, root-collapse, self-allowed) ───────────

test('toggleRepost creates a plain repost of a public original, scoped to the user', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },                       // target
    { id: 5, user_id: 9, visibility: 'public' },      // root
    null,                                             // no existing plain repost
  );
  seedQuery([feedRow({ id: 100, repost_of: 5, orig_id: 5 })], []); // fetchFeedPostById + top comments

  const res = await posts.toggleRepost(USER_ID, 5);

  assert.equal(res.reposted, true);
  const insert = db.execute.mock.calls.find((c) => /INSERT INTO posts/.test(c.arguments[0] as string))!;
  assert.match(insert.arguments[0] as string, /content_html, visibility, image_path, type, skill_tag, repost_of/);
  assert.deepEqual(insert.arguments[1], [USER_ID, 5], 'author = session user, repost_of = root id');
});

test('toggleRepost on an existing plain repost removes it (un-repost), scoped to the user', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },                       // target
    { id: 5, user_id: 9, visibility: 'public' },      // root
    { id: 99 },                                       // existing plain repost row
  );
  const res = await posts.toggleRepost(USER_ID, 5);

  assert.deepEqual(res, { reposted: false });
  const [sql, params] = db.execute.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /DELETE FROM posts WHERE id = \? AND user_id = \?/);
  assert.deepEqual(params, [99, USER_ID], 'a user can only undo their own repost');
});

test('toggleRepost rejects a non-public original (400) and writes nothing', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },
    { id: 5, user_id: 9, visibility: 'friends' },     // friends-only ⇒ not repostable
  );
  await assert.rejects(
    () => posts.toggleRepost(USER_ID, 5),
    (err: any) => err instanceof HttpError && err.status === 400,
  );
  assert.equal(db.execute.mock.calls.length, 0);
});

test('toggleRepost collapses to the root when the target is itself a repost', async () => {
  seedQueryOne(
    { id: 5, repost_of: 3 },                           // target is a repost of 3
    { id: 3, user_id: 9, visibility: 'public' },       // root = 3
    null,
  );
  seedQuery([feedRow({ id: 100, repost_of: 3, orig_id: 3 })], []);

  await posts.toggleRepost(USER_ID, 5);

  assert.deepEqual(db.queryOne.mock.calls[1].arguments[1], [3], 'root resolved from the target\'s repost_of');
  const insert = db.execute.mock.calls.find((c) => /INSERT INTO posts/.test(c.arguments[0] as string))!;
  assert.equal((insert.arguments[1] as any[])[1], 3, 'repost_of points at the true root, never a chain');
});

test('toggleRepost allows a self-repost (root authored by the same user)', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },
    { id: 5, user_id: USER_ID, visibility: 'public' }, // own post
    null,
  );

  const res = await posts.toggleRepost(USER_ID, 5);
  assert.equal(res.reposted, true, 'self-repost is permitted at the service layer');
});

test('toggleRepost returns the original author + id to notify (a plain repost never enters the feed)', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },
    { id: 5, user_id: 9, visibility: 'public' },
    null,
  );
  const res = await posts.toggleRepost(USER_ID, 5);
  assert.deepEqual(res, { reposted: true, originalAuthorId: 9, originalId: 5 });
});

test('toggleRepost matches only the empty IMAGE-LESS pointer (an image-only quote is not a plain repost)', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },
    { id: 5, user_id: 9, visibility: 'public' },
    null,
  );
  await posts.toggleRepost(USER_ID, 5);
  const probe = db.queryOne.mock.calls[2].arguments[0] as string;
  assert.match(probe, /content_html = '' AND image_path IS NULL/, 'plain-repost probe excludes image-only quotes');
});

test('getFeed hides plain reposts (empty image-less pointers) from the home feed', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({ id: 5 })], []);
  await posts.getFeed(USER_ID, { tier: 'seen' });
  const sql = db.query.mock.calls[0].arguments[0] as string;
  assert.match(sql, /NOT \(p\.repost_of IS NOT NULL AND p\.content_html = '' AND p\.image_path IS NULL\)/);
});

test('createPost quote accepts an image-only quote (no text)', async () => {
  seedQueryOne({ id: 5, repost_of: null }, { id: 5, user_id: 9, visibility: 'public' });
  seedQuery([feedRow({ id: 102, repost_of: 5, orig_id: 5 })], []);
  await posts.createPost(USER_ID, { contentHtml: '', visibility: 'public', imageFile: { size: 100 } as any, repostOf: 5 });
  assert.equal(uploads.processImageUpload.mock.calls.length, 1, 'the quote\'s own image is processed');
  const insert = db.execute.mock.calls.find((c) => /INSERT INTO posts/.test(c.arguments[0] as string))!;
  assert.equal((insert.arguments[1] as any[])[6], 5, 'repost_of = root id');
});

// ── Repost: quote (createPost with repostOf) ─────────────────────────────────

test('createPost quote stores repost_of + content and forces public/status', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },                       // target
    { id: 5, user_id: 9, visibility: 'public' },      // root
  );
  seedQuery([feedRow({ id: 101, repost_of: 5, orig_id: 5 })], []); // fetchFeedPostById

  await posts.createPost(USER_ID, { contentHtml: '<p>nice work</p>', visibility: 'friends', imageFile: null, repostOf: 5 });

  const insert = db.execute.mock.calls.find((c) => /INSERT INTO posts/.test(c.arguments[0] as string))!;
  const params = insert.arguments[1] as any[];
  // (user_id, content_html, visibility, image_path, type, skill_tag, repost_of)
  assert.equal(params[0], USER_ID);
  assert.match(params[1], /nice work/);
  assert.equal(params[2], 'public', 'a quote is always public');
  assert.equal(params[4], 'status', 'a quote is always a status');
  assert.equal(params[6], 5, 'repost_of = root id');
});

test('createPost quote rejects empty text (400) before touching the DB', async () => {
  await assert.rejects(
    () => posts.createPost(USER_ID, { contentHtml: '   ', visibility: 'public', imageFile: null, repostOf: 5 }),
    (err: any) => err instanceof HttpError && err.status === 400,
  );
  assert.equal(db.execute.mock.calls.length, 0);
  assert.equal(db.queryOne.mock.calls.length, 0, 'empty-text quote is rejected before resolving the target');
});

test('createPost quote rejects a non-public original (400)', async () => {
  seedQueryOne(
    { id: 5, repost_of: null },
    { id: 5, user_id: 9, visibility: 'exclusive' },
  );
  await assert.rejects(
    () => posts.createPost(USER_ID, { contentHtml: '<p>x</p>', visibility: 'public', imageFile: null, repostOf: 5 }),
    (err: any) => err instanceof HttpError && err.status === 400,
  );
  assert.equal(db.execute.mock.calls.length, 0);
});

// ── getSaved: newest-saved-first, visibility re-checked, bookmarked forced ────

test('getSaved orders newest-saved-first and re-applies the feed visibility rule', async () => {
  seedQuery([feedRow({ id: 7, bookmark_id: 30, repost_of: null })], []); // saved rows + top comments

  const res = await posts.getSaved(USER_ID, {});

  const [sql, params] = db.query.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /FROM post_bookmarks b/);
  assert.match(sql, /ORDER BY b\.id DESC/);
  assert.match(sql, /p\.visibility = 'public'/, 'visibility clause re-applied so lost-access posts drop out');
  assert.equal(params[6], USER_ID, 'bookmark owner filter is the session user');
  assert.equal(res.posts[0].bookmarked_by_me, true, 'every saved row is bookmarked by definition');
});

test('getSaved keyset-paginates on the bookmark id', async () => {
  seedQuery([feedRow({ id: 7, bookmark_id: 12, repost_of: null }), feedRow({ id: 6, bookmark_id: 11, repost_of: null })], []);

  const res = await posts.getSaved(USER_ID, { cursor: 20, limit: 2 });

  const [sql, params] = db.query.mock.calls[0].arguments as [string, any[]];
  assert.match(sql, /b\.id < \?/, 'keyset predicate on the bookmark id');
  assert.equal(params[params.length - 1], 20, 'cursor bound last');
  assert.equal(res.has_more, true);
  assert.equal(res.next_cursor, 11, 'smallest bookmark id seeds the next page');
});

// ── getFeed: nested repost shape + engagement flags ──────────────────────────

test('getFeed builds a nested repost_of object from the orig_* columns', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({
    id: 200, repost_of: 5, orig_id: 5, orig_user_id: 9, orig_username: 'origauthor',
    orig_content_html: '<p>the original</p>', orig_like_count: 3, orig_comment_count: 1,
  })], []);

  const res = await posts.getFeed(USER_ID, { tier: 'seen' }); // non-scored path

  const nested = res.posts[0].repost_of;
  assert.ok(nested && typeof nested === 'object', 'live repost yields a nested original object');
  assert.equal(nested.id, 5);
  assert.equal(nested.username, 'origauthor');
  assert.match(nested.content_html, /the original/);
});

test('getFeed yields repost_of: null (tombstone) when the original was deleted', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({ id: 200, repost_of: 5, orig_id: null })], []); // FK set, original gone

  const res = await posts.getFeed(USER_ID, { tier: 'seen' });
  assert.equal(res.posts[0].repost_of, null, 'a deleted original renders as a tombstone');
});

test('getFeed normalizes engagement flags to booleans', async () => {
  seedQueryOne({ tags: [] });
  seedQuery([feedRow({ id: 5, liked_by_me: 1, bookmarked_by_me: 1, is_following: 1, is_friend: 1, reposted_by_me: 1, repost_count: 4 })], []);

  const res = await posts.getFeed(USER_ID, { tier: 'seen' });
  const p = res.posts[0];
  assert.equal(p.liked_by_me, true);
  assert.equal(p.bookmarked_by_me, true);
  assert.equal(p.is_following, true);
  assert.equal(p.is_friend, true);
  assert.equal(p.reposted_by_me, true);
  assert.equal(p.repost_count, 4);
});

test('getFeed excludes reposts from relevance scoring (recency only — score 0)', async () => {
  seedQueryOne({ tags: ['react'] }); // viewer tags
  // A normal tag-matched post (score 10) vs a repost whose content also matches
  // (#react) but is forced to score 0 — the normal post must rank first.
  seedQuery([
    feedRow({ id: 1, content_html: '<span data-tag="react">#react</span>' }), // normal, score 10
    feedRow({ id: 2, content_html: '<span data-tag="react">#react</span>', repost_of: 9, orig_id: 9 }), // repost, score 0
  ]);

  const res = await posts.getFeed(USER_ID, {}); // scored landing page
  assert.deepEqual(res.posts.map((p: any) => p.id), [1, 2], 'the repost never outranks a real tag match');
});
