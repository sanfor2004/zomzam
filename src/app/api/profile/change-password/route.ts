import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { hashPassword, comparePassword } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';

export const POST = withAuth(async (request, user) => {
  const body = await request.json().catch(() => ({}));
  const { current_password, new_password } = body;

  if (!current_password || !new_password) {
    return NextResponse.json({ success: false, message: 'All fields are required' }, { status: 400 });
  }

  if (new_password.length < 8) {
    return NextResponse.json({ success: false, message: 'New password must be at least 8 characters' }, { status: 400 });
  }

  // Fetch user password hash
  const dbUser = await queryOne<{ password: string }>(
    `SELECT password FROM users WHERE id = ? LIMIT 1`,
    [user.id]
  );

  if (!dbUser) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  // Compare
  const passwordValid = await comparePassword(current_password, dbUser.password);
  if (!passwordValid) {
    return NextResponse.json({ success: false, message: 'Current password is incorrect' }, { status: 400 });
  }

  // Hash new password
  const newHash = await hashPassword(new_password);
  await execute(`UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`, [newHash, user.id]);

  return NextResponse.json({ success: true, message: 'Password changed successfully' });
});
export const dynamic = 'force-dynamic';
