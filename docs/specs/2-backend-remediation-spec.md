# Spec: Backend Remediation + Auth Gate (Pre-Launch)

> **Single source of truth** for backend hardening + the auth/error-handler refactor. Consolidates the former `auth-gate-error-handler-spec.md` into Phase 2.
> **Source of findings:** `docs/specs/1-backend-audit.md`. **Threat model:** public multi-tenant, open registration.
> **Goal:** clear the 3 release-blockers + 3 high findings, ship the auth-gate refactor (Phase 2), then the highest-leverage architecture refactor (Phase 3). Sequenced cheapest-highest-impact first.
> **Decision points** needing a call are marked **[DECIDE]** with a recommendation.
>
> **For agentic workers (Phase 2):** Phase 2 is a task-by-task execution plan. Each task ends with an independently verifiable deliverable and a **proceed gate** — stop and wait for the stakeholder's explicit "proceed" before the next task. Steps use checkbox (`- [ ]`) syntax. **Commit after each approved task; push only after the final task is approved.**

---

## ✅ Execution status (as of 2026-06-22)

- **Phase 0 — Release blockers:** ✅ **COMPLETED** (0.1 JWT fail-fast, 0.2 centralized error boundary, 0.3 rate-limit + field-specific-enumeration-with-throttle).
- **Phase 1 — High findings:** ✅ **COMPLETED** (1.1 proxy default-deny invert, 1.2 `is_active` + `token_version` hard revocation, 1.3 `isomorphic-dompurify` sanitizer).
- **Phase 2 — Auth Gate + Global Error Handler (Tasks 1–7):** ✅ **COMPLETED** — `lib/session.ts` + `lib/api-auth.ts` shipped, `jsonwebtoken` removed, all routes gated, build green.
- **Phase 3 — Per-suite service layer + first tests:** ✅ **COMPLETED** (2026-06-22). Scoped (grilled) to the routes downstream work touches: `crm`/`posts`/`dashboard` logic extracted into `src/lib/services/*.ts` (routes are now thin `withAuth` dispatchers); posts schema consolidated into `scripts/db-sync.ts` (+ declarative index sync) with the in-route `ensureTables()` removed (finding D); `HttpError` moved to a runtime-free leaf (`src/lib/http-error.ts`); first tests on `node:test`+`tsx` (zero pinned deps) — 19 covering the `qualify_lead` bridge + ownership scoping (finding E). The other 11 routes were intentionally left as-is (no downstream consumer; refactor would be churn).
- **Open follow-up (not part of any phase):** 🔸 `shops/route.ts:81,84` inner Google Places catch still leaks `error.response?.data || error.message` to the client (the "0.2 follow-up" — `withAuth` only removed the route-level catch). One-liner; track separately.

---

## Phase 0 — Release blockers (must ship before opening registration) — ✅ COMPLETED (2026-06-22)

### 0.1 🔴 JWT secret — remove the hardcoded fallback
**Delivered by Phase 2, Task 1.** Both `lib/auth.ts` and `proxy.ts` defaulted to the README-published string `'super_secret_zomzam_jwt_key_2026_zenith_tier'`. Phase 2 unifies signing/verifying into a single `lib/session.ts` that reads `process.env.JWT_SECRET` once and **throws at module load** if it is missing — no fallback, ever. (`.env` already holds a real, non-leaked value.)
- **Side effect:** rotating the secret invalidates all existing sessions — harmless pre-launch.
- **Do also:** rotate the secret value itself, since the old one is public in git history.

### 0.2 🔴 Generic error responder — stop leaking `err.message`
**Delivered by Phase 2, Task 2 + 5.** The **outer route catch** in `money/route.ts:235`, `messages/route.ts:138,234`, `notion/route.ts:27,348`, and `crm/route.ts:536` forwarded `err.message` to the client at status 500 (some under the JSON key `error`, others `message`). **`social` already returns a generic 500 — no leak** (verified: `social/route.ts:254,446`). Phase 2's `withError`/`withAuth` wrappers own a single error boundary (`toErrorResponse`) that logs full detail server-side and returns a generic `500 { success: false, message: 'Internal Server Error' }`. Migrating those four routes (Task 5) removes the outer catch and fixes the leak as a called-out side effect — this also **normalizes the response key from `error` to `message`** on those 500s. **Not auto-fixed:** `shops/route.ts:91` forwards `error.response?.data || error.message` from an *inner* Google Places fetch catch (not the route-level catch `withAuth` removes) — track separately as a 0.2 follow-up. Keep `db.ts`'s internal throw as-is (server-side logging); the fix is at the route boundary.

