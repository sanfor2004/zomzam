import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { listLend, addLend, settleLend, deleteLend } from '@/lib/services/money';

export const GET = withAuth(async (_req, user) => {
  return NextResponse.json({ success: true, lendList: await listLend(user.id) });
});

export const POST = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const personName = (b.person_name || '').trim();
  const amount = parseFloat(b.amount);
  const type = b.type;
  if (!personName || !['owe_me', 'i_owe'].includes(type) || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
  }
  const id = await addLend(user.id, {
    person_name: personName, type, amount,
    currency: b.currency || 'EGP',
    due_date: b.due_date || null,
  });
  return NextResponse.json({ success: true, id });
});

export const PATCH = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id || 0);
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  await settleLend(user.id, id);
  return NextResponse.json({ success: true });
});

export const DELETE = withAuth(async (req, user) => {
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id || 0);
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 });
  await deleteLend(user.id, id);
  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
