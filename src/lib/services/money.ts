import { query, queryOne, execute, transaction } from '@/lib/db';
import { EXCHANGE_RATES_TO_EGP } from '@/lib/utils';

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
}

/** Signed change applied to money_accounts.balance for a transaction. */
export function balanceDelta(type: TxnType, amount: number): number {
  return type === 'income' ? amount : -amount;
}

export async function addTransaction(userId: number, input: AddTransactionInput): Promise<number> {
  let insertId = 0;
  await transaction(async (c) => {
    const [res] = await c.execute<any>(
      `INSERT INTO money_transactions
         (user_id, account_id, category_id, type, amount, currency, description, transaction_date, lead_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, input.account_id, input.category_id, input.type, input.amount,
       input.currency, input.description, input.date,
       input.type === 'income' ? input.lead_id : null],
    );
    insertId = res.insertId;
    await c.execute(
      `UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`,
      [balanceDelta(input.type, input.amount), input.account_id, userId],
    );
  });
  return insertId;
}

export async function deleteTransaction(userId: number, id: number): Promise<void> {
  await transaction(async (c) => {
    const [rows] = await c.execute<any[]>(
      `SELECT account_id, amount, type FROM money_transactions WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId],
    );
    const t = rows[0];
    if (!t) return;
    // reverse the original delta
    await c.execute(
      `UPDATE money_accounts SET balance = balance - ? WHERE id = ? AND user_id = ?`,
      [balanceDelta(t.type, parseFloat(t.amount)), t.account_id, userId],
    );
    await c.execute(`DELETE FROM money_transactions WHERE id = ? AND user_id = ?`, [id, userId]);
  });
}

export async function listTransactions(userId: number, limit = 50, offset = 0) {
  return query(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon,
            a.name AS account_name, l.name AS client_name
       FROM money_transactions t
       LEFT JOIN money_categories c ON t.category_id = c.id
       LEFT JOIN money_accounts a ON t.account_id = a.id
       LEFT JOIN crm_leads l ON t.lead_id = l.id
      WHERE t.user_id = ?
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, limit, offset],
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
