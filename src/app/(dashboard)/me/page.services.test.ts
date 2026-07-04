import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAvatarFile, fetchProfile, saveProfileRequest, uploadAvatarRequest, AVATAR_MAX_BYTES,
} from './page.services';

let lastBody: any;
let payload: any;

beforeEach(() => {
  lastBody = undefined;
  payload = { success: true };
  globalThis.fetch = (async (_url: any, init: any) => {
    lastBody = init?.body;
    return { json: async () => payload } as any;
  }) as any;
});

const file = (type: string, size = 10) => new File([new Uint8Array(size)], 'a', { type });

test('validateAvatarFile rejects oversize + bad type, accepts a good file', () => {
  assert.match(validateAvatarFile(file('image/png', AVATAR_MAX_BYTES + 1))!, /2MB/);
  assert.match(validateAvatarFile(file('image/svg+xml'))!, /JPEG/);
  assert.equal(validateAvatarFile(file('image/webp')), null);
});

test('fetchProfile normalizes fields and parses a JSON tags string', async () => {
  payload = { success: true, authenticated: true, user: { username: 'a', email: 'a@b', tags: '["x","y"]' } };
  const u = await fetchProfile();
  assert.equal(u?.username, 'a');
  assert.equal(u?.first_name, ''); // missing → default
  assert.deepEqual(u?.tags, ['x', 'y']);
});

test('fetchProfile returns null when not authenticated (page redirects)', async () => {
  payload = { success: true, authenticated: false };
  assert.equal(await fetchProfile(), null);
});

test('fetchProfile tolerates a malformed tags column', async () => {
  payload = { success: true, authenticated: true, user: { username: 'a', tags: '{not json' } };
  assert.deepEqual((await fetchProfile())?.tags, []);
});

test('saveProfileRequest posts the username, identity fields + tags JSON', async () => {
  await saveProfileRequest({ username: 'neo', firstName: 'F', lastName: 'L', bio: 'hi', tags: ['react'] });
  assert.equal(lastBody.get('username'), 'neo');
  assert.equal(lastBody.get('first_name'), 'F');
  assert.equal(lastBody.get('bio'), 'hi');
  assert.deepEqual(JSON.parse(lastBody.get('tags') as string), ['react']);
});

test('uploadAvatarRequest returns the new avatar url on success', async () => {
  payload = { success: true, user: { avatar: '/up/x.webp' } };
  const r = await uploadAvatarRequest(file('image/png'));
  assert.equal(r.success, true);
  assert.equal(r.avatar, '/up/x.webp');
});
