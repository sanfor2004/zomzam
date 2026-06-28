import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalEmail } from '@/lib/email';

test('lowercases and trims', () => {
  assert.equal(canonicalEmail('  John.Doe@Example.COM '), 'john.doe@example.com');
});

test('Gmail: dots in the local part are ignored (same inbox)', () => {
  assert.equal(canonicalEmail('2004.sanfor@gmail.com'), '2004sanfor@gmail.com');
  assert.equal(canonicalEmail('2004sanfor@gmail.com'), '2004sanfor@gmail.com');
});

test('Gmail: +tag sub-addressing folds to the base inbox', () => {
  assert.equal(canonicalEmail('2004.sanfor+newsletter@gmail.com'), '2004sanfor@gmail.com');
});

test('Gmail: googlemail.com folds to gmail.com', () => {
  assert.equal(canonicalEmail('a.b@googlemail.com'), 'ab@gmail.com');
});

test('the three forms the user hit all collapse to ONE identity', () => {
  const a = canonicalEmail('2004.sanfor@gmail.com');     // registered
  const b = canonicalEmail('2004sanfor@gmail.com');      // what Google may return
  const c = canonicalEmail('2004.Sanfor+x@GMAIL.com');   // yet another form
  assert.equal(a, b);
  assert.equal(b, c);
});

test('non-Gmail: dots are SIGNIFICANT and kept', () => {
  assert.equal(canonicalEmail('john.doe@outlook.com'), 'john.doe@outlook.com');
  assert.notEqual(canonicalEmail('john.doe@outlook.com'), canonicalEmail('johndoe@outlook.com'));
});

test('non-Gmail: +tag is still folded (common sub-addressing convention)', () => {
  assert.equal(canonicalEmail('john+promo@outlook.com'), 'john@outlook.com');
});

test('degrades gracefully on a non-address input', () => {
  assert.equal(canonicalEmail('not-an-email'), 'not-an-email');
  assert.equal(canonicalEmail(''), '');
});
