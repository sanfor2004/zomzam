import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { canonicalEmail, sendEmail } from '@/lib/email';
import crypto from 'crypto';

// Resolve the public origin for links in the email: an explicit APP_URL wins
// (set this in production), otherwise fall back to the request's own origin so
// local dev and preview deploys work with zero config.
function resolveBaseUrl(request: NextRequest): string {
  const fromEnv = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return (request.headers.get('origin') || request.nextUrl.origin).replace(/\/$/, '');
}

// The password-reset email body. Kept inline (co-located with the flow) the same
// way bug-report.ts owns its own template.
function buildResetEmailHtml(username: string, link: string): string {
  const safeName = String(username || 'there').replace(/[<>&"]/g, '');
  return `<div style="background:#0f1115;padding:32px;font-family:system-ui,-apple-system,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#1A1D24;border:1px solid #1e293b;border-radius:20px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#EE5712,#c2410c);padding:22px 28px;color:#fff;font-weight:800;font-size:18px;letter-spacing:.3px">zomzam.com</div>
      <div style="padding:28px">
        <p style="margin:0 0 16px;color:#f8fafc;font-size:16px;font-weight:700">Reset your password</p>
        <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6">Hi ${safeName}, we received a request to reset your Zomzam password. Click the button below to choose a new one. This link expires in 1 hour.</p>
        <a href="${link}" style="display:inline-block;background:#EE5712;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:12px">Reset Password</a>
        <p style="margin:22px 0 0;color:#64748b;font-size:12px;line-height:1.6">If the button doesn't work, paste this link into your browser:<br><span style="color:#94a3b8;word-break:break-all">${link}</span></p>
        <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6">Didn't request this? You can safely ignore this email — your password won't change.</p>
      </div>
    </div>
  </div>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    // Match how login/register key identity: on the canonical form, so Gmail
    // dot/case/+tag variants of a registered address still resolve. Send to the
    // address actually stored on the account (the real inbox), not the raw input.
    const emailCanonical = canonicalEmail(email);
    const user = await queryOne<{ id: number; username: string; email: string }>(
      `SELECT id, username, email FROM users WHERE email = ? OR email_canonical = ? LIMIT 1`,
      [email, emailCanonical]
    );

    // Generic response either way — never reveal whether an account exists.
    const genericResponse = {
      success: true,
      message: 'If your email is registered, you will receive a password reset link shortly.',
    };

    if (!user) {
      return NextResponse.json(genericResponse);
    }

    // Generate token + 1-hour expiry.
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    await execute(
      `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`,
      [token, expiry, user.id]
    );

    // The reset page reads ?token=… and switches to the "set new password" step.
    const resetLink = `${resolveBaseUrl(request)}/forgot-password?token=${token}`;
    const result = await sendEmail({
      to: user.email,
      subject: 'Reset your Zomzam password',
      html: buildResetEmailHtml(user.username, resetLink),
    });

    if (!result.ok && !result.skipped) {
      // A real delivery failure (bad API key, Resend down) — surface it so the
      // user isn't told to check an inbox that will never get the mail.
      console.error('Forgot password: email send failed:', result.error);
      return NextResponse.json(
        { success: false, message: 'We could not send the reset email right now. Please try again later.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ...genericResponse,
      // When email isn't configured (local dev), hand the token back so the flow
      // is still testable. Never leak it once Resend is delivering, or in prod.
      ...(result.skipped && process.env.NODE_ENV !== 'production' ? { demo_token: token } : {}),
    });
  } catch (error: any) {
    console.error('Forgot password API error:', error);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
