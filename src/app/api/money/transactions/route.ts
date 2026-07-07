import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { listTransactions, addTransaction, deleteTransaction } from '@/lib/services/money';

export const GET = withAuth(async (req, user) => {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  return NextResponse.json({ success: true, transactions: await listTransactions(user.id, limit, offset) });
});

export const POST = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
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
    return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
  }
  const id = await addTransaction(user.id, {
    account_id: accountId,
    category_id: categoryId,
    type, amount, currency: b.currency || 'EGP',
    description: (b.description || '').slice(0, 255),
    date: b.date || new Date().toISOString().substring(0, 10),
    lead_id: leadId,
    transfer_account_id: transferAccountId,
  });
  return NextResponse.json({ success: true, id });
});

export const DELETE = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id || 0);
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  await deleteTransaction(user.id, id);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
