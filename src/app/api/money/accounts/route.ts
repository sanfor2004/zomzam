import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { listAccounts, createAccount, deleteAccount, listCategories } from '@/lib/services/money';

export const GET = withAuth(async (_req, user) => {
  // ponytail: categories rarely change and every money page needs both — piggyback
  // them on the accounts fetch instead of adding a 6th route for one small table.
  const [accounts, categories] = await Promise.all([listAccounts(user.id), listCategories(user.id)]);
  return NextResponse.json({ success: true, accounts, categories });
});

export const POST = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ success: false, message: 'Account name required' }, { status: 400 });
  const isCard = b.type === 'credit_card';
  const four = /^\d{4}$/.test((b.last_four || '').trim()) ? b.last_four.trim() : null;
  const creditLimit = isCard && b.credit_limit ? parseFloat(b.credit_limit) : null;
  const statementDay = isCard && b.statement_day ? parseInt(b.statement_day) : null;
  const dueDay = isCard && b.due_day ? parseInt(b.due_day) : null;
  if (
    (creditLimit !== null && isNaN(creditLimit)) ||
    (statementDay !== null && isNaN(statementDay)) ||
    (dueDay !== null && isNaN(dueDay))
  ) {
    return NextResponse.json({ success: false, message: 'Invalid card fields' }, { status: 400 });
  }
  const id = await createAccount(user.id, {
    name, type: b.type || 'bank', currency: b.currency || 'EGP',
    balance: parseFloat(b.balance || 0) || 0, last_four: four,
    credit_limit: creditLimit,
    statement_day: statementDay,
    due_day: dueDay,
  });
  return NextResponse.json({ success: true, accountId: id });
});

export const DELETE = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id || 0);
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  await deleteAccount(user.id, id);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
