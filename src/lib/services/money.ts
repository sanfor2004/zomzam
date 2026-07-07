import { query, execute, transaction } from '@/lib/db';

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
