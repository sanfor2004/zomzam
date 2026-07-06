import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterQueueByHorizon, isDreamComplete } from './page.services';

const T = (horizon_id: number | null, status = 'pending') => ({ horizon_id, status });

test('filterQueueByHorizon returns the input unchanged when no filter', () => {
  const pending = [T(1), T(2)];
  assert.equal(filterQueueByHorizon(pending, null), pending);
});

test('filterQueueByHorizon keeps only the matching horizon, order preserved', () => {
  const a = T(5), b = T(9), c = T(5);
  assert.deepEqual(filterQueueByHorizon([a, b, c], 5), [a, c]);
});

test('filterQueueByHorizon returns empty when nothing matches', () => {
  assert.deepEqual(filterQueueByHorizon([T(1), T(2)], 99), []);
});

test('isDreamComplete is false for a null horizon', () => {
  assert.equal(isDreamComplete([T(1, 'completed')], null), false);
});

test('isDreamComplete is false when the horizon has a still-pending task', () => {
  assert.equal(isDreamComplete([T(1, 'completed'), T(1, 'pending')], 1), false);
});

test('isDreamComplete is true when every linked task is completed', () => {
  assert.equal(isDreamComplete([T(1, 'completed'), T(1, 'completed')], 1), true);
});

test('isDreamComplete is false when the horizon has no linked tasks', () => {
  assert.equal(isDreamComplete([T(2, 'completed')], 1), false);
});

test('isDreamComplete ignores in_progress as not-done', () => {
  assert.equal(isDreamComplete([T(1, 'completed'), T(1, 'in_progress')], 1), false);
});