### 0.3 🔴 Brute-force / enumeration on auth
> ✅ **DONE** — `lib/rate-limit.ts` (5 / 15 min per IP+action) applied to login/register in `auth/route.ts`; field-specific messages kept behind the throttle (recommended option).

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

Apply to `login` and `register` (e.g. 5 attempts / 15 min per IP) → return `429` when exceeded. This lives inside the `auth/route.ts` `withError` handler from Phase 2 Task 6.

**(b) Enumeration message** — `models/user.ts:78,84`.
**[DECIDE]** Distinct "Username already exists" / "Email already exists" lets attackers probe accounts.
- **Recommended:** keep the field-specific messages (real signup UX expects them) **but** gate registration behind the rate limiter above — that's the meaningful mitigation. Enumeration without throttling is the actual risk; throttled, the field-specific message is an acceptable trade-off.
- **Stricter alternative:** generic "Could not register with those details" + email-verification flow (you already have an `is_verified` column). Bigger build; defer unless you want max hardening.

---

## Phase 1 — High findings — ✅ COMPLETED (2026-06-22)

> ✅ **DONE** — 1.1 proxy inverted to default-deny, 1.2 `is_active` + `token_version` revocation wired into `getSessionUser()`, 1.3 `isomorphic-dompurify` allowlist replaced the regex sanitizer.

### 1.1 🟠 Proxy route protection — invert to default-deny
**File:** `proxy.ts:28`

`/crm` and `/p/[postId]` are missing from the protected allowlist. Rather than patch the list (which is how `/crm` got forgotten), **invert it**: protect everything by default, list the *public* exceptions.

```ts
const PUBLIC_PREFIXES = ['/sign', '/forgot-password', '/u', '/ui-kit'];
const isPublic = pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
// authed + public auth page → redirect to /home; unauthed + non-public → redirect to /sign
```

More robust: a new protected page can never be accidentally left unguarded. (Compatible with Phase 2 — the proxy keeps its page-only role; this only changes the page allowlist logic.)

### 1.2 🟠 Enforce `is_active` + enable revocation
- **Minimum (launch):** add `is_active` to the `getUserById` SELECT (`models/user.ts:46`) and reject in `/api/auth?action=check` + at login if `is_active = 0`. Stops a deactivated user from continuing once their session is re-checked.
- **[DECIDE] Full revocation:** add a `token_version INT` to `users`, embed it in the JWT (in `signSession`), and compare per request inside `getSessionUser()` (Phase 2). Bumping the column instantly invalidates all of a user's tokens. **Recommended** if you ever need to force-logout / ban mid-session; costs one extra column + one comparison. This is the "secure-check (DB)" upgrade deliberately *deferred* in Phase 2 (Q6 chose payload-only). Revisit when an account-deletion / ban / "log out all devices" feature is built.

### 1.3 🟠 `sanitizeHtml` → real sanitizer
**File:** `api/posts/route.ts:79` (regex blocklist feeding `dangerouslySetInnerHTML`).
**[DECIDE] New dependency** (CLAUDE.md requires approval): recommend **`isomorphic-dompurify`** — battle-tested, runs server-side in the route. Replace the regex with a DOMPurify allowlist (permit only the formatting tags the composer actually emits). This also hardens the upcoming Ask/Win post paths (`3-social-feed-favor-economy-spec.md`). **Needs your yes on the dep.**

---

## Phase 2 — Auth Gate + Global Error Handler (EXECUTION PLAN) — ✅ COMPLETED (2026-06-22)

> **Supersedes** the original Phase 2 `requireUser()` sketch with the grilled, decided design: a `jose`-unified `lib/session.ts` + a `withAuth()` HOF gate (not an inline helper) + a `withError()` error boundary. Delivers 0.1 and a centralized 0.2.

**Goal:** Centralize JWT session handling into one `jose`-based module and gate every auth-needing API route through a single `withAuth()` wrapper that also owns error handling — eliminating the ~25× duplicated auth boilerplate and per-route `try/catch`.

