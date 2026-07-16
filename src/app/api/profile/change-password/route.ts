import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { hashPassword, comparePassword } from '@/lib/auth';
import { queryOne, execute } from '@/lib/db';
import { signSession, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

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

  // Hash new password. Bumping token_version in the same statement atomically
  // revokes every outstanding session — no window where the new password
  // coexists with old sessions.
  const newHash = await hashPassword(new_password);
  await execute(
    `UPDATE users SET password = ?, token_version = token_version + 1, updated_at = NOW() WHERE id = ?`,
    [newHash, user.id]
  );

  // Re-issue a fresh session at the bumped version in the same response so the
  // changing device stays signed in while every other device dies.
  const row = await queryOne<{ token_version: number }>(
    `SELECT token_version FROM users WHERE id = ? LIMIT 1`,
    [user.id]
  );
  const token = await signSession(user.id, row?.token_version ?? 0);

  const response = NextResponse.json({ success: true, message: 'Password changed successfully' });
  response.cookies.set('ZOMZAM_SESSION', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
});
export const dynamic = 'force-dynamic';
