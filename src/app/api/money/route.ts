import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { query, queryOne, execute, transaction } from '@/lib/db';

export const POST = withAuth(async (request, user) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action || '';

  switch (action) {
    case 'get_initial_data': {
      const userSettings = await queryOne(
        `SELECT primary_currency, secondary_currency FROM users WHERE id = ? LIMIT 1`,
        [user.id]
      );

      const accounts = await query(
        `SELECT * FROM money_accounts WHERE user_id = ?`,
        [user.id]
      );

      const categories = await query(
        `SELECT * FROM money_categories WHERE user_id = ?`,
        [user.id]
      );

      const currentMonth = new Date().toISOString().substring(0, 8) + '01';
      const nextMonthDate = new Date();
      nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
      const nextMonth = nextMonthDate.toISOString().substring(0, 8) + '01';

      const totalIncomeRow = await queryOne<{ total: string }>(
        `SELECT SUM(amount) as total FROM money_transactions WHERE user_id = ? AND type = 'income' AND transaction_date >= ? AND transaction_date < ?`,
        [user.id, currentMonth, nextMonth]
      );
      const totalIncome = parseFloat(totalIncomeRow?.total || '0');

      const expenseStats = await query<{ type: string; total: string }>(
        `SELECT c.type, SUM(t.amount) as total
         FROM money_transactions t
         JOIN money_categories c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.type = 'expense' AND t.transaction_date >= ? AND t.transaction_date < ?
         GROUP BY c.type`,
        [user.id, currentMonth, nextMonth]
      );

      const expensesMap: Record<string, number> = {};
      for (const stat of expenseStats) {
        expensesMap[stat.type] = parseFloat(stat.total || '0');
      }

      const transactions = await query(
        `SELECT t.*, c.name as category_name, c.icon as category_icon, a.name as account_name
         FROM money_transactions t
         LEFT JOIN money_categories c ON t.category_id = c.id
         LEFT JOIN money_accounts a ON t.account_id = a.id
         WHERE t.user_id = ?
         ORDER BY t.transaction_date DESC, t.created_at DESC
         LIMIT 20`,
        [user.id]
      );

      const lendStats = await query<{ type: string; total: string }>(
        `SELECT type, SUM(amount) as total FROM money_lend WHERE user_id = ? AND status != 'settled' GROUP BY type`,
        [user.id]
      );

      const lendMap: Record<string, number> = {};
      for (const stat of lendStats) {
        lendMap[stat.type] = parseFloat(stat.total || '0');
      }

      const lendList = await query(
        `SELECT * FROM money_lend WHERE user_id = ? ORDER BY created_at DESC`,
        [user.id]
      );

      return NextResponse.json({
        success: true,
        user_settings: userSettings,
        accounts,
        categories,
        transactions,
        lendList,
        stats: {
          income: totalIncome,
          expenses: expensesMap,
          lend: lendMap,
        },
      });
    }

    case 'update_settings': {
      const primary = body.primary_currency || 'EGP';
      const secondary = body.secondary_currency || 'USD';

      await execute(
        `UPDATE users SET primary_currency = ?, secondary_currency = ? WHERE id = ?`,
        [primary, secondary, user.id]
      );

      return NextResponse.json({ success: true });
    }

    case 'delete_transaction': {
      const id = parseInt(body.id || 0);

      await transaction(async (connection) => {
        const [tRows] = await connection.execute<any[]>(
          `SELECT account_id, amount, type FROM money_transactions WHERE id = ? AND user_id = ? LIMIT 1`,
          [id, user.id]
        );
        const t = tRows[0];

        if (t) {
          const amount = parseFloat(t.amount);
          const balanceChange = t.type === 'income' ? -amount : amount;

          await connection.execute(
            `UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`,
            [balanceChange, t.account_id, user.id]
          );

          await connection.execute(
            `DELETE FROM money_transactions WHERE id = ? AND user_id = ?`,
            [id, user.id]
          );
        }
      });

      return NextResponse.json({ success: true });
    }

    case 'add_transaction': {
      const type = body.type; // income, expense, transfer
      const accountId = parseInt(body.account_id || 0);
      const categoryId = body.category_id ? parseInt(body.category_id) : null;
      const amount = parseFloat(body.amount || 0);
      const currency = body.currency || 'EGP';
      const description = body.description || '';
      const date = body.date || new Date().toISOString().substring(0, 10);

      if (!accountId || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid input parameters' }, { status: 400 });
      }

      let transactionId = 0;

      await transaction(async (connection) => {
        const [res] = await connection.execute<any>(
          `INSERT INTO money_transactions (user_id, account_id, category_id, type, amount, currency, description, transaction_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [user.id, accountId, categoryId, type, amount, currency, description, date]
        );
        transactionId = res.insertId;

        const balanceChange = type === 'income' ? amount : -amount;
        await connection.execute(
          `UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`,
          [balanceChange, accountId, user.id]
        );
      });

      return NextResponse.json({ success: true, id: transactionId });
    }

    case 'add_account': {
      const name = (body.name || '').trim();
      const type = body.type || 'bank';
      const currency = body.currency || 'EGP';
      const balance = parseFloat(body.balance || 0);
      const lastFour = body.last_four || null;

      if (!name) {
        return NextResponse.json({ success: false, message: 'Account name is required' }, { status: 400 });
      }

      const res = await execute(
        `INSERT INTO money_accounts (user_id, name, type, currency, balance, last_four) VALUES (?, ?, ?, ?, ?, ?)`,
        [user.id, name, type, currency, balance, lastFour]
      );

      return NextResponse.json({ success: true, accountId: res.insertId });
    }

    case 'delete_account': {
      const id = parseInt(body.id || 0);
      await execute(`DELETE FROM money_accounts WHERE id = ? AND user_id = ?`, [id, user.id]);
      return NextResponse.json({ success: true });
    }

    case 'add_lend': {
      const personName = (body.person_name || '').trim();
      const type = body.type || 'owe_me';
      const amount = parseFloat(body.amount || 0);
      const currency = body.currency || 'EGP';
      const dueDate = body.due_date || null;

      if (!personName || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid person name or amount' }, { status: 400 });
      }

      const res = await execute(
        `INSERT INTO money_lend (user_id, person_name, type, amount, currency, status, due_date) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [user.id, personName, type, amount, currency, dueDate]
      );

      return NextResponse.json({ success: true, lendId: res.insertId });
    }

    case 'settle_lend': {
      const id = parseInt(body.id || 0);
      await execute(`UPDATE money_lend SET status = 'settled' WHERE id = ? AND user_id = ?`, [id, user.id]);
      return NextResponse.json({ success: true });
    }

    case 'delete_lend': {
      const id = parseInt(body.id || 0);
      await execute(`DELETE FROM money_lend WHERE id = ? AND user_id = ?`, [id, user.id]);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  }
});
export const dynamic = 'force-dynamic';
