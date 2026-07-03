# Auth And Security

Zomzam uses a trust-zero posture: page navigation, API calls, data writes, uploads, and realtime payloads are all independently guarded.

## Session Model

Files:

- `src/lib/session.ts`
- `src/lib/api-auth.ts`
- `src/app/api/auth/route.ts`
- `src/proxy.ts`

The session cookie is `ZOMZAM_SESSION`. It contains a jose-signed JWT with:

- `id`
- `username`
- `email`
- `role`
- `tv` token-version claim

`src/lib/session.ts` refuses to load if `JWT_SECRET` is missing. There is no insecure fallback key.

## Page Protection

`src/proxy.ts` protects pages with a default-deny rule.

Public prefixes:

- `/`
- `/sign`
- `/forgot-password`
- `/u`
- `/ui-kit`
- `/p`
- `/pricing`

Everything else redirects unauthenticated users to `/sign?redirect=[path]`.

Authenticated users visiting `/` or `/sign` are redirected to `/home`.

## API Protection

API routes are not protected by the proxy. They use `src/lib/api-auth.ts`:

- `withAuth(handler)` requires a valid session and returns 401 if missing.
- `withError(handler)` centralizes error handling for public/mixed routes.
- `getSessionUser()` verifies the JWT, then checks the live DB for `is_active` and `token_version`.

Revocation works by incrementing `users.token_version`. Deactivation works by setting `users.is_active = 0`.

## Password Auth

Files:

- `src/lib/auth.ts`
- `src/lib/models/user.ts`
- `src/app/api/auth/route.ts`

Passwords are hashed with bcryptjs. Registration canonicalizes email identity with `canonicalEmail()` so the same inbox cannot register twice through different dot/case/tag variants.

Login and registration are rate-limited per IP with `src/lib/rate-limit.ts`.

## Google OAuth

Files:

- `src/lib/google-oauth.ts`
- `src/lib/models/user.ts`
- `src/app/api/auth/oauth/google/route.ts`
- `src/app/api/auth/oauth/google/callback/route.ts`

The OAuth start route sets short-lived state/redirect cookies. The callback verifies state, exchanges the code, verifies the Google `id_token` through jose remote JWKS, and calls `findOrCreateGoogleUser()`.

Account linking uses canonical email identity after Google proves email ownership.

## Data Boundary Rules

- SQL must use parameterized queries.
- Expected client-facing errors should throw/return `HttpError` or shaped route responses.
- Unexpected errors are reported server-side and returned as generic 500 responses.
- Public IDs are used where sequential IDs should not leak, for example post permalinks.
- The realtime channels (`/api/stream`, `/api/heartbeat`) are hard-gated by `withAuth` and take no client-supplied identifier — a connection only ever serves the signed-in user's own data, and no account's presence is observable by anyone else.

## Upload Safety

Files:

- `src/lib/uploads.ts`
- `src/app/api/profile/route.ts`
- `src/lib/services/posts/shared.ts`
- `src/lib/services/posts/crud.ts`

Avatar and post image handling uses server-side processing. `sharp` strips/normalizes images, and stored assets go through Vercel Blob rather than relying on writable production disk.

## HTML Sanitization

Post HTML is sanitized server-side before storage with `isomorphic-dompurify`. Rendering HTML is allowed only after the storage boundary has enforced the allowlist.

## Error Reporting

Files:

- `src/components/ErrorReporter.tsx`
- `src/app/api/report-error/route.ts`
- `src/lib/bug-report.ts`
- `src/app/global-error.tsx`

Client runtime errors and unhandled rejections are sent to `/api/report-error`. Server 500s are reported through `reportBug()`. The reporter is throttled and should never throw back into the user path.