**Architecture:** `src/lib/session.ts` owns the secret + `jose` sign/verify (Edge proxy **and** Node routes). `src/lib/api-auth.ts` exposes the gate: `getSessionUser()` (soft, `SessionUser | null`), `withAuth()` (auth + error handling, the 14 protected routes), `withError()` (error handling only, the mixed auth route). `proxy.ts` stays **page-only** (redirects); API auth lives at the route-handler layer per Next 16's own guidance ("Proxy should not be used as a full authorization solution," and the CVE-2025-29927 middleware-bypass class).

**Tech Stack:** Next.js 16.2.7 (App Router, `proxy.ts` convention), React 19.2.4, `jose` (replaces `jsonwebtoken`), `bcryptjs`, `mysql2/promise`, TypeScript.

### Phase 2 Global Constraints

- **Next.js 16.2.7** — middleware file is `proxy.ts`; `cookies()` from `next/headers` is **async** (`await`).
- **No new dependencies.** This phase *removes* `jsonwebtoken` + `@types/jsonwebtoken`; `jose` is already installed.
- **No test framework** is installed and none is added (explicit decision). Verification bar at every gate: `npx tsc --noEmit` passes **and** `npm run build` passes **and** the stakeholder's manual smoke passes.
- **Single JWT secret** from `process.env.JWT_SECRET`, **no fallback**, fail-fast at module load.
- **Quarantine Protocol:** route responses never forward `error.message`/stack. Generic 500 only; detail is `console.error`-logged.
- **Session payload** stays `{ id: number; username: string; email: string; role: string }` (`SessionUser`). Token expiry stays **7 days**; login cookie `maxAge` (session vs 30-day remember) unchanged.
- **Clean-code-guard** review is a mandatory step in every task (imperatives 1–23).
- **Commit after each approved task; do NOT push.** Push all commits only after Task 7 is approved.
- **Behavior-preserving** except two *intentional, called-out* security improvements: (a) removing the hardcoded secret fallback (0.1); (b) the outer-catch `err.message` leak in `money`/`messages`/`notion`/`crm` → generic 500, which also normalizes those 500s' JSON key from `error` to `message` (0.2). Both flagged where they occur.

### Phase 2 File Structure

| File | Responsibility | Action |
| :--- | :--- | :--- |
| `src/lib/session.ts` | Secret (fail-fast) + `jose` `signSession`/`verifySession` + `SessionUser`. The **only** place a JWT is signed/verified. | **Create** |
| `src/lib/api-auth.ts` | The gate: `getSessionUser()`, `withAuth()`, `withError()`, `HttpError`. | **Create** |
| `src/lib/auth.ts` | Reduce to bcrypt helpers only. Remove `jsonwebtoken`, `JWT_SECRET`, `signToken`, `verifyToken`. | **Modify** |
| `src/proxy.ts` | Page redirects only; verify via shared `verifySession`. Matcher stays page-only. | **Modify** |
| `src/app/api/auth/route.ts` | `signToken`→`await signSession`; wrap with `withError`; protected actions use `getSessionUser()`. | **Modify** |
| 14 protected API routes | Replace cookie+verify+401 boilerplate and outer `try/catch` with `withAuth()`. | **Modify** |
| `(dashboard)/layout.tsx`, `u/[username]/page.tsx`, `p/[postId]/page.tsx` | Sync `verifyToken` → `await getSessionUser()`. | **Modify** |
| `package.json` | Drop `jsonwebtoken` + `@types/jsonwebtoken`. | **Modify** |
| `README.md`, `CLAUDE.md` (Section 5) | Stack table: `jose` only; note new `lib/session.ts` + `lib/api-auth.ts`. | **Modify** |

**The 14 protected API routes** (wrap **each** exported `GET`/`POST` separately):
`time`, `money`, `crm`, `dashboard`, `notifications`, `stream`, `social`, `posts`, `messages`, `profile`, `profile/change-password`, `shops`, `notion`, `heartbeat`.

---

### Task 1: Foundation — `lib/session.ts`, slim `auth.ts`, rewire `proxy.ts`, drop `jsonwebtoken`

**Files:** Create `src/lib/session.ts`; Modify `src/lib/auth.ts`, `src/proxy.ts:1-24`, `package.json`.

