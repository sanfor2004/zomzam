# Data And Database

Zomzam uses MySQL through `mysql2/promise`. Schema is defined in code and synced by script.

## Core Files

- `src/lib/db.ts` - pool, query helpers, transaction helper.
- `scripts/db-sync.ts` - declarative schema sync and seed/default logic.
- `src/lib/services/*` - feature business logic.
- `src/lib/models/user.ts` - user, presence, notifications, and stream queue model.

## Schema Sync

Run:

```bash
npm run db:sync
```

This executes:

```bash
npx tsx scripts/db-sync.ts
```

`db-sync.ts` loads `.env` and `.env.local`, then applies the schema map. It is the database source of truth and should be updated with every new table or column.

## Major Table Families

| Family | Tables |
| --- | --- |
| Users/session/profile | `users`, `password_reset_tokens` or reset fields on `users` depending on route logic |
| Presence/realtime | `user_online_status` |
| Social graph | `user_connections` |
| Notifications | `notifications` |
| Messages | `conversations`, `messages`, `message_reactions` |
| Safety/audit | `user_audit_log` (append-only moderation trail — username changes, avatar change/remove, post deletions; written by `src/lib/models/audit.ts`, best-effort, not surfaced in-app yet) |
| Time | `time_tasks`, `time_horizons`, `time_ideas`, `time_links`, `time_task_links` |
| Money | `money_accounts`, `money_categories`, `money_transactions`, `money_lend` |
| CRM | `crm_leads`, `crm_scrape_jobs`, `crm_settings`, `crm_projects` |
| Posts | `posts`, comments, likes, bookmarks, reports, views, repost/favor-economy related tables as defined in `db-sync.ts` |
| Rate limits | DB-backed limiter tables defined by `src/lib/rate-limit.ts` / sync script |

## Ownership Rule

Private records must be scoped by `user_id`. Services should never trust a client-provided record ID without checking ownership in the query.

Examples:

- CRM service receives `userId` and lead/project IDs, then scopes every mutation to that owner.
- Money actions are user-scoped.
- Time tasks and ideas are user-scoped.
- Feed/post operations combine visibility, ownership, and social graph rules.

## Transactions

Use `transaction()` from `src/lib/db.ts` for multi-step mutations that must be atomic.

Important transactional flows:

- CRM `qualifyLead()` updates lead status, creates project state, seeds tasks, records income, updates account balance, and may create lending records.
- Live sync drains `stream_queue` with `SELECT ... FOR UPDATE` and clears it in the same transaction.
- Post answer acceptance and ask resolution should keep post/comment state consistent.

## IDs And Public References

Internal rows use numeric IDs. Public post permalinks use opaque `public_id` values so URLs do not expose sequential database IDs.

## JSON Columns

JSON is used for:

- `user_online_status.stream_queue`
- notification payloads
- user profile tags
- some feature settings or metadata

When reading JSON columns, code must tolerate either stringified JSON or already-parsed driver output.

## Currency

Allowed currencies currently appear as `EGP`, `USD`, `EUR`, and `GBP`. User settings keep primary and secondary currency preferences. Conversion helpers live in `src/lib/utils.ts`.
