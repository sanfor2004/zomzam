import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { deletePostRequest, likePostRequest, bookmarkPostRequest, repostRequest } from './PostCard.services';

// Capture each request's parsed body + return a stubbed payload.
let bodies: any[] = [];
let payload: any = { success: true };

beforeEach(() => {
  bodies = [];
  payload = { success: true };
  globalThis.fetch = (async (_url: any, init: any) => {
    bodies.push(JSON.parse(init.body));
    return { json: async () => payload } as any;
  }) as any;
});

test('deletePostRequest sends the delete action and resolves on success', async () => {
  await deletePostRequest(11);
  assert.deepEqual(bodies[0], { action: 'delete', post_id: 11 });
});

test('deletePostRequest throws on an unsuccessful payload (confirm stays armed)', async () => {
  payload = { success: false, message: 'nope' };
  await assert.rejects(() => deletePostRequest(11), /nope/);
});

test('likePostRequest posts the like action', async () => {
  await likePostRequest(7);
  assert.deepEqual(bodies[0], { action: 'like', post_id: 7 });
});

test('bookmarkPostRequest posts the bookmark action', async () => {
  await bookmarkPostRequest(7);
  assert.deepEqual(bodies[0], { action: 'bookmark', post_id: 7 });
});

test('repostRequest targets the collapsed root id and reports server acceptance', async () => {
  payload = { success: true };
  assert.equal(await repostRequest(99), true);
  assert.deepEqual(bodies[0], { action: 'repost', post_id: 99 });
});

test('repostRequest reports rejection so the card rolls back', async () => {
  payload = { success: false };
  assert.equal(await repostRequest(99), false);
});