**Interfaces — Produces:**
- `interface SessionUser { id: number; username: string; email: string; role: string }`
- `signSession(user: SessionUser): Promise<string>` — HS256, 7-day expiry.
- `verifySession(token: string | undefined): Promise<SessionUser | null>` — null on missing/invalid/expired.

- [ ] **Step 1: Create `src/lib/session.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';

// Single source of truth for the session secret. Fail fast at module load:
// a misconfigured deploy must refuse to boot, never fall back to a forgeable key.
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET is not set — refusing to start.');
}
const encodedKey = new TextEncoder().encode(secret);

const SESSION_TTL = '7d';
const SESSION_ALG = 'HS256';

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  role: string;
}

/** Sign a session payload into a JWT. Edge- and Node-safe (jose). */
export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: SESSION_ALG })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(encodedKey);
}

/** Verify a token and return the session user, or null if missing/invalid/expired. */
export async function verifySession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: [SESSION_ALG] });
    return {
      id: payload.id as number,
      username: payload.username as string,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Slim `src/lib/auth.ts` to bcrypt only** (drops `jsonwebtoken`, `JWT_SECRET`, `signToken`, `verifyToken`):

```ts
import bcrypt from 'bcryptjs';

/** Hash a plain text password using bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Compare a plain text password with a bcrypt hash. */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 3: Rewire `src/proxy.ts`** — replace lines 1–24 (imports through the inline verify) with:

```ts
import { NextResponse, NextRequest } from 'next/server';
import { verifySession } from './lib/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optimistic page-level check: read + verify the session cookie. This proxy
  // only redirects pages; API authorization lives in withAuth() at the route layer.
  const token = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = await verifySession(token);
```

Leave the `isAuthRoute`/`isProtectedRoute` logic, redirects, `NextResponse.next()`, and `config` **unchanged**. Confirm the matcher still excludes `api/`.

- [ ] **Step 4: Remove `jsonwebtoken`** — `npm uninstall jsonwebtoken @types/jsonwebtoken`. Expected: both removed; `jose` remains.

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit`. **Expected to report errors** at every site still importing the now-removed `verifyToken`/`signToken` (the 14 routes, `auth/route.ts`, the 3 server components). That is acceptable *within this task only* — full green build returns at Task 6. Do not add re-export shims (cleaner to push through Tasks 3–6).

- [ ] **Step 6: Verify the fail-fast guard** — temporarily rename `JWT_SECRET` to `JWT_SECRET_X` in `.env`, run `npm run build`, observe the boot error (`JWT_SECRET is not set`), then **restore `.env`**.

- [ ] **Step 7: Clean-code-guard review** — confirm #15 (`catch`→null is the documented contract), #17 (`SignJWT`/`jwtVerify`/`setExpirationTime` exist in installed `jose`), #21 (no dead `jwt`/`JWT_SECRET` in `auth.ts`), #6/#22 (style matches neighbors).

- [ ] **Step 8: Commit (do not push)**

```bash
git add src/lib/session.ts src/lib/auth.ts src/proxy.ts package.json package-lock.json
git commit -m "feat(auth): centralize JWT into jose-based lib/session.ts; drop jsonwebtoken

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **PROCEED GATE 1 — report build/typecheck status (partial per Step 5) + fail-fast verified. Wait for "proceed".**

---

### Task 2: The gate module — `lib/api-auth.ts`

**Files:** Create `src/lib/api-auth.ts`.

**Interfaces:**
- Consumes: `verifySession`, `SessionUser` from `./session`.
- Produces: `getSessionUser(): Promise<SessionUser | null>`; `class HttpError extends Error { status: number }`; `withAuth(handler)`; `withError(handler)`.

- [ ] **Step 1: Create `src/lib/api-auth.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, type SessionUser } from './session';

const SESSION_COOKIE = 'ZOMZAM_SESSION';

// Next 16 passes route params as the second handler arg ({ params: Promise<...> }).
// We forward it untouched so the wrappers are safe on dynamic API routes too.
type RouteCtx = { params?: Promise<Record<string, string>> };

type AuthedHandler = (req: NextRequest, user: SessionUser, ctx: RouteCtx) => Promise<Response> | Response;
type PublicHandler = (req: NextRequest, ctx: RouteCtx) => Promise<Response> | Response;

/**
 * Soft read of the verified session user, or null. Reads the cookie via
 * next/headers, so it works in route handlers AND server components.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
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
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit`. Confirm `api-auth.ts` itself reports **no** errors (pre-existing route errors from Task 1 may persist; verify none originate here).

