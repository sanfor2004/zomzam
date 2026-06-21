import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { queryOne } from './db';
import { verifySession, type SessionUser } from './session';

const SESSION_COOKIE = 'ZOMZAM_SESSION';

// Next 16 passes route params as the second handler arg ({ params: Promise<...> }).
// We forward it untouched so the wrappers are safe on dynamic API routes too.
type RouteCtx = { params?: Promise<Record<string, string>> };

type AuthedHandler = (req: NextRequest, user: SessionUser, ctx: RouteCtx) => Promise<Response> | Response;
type PublicHandler = (req: NextRequest, ctx: RouteCtx) => Promise<Response> | Response;

/**
 * Soft read of the verified session user, or null. Two layers:
 *   1. verifySession() — signature + expiry (stateless).
 *   2. live DB check — the session is revoked if the user row is gone,
 *      deactivated (is_active = 0), or its token_version has moved past the
 *      token's claim. Bumping users.token_version therefore force-logs-out every
 *      device on its next request; flipping is_active bans on next request.
 * Reads the cookie via next/headers, so it works in route handlers AND server
 * components. Propagates (does not swallow) DB errors — the caller's error
 * boundary turns those into a 500.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const row = await queryOne<{ token_version: number; is_active: number }>(
    'SELECT token_version, is_active FROM users WHERE id = ? LIMIT 1',
    [session.id]
  );
  if (!row || row.is_active === 0 || row.token_version !== session.tokenVersion) {
    return null;
  }

  return { id: session.id, username: session.username, email: session.email, role: session.role };
}

/** Throw for an intentional, client-safe error with a specific status. */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

const unauthorized = () =>
  NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

/**
 * Centralized error boundary. A thrown HttpError maps to its status with its
 * (client-safe) message; anything else is logged server-side and returned as a
 * generic 500 — never leaking error.message/stack to the client.
 */
function toErrorResponse(context: string, error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  console.error(`${context}:`, error);
  return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
}

/** Wrap a public route handler with centralized error handling. */
export function withError(handler: PublicHandler) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return toErrorResponse(req.nextUrl.pathname, error);
    }
  };
}

/** Wrap a protected route handler: auth gate (401 if no valid session) + error handling. */
export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest, ctx: RouteCtx): Promise<Response> => {
    try {
      const user = await getSessionUser();
      if (!user) return unauthorized();
      return await handler(req, user, ctx);
    } catch (error) {
      return toErrorResponse(req.nextUrl.pathname, error);
    }
  };
}
