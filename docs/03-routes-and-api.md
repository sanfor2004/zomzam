# Routes And API

This file maps the visible site and the server endpoints that power it.

## Public Page Routes

| Route | Purpose | Main files |
| --- | --- | --- |
| `/` | Marketing landing page with gated desktop WebGL hero visual | `src/app/page.tsx`, `src/components/Silk.tsx`, `src/hooks/useDesktopWebGL.ts` |
| `/sign` | Login/register UI and OAuth entry | `src/app/sign/page.tsx`, `src/app/api/auth/route.ts`, `src/app/api/auth/oauth/google/*` |
| `/forgot-password` | Password recovery request | `src/app/forgot-password/page.tsx`, `src/app/api/auth/forgot-password/route.ts` |
| `/pricing` | Upgrade surface | `src/app/pricing/page.tsx` |
| `/ui-kit` | Dev-only component showcase | `src/app/ui-kit/page.tsx`, `src/components/ui/*` |
| `/u/[username]` | Public vanity profile with live status | `src/app/u/[username]/page.tsx`, `PublicUserStatus.tsx`, `SocialButtons.tsx` |
| `/p/[postId]` | Public post permalink | `src/app/p/[postId]/page.tsx`, `PostDetail.tsx` |

## Authenticated Page Routes

| Route group | Routes |
| --- | --- |
| Social | `/home`, `/saved`, `/messages`, `/notifications` |
| Community | `/community`, `/community/friends`, `/community/discover`, `/community/requests` |
| Time | `/time/execution`, `/time/tasks`, `/time/planning`, `/time/ideas`, `/time/tracker` |
| Money | `/money/dashboard`, `/money/accounts`, `/money/income`, `/money/expenses`, `/money/lend` |
| CRM | `/crm`, `/crm/leads`, `/crm/pipeline`, `/crm/contacts`, `/crm/outreach`, `/crm/projects` |
| Account | `/me`, `/settings` |

## API Route Reference

| Endpoint | Actions / behavior | Main files |
| --- | --- | --- |
| `/api/auth` | `register`, `login`, `logout`, `update_settings`, `check` | `src/app/api/auth/route.ts`, `src/lib/models/user.ts`, `src/lib/session.ts` |
| `/api/auth/oauth/google` | Starts Google OAuth with state and redirect cookies | `src/app/api/auth/oauth/google/route.ts` |
| `/api/auth/oauth/google/callback` | Verifies state, exchanges code, links or creates user, signs session | `src/app/api/auth/oauth/google/callback/route.ts`, `src/lib/google-oauth.ts` |
| `/api/auth/forgot-password` | Issues reset token and sends SMTP email when configured | `src/app/api/auth/forgot-password/route.ts`, `src/lib/email.ts` |
| `/api/auth/reset-password` | Consumes reset token and writes new password | `src/app/api/auth/reset-password/route.ts` |
| `/api/profile` | Profile field updates and avatar upload | `src/app/api/profile/route.ts`, `src/lib/uploads.ts` |
| `/api/profile/change-password` | Authenticated password change | `src/app/api/profile/change-password/route.ts` |
| `/api/time` | `load`, task CRUD, task status, planning horizon CRUD/move/complete, idea CRUD | `src/app/api/time/route.ts` |
| `/api/money` | Initial data, currency settings, transaction CRUD, account CRUD, lending CRUD/settle | `src/app/api/money/route.ts` |
| `/api/crm` | Lead CRUD, batch operations, scrape jobs, dashboard stats, AI outreach, settings, contacts, projects, project status | `src/app/api/crm/route.ts`, `src/lib/services/crm.ts` |
| `/api/shops` | Google Places nearby-search proxy for map scraper | `src/app/api/shops/route.ts` |
| `/api/notion` | `sync`, `update_settings` | `src/app/api/notion/route.ts`, `src/lib/notion.ts` |
| `/api/posts` | Feed/saved reads, create/edit/delete, comments, votes, ask resolve/reopen/accept answer, likes, bookmarks, reports, reposts, seen marks | `src/app/api/posts/route.ts`, `src/lib/services/posts/*` |
| `/api/social` | Friend request lifecycle, unfriend, block/unblock, status, friends, requests, discovery, search | `src/app/api/social/route.ts`, `src/lib/social-actions.ts` |
| `/api/messages` | Contacts, thread reads, send, typing, mark read | `src/app/api/messages/route.ts`, `src/context/MessagesContext.tsx` |
| `/api/notifications` | Mark all notifications read | `src/app/api/notifications/route.ts` |
| `/api/stream` | Active-mode Server-Sent Events live sync | `src/app/api/stream/route.ts`, `src/lib/live-sync.ts` |
| `/api/heartbeat` | AFK-mode live sync poll and notification bootstrap | `src/app/api/heartbeat/route.ts`, `src/lib/live-sync.ts` |
| `/api/report-error` | Client error intake, throttled and emailed through bug reporter | `src/app/api/report-error/route.ts`, `src/lib/bug-report.ts` |

## Route Pattern

Most APIs follow this pattern:

1. Wrap route with `withAuth()` for private endpoints or `withError()` for public/mixed endpoints.
2. Parse `action` from query string or request body.
3. Validate input at the route/service boundary.
4. Delegate real logic to a service/model.
5. Return shaped JSON with no internal stack/path leaks.

## Public vs Private API Note

The page proxy does not protect API routes. API routes must protect themselves with `withAuth()`, `getSessionUser()`, or route-specific public validation.
