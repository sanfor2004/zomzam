import { query, queryOne } from '@/lib/db';
import { HttpError } from '@/lib/http-error';
import { EXCHANGE_RATES_TO_EGP } from '@/lib/utils';

// Dashboard aggregation: one read-only rollup across the Time, Money and CRM
// suites, normalized to the user's primary currency. Route stays thin; this owns
// the cross-suite reads and the blended hourly-rate math.

function convertToPrimary(amount: number, fromCurrency: string, primaryCurrency: string): number {
  if (fromCurrency === primaryCurrency) return amount;
  const amountEGP = amount * (EXCHANGE_RATES_TO_EGP[fromCurrency] || 1.0);
  return amountEGP / (EXCHANGE_RATES_TO_EGP[primaryCurrency] || 1.0);
}

export async function getDashboardSummary(userId: number) {
  // 1. User settings (drives the primary currency every total normalizes to).
  const userRow = await queryOne(
    `SELECT username, email, role, avatar, bio, primary_currency, secondary_currency FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (!userRow) {
    throw new HttpError(404, 'User not found');
  }
  const primaryCurrency = userRow.primary_currency || 'EGP';

  // 2. Time task metrics.
  const completedTasksRow = await queryOne<{ count: number; total_mins: string }>(
    `SELECT COUNT(*) as count, SUM(COALESCE(actual_duration, duration_block)) as total_mins
     FROM time_tasks
     WHERE user_id = ? AND status = 'completed'`,
    [userId]
  );
  const completedTasksCount = completedTasksRow?.count || 0;
  const completedMinutes = parseFloat(completedTasksRow?.total_mins || '0');
  const completedHours = completedMinutes / 60.0;

  const pendingTasksRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM time_tasks WHERE user_id = ? AND status = 'pending'`,
    [userId]
  );
  const pendingTasksCount = pendingTasksRow?.count || 0;

  const inProgressTasksRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM time_tasks WHERE user_id = ? AND status = 'in_progress'`,
    [userId]
  );
  const inProgressTasksCount = inProgressTasksRow?.count || 0;

  const recentTasks = await query(
    `SELECT * FROM time_tasks
     WHERE user_id = ? AND status != 'deleted'
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId]
  );
  const completedTasks = await query(
    `SELECT id, title, duration_block, actual_duration, completed_at FROM time_tasks
     WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
     AND completed_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)`,
    [userId]
  );

  // 3. Money transaction & account metrics.
  const accounts = await query(
    `SELECT name, balance, currency, type FROM money_accounts WHERE user_id = ?`,
    [userId]
  );
  const transactions = await query(
    `SELECT type, amount, currency FROM money_transactions WHERE user_id = ?`,
    [userId]
  );

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

  let netBalancePrimary = 0;
  accounts.forEach((acc: any) => {
    const balance = parseFloat(acc.balance || '0');
    const currency = acc.currency || 'EGP';
    netBalancePrimary += convertToPrimary(balance, currency, primaryCurrency);
  });

  // 4. CRM leads.
  const totalLeads = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ?`,
    [userId]
  );
  const totalLeadsCount = totalLeads?.count || 0;

  const leadsByStatus = await query(
    `SELECT status, COUNT(*) as count FROM crm_leads WHERE user_id = ? GROUP BY status`,
    [userId]
  );
  const leadsStatusMap: Record<string, number> = { new: 0, contacted: 0, qualified: 0, lost: 0 };
  leadsByStatus.forEach((item: any) => {
    if (item.status in leadsStatusMap) {
      leadsStatusMap[item.status] = item.count;
    }
  });

  // 5. CRM projects.
  const projects = await query(
    `SELECT amount, currency, status FROM crm_projects WHERE user_id = ?`,
    [userId]
  );
  let totalProjectRevenuePrimary = 0;
  let deliveredProjectRevenuePrimary = 0;
  let activeProjectsCount = 0;
  let deliveredProjectsCount = 0;
  projects.forEach((proj: any) => {
    const amount = parseFloat(proj.amount || '0');
    const currency = proj.currency || 'EGP';
    totalProjectRevenuePrimary += convertToPrimary(amount, currency, primaryCurrency);
    if (proj.status === 'delivered') {
      deliveredProjectRevenuePrimary += convertToPrimary(amount, currency, primaryCurrency);
      deliveredProjectsCount++;
    } else {
      activeProjectsCount++;
    }
  });

  // 6. Blended freelancer hourly rates (computed from unrounded primaries).
  const hourlyRateIncome = completedHours > 0 ? totalIncomePrimary / completedHours : 0;
  const hourlyRateProjects = completedHours > 0 ? deliveredProjectRevenuePrimary / completedHours : 0;

  // 7. Per-client realized hourly rate. Re-slices the blended income rate by the
  //    CRM client/deal each income row + tracked task is attributed to, so the
  //    freelancer can rank clients by what they actually pay per hour worked.
  //    Pure read-only analytics over existing data — Zomzam never moves money.
  const clientHoursRows = await query<{ lead_id: number; minutes: string }>(
    `SELECT p.lead_id, SUM(COALESCE(t.actual_duration, t.duration_block)) AS minutes
     FROM time_tasks t
     JOIN crm_projects p ON t.project_id = p.id
     WHERE t.user_id = ? AND t.status = 'completed' AND p.lead_id IS NOT NULL
     GROUP BY p.lead_id`,
    [userId]
  );
  // Multi-currency: keep currency on the row and normalize each via convertToPrimary().
  const clientIncomeRows = await query<{ lead_id: number; currency: string; amount: string }>(
    `SELECT lead_id, currency, SUM(amount) AS amount
     FROM money_transactions
     WHERE user_id = ? AND type = 'income' AND lead_id IS NOT NULL
     GROUP BY lead_id, currency`,
    [userId]
  );
  // Lead labels — LEFT JOIN semantics in JS: drop any attribution to a lead that
  // no longer exists (deleted/declined), so dangling rows don't surface.
  const clientLeadRows = await query<{ id: number; name: string; company: string | null }>(
    `SELECT id, name, company FROM crm_leads WHERE user_id = ?`,
    [userId]
  );

  const leadLabel = new Map<number, { name: string; company: string | null }>();
  clientLeadRows.forEach((l) => leadLabel.set(l.id, { name: l.name, company: l.company }));

  const clientAgg = new Map<number, { incomePrimary: number; minutes: number }>();
  const ensureClient = (leadId: number) => {
    let row = clientAgg.get(leadId);
    if (!row) { row = { incomePrimary: 0, minutes: 0 }; clientAgg.set(leadId, row); }
    return row;
  };
  clientHoursRows.forEach((r) => { ensureClient(r.lead_id).minutes += parseFloat(r.minutes || '0'); });
  clientIncomeRows.forEach((r) => {
    ensureClient(r.lead_id).incomePrimary += convertToPrimary(parseFloat(r.amount || '0'), r.currency || 'EGP', primaryCurrency);
  });

  const perClient = Array.from(clientAgg.entries())
    .filter(([leadId, agg]) => leadLabel.has(leadId) && agg.minutes > 0) // need a live lead + tracked hours to rank
    .map(([leadId, agg]) => {
      const hours = agg.minutes / 60.0;
      const label = leadLabel.get(leadId)!;
      // $0-income-yet clients keep a null rate ("in progress") instead of dividing by zero.
      const realizedRate = agg.incomePrimary > 0 ? parseFloat((agg.incomePrimary / hours).toFixed(2)) : null;
      return {
        leadId,
        name: label.name,
        company: label.company,
        incomePrimary: parseFloat(agg.incomePrimary.toFixed(2)),
        hours: parseFloat(hours.toFixed(2)),
        realizedRate,
      };
    })
    // Best $/hr first; un-earning ("in progress") clients sink to the bottom.
    .sort((a, b) => (b.realizedRate ?? -1) - (a.realizedRate ?? -1));

  return {
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
      exchangeRates: EXCHANGE_RATES_TO_EGP,
      perClient,
    },
  };
}
