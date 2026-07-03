# Realtime: SSE And Heartbeat

Zomzam has two live channels. They are mutually exclusive and share one payload shape.

Files:

- `src/context/StreamWaiterContext.tsx`
- `src/lib/live-sync.ts`
- `src/app/api/stream/route.ts`
- `src/app/api/heartbeat/route.ts`
- `src/lib/models/user.ts`
- `src/context/MessagesContext.tsx`
- `src/components/chat/*`

## Auth

Both channels are **auth-gated** (`withAuth` → 401 without a valid session). A connection only ever serves the signed-in user's own live data; there is no client-supplied identifier and no way to watch another account's presence. (Public profiles at `/u/[username]` deliberately show no presence indicator.)

## The Two Channels

| Mode | Transport | When used | Server meaning |
| --- | --- | --- | --- |
| Active | `EventSource('/api/stream')` | User is engaged with the app | Open stream means active, so `is_idle = 0` |
| AFK | `POST /api/heartbeat` every 5 seconds | No input for 60 seconds or tab hidden | Heartbeat means away, so `is_idle = 1` |

The client never sends "I am active" or "I am idle" as trusted state. The server derives presence from the channel being used.

## Shared Payload Builder

`src/lib/live-sync.ts` exports:

- `drainLiveSync(userId, opts)`
- `isEmptySync(payload)`

`drainLiveSync()` is the single source of truth for both transports. It atomically drains `user_online_status.stream_queue` inside a transaction with `SELECT ... FOR UPDATE`, groups known order names, drops unknown ones, and optionally includes the caller's contacts presence.

## Sync Payload Shape

```ts
interface LiveSyncPayload {
  messages: LiveEvent[];
  notifications: any[];
  posts: any[];
  social: any[];
  contacts_presence: ContactPresence[] | null;
}
```

Sections:

- `messages`: `new_message`, `typing`, `message_read`.
- `notifications`: live notification rows for bell/toasts.
- `posts`: `new_post` feed refresh signals.
- `social`: connection request/accept updates.
- `contacts_presence`: throttled friend presence snapshot for chat surfaces.

## Active SSE Flow

`/api/stream` (gated by `withAuth`):

1. Receives the verified session `user` from `withAuth` (401 otherwise).
2. Opens a `ReadableStream` with `text/event-stream`.
3. Sends an initial ping comment so `EventSource` opens immediately.
4. Every 2 seconds:
   - Calls `updateOnlineStatus(user.id, 0)`.
   - Calls `drainLiveSync(user.id, ...)`.
   - Includes contacts presence every 10 ticks, about every 20 seconds.
   - Emits `event: sync` only when the payload is non-empty.
5. Sends keepalive ping comments every 20 seconds.

## AFK Heartbeat Flow

`/api/heartbeat` (gated by `withAuth`):

1. Receives the verified session `user` from `withAuth` (401 otherwise).
2. Parses JSON body safely.
3. Treats only literal `init: true` as bootstrap request.
4. Rate-limits by user.
5. Calls `updateOnlineStatus(user.id, wantsInit ? 0 : 1)`. Routine beats mark the user idle, while bootstrap (`init: true`) requests keep them active.
6. Calls `drainLiveSync(user.id, ...)`.
7. When `init` is true, adds `notifications_bootstrap` with unread count and recent rows.

## Client Mode Switching

`StreamWaiterProvider` starts active:

- On mount, it sends one `init` heartbeat to bootstrap notifications and drain missed events.
- It opens `/api/stream` in active mode.
- It flips to AFK after 60 seconds without input or when the tab becomes hidden.
- AFK mode closes SSE and starts a 5-second heartbeat interval.
- Any activity flips back to active; heartbeat cleanup sends one `init` catch-up before SSE resumes.
- Heartbeat requests are guarded by an `AbortController` to prevent late responses from racing mode switches and corrupting presence state.

## Applying Live Data

Both channels call one `applySync()` function:

- Message events dispatch browser events consumed by `MessagesContext`.
- Notifications update local notification state using functional atomic updates (preventing unread badge drift) and dispatch `new-notification`.
- New posts dispatch `zz-new-post` for the feed refresh pill.
- Social updates dispatch `zz-social-update`.
- Contacts presence dispatches `zz-contacts-presence`.

## Event Queue

`pushStreamOrder(userId, orderName, params, touchLastSeen)` appends JSON orders to `user_online_status.stream_queue`.

Important rule: delivery events should usually pass `touchLastSeen = false` so receiving a notification or broadcast does not falsely make the recipient appear online.

Queue safety:

- Appends are atomic with MySQL JSON operations.
- Queues are capped to prevent abandoned users from accumulating unlimited events.
- Draining clears the queue before processing so SSE and heartbeat cannot double-deliver during mode switches.
- Stale queues drop transient typing events.

## Public Profile Presence — Removed

Public profiles (`/u/[username]`) intentionally show **no** presence indicator. Exposing a user's online/idle/last-seen status to anonymous or third-party visitors is a privacy leak, so the whole "watch another user's presence" capability was removed:

- No `PublicUserStatus` component, no `viewed_user_status` payload field, no `viewing_user_id` request parameter, and no `parseViewingUserId` / `getOnlineStatus` helpers.
- `/api/stream` and `/api/heartbeat` are now hard-gated by `withAuth` (previously soft-auth, which existed solely to serve this anonymous presence).

Presence that remains is strictly first-party: a user's own status (drives their idle/online state) and `contacts_presence` (accepted friends only, for the chat dock).

## Read Receipts Consistency

When a thread is opened via `GET /api/messages?action=thread` (and it's not a background peek), messages are marked as read. The server actively pushes a `message_read` order to the sender, ensuring "Seen" labels appear instantly without a client-side follow-up request.
