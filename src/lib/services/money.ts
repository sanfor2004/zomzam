import { query, queryOne, execute, transaction } from '@/lib/db';
import { EXCHANGE_RATES_TO_EGP } from '@/lib/utils';
import { HttpError } from '@/lib/http-error';

export const DEFAULT_BUCKETS = [
  { key: 'need', label: 'Needs', percent: 60 },
  { key: 'want', label: 'Wants', percent: 20 },
  { key: 'saving', label: 'Savings', percent: 20 },
] as const;

// Money suite business logic. Route handlers stay thin (parse → call → respond);
// every SQL/transaction/owner-scoping rule lives here, and the pure math helpers
// (balanceDelta, computeAllocation, safeToSpend, ratePerHour, utilization,
// daysUntilDue, monthWindow) are DB-free so they're unit-testable in isolation.

export type TxnType = 'income' | 'expense' | 'transfer';

export interface AddTransactionInput {
  account_id: number;
  category_id: number | null;
  type: TxnType;
  amount: number;
  currency: string;
  description: string;
  date: string;          // YYYY-MM-DD
  lead_id: number | null; // client attribution (income only)
  transfer_account_id?: number | null; // destination account (transfer only)
}

/** Signed change applied to money_accounts.balance for a transaction. */
export function balanceDelta(type: TxnType, amount: number): number {
  return type === 'income' ? amount : -amount;
}

export async function addTransaction(userId: number, input: AddTransactionInput): Promise<number> {
  let insertId = 0;
  const transferAccountId = input.type === 'transfer' ? (input.transfer_account_id ?? null) : null;
  await transaction(async (c) => {
    const [res] = await c.execute<any>(
      `INSERT INTO money_transactions
         (user_id, account_id, category_id, type, amount, currency, description, transaction_date, lead_id, transfer_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, input.account_id, input.category_id, input.type, input.amount,
       input.currency, input.description, input.date,
       input.type === 'income' ? input.lead_id : null,
       transferAccountId],
    );
    insertId = res.insertId;
    const [balanceRes] = await c.execute<any>(
      `UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`,
      [balanceDelta(input.type, input.amount), input.account_id, userId],
    );
    // account_id didn't belong to this user — abort so the INSERT above rolls back too.
    if (balanceRes.affectedRows === 0) {
      throw new HttpError(400, 'Invalid account');
    }
    // Transfer's credit leg: credit the destination account for the same amount.
    if (transferAccountId != null) {
      const [destRes] = await c.execute<any>(
        `UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`,
        [input.amount, transferAccountId, userId],
      );
      if (destRes.affectedRows === 0) {
        throw new HttpError(400, 'Invalid destination account');
      }
    }
  });
  return insertId;
}

export async function deleteTransaction(userId: number, id: number): Promise<void> {
  await transaction(async (c) => {
    const [rows] = await c.execute<any[]>(
      `SELECT account_id, amount, type, transfer_account_id FROM money_transactions WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId],
    );
    const t = rows[0];
    if (!t) return;
    // reverse the original delta (source leg)
    await c.execute(
      `UPDATE money_accounts SET balance = balance - ? WHERE id = ? AND user_id = ?`,
      [balanceDelta(t.type, parseFloat(t.amount)), t.account_id, userId],
    );
    // reverse the credit leg on the destination account, if any
    if (t.type === 'transfer' && t.transfer_account_id != null) {
      await c.execute(
        `UPDATE money_accounts SET balance = balance - ? WHERE id = ? AND user_id = ?`,
        [parseFloat(t.amount), t.transfer_account_id, userId],
      );
    }
    await c.execute(`DELETE FROM money_transactions WHERE id = ? AND user_id = ?`, [id, userId]);
  });
}

export async function listTransactions(userId: number, limit = 50, offset = 0) {
  // ponytail: mysql2's execute() (binary prepared-statement protocol) rejects
  // bound LIMIT/OFFSET params on this server version (ER_WRONG_ARGUMENTS).
  // Every other paginated query in this codebase already inlines the number
  // instead of binding it — match that convention. Safe: coerced to a bounded
  // non-negative integer below, never interpolated from a raw request value.
  const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 50, 1), 200);
  const safeOffset = Math.max(parseInt(String(offset), 10) || 0, 0);
  return query(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon,
            a.name AS account_name, l.name AS client_name
       FROM money_transactions t
       LEFT JOIN money_categories c ON t.category_id = c.id
       LEFT JOIN money_accounts a ON t.account_id = a.id
       LEFT JOIN crm_leads l ON t.lead_id = l.id
      WHERE t.user_id = ?
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    [userId],
  );
}

