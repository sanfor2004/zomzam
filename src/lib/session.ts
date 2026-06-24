import { SignJWT, jwtVerify } from 'jose';

// Single source of truth for the session secret. Fail fast at module load:
// a misconfigured deploy must refuse to boot, never fall back to a forgeable key.
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET is not set — refusing to start.');
}
const encodedKey = new TextEncoder().encode(secret);

// Session lifetime — single source of truth for both the JWT `exp` claim and
// the cookie `Max-Age`. Kept long (60 days ≈ 2 months) so re-opening the site
// after a closed browser does NOT silently log the user out. Revocation still
// works instantly via the `token_version` check in `getSessionUser()`.
export const SESSION_MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 days
const SESSION_TTL = `${SESSION_MAX_AGE_SECONDS}s`;
const SESSION_ALG = 'HS256';

/** The identity carried in a session and exposed to route handlers. */
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

/**
 * The full verified token payload: identity + the `token_version` claim used
 * for revocation. `getSessionUser()` compares this against the live DB value so
 * bumping `users.token_version` invalidates every outstanding token instantly.
 */
export interface VerifiedSession extends SessionUser {
  tokenVersion: number;
}

/**
 * Sign a session payload into a JWT. Edge- and Node-safe (jose).
 * `tokenVersion` is embedded as the `tv` claim so the session can be revoked
 * server-side by incrementing the user's stored version.
 */
export async function signSession(user: SessionUser, tokenVersion: number): Promise<string> {
  return new SignJWT({ ...user, tv: tokenVersion })
    .setProtectedHeader({ alg: SESSION_ALG })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(encodedKey);
}

/**
 * Verify a token's signature/expiry and return its payload, or null if
 * missing/invalid/expired. This is a stateless check (no DB) — it is safe in
 * the Edge proxy. Revocation (the `tokenVersion` comparison) happens in the
 * Node-side `getSessionUser()`, which can reach the database.
 */
export async function verifySession(token: string | undefined): Promise<VerifiedSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: [SESSION_ALG] });
    return {
      id: payload.id as number,
      username: payload.username as string,
      email: payload.email as string,
      role: payload.role as string,
      tokenVersion: (payload.tv as number) ?? 0,
    };
  } catch {
    return null;
  }
}
