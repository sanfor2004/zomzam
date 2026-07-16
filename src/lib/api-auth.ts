import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { queryOne } from './db';
import { verifySession, type SessionUser } from './session';
import { HttpError } from './http-error';
import { reportBug } from './bug-report';

// Re-export so existing importers of `HttpError` from '@/lib/api-auth' keep
// working; the class itself now lives in the runtime-free leaf module.
export { HttpError };

const SESSION_COOKIE = 'ZOMZAM_SESSION';

// Next 16 passes route params as the second handler arg ({ params: Promise<...> }).
// We forward it untouched so the wrappers are safe on dynamic API routes too.
type RouteCtx = { params?: Promise<Record<string, string>> };

type AuthedHandler = (req: NextRequest, user: SessionUser, ctx: RouteCtx) => Promise<Response> | Response;
type PublicHandler = (req: NextRequest, ctx: RouteCtx) => Promise<Response> | Response;

/**
 * Soft read of the verified session user, or null. Two layers:
 *   1. verifySession() — decryption + expiry (stateless; token carries only
 *      the user id and token version, no identity claims).
 *   2. live DB check — the session is revoked if the user row is gone,
 *      deactivated (is_active = 0), or its token_version has moved past the
 *      token's claim. Bumping users.token_version therefore force-logs-out every
 *      device on its next request; flipping is_active bans on next request.
 * Identity (username/email/role) rides the same per-request row, so handler
 * identity is always live — a username/role change takes effect on the very
 * next request, never frozen for the token's 60-day life.
 * Reads the cookie via next/headers, so it works in route handlers AND server
 * components. Propagates (does not swallow) DB errors — the caller's error
 * boundary turns those into a 500.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const row = await queryOne<{ username: string; email: string; role: string; token_version: number; is_active: number }>(
    'SELECT username, email, role, token_version, is_active FROM users WHERE id = ? LIMIT 1',
    [session.id]
  );
  if (!row || row.is_active === 0 || row.token_version !== session.tokenVersion) {
    return null;
  }

  return { id: session.id, username: row.username, email: row.email, role: row.role };
}

const unauthorized = () =>
  NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

/**
 * Centralized error boundary. A thrown HttpError maps to its status with its
 * (client-safe) message; anything else is a genuine bug — logged server-side,
 * emailed via the bug reporter, and returned as a generic 500 (never leaking
 * error.message/stack to the client). Expected HttpErrors are NOT emailed.
 *
 * Awaits the email send: on Vercel's serverless runtime a fire-and-forget would
 * be killed when the function freezes after responding. The extra latency only
 * hits responses that are already 500s.
 */
async function toErrorResponse(req: NextRequest, error: unknown, user?: SessionUser | null): Promise<NextResponse> {
  if (error instanceof HttpError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  console.error(`${req.nextUrl.pathname}:`, error);
  await reportBug({
    source: 'api',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    context: req.nextUrl.pathname,
    url: req.nextUrl.href,
    method: req.method,
    userAgent: req.headers.get('user-agent'),
    user: user ? { id: user.id, username: user.username, email: user.email } : null,
  });
  return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
}

/** Wrap a public route handler with centralized error handling. */
export function withError(handler: PublicHandler) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return toErrorResponse(req, error);
    }
  };
}

/** Wrap a protected route handler: auth gate (401 if no valid session) + error handling. */
export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    let user: SessionUser | null = null;
    try {
      user = await getSessionUser();
      if (!user) return unauthorized();
      return await handler(req, user, ctx);
    } catch (error) {
      return toErrorResponse(req, error, user);
    }
  };
}
