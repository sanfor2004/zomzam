# Spec: Backend Remediation (Pre-Launch)

> **Source:** `docs/specs/backend-audit.md`. **Threat model:** public multi-tenant, open registration.
> **Goal:** clear the 3 release-blockers + 3 high findings, then the highest-leverage architecture refactor. Sequenced cheapest-highest-impact first.
> **Decision points** needing your call are marked **[DECIDE]** with a recommendation.

---

## Phase 0 — Release blockers (must ship before opening registration)

### 0.1 🔴 JWT secret — remove the hardcoded fallback
**Files:** `lib/auth.ts:4`, `proxy.ts:5`

Both default to the README-published string. Replace with a fail-fast read (no fallback):

```ts
// lib/auth.ts (Node)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set — refusing to start.');

// proxy.ts (Edge)
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('JWT_SECRET is not set — refusing to start.');
const JWT_SECRET = new TextEncoder().encode(secret);
```

- Both runtimes read the same `process.env.JWT_SECRET` (already in `.env` / README example), so no shared module needed across the edge/node boundary.
- **Side effect:** rotating the secret invalidates all existing sessions — harmless pre-launch.
- **Do also:** rotate the secret value itself, since the old one is public in git history.

### 0.2 🔴 Generic error responder — stop leaking `err.message`
**Files:** `money/route.ts:235`, `messages/route.ts:138,234`, `social` GET catch (+ audit any other `error.message` returns). `auth/route.ts:132` is the correct pattern to copy.

New shared helper:

```ts
// lib/api.ts (NEW)
import { NextResponse } from 'next/server';

/** Log full detail server-side; return a generic body to the client (Quarantine Protocol). */
export function serverError(context: string, error: unknown) {
  console.error(`${context}:`, error);
  return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
}
```

Replace every `catch (error) { … error.message … status: 500 }` with `return serverError('Money API', error);`. Keep `db.ts`'s internal throw as-is (it's server-side logging) — the fix is at the route boundary, which must never forward `.message`.

### 0.3 🔴 Brute-force / enumeration on auth
Two parts:

**(a) Rate limiting** — there's no Redis and the deploy is a single persistent VPS, so an in-memory sliding-window limiter keyed by IP+action is adequate:

```ts
// lib/rate-limit.ts (NEW) — per-instance; fine for single-server deploy
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= max;
}
```

Apply to `login` and `register` (e.g. 5 attempts / 15 min per IP) → return `429` when exceeded.

**(b) Enumeration message** — `models/user.ts:78,84`.
**[DECIDE]** Distinct "Username already exists" / "Email already exists" lets attackers probe accounts.
- **Recommended:** keep the field-specific messages (real signup UX expects them) **but** gate registration behind the rate limiter above — that's the meaningful mitigation. Enumeration without throttling is the actual risk; throttled, the field-specific message is an acceptable trade-off.
- **Stricter alternative:** generic "Could not register with those details" + email-verification flow (you already have an `is_verified` column). Bigger build; defer unless you want max hardening.

---

## Phase 1 — High findings

### 1.1 🟠 Proxy route protection — invert to default-deny
**File:** `proxy.ts:28`

`/crm` and `/p/[postId]` are missing from the protected allowlist. Rather than patch the list (which is how `/crm` got forgotten), **invert it**: protect everything by default, list the *public* exceptions.

```ts
const PUBLIC_PREFIXES = ['/sign', '/forgot-password', '/u', '/ui-kit'];
const isPublic = pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
// authed + public auth page → redirect to /home; unauthed + non-public → redirect to /sign
```

More robust: a new protected page can never be accidentally left unguarded.

### 1.2 🟠 Enforce `is_active` + enable revocation
- **Minimum (launch):** add `is_active` to the `getUserById` SELECT (`models/user.ts:46`) and reject in `/api/auth?action=check` + at login if `is_active = 0`. Stops a deactivated user from continuing once their session is re-checked.
- **[DECIDE] Full revocation:** add a `token_version INT` to `users`, embed it in the JWT, and compare per request (via the `requireUser` helper in 2.1). Bumping the column instantly invalidates all of a user's tokens. **Recommended** if you ever need to force-logout / ban mid-session; costs one extra column + one comparison.

### 1.3 🟠 `sanitizeHtml` → real sanitizer
**File:** `api/posts/route.ts:79` (regex blocklist feeding `dangerouslySetInnerHTML`).
**[DECIDE] New dependency** (CLAUDE.md requires approval): recommend **`isomorphic-dompurify`** — battle-tested, runs server-side in the route. Replace the regex with a DOMPurify allowlist (permit only the formatting tags the composer actually emits). This also hardens the upcoming Ask/Win post paths (`social-feed-favor-economy-spec.md`). **Needs your yes on the dep.**

---

## Phase 2 — Quick architectural win: `requireUser()`

The `const session = …; const user = session ? verifyToken(session) : null; if (!user) return 401` block is duplicated ~25×.

```ts
// lib/api.ts (alongside serverError)
import type { NextRequest } from 'next/server';
import { verifyToken } from './auth';

/** Returns the session payload, or null. Callers: `const user = requireUser(req); if (!user) return unauthorized();` */
export function requireUser(request: NextRequest) {
  const token = request.cookies.get('ZOMZAM_SESSION')?.value;
  return token ? verifyToken(token) : null;
}
export const unauthorized = () =>
  NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
```

Mechanical replace across all 17 routes. Removes the duplication (clean-code #11) and the "a route forgets the check" risk. If 1.2 full-revocation is chosen, the `token_version` check lives here too.

---

## Phase 3 — The big one: per-suite service layer (own session)

> Recommend a dedicated grilling/spec session — this is a structural refactor, not a fix.

- Introduce `src/lib/services/<suite>.ts`; move business logic out of the route `switch(action)` megafiles into named, testable functions (e.g. `qualifyLead(userId, payload)`).
- Route handlers become thin: `requireUser` → parse input → call service → respond. Resolves audit findings A (god-route), B (no service layer), and most of C.
- **Then** add the first tests (finding E) where they matter most: the `qualify_lead` cross-suite bridge + ownership-scoping regression tests.
- Consolidate the posts/comments schema out of `api/posts/route.ts` into `scripts/db-sync.ts` (finding D) so the migrator is the single source of truth.

---

## Execution order (recommended)

1. **0.1 JWT** (≈1 line, highest risk) → **0.2 error responder** → **0.3 rate limit** — closes all release-blockers.
2. **1.1 proxy invert** → **1.2 is_active** → **1.3 sanitizer** (pending dep approval).
3. **Phase 2 `requireUser()`** — fast, satisfying cleanup; do alongside Phase 1 since 1.2 may extend it.
4. **Phase 3** — separate session.

## Open decisions to confirm before coding
- **[0.3b]** Field-specific signup errors + rate limit (recommended) vs. generic message + email verification.
- **[1.2]** Add `token_version` for hard revocation? (recommended)
- **[1.3]** Approve `isomorphic-dompurify` dependency? (recommended)
