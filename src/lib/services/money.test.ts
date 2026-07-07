import assert from 'node:assert';
import { balanceDelta, computeAllocation, safeToSpend, ratePerHour } from './money';

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

check('allocation splits by percent and flags overspend', () => {
  const rows = computeAllocation(10000, [
    { key: 'need', label: 'Needs', percent: 60 },
    { key: 'want', label: 'Wants', percent: 20 },
    { key: 'saving', label: 'Savings', percent: 20 },
  ], { need: 3000, want: 2500, saving: 0 });
  const want = rows.find(r => r.key === 'want')!;
  assert.strictEqual(want.limit, 2000);
  assert.strictEqual(want.spent, 2500);
  assert.strictEqual(want.over, true);
});

check('safeToSpend = income minus total spent', () => {
  assert.strictEqual(
    safeToSpend(10000, [{ key: 'need', label: 'Needs', percent: 60 }], { need: 3000 }),
    7000,
  );
});

check('rate = income / hours', () => {
  assert.strictEqual(ratePerHour(3000, 600), 300); // 600 min = 10h → 300/h
});
check('zero hours yields null, never Infinity', () => {
  assert.strictEqual(ratePerHour(3000, 0), null);
  assert.strictEqual(ratePerHour(3000, null as any), null);
});

console.log(`money.test.ts: all ${checks} checks passed`);
