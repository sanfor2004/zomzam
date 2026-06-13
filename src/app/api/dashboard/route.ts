import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

const EXCHANGE_RATES: Record<string, number> = {
  USD: 48.5,
  EUR: 52.0,
  GBP: 61.0,
  EGP: 1.0,
};

function convertToPrimary(amount: number, fromCurrency: string, primaryCurrency: string): number {
  if (fromCurrency === primaryCurrency) return amount;
  const rateFrom = EXCHANGE_RATES[fromCurrency] || 1.0;
  const amountEGP = amount * rateFrom;
  const rateTo = EXCHANGE_RATES[primaryCurrency] || 1.0;
  return amountEGP / rateTo;
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = session ? verifyToken(session) : null;

  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch User Settings
    const userRow = await queryOne(
      `SELECT username, email, role, avatar, bio, primary_currency, secondary_currency FROM users WHERE id = ? LIMIT 1`,
      [user.id]
    );

    if (!userRow) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const primaryCurrency = userRow.primary_currency || 'EGP';

    // 2. Fetch Time Tasks Metrics
    const completedTasksRow = await queryOne<{ count: number; total_mins: string }>(
      `SELECT COUNT(*) as count, SUM(COALESCE(actual_duration, duration_block)) as total_mins 
       FROM time_tasks 
       WHERE user_id = ? AND status = 'completed'`,
      [user.id]
    );
    const completedTasksCount = completedTasksRow?.count || 0;
    const completedMinutes = parseFloat(completedTasksRow?.total_mins || '0');
    const completedHours = completedMinutes / 60.0;

    const pendingTasksRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM time_tasks WHERE user_id = ? AND status = 'pending'`,
      [user.id]
    );
    const pendingTasksCount = pendingTasksRow?.count || 0;

    const inProgressTasksRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM time_tasks WHERE user_id = ? AND status = 'in_progress'`,
      [user.id]
    );
    const inProgressTasksCount = inProgressTasksRow?.count || 0;

    // Recent time tasks
    const recentTasks = await query(
      `SELECT * FROM time_tasks 
       WHERE user_id = ? AND status != 'deleted' 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [user.id]
    );
    // Fetch completed tasks' details for the heatmap (past 12 weeks)
    const completedTasks = await query(
      `SELECT id, title, duration_block, actual_duration, completed_at FROM time_tasks 
       WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
       AND completed_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)`,
      [user.id]
    );

    // 3. Fetch Money Transactions & Accounts Metrics
    const accounts = await query(
      `SELECT name, balance, currency, type FROM money_accounts WHERE user_id = ?`,
      [user.id]
    );

    const transactions = await query(
      `SELECT type, amount, currency FROM money_transactions WHERE user_id = ?`,
      [user.id]
    );

    // Calculate income and expenses by currency
    const totalIncomeByCurrency: Record<string, number> = {};
    const totalExpenseByCurrency: Record<string, number> = {};
    let totalIncomePrimary = 0;
    let totalExpensePrimary = 0;

    transactions.forEach((tx: any) => {
      const amount = parseFloat(tx.amount || '0');
      const currency = tx.currency || 'EGP';
      if (tx.type === 'income') {
        totalIncomeByCurrency[currency] = (totalIncomeByCurrency[currency] || 0) + amount;
        totalIncomePrimary += convertToPrimary(amount, currency, primaryCurrency);
      } else if (tx.type === 'expense') {
        totalExpenseByCurrency[currency] = (totalExpenseByCurrency[currency] || 0) + amount;
        totalExpensePrimary += convertToPrimary(amount, currency, primaryCurrency);
      }
    });

    // Net balance in primary currency
    let netBalancePrimary = 0;
    accounts.forEach((acc: any) => {
      const balance = parseFloat(acc.balance || '0');
      const currency = acc.currency || 'EGP';
      netBalancePrimary += convertToPrimary(balance, currency, primaryCurrency);
    });

    // 4. Fetch CRM Leads
    const totalLeads = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ?`,
      [user.id]
    );
    const totalLeadsCount = totalLeads?.count || 0;

    const leadsByStatus = await query(
      `SELECT status, COUNT(*) as count FROM crm_leads WHERE user_id = ? GROUP BY status`,
      [user.id]
    );
    const leadsStatusMap: Record<string, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      lost: 0
    };
    leadsByStatus.forEach((item: any) => {
      if (item.status in leadsStatusMap) {
        leadsStatusMap[item.status] = item.count;
      }
    });

    // 5. Fetch CRM Projects
    const projects = await query(
      `SELECT amount, currency, status FROM crm_projects WHERE user_id = ?`,
      [user.id]
    );

    let totalProjectRevenuePrimary = 0;
    let deliveredProjectRevenuePrimary = 0;
    let activeProjectsCount = 0;
    let deliveredProjectsCount = 0;

    projects.forEach((proj: any) => {
      const amount = parseFloat(proj.amount || '0');
      const currency = proj.currency || 'EGP';
      const status = proj.status;

      totalProjectRevenuePrimary += convertToPrimary(amount, currency, primaryCurrency);

      if (status === 'delivered') {
        deliveredProjectRevenuePrimary += convertToPrimary(amount, currency, primaryCurrency);
        deliveredProjectsCount++;
      } else {
        activeProjectsCount++;
      }
    });

    // 6. Calculate Freelancer Hourly Rates
    // Rate A: Effective Hourly Rate based on transaction income
    const hourlyRateIncome = completedHours > 0 ? (totalIncomePrimary / completedHours) : 0;

    // Rate B: Projected Hourly Rate based on completed/delivered project amounts
    const hourlyRateProjects = completedHours > 0 ? (deliveredProjectRevenuePrimary / completedHours) : 0;

    // Rate C: Global rate = (Total Income + Delivered Project Revenue) / hours? No, usually transactions represent the actual received income,
    // whereas projects represent contract value. Let's send both clearly.

    return NextResponse.json({
      success: true,
      profile: {
        username: userRow.username,
        email: userRow.email,
        role: userRow.role,
        avatar: userRow.avatar,
        bio: userRow.bio,
        primary_currency: primaryCurrency,
        secondary_currency: userRow.secondary_currency || 'USD',
      },
      time: {
        completedTasksCount,
        pendingTasksCount,
        inProgressTasksCount,
        completedHours: parseFloat(completedHours.toFixed(2)),
        completedMinutes: Math.round(completedMinutes),
        recentTasks,
        completedTasks,
      },
      money: {
        netBalancePrimary: parseFloat(netBalancePrimary.toFixed(2)),
        totalIncomePrimary: parseFloat(totalIncomePrimary.toFixed(2)),
        totalExpensePrimary: parseFloat(totalExpensePrimary.toFixed(2)),
        totalIncomeByCurrency,
        totalExpenseByCurrency,
        accounts,
      },
      crm: {
        totalLeadsCount,
        leadsStatusMap,
        activeProjectsCount,
        deliveredProjectsCount,
        totalProjectRevenuePrimary: parseFloat(totalProjectRevenuePrimary.toFixed(2)),
        deliveredProjectRevenuePrimary: parseFloat(deliveredProjectRevenuePrimary.toFixed(2)),
      },
      rates: {
        hourlyRateIncome: parseFloat(hourlyRateIncome.toFixed(2)),
        hourlyRateProjects: parseFloat(hourlyRateProjects.toFixed(2)),
        exchangeRates: EXCHANGE_RATES,
      }
    });

  } catch (error: any) {
    console.error('Dashboard data fetch error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
