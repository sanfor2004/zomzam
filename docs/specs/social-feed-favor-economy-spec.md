# Spec: Social Feed — Favor Economy (Ask/Help + Win Posts)

> **Status:** proposed · **Type:** extension of the existing feed (`src/app/(dashboard)/home`, `api/posts`)
> **Mission fit:** the feed is the heart of the app — "the free Life OS for freelancers who don't want to work alone." Today it's technically excellent but professionally generic (status + like + comment + tag-ranked). This wires it to the work: freelancers get *unblocked* (Ask/Help) and *celebrated* (Win), surfacing the favor economy `credits-economy.md` designed but never built.

---

## 1. Scope & launch flags

| Pillar | Launch? | Notes |
| :--- | :---: | :--- |
| **Ask / Help posts** (favor economy) | 🟢 **Launch** | Core of this spec |
| **Win posts** (celebrate spine milestones) | 🟢 **Launch** | Core of this spec |
| **Co-Focus Rooms + live feed card** | 🟠 **POST-LAUNCH — NOT at launch** | Documented in §7; the room engine is the real build, deferred. **Do not implement for launch.** |

> ⚠️ **Launch boundary:** Sections 3–6 are the launch build. Section 7 (Co-Focus Rooms) is a fenced, post-launch phase — design recorded now so it's deliberate, but explicitly out of launch scope.

---

## 2. Locked design decisions (grilled 2026-06-21)

| # | Decision | Outcome |
| :-- | :--- | :--- |
| 1 | **Type model** | One `posts.type ENUM('status','ask','win')` DEFAULT `'status'`. One feed, one card, branch on type. Existing rows untouched. NOT separate tables, NOT JSON meta. |
| 2 | **Helpful mechanic** | Asker accepts **one** answer (`posts.accepted_answer_id`) → resolves ask + is the (future) credit trigger. Existing `comment_votes` stays a separate crowd-upvote signal. |
| 3 | **Credits scope** | Hook only: accept → resolve + notify helper + log append-only `helpful_events`. **No balance/ledger** — credits are a separate dormant project (`credits-economy.md` §8). |
| 4 | **Win consent/privacy** | Never auto-post. Bridge fires a "Share this win?" prompt → composer prefilled, **amount hidden by default**, opt-in amount toggle + visibility select. |
| 5 | **Win triggers** | Deal closed (`qualify_lead` bridge) + project delivered (delivery bridge) only — both already fire. |
| 6 | **Composer UX** | Segmented Status·Ask·Win switch (reuse Kit `AudienceSwitch`); picking Ask reveals a skill/topic tag (reuse existing tag system). |
| 7 | **Ask discovery** | Boost open/unresolved asks in-feed (time-decayed, via the tag-overlap signal at `api/posts/route.ts:378`) + "Help requests → matching your skills" filter + notify skill-matched users on new ask. |

---

## 3. Data model (launch)

All additive, backward-compatible. Posts tables live in `api/posts/route.ts` (created via `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER`s at boot, the existing pattern there).

