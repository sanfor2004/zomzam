import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFeedPage, fetchUnseenPosts } from './page.services';

// Capture the URL each call builds + return a stubbed payload.
let calls: string[] = [];
let payload: any = { success: true, posts: [] };

beforeEach(() => {
  calls = [];
  payload = { success: true, posts: [] };
  globalThis.fetch = (async (url: any) => {
    calls.push(String(url));
    return { json: async () => payload } as any;
  }) as any;
});

test('fetchFeedPage omits cursor on the first page and filter when "all"', async () => {
  payload = { success: true, posts: [{ id: 1 }], next_cursor: 5, has_more: true };
  const page = await fetchFeedPage({ tier: 'unseen', cursor: null, filter: 'all' });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('action=feed'));
  assert.ok(calls[0].includes('tier=unseen'));
  assert.ok(!calls[0].includes('cursor='), 'no cursor on first page');
  assert.ok(!calls[0].includes('filter='), 'no filter when all');
  assert.deepEqual(page, { posts: [{ id: 1 }], next_cursor: 5, has_more: true });
});

test('fetchFeedPage includes cursor + filter when paginating a narrowed feed', async () => {
  await fetchFeedPage({ tier: 'seen', cursor: 42, filter: 'help' });
  assert.ok(calls[0].includes('cursor=42'));
  assert.ok(calls[0].includes('filter=help'));
  assert.ok(calls[0].includes('tier=seen'));
});

test('fetchFeedPage normalizes a missing next_cursor/has_more', async () => {
  payload = { success: true, posts: [] }; // server omitted the fields
  const page = await fetchFeedPage({ tier: 'unseen', cursor: null, filter: 'all' });
  assert.equal(page.next_cursor, null);
  assert.equal(page.has_more, false);
});

test('fetchFeedPage throws on an unsuccessful payload (caller keeps its cursor)', async () => {
  payload = { success: false };
  await assert.rejects(() => fetchFeedPage({ tier: 'unseen', cursor: null, filter: 'all' }));
});

test('fetchUnseenPosts always queries the unseen tier and returns the posts', async () => {
  payload = { success: true, posts: [{ id: 7 }] };
  const posts = await fetchUnseenPosts('all');
  assert.ok(calls[0].includes('tier=unseen'));
  assert.deepEqual(posts, [{ id: 7 }]);
});