- [ ] **Step 3: Clean-code-guard review** — #3 (no boolean-flag args), #15 (`toErrorResponse` always returns + logs non-HttpError detail), #14 (`HttpError` has a documented present-day use path; if strict YAGNI preferred, flag deferral in the gate report), #1 (intent-revealing names).

- [ ] **Step 4: Commit (do not push)**

```bash
git add src/lib/api-auth.ts
git commit -m "feat(auth): add withAuth/withError gate + getSessionUser DAL

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **PROCEED GATE 2 — report module surface + the `HttpError`-vs-strict-YAGNI choice. Wait for "proceed".**

---

### Task 3: Migrate server components to `await getSessionUser()`

These 4 files call **sync** `verifyToken` (now removed) and tolerate anonymous viewers (`null`), so use the soft `getSessionUser()`.

**Files:** Modify `src/app/(dashboard)/layout.tsx:4,24`, `src/app/u/[username]/page.tsx:8,61`, `src/app/p/[postId]/page.tsx:6,49`.

**Interfaces — Consumes:** `getSessionUser` from `@/lib/api-auth`.

- [ ] **Step 1: Apply the identical transformation** in each file:
  - Remove `import { verifyToken } from '@/lib/auth';`
  - Add `import { getSessionUser } from '@/lib/api-auth';`
  - Replace the cookie-read + `verifyToken(...)` line with `const <viewer|payload> = await getSessionUser();`, keeping the file's **existing** variable name (`viewer` in `u`/`p` pages, `payload` in the dashboard layout). Delete the now-unused `cookies()`/`session` local if nothing else references it.

```ts
// before
const session = (await cookies()).get('ZOMZAM_SESSION')?.value;
const viewer = session ? verifyToken(session) : null;
// after
const viewer = await getSessionUser();
```
Read each file first; if a file still uses its raw token elsewhere, keep that local and only swap the `verifyToken(...)` call.

- [ ] **Step 2: Confirm no `verifyToken` remains** —
```bash
grep -rn "verifyToken" "src/app/(dashboard)/layout.tsx" "src/app/u/[username]/page.tsx" "src/app/p/[postId]/page.tsx"
```
Expected: no matches; `npx tsc --noEmit` shows these 4 clean (route errors may persist until Task 6).

- [ ] **Step 3: Manual smoke** — `npm run dev`. **Anonymous:** open `/u/<user>` and `/p/<id>` → render, no viewer-UI, no crash. **Logged in:** dashboard shell renders; public pages show viewer-aware UI. No redirect regressions.

- [ ] **Step 4: Clean-code-guard review** — #19 (re-derived per file), #21 (no orphaned `session` locals/imports), #23 (anonymous still allowed).

- [ ] **Step 5: Commit (do not push)**

```bash
git add "src/app/(dashboard)/layout.tsx" "src/app/u/[username]/page.tsx" "src/app/p/[postId]/page.tsx"
git commit -m "refactor(auth): server components read session via getSessionUser

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **PROCEED GATE 3 — report anon + authed smoke. Wait for "proceed".**

---

### Task 4: Pilot route — migrate `time` to `withAuth`

Prove the wrapper shape end-to-end on one route before fanning out. `time/route.ts` exports `POST` only.

**Files:** Modify `src/app/api/time/route.ts`.

**Interfaces — Consumes:** `withAuth` from `@/lib/api-auth`.

- [ ] **Step 1: Rewrite the handler.** Replace the top:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { query, queryOne, execute } from '@/lib/db';

