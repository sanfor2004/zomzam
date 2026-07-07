import assert from 'node:assert';
import { balanceDelta } from './money';

let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks++; };

check('income increases balance', () => {
  assert.strictEqual(balanceDelta('income', 100), 100);
});
check('expense decreases balance', () => {
  assert.strictEqual(balanceDelta('expense', 100), -100);
});
check('transfer decreases source balance', () => {
  assert.strictEqual(balanceDelta('transfer', 100), -100);
});

console.log(`money.test.ts: all ${checks} checks passed`);