// ── 1.2: Budget allocation + safe-to-spend ───────────────────────────────────

export interface Bucket { key: string; label: string; percent: number }
export interface AllocationRow extends Bucket { limit: number; spent: number; over: boolean }

export function computeAllocation(
  income: number, buckets: Bucket[], spentByKey: Record<string, number>,
): AllocationRow[] {
  return buckets.map((b) => {
    const limit = income * (b.percent / 100);
    const spent = spentByKey[b.key] ?? 0;
    return { ...b, limit, spent, over: spent > limit };
  });
}

export function safeToSpend(
  income: number, buckets: Bucket[], spentByKey: Record<string, number>,
): number {
  const totalSpent = buckets.reduce((s, b) => s + (spentByKey[b.key] ?? 0), 0);
  return income - totalSpent;
}

export async function getBudget(userId: number): Promise<Bucket[]> {
  const row = await queryOne<{ buckets: string | Bucket[] }>(
    `SELECT buckets FROM money_budget WHERE user_id = ? LIMIT 1`, [userId],
  );
  if (!row) {
    await execute(`INSERT INTO money_budget (user_id, buckets) VALUES (?, ?)`,
      [userId, JSON.stringify(DEFAULT_BUCKETS)]);
    return [...DEFAULT_BUCKETS];
  }
  return typeof row.buckets === 'string' ? JSON.parse(row.buckets) : row.buckets;
}

export async function updateBudget(userId: number, buckets: Bucket[]): Promise<void> {
  await execute(
    `INSERT INTO money_budget (user_id, buckets) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE buckets = VALUES(buckets)`,
    [userId, JSON.stringify(buckets)],
  );
}

// ── 1.3: Client-profitability join + rate helper (the Pro core) ─────────────

export interface ClientProfit {
  leadId: number; name: string; income: number; hours: number; ratePerHour: number | null;
}

/** null when no hours logged — callers render "—", never Infinity. */
export function ratePerHour(income: number, minutes: number | null): number | null {
  if (!minutes || minutes <= 0) return null;
  return income / (minutes / 60);
}

function toDisplay(amount: number, from: string, display: string): number {
  const inEgp = amount * (EXCHANGE_RATES_TO_EGP[from] ?? 1);
  return inEgp / (EXCHANGE_RATES_TO_EGP[display] ?? 1);
}

export async function getClientProfitability(
  userId: number, displayCurrency: string,
): Promise<ClientProfit[]> {
  // income per client (converted to display currency)
  const incomeRows = await query<{ lead_id: number; name: string; amount: string; currency: string }>(
    `SELECT t.lead_id, l.name, t.amount, t.currency
       FROM money_transactions t
       JOIN crm_leads l ON t.lead_id = l.id
      WHERE t.user_id = ? AND t.type = 'income' AND t.lead_id IS NOT NULL`,
    [userId],
  );
  // minutes per client: time_tasks → crm_projects → crm_leads
  const minuteRows = await query<{ lead_id: number; minutes: string }>(
    `SELECT p.lead_id, SUM(tt.actual_duration) AS minutes
       FROM time_tasks tt
       JOIN crm_projects p ON tt.project_id = p.id
      WHERE tt.user_id = ? AND tt.status = 'completed'
            AND tt.actual_duration IS NOT NULL AND p.lead_id IS NOT NULL
      GROUP BY p.lead_id`,
    [userId],
  );

  const minutesByLead = new Map<number, number>();
  for (const r of minuteRows) minutesByLead.set(r.lead_id, parseFloat(r.minutes || '0'));

  const acc = new Map<number, ClientProfit>();
  for (const r of incomeRows) {
    const cur = acc.get(r.lead_id) ?? { leadId: r.lead_id, name: r.name, income: 0, hours: 0, ratePerHour: null };
    cur.income += toDisplay(parseFloat(r.amount), r.currency, displayCurrency);
    acc.set(r.lead_id, cur);
  }
  for (const c of acc.values()) {
    const minutes = minutesByLead.get(c.leadId) ?? 0;
    c.hours = minutes / 60;
    c.ratePerHour = ratePerHour(c.income, minutes);
  }
  return [...acc.values()].sort((a, b) => (b.ratePerHour ?? -1) - (a.ratePerHour ?? -1));
}