```sql
-- posts: add type + ask fields (idempotent INFORMATION_SCHEMA-guarded ALTERs, like the existing visibility/image_path adds)
ALTER TABLE posts ADD COLUMN type ENUM('status','ask','win') NOT NULL DEFAULT 'status';
ALTER TABLE posts ADD COLUMN skill_tag VARCHAR(50) NULL DEFAULT NULL;          -- ask routing/matching
ALTER TABLE posts ADD COLUMN accepted_answer_id BIGINT UNSIGNED NULL DEFAULT NULL; -- FK -> post_comments.id
ALTER TABLE posts ADD COLUMN resolved_at DATETIME NULL DEFAULT NULL;           -- set on accept OR manual resolve
ALTER TABLE posts ADD INDEX idx_type_resolved (type, resolved_at);

-- append-only log the future credits engine consumes (NOT a ledger)
CREATE TABLE IF NOT EXISTS helpful_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id BIGINT UNSIGNED NOT NULL,
  comment_id BIGINT UNSIGNED NOT NULL,
  helper_user_id INT UNSIGNED NOT NULL,   -- answer author (future credit recipient)
  asker_user_id INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- **Win posts need no extra columns.** Amount (if the user opts in) lives in the body text only → zero schema leak surface. `type='win'` drives rendering; `visibility` reuses the existing column.
- `resolved` is derived: `resolved_at IS NOT NULL`.

---

## 4. API changes (`api/posts/route.ts`)

- **Create (`POST`)** — accept `type` and (for asks) `skill_tag`; persist on the `INSERT INTO posts`. Reuse `sanitizeHtml` (see §8 security note). Win posts are created through the same path (the prompt just pre-fills the composer).
- **New action `accept_answer`** — `{ post_id, comment_id }`. Guard: only the post owner, post must be `type='ask'`, comment must belong to the post. Effects (single transaction): set `accepted_answer_id` + `resolved_at=NOW()`, insert a `helpful_events` row, create a notification to the answer's author (`type='answer_accepted'`). Idempotent / re-markable (changing the accepted answer updates the row). **No credit balance touched.**
- **Optional action `resolve_ask`** — asker marks resolved without accepting ("solved it myself"): set `resolved_at`, no `helpful_events`, no notification.
- **Feed query (`action=feed`)** — add `p.type, p.skill_tag, p.accepted_answer_id, p.resolved_at` to the SELECT. Extend the existing tag-overlap ranking (`:378`): add a **time-decayed boost** for `type='ask' AND resolved_at IS NULL` whose `skill_tag` matches the viewer's tags; de-boost resolved asks. New optional `filter` param: `help` (asks only) and `help_matches` (open asks whose `skill_tag` ∈ viewer tags).
- **Notifications** — on new ask creation, enqueue `type='new_help_request'` to skill-matched users (matching `skill_tag`, scoped to friends/follows, **throttled** — cap per user/day to prevent nag). Delivered over the existing `/api/stream` SSE pipe.

---

## 5. UI changes (`home/page.tsx`, `PostComposer.tsx`)

- **Composer** — a segmented `AudienceSwitch`: 💬 Status · 🙋 Ask · 🎉 Win at the top. Selecting **Ask** reveals a `skill_tag` `Dropdown` (sourced from the existing tag set) + question-framed placeholder. Reuses the shared rich editor (the one being extracted per the prior feed-redesign work).
- **Win prompt** — on the deal-closed and project-delivered bridges, fire a `Toast`/`Modal`: "Nice! Share this win? 🎉" → opens the composer prefilled with a celebratory draft, **amount omitted**, with an `[ ] include amount` toggle + visibility select. Dismissible. (Hook into the same client flow that already reacts to those bridge completions.)
- **Post card rendering** — branch `PostCard` on `post.type`:
  - `status` — unchanged.
  - `ask` — a distinct "Help needed" badge + `skill_tag` chip; if resolved, pin the accepted answer at top with a green ✓; owner sees a "mark helpful" affordance on each answer (comment). Resolved asks stay commentable.
  - `win` — celebratory styling/badge; reuse `canvas-confetti` on first paint (respecting `prefers-reduced-motion`).
- **Feed filter** — a "Help requests" tab/filter with a "matching your skills" view (drives the `filter=help` / `help_matches` params).

---

## 6. Defaults locked (un-grilled, vetoable)

- Resolved ask pins the accepted answer (green ✓), stays open to comments.
- Asker may resolve without accepting (no `helpful_events`, no credit).
- Skill-match notifications throttled + relationship-scoped (friends/follows only).
- Win posts store no amount column; amount, if included, is body text only.
- Win cards reuse `canvas-confetti`; all motion gated by `prefers-reduced-motion`.

---

## 7. Co-Focus Rooms — 🟠 POST-LAUNCH (NOT in launch scope)

> **This entire section is deferred to after launch. Do not build it for the launch milestone.** Recorded here so the design is deliberate when it's picked up.

**Concept:** an **ad / notification-style feed card** that advertises a *currently running* public focus room, with a **Join** CTA — visually distinct from the basic post card so it's caught by the eyeball mid-scroll.

**Decided constraints:**
- **No live timer / no live time-tracking on the card.** (Perf call: a per-card synced/ticking timer risks a repeat of the P3 rAF/TBT regression that got the dashboard WebGL fluid sim removed.) The card is a static-ish referral to the room — Join CTA + at most a **static contributor count** ("N focusing now"), refreshed only on normal feed load, not a live tick.
- **Not a `posts` row.** It is ephemeral, system-generated live state — **inject it into the feed from live room state over the existing `/api/stream` SSE pipe**, never persist it as a post (avoids dead "Join" cards for ended rooms polluting the feed/permalinks).
- **The real build is the room engine, not the card** — room lifecycle (open→running→ended), membership/presence, host, topic, and a shared room concept. That subsystem does not exist today (the current Pomodoro timer is per-user `localStorage`, single-user). **Deferred.**

**Open design forks (to grill when this phase starts):** one card per room vs. one aggregate "rooms live" card; placement (pinned top vs. inline); what counts as a "contributor"; cold-start seeding from friends' live sessions.

---

## 8. Security note (pre-launch)

`sanitizeHtml` (`api/posts/route.ts:79`) is a regex blocklist; no DOMPurify installed. Ask/Win widen reliance on the post-creation path. **Harden before launch** (carried over from the earlier feed-redesign findings). Not strictly part of this feature, but this work increases its exposure.

---

## 9. Build order (launch scope)

1. **Schema** — add `type` + ask columns + `helpful_events` (idempotent ALTERs in `api/posts/route.ts` boot block).
2. **API** — create-with-type; `accept_answer` (+ optional `resolve_ask`); feed SELECT + ranking boost + filters; new-ask notifications.
3. **Composer** — Status·Ask·Win switch + ask skill-tag field.
4. **Post card** — per-type rendering (ask badge / accepted-answer pin / mark-helpful; win badge + confetti).
5. **Win prompt** — wire the deal-closed + project-delivered bridges to the prefilled composer.
6. **Help filter** — "Help requests / matching your skills" view.
7. **README** — `/api/posts` gains `accept_answer` (+ maybe `resolve_ask`); update the API Endpoints table. No new routes/pages/deps → Site Map and Tech Stack unchanged.

> Co-Focus Rooms (§7) is a separate, later phase — do not include in the launch build.
