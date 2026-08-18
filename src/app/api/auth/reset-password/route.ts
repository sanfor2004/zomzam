import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, new_password } = body;

    if (!token || !new_password) {
      return NextResponse.json({ success: false, message: 'All fields are required' }, { status: 400 });
    }

    if (new_password.length < 8) {
      return NextResponse.json({ success: false, message: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Verify token exists and is not expired
    const user = await queryOne<{ id: number }>(
      `SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > NOW() LIMIT 1`,
      [token]
    );

    if (!user) {
      return NextResponse.json({ success: false, message: 'Invalid or expired reset token' }, { status: 400 });
    }

    const newHash = await hashPassword(new_password);

    // token_version bump in the same statement revokes every outstanding
    // session — the compromised-account recovery path must kill stolen sessions.
    await execute(
      `UPDATE users SET password = ?, token_version = token_version + 1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW() WHERE id = ?`,
      [newHash, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password API error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
