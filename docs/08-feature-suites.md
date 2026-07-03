# Feature Suites

This file explains how each product suite works and where it lives in the repository.

## Social Feed

Routes:

- `/home`
- `/saved`
- `/p/[postId]`

Files:

- `src/app/(dashboard)/home/page.tsx`
- `src/app/(dashboard)/home/useFeed.ts`
- `src/app/(dashboard)/home/usePostSeenTracker.ts`
- `src/components/ui/PostComposer.tsx`
- `src/components/ui/PostCard.tsx`
- `src/lib/services/posts/*`
- `src/app/api/posts/route.ts`

Capabilities:

- Status, ask, and win posts.
- Post image support.
- Mentions/tags through composer logic.
- Like, comment, upvote comment, bookmark, report, repost.
- Ask resolve/reopen and accepted-answer flow.
- Tiered feed loading: unseen first, seen backfill.
- Saved posts route.
- New-post realtime refresh pill.

## Community

Routes:

- `/community`
- `/community/friends`
- `/community/discover`
- `/community/requests`

Files:

- `src/app/(dashboard)/community/*`
- `src/app/api/social/route.ts`
- `src/lib/social-actions.ts`

Capabilities:

- Friend/connect request lifecycle.
- Discovery/search.
- Friend list.
- Incoming and outgoing requests.
- Block/unblock.

## Messages

Routes:

- `/messages`

Files:

- `src/context/MessagesContext.tsx`
- `src/components/chat/ChatDock.tsx`
- `src/components/chat/RightSidebar.tsx`
- `src/components/chat/TypingDots.tsx`
- `src/app/api/messages/route.ts`

Capabilities:

- 1:1 conversations between friends.
- Contacts ordered by recent activity.
- Docked chat windows.
- Typing pings.
- Read receipts.
- Realtime delivery through live sync events.

## Time Suite

Routes:

- `/time/execution`
- `/time/tasks`
- `/time/planning`
- `/time/ideas`
- `/time/tracker`

Files:

- `src/app/(dashboard)/time/*`
- `src/app/api/time/route.ts`

Capabilities:

- Pomodoro focus engine with persistent local timer state.
- Task board with priority, duration blocks, completion, restore/delete.
- Planning horizons: week, month, year.
- Drag/move planning items.
- Idea capture and editing.
- Tracker page for daily review.

## Money Suite

Routes:

- `/money/dashboard`
- `/money/accounts`
- `/money/income`
- `/money/expenses`
- `/money/lend`

Files:

- `src/context/MoneyContext.tsx`
- `src/app/(dashboard)/money/*`
- `src/app/api/money/route.ts`

Capabilities:

- Accounts and balances.
- Income and expenses.
- Category/budget logic.
- Lending and debt tracking.
- Primary/secondary currency display.
- Dashboard aggregation.

## CRM Suite

Routes:

- `/crm`
- `/crm/leads`
- `/crm/pipeline`
- `/crm/contacts`
- `/crm/outreach`
- `/crm/projects`

Files:

- `src/app/(dashboard)/crm/*`
- `src/components/crm/*`
- `src/lib/services/crm.ts`
- `src/app/api/crm/route.ts`
- `src/app/api/shops/route.ts`
- `src/app/api/notion/route.ts`

Capabilities:

- Google Maps lead scraping/proxy flow.
- Lead vault with batch operations.
- Pipeline/Kanban flow.
- Lead qualification bridge into projects, tasks, income, and lending.
- Contacts and project delivery tracking.
- Outreach generation.
- Notion settings/sync.

## Profile And Settings

Routes:

- `/me`
- `/settings`
- `/u/[username]`

Files:

- `src/app/(dashboard)/me/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/u/[username]/*`
- `src/app/api/profile/route.ts`
- `src/app/api/profile/change-password/route.ts`
- `src/app/api/auth/route.ts`

Capabilities:

- Profile editing and avatar upload.
- Password change.
- Timezone, language, notifications, and currency settings.
- Public profile with social actions and live status.

Public profile (`/u/[username]`) details:

- Server queries are parallelized (presence + session, then posts + mutual friends) and the profile row is request-deduped between `generateMetadata` and the page body via React `cache()`.
- Emits Open Graph `profile`, Twitter card, and canonical metadata (absolute URLs via `metadataBase` in the root layout, driven by `APP_URL`).
- Connect buttons cover the full relationship lifecycle including blocked states: `blocked_by_me` renders a Blocked button whose hover reveals Unblock (`unblock` API action); `blocked_by_them` hides the controls and the CTA copy switches to "Connections are unavailable".
- Post previews are clamped to 4 lines; plain reposts render as the original post with a "reposted" attribution.
- Unknown usernames render a branded `not-found.tsx` card instead of the framework default 404.

## Landing, Pricing, And Sign-In

Routes:

- `/`
- `/pricing`
- `/sign`
- `/forgot-password`

Files:

- `src/app/page.tsx`
- `src/app/pricing/page.tsx`
- `src/app/sign/page.tsx`
- `src/app/forgot-password/page.tsx`
- auth API routes.

Capabilities:

- Public marketing entry.
- Upgrade surface.
- Credentials login/register.
- Google OAuth.
- Password recovery.
