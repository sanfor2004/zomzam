# Cross-Suite Bridges

The product value comes from features talking to each other. This file lists the bridges that should stay intentional and transactional.

## CRM Qualification Bridge

Primary file: `src/lib/services/crm.ts`

Trigger: lead moves into `qualified` — the sole money-writing lead state — reachable only through the `qualify_lead` action (the status enum has no won/closed value; "Closed Won" is UI wording). Direct status updates to `qualified` are rejected by the service.

Effects:

1. Updates the lead status.
2. Creates a CRM project/delivery tracker.
3. Seeds Time tasks for delivery milestones.
4. Creates a Money income transaction.
5. Increments the selected deposit account balance.
6. Optionally creates a lending record when money is due later.

Why it matters: CRM is not just a list of leads. Closed work immediately appears in execution and finance.

## Project Completion Bridge

Primary tables/files:

- `time_tasks`
- `crm_projects`
- `src/app/api/time/route.ts`
- `scripts/db-sync.ts`

Completion of delivery-related tasks can update project delivery state. Keep this path explicit so task completion and project status do not drift.

## Posts To Notifications

Primary files:

- `src/app/api/posts/route.ts`
- `src/lib/services/posts/*`
- `src/lib/models/user.ts`

Examples:

- Accepting an answer notifies the helper.
- New ask posts can notify skill-matched friends/followers.
- Reposts notify the original author, with aggregation to prevent spam.

Notifications are stored in `notifications`, then pushed live through `pushStreamOrder()`.

## Posts To Realtime Feed

When a post is created, the API computes the audience with `getFeedAudience()` and pushes `new_post` stream orders with `touchLastSeen = false`.

The client receives this as a `posts` sync section and shows a feed refresh affordance rather than forcibly rearranging the user's current feed.

## Messages To Realtime

Primary files:

- `src/app/api/messages/route.ts`
- `src/context/MessagesContext.tsx`
- `src/context/StreamWaiterContext.tsx`

Message send/read/typing events are queued as stream orders and then dispatched as browser events:

- `zz-new-message`
- `zz-typing`
- `zz-message-read`
- `zz-contacts-presence`

`MessagesContext` consumes them and updates chat UI.

## Social Graph To Product Surface

Primary files:

- `src/app/api/social/route.ts`
- `src/lib/social-actions.ts`
- `src/lib/services/posts/feed.ts`
- `src/components/chat/RightSidebar.tsx`

The social graph affects:

- Feed visibility.
- Post audience.
- Message eligibility.
- Contacts/presence rails.
- Community discovery.
- Public profile actions.

## Presence (First-Party Only)

Primary files:

- `src/context/StreamWaiterContext.tsx`
- `src/lib/live-sync.ts`
- `src/lib/models/user.ts`

Presence never crosses to the public profile. The realtime channels serve only the signed-in user's own status and their accepted friends' `contacts_presence` (chat dock). Public profiles (`/u/[username]`) expose no presence at all — watching another account's online status is not possible.

## Money To Settings

Primary files:

- `src/context/MoneyContext.tsx`
- `src/app/api/money/route.ts`
- `src/app/api/auth/route.ts`
- `src/app/(dashboard)/settings/page.tsx`

Primary and secondary currency settings affect Money dashboards and cross-suite values. Keep accepted currency enums synchronized across settings and money logic.

## Design Rule For New Bridges

Any new bridge should document:

- Trigger.
- Source table/service.
- Target table/service.
- Transaction boundary.
- Realtime side effects.
- Failure behavior.

If a bridge changes a route, API action, or data model, update the matching docs in this folder.
