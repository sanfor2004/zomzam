import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeNotification, notifTimeAgo, NOTIF_FALLBACK_AVATAR } from '@/lib/notifications';

// ── describeNotification: wording, batching, and deep-link routing ───────────

test('reposted notification deep-links to the opaque public_id, not the numeric id', () => {
  const v = describeNotification({ id: 1, type: 'reposted', data: { from_username: 'alice', post_id: 9, public_id: 'abc123def456abc123def456abc12345' } });
  assert.equal(v.text, 'alice reposted your post');
  assert.equal(v.href, '/p/abc123def456abc123def456abc12345');
  assert.equal(v.emoji, '🔁');
});

test('a post notification with no public_id (legacy row) does not deep-link to a numeric id', () => {
  const v = describeNotification({ id: 1, type: 'reposted', data: { from_username: 'alice', post_id: 9 } });
  assert.equal(v.href, null);
});

test('batched roster reads "X and N others" from actor_count', () => {
  const v = describeNotification({
    id: 1,
    type: 'reposted',
    data: { actors: [{ username: 'zoe' }], actor_count: 4, post_id: 9 },
  });
  assert.equal(v.text, 'zoe and 3 others reposted your post');
});

test('a roster of exactly two reads "and 1 other" (singular)', () => {
  const v = describeNotification({
    id: 1,
    type: 'new_follower',
    data: { actors: [{ username: 'zoe' }], actor_count: 2 },
  });
  assert.equal(v.text, 'zoe and 1 other started following you');
});

test('new_follower deep-links to the lead actor profile', () => {
  const v = describeNotification({ id: 1, type: 'new_follower', data: { from_username: 'bob' } });
  assert.equal(v.href, '/u/bob');
  assert.equal(v.text, 'bob started following you');
});

test('the lead actor in a roster is the avatar + profile, not the stale top-level field', () => {
  const v = describeNotification({
    id: 1,
    type: 'new_follower',
    data: {
      actors: [{ username: 'newest', avatar: '/new.png' }],
      actor_count: 3,
      from_username: 'stale',
      from_avatar: '/stale.png',
    },
  });
  assert.equal(v.avatar, '/new.png');
  assert.equal(v.href, '/u/newest');
});

test('new_help_request shows the skill tag and links to the post via public_id', () => {
  const v = describeNotification({ id: 1, type: 'new_help_request', data: { by_user: 'cy', skill_tag: 'react', post_id: 3, public_id: 'f'.repeat(32) } });
  assert.equal(v.text, 'cy needs help with #react');
  assert.equal(v.href, `/p/${'f'.repeat(32)}`);
});

test('unknown type falls back to the stored message; a "message" routes to the inbox', () => {
  const v = describeNotification({ id: 1, type: 'mystery', data: { from_username: 'dee', message: 'sent you a message' } });
  assert.equal(v.text, 'dee sent you a message');
  assert.equal(v.href, '/messages');
});

test('missing actor data degrades to "Someone" and the fallback avatar', () => {
  const v = describeNotification({ id: 1, type: 'reposted', data: {} });
  assert.match(v.text, /^Someone /);
  assert.equal(v.avatar, NOTIF_FALLBACK_AVATAR);
  assert.equal(v.href, null); // no post_id ⇒ no destination
});

// ── notifTimeAgo: compact relative time ──────────────────────────────────────

test('notifTimeAgo buckets seconds/minutes/hours/days/weeks', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  assert.equal(notifTimeAgo(ago(10 * 1000)), 'now');
  assert.equal(notifTimeAgo(ago(5 * 60 * 1000)), '5m');
  assert.equal(notifTimeAgo(ago(3 * 3600 * 1000)), '3h');
  assert.equal(notifTimeAgo(ago(2 * 86400 * 1000)), '2d');
  assert.equal(notifTimeAgo(ago(21 * 86400 * 1000)), '3w');
  assert.equal(notifTimeAgo(null), '');
  assert.equal(notifTimeAgo('not-a-date'), '');
});
