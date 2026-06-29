import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePostImage, createPostRequest, quoteRequest, editPostRequest, POST_IMAGE_MAX_BYTES,
} from './PostComposer.services';

// Capture the FormData each request builds.
let lastBody: FormData;

beforeEach(() => {
  globalThis.fetch = (async (_url: any, init: any) => {
    lastBody = init.body;
    return { json: async () => ({ success: true }) } as any;
  }) as any;
});

const img = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type });

test('validatePostImage rejects an unsupported type', () => {
  const err = validatePostImage(img('a.gif', 'image/gif'));
  assert.equal(err?.title, 'Unsupported image');
});

test('validatePostImage rejects a file over the byte cap', () => {
  const err = validatePostImage(img('big.png', 'image/png', POST_IMAGE_MAX_BYTES + 1));
  assert.equal(err?.title, 'Image too large');
});

test('validatePostImage accepts a within-limit allowed type', () => {
  assert.equal(validatePostImage(img('ok.webp', 'image/webp')), null);
});

test('createPostRequest sends type/visibility + skill_tag only for a tagged ask, plus image parts', async () => {
  await createPostRequest({
    contentHtml: '<p>hi</p>', visibility: 'friends', postType: 'ask', skillTag: ' react ',
    imageFiles: [img('1.png', 'image/png'), img('2.png', 'image/png')],
  });
  assert.equal(lastBody.get('content_html'), '<p>hi</p>');
  assert.equal(lastBody.get('visibility'), 'friends');
  assert.equal(lastBody.get('type'), 'ask');
  assert.equal(lastBody.get('skill_tag'), 'react'); // trimmed
  assert.equal(lastBody.getAll('image').length, 2);
});

test('createPostRequest omits skill_tag for a non-ask post', async () => {
  await createPostRequest({ contentHtml: 'x', visibility: 'public', postType: 'status', skillTag: 'react', imageFiles: [] });
  assert.equal(lastBody.get('skill_tag'), null);
  assert.equal(lastBody.getAll('image').length, 0);
});

test('quoteRequest forces public visibility and carries repost_of', async () => {
  await quoteRequest({ contentHtml: 'nice', repostOf: 77, imageFiles: [] });
  assert.equal(lastBody.get('visibility'), 'public');
  assert.equal(lastBody.get('repost_of'), '77');
});

test('editPostRequest sends post_edit action, id, and kept_paths JSON', async () => {
  await editPostRequest({ postId: 5, contentHtml: 'edited', visibility: 'friends', keptPaths: ['/a.jpg'], imageFiles: [] });
  assert.equal(lastBody.get('action'), 'post_edit');
  assert.equal(lastBody.get('post_id'), '5');
  assert.deepEqual(JSON.parse(lastBody.get('kept_paths') as string), ['/a.jpg']);
});