export const POST = withAuth(async (request, user) => {
  const userId = user.id;
  // ...syncProjectDeliveryIfApplicable closure + body unchanged...
```
Then: **delete** the outer `try { … } catch (error: any) { console.error(...); return …500 }` (now owned by `withAuth`); keep the inner `body`/`switch(action)` verbatim (de-indent one level); close the function with `});`. Remove the now-moot TS-narrowing comment block (`user` is a guaranteed-non-null param).

- [ ] **Step 2: Typecheck + build** — `npx tsc --noEmit` then `npm run build`. Confirm `time/route.ts` is clean (other unmigrated routes still error until Task 5; full green at Task 6).

- [ ] **Step 3: Manual smoke (ergonomics sign-off)** — log in, open Time: load tasks, create/update a task, confirm the `Production Delivery & Launch` → CRM delivery sync fires. Logged out → `401 { success: false, message: 'Unauthorized' }`. **Approve the `withAuth` shape here before 13 more routes adopt it.**

- [ ] **Step 4: Clean-code-guard review** — #23 (behavior identical), #21 (no leftover `verifyToken`; keep `NextResponse` only if still used), #2/#5 (no orphaned comments).

- [ ] **Step 5: Commit (do not push)**

```bash
git add src/app/api/time/route.ts
git commit -m "refactor(time): gate route via withAuth wrapper (pilot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **PROCEED GATE 4 — stakeholder approves wrapper ergonomics. Wait for "proceed" before fan-out.**

---

### Task 5: Fan-out — migrate the remaining 13 protected routes

Apply the **exact** Task 4 transformation to each route. For `GET`+`POST` routes, wrap **each** method.

**Files (modify each):**
- `money/route.ts` — **leak fix:** outer catch (`money:235`) returns `error.message`; wrapper's generic 500 fixes it (0.2).
- `messages/route.ts` (GET+POST) — **leak fix** (outer catches `messages:138,234`; key `error`→`message`).
- `notion/route.ts` (GET+POST) — **leak fix** (outer catches `notion:27,348`; key `error`→`message`).
- `crm/route.ts` — **leak fix** (outer catch `crm:536`; key `error`→`message`). Keep its *inner* catches (`crm:466,619,701`) untouched.
- `social/route.ts` (GET+POST) — **no leak** (`social:254,446` already generic 500); boilerplate removal only.
- `dashboard/route.ts`, `notifications/route.ts` (GET+POST), `stream/route.ts`, `posts/route.ts` (GET+POST), `shops/route.ts`, `heartbeat/route.ts`.
- `profile/route.ts` (GET+POST) — **keep** its `comparePassword` import from `@/lib/auth`.
- `profile/change-password/route.ts` — **keep** its `hashPassword`/`comparePassword` imports.

> `shops/route.ts:91` leaks `error.message` from an **inner** Google Places catch — `withAuth` removes only the route-level catch, so this is **not** fixed here. Leave it; track as a 0.2 follow-up. `posts:167` / `profile:81` return `err.message` at status **400** (intentional validation) — preserve those returns.

**Interfaces — Consumes:** `withAuth` from `@/lib/api-auth`.

