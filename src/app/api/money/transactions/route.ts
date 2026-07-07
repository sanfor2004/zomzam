import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { listTransactions, listTransactionsFiltered, addTransaction, updateTransaction, deleteTransaction } from '@/lib/services/money';

const FILTER_KEYS = ['type', 'account_id', 'category_id', 'date_from', 'date_to', 'search', 'page', 'page_size'];

export const GET = withAuth(async (req, user) => {
  const sp = new URL(req.url).searchParams;
  // Filtered/paginated read (the unified /money/transactions ledger). When no
  // filter/page params are present, fall back to the recent-list shape the
  // dashboard + context bootstrap already rely on.
  if (FILTER_KEYS.some((k) => sp.has(k))) {
    const pageSize = Math.min(Math.max(parseInt(sp.get('page_size') || '25'), 1), 200);
    const page = Math.max(parseInt(sp.get('page') || '1'), 1);
    const { rows, total } = await listTransactionsFiltered(user.id, {
      type: sp.get('type') || undefined,
      accountId: sp.get('account_id') ? parseInt(sp.get('account_id')!) : null,
      categoryId: sp.get('category_id') ? parseInt(sp.get('category_id')!) : null,
      dateFrom: sp.get('date_from') || null,
      dateTo: sp.get('date_to') || null,
      search: sp.get('search') || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return NextResponse.json({ success: true, transactions: rows, total, page, page_size: pageSize });
  }
  const limit = Math.min(parseInt(sp.get('limit') || '50'), 200);
  const offset = parseInt(sp.get('offset') || '0');
  return NextResponse.json({ success: true, transactions: await listTransactions(user.id, limit, offset) });
});

/** Shared parse+validate for POST (create) and PATCH (edit) bodies. */
function parseTxnBody(b: any): { ok: false } | { ok: true; input: Parameters<typeof addTransaction>[1] } {
  const amount = parseFloat(b.amount);
  const type = b.type;
  const accountId = parseInt(b.account_id);
  const categoryId = b.category_id ? parseInt(b.category_id) : null;
  const leadId = b.lead_id ? parseInt(b.lead_id) : null;
  const transferAccountId = type === 'transfer' ? parseInt(b.transfer_account_id) : null;
  if (
    !['income', 'expense', 'transfer'].includes(type) || !accountId || isNaN(accountId) ||
    isNaN(amount) || amount <= 0 ||
    (categoryId !== null && isNaN(categoryId)) || (leadId !== null && isNaN(leadId)) ||
    (type === 'transfer' && (!transferAccountId || isNaN(transferAccountId) || transferAccountId === accountId))
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    input: {
      account_id: accountId,
      category_id: categoryId,
      type, amount, currency: b.currency || 'EGP',
      description: (b.description || '').slice(0, 255),
      date: b.date || new Date().toISOString().substring(0, 10),
      lead_id: leadId,
      transfer_account_id: transferAccountId,
    },
  };
}

export const POST = withAuth(async (req, user) => {
  const parsed = parseTxnBody(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
  const id = await addTransaction(user.id, parsed.input);
  return NextResponse.json({ success: true, id });
});

export const PATCH = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id || 0);
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  const parsed = parseTxnBody(b);
  if (!parsed.ok) return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
  await updateTransaction(user.id, id, parsed.input);
  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id || 0);
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  await deleteTransaction(user.id, id);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
