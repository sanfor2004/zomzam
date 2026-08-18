import { EncryptJWT, jwtDecrypt } from 'jose';

// Single source of truth for the session secret. Fail fast at module load:
// a misconfigured deploy must refuse to boot, never fall back to a forgeable
// or brute-forceable key.
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET is not set — refusing to start.');
}
if (secret.length < 32) {
  throw new Error('JWT_SECRET is shorter than 32 characters — refusing to start with a brute-forceable key.');
}

// A256GCM needs exactly 32 key bytes: derive them from the secret with a
// SHA-256 digest via crypto.subtle (available in both the Edge proxy and Node
// routes). Memoized as a promise so the async digest is paid once per runtime.
let keyPromise: Promise<Uint8Array> | null = null;
function getEncryptionKey(): Promise<Uint8Array> {
  if (!keyPromise) {
    keyPromise = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(secret))
      .then((digest) => new Uint8Array(digest));
  }
  return keyPromise;
}

// Session lifetime — single source of truth for both the token `exp` claim and
// the cookie `Max-Age`. Kept long (60 days ≈ 2 months) so re-opening the site
// after a closed browser does NOT silently log the user out. Revocation still
// works instantly via the `token_version` check in `getSessionUser()`.
export const SESSION_MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 days
const SESSION_TTL = `${SESSION_MAX_AGE_SECONDS}s`;

/** The identity exposed to route handlers — sourced live from the user record
 *  by `getSessionUser()` on every request, never from token claims. */
export interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

/**
 * The full verified token payload: user id + the `token_version` claim used
 * for revocation. Deliberately minimal — no username/email/role — so a captured
 * cookie value discloses nothing even if the ciphertext were ever broken open.
 * `getSessionUser()` compares `tokenVersion` against the live DB value so
 * bumping `users.token_version` invalidates every outstanding token instantly.
 */
export interface VerifiedSession {
  id: number;
  tokenVersion: number;
}

/**
 * Mint an encrypted session token (JWE, `dir` + `A256GCM`). Edge- and
 * Node-safe (jose + crypto.subtle). The payload carries only `sub` (user id)
 * and `tv` (token version); the whole payload is ciphertext, unreadable to any
 * holder of the cookie value.
 */
export async function signSession(userId: number, tokenVersion: number): Promise<string> {
  return new EncryptJWT({ tv: tokenVersion })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .encrypt(await getEncryptionKey());
}

/**
 * Decrypt + validate a token and return its minimal payload, or null if
 * missing/tampered/malformed/expired. Algorithms are pinned to block
 * algorithm-confusion. This is a stateless check (no DB) — safe in the Edge
 * proxy. Revocation (the `tokenVersion` comparison) and identity loading
 * happen in the Node-side `getSessionUser()`, which can reach the database.
 */
export async function verifySession(token: string | undefined): Promise<VerifiedSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await getEncryptionKey(), {
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    });
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) return null;
    return { id, tokenVersion: (payload.tv as number) ?? 0 };
  } catch {
    return null;
  }
}
