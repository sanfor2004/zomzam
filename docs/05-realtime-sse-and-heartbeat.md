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

## The Two Channels

| Mode | Transport | When used | Server meaning |
| --- | --- | --- | --- |
| Active | `EventSource('/api/stream')` | User is engaged with the app | Open stream means active, so `is_idle = 0` |
| AFK | `POST /api/heartbeat` every 5 seconds | No input for 60 seconds or tab hidden | Heartbeat means away, so `is_idle = 1` |

The client never sends "I am active" or "I am idle" as trusted state. The server derives presence from the channel being used.

## Shared Payload Builder

`src/lib/live-sync.ts` exports:

- `parseViewingUserId(raw)`
- `drainLiveSync(userId, viewingUserId, opts)`
- `isEmptySync(payload)`

`drainLiveSync()` is the single source of truth for both transports. It atomically drains `user_online_status.stream_queue` inside a transaction with `SELECT ... FOR UPDATE`, groups known order names, drops unknown ones, and optionally includes contacts presence and viewed-user status.

## Sync Payload Shape

```ts
interface LiveSyncPayload {
  messages: LiveEvent[];
  notifications: any[];
  posts: any[];
  social: any[];
  viewed_user_status: any | null;
  contacts_presence: ContactPresence[] | null;
}
```

Sections:

- `messages`: `new_message`, `typing`, `message_read`.
- `notifications`: live notification rows for bell/toasts.
- `posts`: `new_post` feed refresh signals.
- `social`: connection request/accept updates.
- `viewed_user_status`: live public profile status.
- `contacts_presence`: throttled friend presence snapshot for chat surfaces.

## Active SSE Flow

`/api/stream`:

1. Soft-reads the session with `getSessionUser()`. Anonymous viewers are allowed for public profile status.
2. Parses `viewing_user_id` through `parseViewingUserId()`.
3. Opens a `ReadableStream` with `text/event-stream`.
4. Sends an initial ping comment so `EventSource` opens immediately.
5. Every 2 seconds:
   - If authenticated, calls `updateOnlineStatus(user.id, 0)`.
   - Calls `drainLiveSync()`.
   - Includes contacts presence every 10 ticks, about every 20 seconds.
   - Emits `event: sync` only when the payload is non-empty.
6. Sends keepalive ping comments every 20 seconds.

## AFK Heartbeat Flow

`/api/heartbeat`:

1. Soft-reads the session.
2. Parses JSON body safely.
3. Strictly parses `viewing_user_id`.
4. Treats only literal `init: true` as bootstrap request.
5. Rate-limits by user or IP.
6. If authenticated, calls `updateOnlineStatus(user.id, wantsInit ? 0 : 1)`. Routine beats mark the user idle, while bootstrap (`init: true`) requests keep them active.
7. Calls `drainLiveSync()`.
8. When `init` is true, adds `notifications_bootstrap` with unread count and recent rows.

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
- Viewed profile status updates the public profile badge.
- Contacts presence dispatches `zz-contacts-presence`.

## Event Queue

`pushStreamOrder(userId, orderName, params, touchLastSeen)` appends JSON orders to `user_online_status.stream_queue`.

Important rule: delivery events should usually pass `touchLastSeen = false` so receiving a notification or broadcast does not falsely make the recipient appear online.

Queue safety:

- Appends are atomic with MySQL JSON operations.
- Queues are capped to prevent abandoned users from accumulating unlimited events.
- Draining clears the queue before processing so SSE and heartbeat cannot double-deliver during mode switches.
- Stale queues drop transient typing events.

## Public Profile Presence

`src/app/u/[username]/PublicUserStatus.tsx` uses a lightweight `usePublicPresence` hook to watch a user's presence anonymously.
Unlike the global `StreamWaiterProvider`, this hook only opens the SSE channel for `viewed_user_status` frames and deliberately omits idle detection, notification polls, and heartbeat loops. This ensures a viewer's own presence isn't accidentally mutated while visiting a profile.

Behavior details:

- The offline "Seen Xm ago" label ticks client-side every 30 seconds. The hook anchors `last_seen` to the client clock using the server-sent `diff`, because the stream dedupes identical `viewed_user_status` frames and would otherwise let the label go stale.
- The SSE connection closes while the tab is hidden and reconnects when it becomes visible again, so hidden anonymous profile tabs never hold a server connection. A fresh connection always receives an immediate status frame, which re-syncs the badge on return.
- Reconnect backoff (max 15 attempts) resets on tab focus and on the browser `online` event, so a dropped connection is never permanently dead.
- The badge is wrapped in `role="status"` with `aria-live="polite"`, and offline states expose the exact local last-seen datetime via a `title` tooltip.

## Read Receipts Consistency

When a thread is opened via `GET /api/messages?action=thread` (and it's not a background peek), messages are marked as read. The server actively pushes a `message_read` order to the sender, ensuring "Seen" labels appear instantly without a client-side follow-up request.
