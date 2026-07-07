import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { listAccounts, createAccount, deleteAccount } from '@/lib/services/money';

export const GET = withAuth(async (_req, user) => {
  return NextResponse.json({ success: true, accounts: await listAccounts(user.id) });
});

export const POST = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return NextResponse.json({ success: false, message: 'Account name required' }, { status: 400 });
  const isCard = b.type === 'credit_card';
  const four = /^\d{4}$/.test((b.last_four || '').trim()) ? b.last_four.trim() : null;
  const id = await createAccount(user.id, {
    name, type: b.type || 'bank', currency: b.currency || 'EGP',
    balance: parseFloat(b.balance || 0) || 0, last_four: four,
    credit_limit: isCard && b.credit_limit ? parseFloat(b.credit_limit) : null,
    statement_day: isCard && b.statement_day ? parseInt(b.statement_day) : null,
    due_day: isCard && b.due_day ? parseInt(b.due_day) : null,
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
