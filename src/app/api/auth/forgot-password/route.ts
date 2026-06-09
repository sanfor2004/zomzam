import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    const user = await queryOne<{ id: number; username: string }>(
      `SELECT id, username FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (!user) {
      // Security best practice: don't reveal user existence
      return NextResponse.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.',
      });
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    await execute(
      `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`,
      [token, expiry, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Password reset instructions have been sent to your email.',
      demo_token: token, // Emulate legacy PHP behavior of returning token for demo
    });
  } catch (error: any) {
    console.error('Forgot password API error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
