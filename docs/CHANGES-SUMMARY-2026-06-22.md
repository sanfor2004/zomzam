# What Changed — Backend Remediation Phase 3 + Social Feed Favor Economy

> **Plain-English summary for the team.** Date: 2026-06-22.
> Covers the work executed from the spec set: **Spec 1 (audit) → Spec 2 (remediation, incl. Phase 3) → Spec 3 (favor economy)**. Spec 4 (Client Profitability) and Spec 5 (post editing/uploads) were **not** part of this push. Everything below is shipped, type-checks, builds, and is covered by the new tests.

---

## The 30-second version

We did two big things:

1. **Cleaned up the backend's structure and added the project's first automated tests** (finishing the security/remediation spec).
2. **Turned the social feed into a "favor economy"** — people can now post **Asks** (ask for help and accept the best answer) and **Wins** (celebrate closing a deal or delivering a project), on top of normal status posts.

No new heavy dependencies were added. The app behaves the same for everything that already worked; we only *added* capabilities and *reorganized* code behind the scenes.

---

## Part 1 — Backend cleanup + first tests (Spec 2, Phase 3)

### Before
- Each API route was one giant file with a long `switch(action) { … }` block that mixed **everything together**: reading the request, all the SQL, the business rules, and the response. The CRM route alone was ~750 lines.
- The social-feed database tables were created/patched **inside the route file at request time** (self-healing on every request), separate from the project's real database migrator (`db-sync.ts`). Two places could drift apart.
- There were **zero automated tests**. Every change was verified by hand.

### After
- The business logic for the three routes that the rest of the work builds on — **CRM, Posts, and Dashboard** — now lives in dedicated **service files** (`src/lib/services/crm.ts`, `posts.ts`, `dashboard.ts`). The routes became thin: *check who's logged in → read the input → call the service → return the answer.* (The other 11 routes were left alone on purpose — they work, and rewriting them would be churn with no benefit yet.)
- All the social-feed tables now live in **one place** (`scripts/db-sync.ts`), the real migrator — which we also taught to manage database indexes declaratively. Schema is now updated with `npm run db:sync` instead of silently at request time.
- We introduced the **first test suite** (`npm test`) using Node's built-in test runner — **no new pinned dependency**. **26 tests** now guard the most important behaviors, especially:
  - the **"qualify lead" bridge** (closing a deal correctly creates a project, seeds tasks, records the income, and bumps the account balance — all for the right user, all-or-nothing), and
  - **ownership checks** (one user can never edit/delete another user's data) across CRM and Posts.
- Small architecture win: the shared `HttpError` type was moved to its own tiny file so services and their tests use the *real* error class instead of a stand-in.

### Why it matters
The code is now **easier to read, safer to change, and test-protected** where it counts. The structure also made Spec 3 (below) much cleaner to build.

---

## Part 2 — The Social Feed "Favor Economy" (Spec 3)

The feed used to be: write a status, like it, comment, done. Now every post has a **type**, and the feed branches on it.

### New post types
- **Status** — exactly like before (nothing changes for existing posts).
- **Ask** — "I need help." The author picks a **skill/topic tag** so the right people see it. Other users answer in the comments, and the asker can **mark one answer as "helpful"**, which **resolves** the ask. They can also say *"I solved it myself."*
- **Win** — celebrate a milestone (a closed deal or a delivered project). Shows a celebratory badge and a little **confetti** burst (respecting "reduce motion" settings). The dollar amount is **never** shown automatically — it's opt-in, text only.

### How it works end-to-end
- **Composer**: a new **Status · Ask · Win** switch at the top of the post box; picking *Ask* reveals a skill/topic field.
- **Feed ranking**: open Asks get a **time-decayed boost** (fresh, skill-matched help requests float to the top), and resolved Asks settle back down. A new **filter bar** lets you view **All / Help requests / Matching my skills**.
- **Accepting an answer** records an append-only **"helpful event"** — this is the hook a future credits/rewards system can read. (No points or balances exist yet; we only laid the wire.)
- **Notifications**: posting an Ask notifies your skill-matched friends/followers (capped per day so it never becomes spam). Getting your answer accepted notifies you.
- **Win prompt**: when you close a deal (CRM) or deliver a project (Time), the app sends a quiet, one-time nudge over the existing live connection. Next time you're on the feed, the composer is **pre-filled in Win mode** with a friendly draft you can edit or dismiss — it **never auto-posts**.

### Where it shows up
- The **home feed** and the **single-post permalink page** both render the new badges, the pinned **Accepted ✓** answer, and (on the permalink, for the post's owner) the **"Mark helpful"** / **"I solved it myself"** controls.

### Why it matters
The feed is now tied to the actual work freelancers do: they get **unblocked** (Ask) and **celebrated** (Win), instead of just posting generic updates.

---

## What did NOT change / was deliberately deferred
- **Co-Focus Rooms** (live focus-room cards) — explicitly post-launch, not built.
- **Spec 4 (per-client hourly rate)** and **Spec 5 (post editing / image upload polish)** — not part of this round.
- Win posts still store **no amount column** (amount, if shared, is just text in the post).
- A **real-database integration test** for the new accept/notification SQL is a noted fast-follow (current tests mock the database and verify the logic + ownership scoping).

---

## How to see it yourself
- Run the app, open the **Home feed**: try the **Ask** and **Win** options in the composer, and the **Help requests** filter.
- Close a deal in **CRM** (qualify a lead) or complete a **"Production Delivery & Launch"** task in **Time** → go to Home → the composer greets you in **Win mode**.
- Run `npm test` → 26 passing tests.

---

## File-level map (for the curious)
- **New:** `src/lib/services/{crm,posts,dashboard}.ts` (+ their `.test.ts`), `src/lib/http-error.ts`.
- **Schema:** `scripts/db-sync.ts` (posts type/skill_tag/accepted_answer_id/resolved_at, `helpful_events` table, index sync).
- **API:** `src/app/api/posts/route.ts` (ask/win create, `accept_answer`, `resolve_ask`, help filters, notifications), `src/app/api/crm/route.ts` + `src/app/api/time/route.ts` (emit the Win prompt).
- **UI:** `src/app/(dashboard)/home/PostComposer.tsx` + `page.tsx`, `src/app/p/[postId]/PostDetail.tsx`, `src/context/StreamWaiterContext.tsx`.