- [ ] **Step 1: Transform each route (per-method).** Remove `import { verifyToken } from '@/lib/auth';`, add `import { withAuth } from '@/lib/api-auth';`, convert each `export async function METHOD(request)` with cookie+verify+401+try/catch into `export const METHOD = withAuth(async (request, user) => { ... });`. Preserve inner logic, closures, and **intentional** non-500 returns (validation `400`s) exactly. Drop any now-unused import. **Re-derive per file** (clean-code #19) — routes differ (closures, GET+POST, `profile` keeps `comparePassword`). Check each handler still references `user.id`, not a deleted local.

- [ ] **Step 2: Confirm boilerplate gone** — `grep -rn "verifyToken" src/app/api`. Expected: matches **only** in `auth/route.ts` (Task 6).

- [ ] **Step 3: Typecheck + build** — `npx tsc --noEmit` then `npm run build`. Only `auth/route.ts` may still reference removed exports; all 14 wrapped routes compile clean.

- [ ] **Step 4: Manual smoke (spot-check)** — logged in: Money (load + mutation), Messages (load thread), Social (load), CRM (load pipeline), Dashboard, Profile (load + save). Each works; each `401`s logged out. Confirm `money`/`messages`/`notion`/`crm` now return generic `500` (not `err.message`) when forced to error.

- [ ] **Step 5: Clean-code-guard review (batch)** — #19 (re-derived), #23 (behavior preserved except called-out leak fixes), #21 (no dead imports/locals), #11 (the duplicated auth block is deleted, not just moved).

- [ ] **Step 6: Commit (do not push)**

```bash
git add src/app/api/money src/app/api/messages src/app/api/social src/app/api/crm src/app/api/dashboard src/app/api/notifications src/app/api/stream src/app/api/posts src/app/api/profile src/app/api/shops src/app/api/notion src/app/api/heartbeat
git commit -m "refactor(api): gate 13 routes via withAuth; centralize error handling

money/messages/notion/crm previously leaked err.message in their outer catch;
the wrapper's generic 500 fixes that (remediation 0.2).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **PROCEED GATE 5 — report spot-check + confirm leak-fix routes return generic 500. Wait for "proceed".**

---

### Task 6: Mixed auth route — `withError` + `getSessionUser`

`auth/route.ts` is mixed: `register`/`login`/`logout` public; `update_settings`/`check` need a session.

**Files:** Modify `src/app/api/auth/route.ts`.

**Interfaces — Consumes:** `withError`, `getSessionUser` from `@/lib/api-auth`; `signSession` from `@/lib/session`.

- [ ] **Step 1: Update imports**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { loginUser, registerUser, getUserById } from '@/lib/models/user';
import { signSession } from '@/lib/session';
import { withError, getSessionUser } from '@/lib/api-auth';
import { execute } from '@/lib/db';
```

- [ ] **Step 2: Wrap `POST` in `withError` + async signing** — `export async function POST(request: NextRequest) {` → `export const POST = withError(async (request) => {`, closing `}` → `});`. **Delete** the outer `try/catch` (now `withError`'s). De-indent branches.
  - `register`: `const token = await signSession({ id: res.user.id, username: res.user.username, email: res.user.email, role: 'user' });`
  - `login`: `const token = await signSession({ id: res.user.id!, username: res.user.username!, email: res.user.email!, role: res.user.role! });` — keep the `maxAge` (remember) cookie logic.
  - `update_settings`: replace the cookie-read + `verifyToken` + 401 block with:
    ```ts
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    ```
    Keep `user.id` usage and currency/timezone validation unchanged.

- [ ] **Step 3: Wrap `GET` (`check`) in `withError`** — `export async function GET(request: NextRequest) {` → `export const GET = withError(async (request) => {`, closing `}` → `});`. Replace `const userPayload = session ? verifyToken(session) : null;` (+ its `session` local) with `const userPayload = await getSessionUser();`. Keep the `getUserById(userPayload.id)` fetch + cookie-clear-on-invalid logic.

- [ ] **Step 4: Full typecheck + build (expected GREEN)** — `npx tsc --noEmit` then `npm run build`. Expected: **PASS, zero errors.**

- [ ] **Step 5: Manual smoke — full auth flow** — register (cookie set), logout (cleared), login with remember (30-day) vs without (session), `update_settings` persists, `?action=check` returns the user and clears the cookie on a tampered token.

- [ ] **Step 6: Grep clean** — `grep -rn "verifyToken\|signToken\|jsonwebtoken" src`. Expected: **no matches.**

- [ ] **Step 7: Clean-code-guard review** — #23 (auth flows identical), #17 (`signSession` signature matches Task 1), #21 (no removed imports), #15 (`withError` doesn't swallow; intentional 400/401 preserved).

- [ ] **Step 8: Commit (do not push)**

```bash
git add src/app/api/auth/route.ts
git commit -m "refactor(auth): wrap auth route in withError; sign via jose signSession

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **PROCEED GATE 6 — report full-flow smoke + green build + clean grep. Wait for "proceed".**

---

### Task 7: Cleanup + docs sync + push

**Files:** Modify `README.md`, `CLAUDE.md` (Section 5), `docs/README.md`. (This spec's own Phase 2-superseded note is already in place.)

- [ ] **Step 1: README** — Core Tech Stack Auth row: drop `jsonwebtoken`; read `jose` (Edge proxy + Node routes via `lib/session.ts`) + `bcryptjs`. If the repo-structure tree lists `src/lib`, add `session.ts` + `api-auth.ts`. If an API/middleware section describes auth, note API routes are gated by `withAuth()` (not the proxy). (CLAUDE.md Section 9 — same-turn sync.)

- [ ] **Step 2: CLAUDE.md Section 5** — Auth row: remove `jsonwebtoken (Node routes)`; state `jose` is used in `proxy.ts` and Node routes via `lib/session.ts`, plus `bcryptjs`.

- [ ] **Step 3: docs index** — in `docs/README.md` under `specs/`, ensure the `2-backend-remediation-spec.md` entry notes it now includes the shipped auth-gate plan. Remove any reference to the former `auth-gate-error-handler-spec.md` (deleted/merged here).

- [ ] **Step 4: Final sweep** — `grep -rn "verifyToken\|signToken\|jsonwebtoken\|super_secret_zomzam" src docs README.md CLAUDE.md` (scrub stale doc mentions of the old secret); `npx tsc --noEmit && npm run build` → PASS.

- [ ] **Step 5: Docs-guard review** — README/CLAUDE/index claims match code: stack table = actual `package.json`; `withAuth`/`getSessionUser`/`signSession` names match shipped modules; structure-tree paths exist. Fix drift.

- [ ] **Step 6: Clean-code-guard final pass** — whole-branch diff (Tasks 1–7) against imperatives 1–23: no regressions, no speculative leftovers, no swallowed errors.

- [ ] **Step 7: Commit, then push all commits**

```bash
git add README.md CLAUDE.md docs/README.md docs/specs/2-backend-remediation-spec.md
git commit -m "docs(auth): sync README/CLAUDE/specs for session + route-gate refactor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
```

- [ ] **PROCEED GATE 7 (final) — report green build, clean grep, docs-guard clean, commits pushed.**

---

## Phase 3 — The big one: per-suite service layer (own session) — ✅ COMPLETED (2026-06-22)

> Grilled before execution. Scoped down from "all 14 routes" to the three the remaining specs build on (`crm`, `posts`, `dashboard`) — smaller blast radius, and specs 3/4 now target the extracted service shape directly. The other 11 routes work and have no downstream consumer, so refactoring them now would be pure churn (revisit per-suite as features touch them).

- ✅ `src/lib/services/{crm,posts,dashboard}.ts` introduced; business logic moved out of the `switch(action)` megafiles into named, testable functions (e.g. `qualifyLead(userId, input)`). Route handlers are now `withAuth` → parse input → call service → respond. Resolves audit findings A (god-route) + B (no service layer) for these suites.
- ✅ First tests (finding E) on **`node:test` + `tsx`** (zero pinned deps; `npm test = npx tsx --test --experimental-test-module-mocks`): the `qualify_lead` cross-suite bridge + ownership-scoping regression on the mutating crm/posts ops + dashboard read scoping. `@/lib/db` and runtime boundaries are mocked; **real-DB integration of the bridge SQL is a noted fast-follow.**
- ✅ Posts/comments schema consolidated into `scripts/db-sync.ts` (finding D) — added the 4 posts tables + a declarative idempotent **index sync** (the column-only map couldn't express composite/unique keys); the in-route self-healing `ensureTables()` is deleted. Schema now provisions via `npm run db:sync`. **Knock-on for spec 3:** its new columns (`type`, `skill_tag`, `accepted_answer_id`, `resolved_at`) + `helpful_events` go into `db-sync.ts` (declarative), not in-route boot ALTERs.
- ✅ Side cleanup: `HttpError` extracted from `api-auth.ts` (which pulls the Next runtime + JWT fail-fast) into the runtime-free leaf `src/lib/http-error.ts`, so services and their unit tests throw/assert the real class. `api-auth` re-exports it for compatibility.

---

## Execution order (recommended)

1. **Phase 2** (Tasks 1–7) — delivers 0.1 (JWT fail-fast) + 0.2 (centralized error boundary) *and* the duplication cleanup in one sequenced refactor.
2. **0.3 rate limit + enumeration** — lands inside the `auth/route.ts` `withError` handler from Phase 2 Task 6.
3. **1.1 proxy invert** → **1.2 is_active** → **1.3 sanitizer** (pending dep approval).
4. **Phase 3** — separate session.

## Open decisions to confirm before coding

- **[0.3b]** Field-specific signup errors + rate limit (recommended) vs. generic message + email verification.
- **[1.2]** Add `token_version` for hard revocation? (recommended; slots into `getSessionUser()` / `signSession`). Note Phase 2 chose payload-only (no per-request DB check) by decision — this is the deferred upgrade path.
- **[1.3]** Approve `isomorphic-dompurify` dependency? (recommended)
- **[Phase 2, HttpError]** Keep the `HttpError` class now (documented future use) or defer under strict YAGNI?