// ── 1.4: Accounts service (+ card cycle derivations) ─────────────────────────

export function utilization(balance: number, limit: number | null): number | null {
  if (!limit || limit <= 0) return null;
  return Math.round((Math.abs(balance) / limit) * 100) / 100;
}

export function daysUntilDue(dueDay: number | null, today = new Date()): number | null {
  if (!dueDay) return null;
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  let due = new Date(y, m, dueDay);
  if (dueDay < d) due = new Date(y, m + 1, dueDay);
  return Math.round((due.getTime() - new Date(y, m, d).getTime()) / 86400000);
}

export interface CreateAccountInput {
  name: string; type: string; currency: string; balance: number;
  last_four: string | null; credit_limit: number | null;
  statement_day: number | null; due_day: number | null;
}
export async function listAccounts(userId: number) {
  return query(`SELECT * FROM money_accounts WHERE user_id = ?`, [userId]);
}
export async function createAccount(userId: number, i: CreateAccountInput): Promise<number> {
  const res = await execute(
    `INSERT INTO money_accounts
       (user_id, name, type, currency, balance, last_four, credit_limit, statement_day, due_day)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, i.name, i.type, i.currency, i.balance, i.last_four,
     i.credit_limit, i.statement_day, i.due_day],
  );
  return res.insertId;
}
export async function deleteAccount(userId: number, id: number): Promise<void> {
  await execute(`DELETE FROM money_accounts WHERE id = ? AND user_id = ?`, [id, userId]);
}

// ── 1.5: Lend + settings service ─────────────────────────────────────────────

export interface AddLendInput {
  person_name: string; type: 'owe_me' | 'i_owe'; amount: number; currency: string; due_date: string | null;
}
export async function listLend(userId: number) {
  return query(`SELECT * FROM money_lend WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
}
export async function addLend(userId: number, i: AddLendInput): Promise<number> {
  const res = await execute(
    `INSERT INTO money_lend (user_id, person_name, type, amount, currency, status, due_date)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [userId, i.person_name, i.type, i.amount, i.currency, i.due_date],
  );
  return res.insertId;
}
export async function settleLend(userId: number, id: number): Promise<void> {
  await execute(`UPDATE money_lend SET status = 'settled' WHERE id = ? AND user_id = ?`, [id, userId]);
}
export async function deleteLend(userId: number, id: number): Promise<void> {
  await execute(`DELETE FROM money_lend WHERE id = ? AND user_id = ?`, [id, userId]);
}
export async function getMoneySettings(userId: number) {
  return queryOne(`SELECT primary_currency, secondary_currency FROM users WHERE id = ? LIMIT 1`, [userId]);
}
export async function updateSettings(userId: number, primary: string, secondary: string): Promise<void> {
  await execute(`UPDATE users SET primary_currency = ?, secondary_currency = ? WHERE id = ?`,
    [primary, secondary, userId]);
}

// ── 1.6: Category + monthly aggregation helpers ──────────────────────────────

export async function listCategories(userId: number) {
  return query(`SELECT * FROM money_categories WHERE user_id = ?`, [userId]);
}
export function monthWindow(now = new Date()): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const iso = (d: Date) => d.toISOString().substring(0, 10);
  return { start: iso(start), end: iso(end) };
}
export async function monthlyIncome(userId: number, start: string, end: string): Promise<number> {
  const row = await queryOne<{ total: string }>(
    `SELECT SUM(amount) AS total FROM money_transactions
      WHERE user_id = ? AND type = 'income' AND transaction_date >= ? AND transaction_date < ?`,
    [userId, start, end],
  );
  return parseFloat(row?.total || '0');
}
export async function monthlySpendByBucket(userId: number, start: string, end: string): Promise<Record<string, number>> {
  const rows = await query<{ type: string; total: string }>(
    `SELECT c.type, SUM(t.amount) AS total
       FROM money_transactions t JOIN money_categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = 'expense' AND t.transaction_date >= ? AND t.transaction_date < ?
      GROUP BY c.type`,
    [userId, start, end],
  );
  const map: Record<string, number> = {};
  for (const r of rows) map[r.type] = parseFloat(r.total || '0');
  return map;
}
