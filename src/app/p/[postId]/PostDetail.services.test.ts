import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptAnswerRequest, resolveAskRequest, reopenAskRequest, repostRequest, commentRequest,
} from './PostDetail.services';

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

test('acceptAnswerRequest sends post + comment ids and returns the server resolvedAt', async () => {
  payload = { success: true, resolvedAt: '2026-06-29T00:00:00Z' };
  const r = await acceptAnswerRequest(3, 9);
  assert.deepEqual(bodies[0], { action: 'accept_answer', post_id: 3, comment_id: 9 });
  assert.equal(r.success, true);
  assert.equal(r.resolvedAt, '2026-06-29T00:00:00Z');
});

test('resolveAskRequest posts the resolve action', async () => {
  await resolveAskRequest(3);
  assert.deepEqual(bodies[0], { action: 'resolve_ask', post_id: 3 });
});

test('reopenAskRequest reports a boolean', async () => {
  payload = { success: false };
  assert.equal(await reopenAskRequest(3), false);
});

test('repostRequest reports server acceptance for rollback', async () => {
  payload = { success: false };
  assert.equal(await repostRequest(3), false);
});

test('commentRequest defaults parent_id to null and returns the created comment', async () => {
  payload = { success: true, comment: { id: 50 } };
  const c = await commentRequest(3, 'hello');
  assert.equal(bodies[0].parent_id, null);
  assert.equal(bodies[0].content, 'hello');
  assert.deepEqual(c, { id: 50 });
});

test('commentRequest passes a parent id for replies and returns null on rejection', async () => {
  payload = { success: false };
  const c = await commentRequest(3, 'reply', 7);
  assert.equal(bodies[0].parent_id, 7);
  assert.equal(c, null);
});
