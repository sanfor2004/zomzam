import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// The module gates on JWT_SECRET at load — provide a strong one before import.
process.env.JWT_SECRET = 'unit-test-secret-0123456789abcdef-0123456789abcdef';

let session: typeof import('@/lib/session');
before(async () => { session = await import('@/lib/session'); });

const b64urlDecode = (seg: string) => Buffer.from(seg, 'base64url').toString('utf8');

test('signSession → verifySession round-trips id and tokenVersion', async () => {
  const token = await session.signSession(42, 3);
  const verified = await session.verifySession(token);
  assert.deepEqual(verified, { id: 42, tokenVersion: 3 });
});

test('token is an opaque 5-segment JWE — no claim readable outside the header', async () => {
  const token = await session.signSession(42, 3);
  const segments = token.split('.');
  assert.equal(segments.length, 5, 'JWE compact serialization has 5 segments');

  const header = JSON.parse(b64urlDecode(segments[0]));
  assert.equal(header.alg, 'dir');
  assert.equal(header.enc, 'A256GCM');

  // Every post-header segment is ciphertext/IV/tag — no plaintext claims leak.
  for (const seg of segments.slice(1)) {
    const decoded = b64urlDecode(seg);
    assert.ok(!decoded.includes('"tv"'), 'token version not readable');
    assert.ok(!decoded.includes('"sub"'), 'subject not readable');
  }
});

test('tampered token is rejected', async () => {
  const token = await session.signSession(42, 3);
  const segments = token.split('.');
  // Flip a character in the ciphertext segment.
  const cipher = segments[3];
  segments[3] = (cipher[0] === 'A' ? 'B' : 'A') + cipher.slice(1);
  assert.equal(await session.verifySession(segments.join('.')), null);
});

test('missing and garbage tokens are rejected without throwing', async () => {
  assert.equal(await session.verifySession(undefined), null);
  assert.equal(await session.verifySession(''), null);
  assert.equal(await session.verifySession('garbage'), null);
  assert.equal(await session.verifySession('a.b.c.d.e'), null);
});
