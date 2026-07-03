# Architecture

Zomzam is a Next.js 16.2.7 App Router application using React 19, Tailwind CSS v4, MySQL, jose JWT sessions, and a self-owned UI system.

## Runtime Shape

- App framework: `src/app`.
- Route protection: `src/proxy.ts` for pages, `src/lib/api-auth.ts` for APIs.
- Database access: `src/lib/db.ts`.
- Schema sync: `scripts/db-sync.ts`.
- Business services: `src/lib/services`.
- Global client state: `src/context`.
- UI primitives: `src/components/ui`.
- Feature components: `src/components/chat`, `src/components/crm`, `src/components`.

## Important Source Map

| Area | Files |
| --- | --- |
| Root shell | `src/app/layout.tsx`, `src/app/providers.tsx`, `src/app/globals.css`, `src/app/global-error.tsx` |
| Dashboard shell | `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/DashboardShell.tsx` |
| Page proxy | `src/proxy.ts` |
| Sessions | `src/lib/session.ts`, `src/lib/api-auth.ts`, `src/lib/auth.ts`, `src/lib/google-oauth.ts` |
| Realtime | `src/context/StreamWaiterContext.tsx`, `src/lib/live-sync.ts`, `src/app/api/stream/route.ts`, `src/app/api/heartbeat/route.ts` |
| Messaging | `src/context/MessagesContext.tsx`, `src/components/chat/*`, `src/app/api/messages/route.ts` |
| Social feed | `src/app/(dashboard)/home/*`, `src/components/ui/PostComposer.tsx`, `src/components/ui/PostCard.tsx`, `src/lib/services/posts/*`, `src/app/api/posts/route.ts` |
| CRM | `src/app/(dashboard)/crm/*`, `src/components/crm/*`, `src/lib/services/crm.ts`, `src/app/api/crm/route.ts` |
| Money | `src/context/MoneyContext.tsx`, `src/app/(dashboard)/money/*`, `src/app/api/money/route.ts` |
| Time | `src/app/(dashboard)/time/*`, `src/app/api/time/route.ts` |
| UI Kit | `src/components/ui/*`, `src/app/ui-kit/page.tsx` |
| Brand tokens | `BrandGuideLine.md`, `src/app/globals.css` |

## App Router Structure

Public routes live directly under `src/app`:

- `/` from `src/app/page.tsx`.
- `/sign`.
- `/forgot-password`.
- `/pricing`.
- `/ui-kit`.
- `/u/[username]`.
- `/p/[postId]`.

Authenticated dashboard routes live under `src/app/(dashboard)`. The route group does not appear in the URL, but it shares a single layout and shell.

## Dashboard Shell

`DashboardShell` composes the authenticated app:

1. `CurrentUserProvider` receives the server-loaded user.
2. `StreamWaiterProvider` owns presence, notifications, SSE, and heartbeat.
3. `MessagesProvider` owns direct-message contacts, docked chat windows, unread state, typing, and read receipts.
4. `MoneyProvider` owns accounts, transactions, lending, balances, and currency settings.
5. `DashboardLayoutContent` renders the left desktop sidebar, topbar, right sidebar, chat dock, notification toaster, mobile bottom nav, and mobile menu sheet.

## Separation Rules

- API routes should be thin dispatch layers.
- Business logic belongs in `src/lib/services` or purpose-specific model files.
- UI state should be kept inside page hooks/services when it is feature-scoped.
- Shared interaction primitives belong in `src/components/ui`.
- Shared global state belongs in `src/context` only when multiple route families need it.

## Dependency Policy

Installed stack is intentionally small:

- UI: Zomzam Kit, Tailwind v4, lucide-react.
- Animation: GSAP via `src/lib/gsap.ts`, canvas-confetti.
- 3D: three + `@react-three/fiber`, only when gated.
- Auth: jose and bcryptjs.
- DB: mysql2/promise.
- Sanitization: isomorphic-dompurify.
- Upload/image processing: sharp and Vercel Blob.
- Maps: `@vis.gl/react-google-maps`.

Do not add shadcn/ui, Radix UI, Framer Motion, React Hook Form, Zod, Recharts, D3, Spline, or drei without a deliberate product and architecture decision.
