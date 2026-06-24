import { NextResponse } from 'next/server';
import { withError, getSessionUser } from '@/lib/api-auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { reportBug } from '@/lib/bug-report';

// ──────────────────────────────────────────────────────────
// CLIENT ERROR INTAKE
// Receives uncaught client-side errors / unhandled promise rejections from the
// browser (see components/ErrorReporter.tsx) and forwards them to the bug
// reporter. Public (errors can happen before sign-in) but throttled per IP and
// size-capped — the client is untrusted, so nothing here is rendered or trusted
// beyond the email body.
// ──────────────────────────────────────────────────────────

const MAX_FIELD = 4000;

function cap(value: unknown, max = MAX_FIELD): string {
  return String(value ?? '').slice(0, max);
}

export const POST = withError(async (request) => {
  // Blunt abuse: at most 20 client reports / 5 min per IP. The per-fault email
  // throttle in bug-report.ts then collapses duplicates on top of this.
  if (!rateLimit(`report-error:${clientIp(request)}`, 20, 5 * 60 * 1000)) {
    return NextResponse.json({ success: true }); // silently drop
  }

  const body = await request.json().catch(() => ({}));
  const message = cap(body.message, 500).trim();
  if (!message) {
    return NextResponse.json({ success: false, message: 'message required' }, { status: 400 });
  }

  // Soft auth: attach the user if there's a valid session, otherwise anonymous.
  const user = await getSessionUser().catch(() => null);

  await reportBug({
    source: 'client',
    message,
    stack: cap(body.stack),
    context: cap(body.context, 300) || null,
    url: cap(body.url, 500) || null,
    userAgent: request.headers.get('user-agent'),
    user: user ? { id: user.id, username: user.username, email: user.email } : null,
  });

  return NextResponse.json({ success: true });
});

export const dynamic = 'force-dynamic';
