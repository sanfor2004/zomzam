import assert from 'node:assert';
import { balanceDelta, computeAllocation, safeToSpend, ratePerHour } from './money';
import { utilization, daysUntilDue } from './money-math';

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

check('utilization = |balance| / limit', () => {
  assert.strictEqual(utilization(12400, 40000), 0.31);
});
check('utilization null when no limit', () => {
  assert.strictEqual(utilization(12400, null), null);
});
check('daysUntilDue counts within the current month', () => {
  // today = 8th, due_day = 11 → 3 days
  assert.strictEqual(daysUntilDue(11, new Date('2026-07-08')), 3);
});
check('daysUntilDue rolls to next month when due day already passed', () => {
  // today = 11th, due_day = 8 → next occurrence is Aug 8 → 28 days
  assert.strictEqual(daysUntilDue(8, new Date('2026-07-11')), 28);
});
check('daysUntilDue null when no due day set', () => {
  assert.strictEqual(daysUntilDue(null, new Date('2026-07-11')), null);
});

console.log(`money.test.ts: all ${checks} checks passed`);
