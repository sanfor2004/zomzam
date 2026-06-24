# Zomzam — Site Logic & Flow Plan

> A plan for how Zomzam should *think* (its logic) and how a user should *move
> through it* (its flow). Written against the codebase as it stands today, with
> a prioritized path to make the product coherent and genuinely good.

---

## 1. The product thesis (the one sentence everything serves)

**Zomzam is a personal operating system where a solo professional runs their
day (Time), their money (Money), and their network (Social) in one place — and
the three reinforce each other instead of living in separate apps.**

Everything below is judged by one question: *does it make that sentence true and
obvious?* If a feature doesn't serve the daily loop or the cross-suite payoff,
it's noise.

### Current reality vs thesis
- ✅ **Time Suite** (execution/tasks/planning/ideas/tracker) — built, coherent.
- ✅ **Money Suite** (dashboard/accounts/income/expenses/lend) — built, coherent.
- ✅ **Social layer** (feed, messaging, presence, notifications) — built recently.
- ⏸️ **CRM Suite** — parked (kept intentionally, see project memory). It is the
  bridge that ties Social → Money → Time, so its absence is *why the suites feel
  separate today.*
- ⚠️ **Dashboard** (`/dashboard`) — the cross-suite rollup that should be the
  "spine" is currently disabled in nav. The app effectively opens on `/home`
  (the feed), which makes Zomzam read as a *social app with tools attached*
  rather than a *personal OS with a social layer*.

**The single biggest logic problem is altitude:** the home screen is the feed,
not the user's life. Fixing the flow starts there.

---

## 2. The flows that must work (in priority order)

### 2.1 First-run / onboarding flow (currently missing)
Today: register → cookie set → land on `/home` with an empty feed and no context.
A new user has no tags, no currency preference, no friends, no tasks — so every
suite looks empty and the favor economy (skill matching) can't function.

**Target flow:**
1. Register / OAuth → **3-step onboarding** (skippable, resumable):
   - **Identity & skills**: name, avatar, and **profile tags** (these power the
     `ask`/help-matching logic — without them the favor economy is dead on arrival).
   - **Money basics**: primary/secondary currency (drives every Money conversion).
   - **Find your people**: seed 3–5 friend suggestions (`/api/social?action=discover`).
2. Land on **`/dashboard`** (not `/home`) with a "Day Zero" state that teaches
   the loop: "Start a focus session", "Log your first expense", "Say hi to a friend".

**Why:** onboarding is the cheapest lever for activation. The data it collects
(tags, currency) is a *hard dependency* of features already built.

### 2.2 The daily loop (the core habit)
This is the flow that should pull a user back every day:

```
Open Zomzam → /dashboard (what matters today)
   → Time:  start a focus session / clear a task
   → Money: log today's income/expense, glance at net worth
   → Social: see who's around, answer a help request, share a win
   → close the loop: dashboard reflects the day's deltas
```

**Logic to make this real:**
- `/dashboard` must become the **default post-login route** and the **home of the
  daily loop** — a glanceable rollup (hours focused, money in/out, streak,
  pending help requests from friends, unread messages).
- Every suite action should produce a **visible delta on the dashboard** (close
  the Gulf of Evaluation — the user must *see* that what they did mattered).

### 2.3 The social / engagement loop (built — needs tightening)
Now that messaging, presence, notifications, and the new-posts pill exist, the
loop is: *post/ask → friend sees it live → they react/answer/DM → you get a live
notification/toast → you respond.* This is the retention engine. See §4 for the
specific logic fixes it still needs.

### 2.4 The value loop (the cross-suite bridge — the moat)
The thing no single-purpose app can do: **an event in one suite cascades into the
others.** The pattern already exists (`qualify_lead` seeds Money income + Time
tasks + a debtor ledger row — see README "Cross-Suite Data Bridges"). The plan is
to make this pattern the product's signature rather than a hidden CRM detail:
- A **`win` post** ("closed a client") could offer to log the income.
- Completing a **focus session** on a client task could nudge an invoice.
- The **favor economy** (`helpful_event` is logged but "no balance touched")
  should *pay out* into something visible — reputation, credits, or a leaderboard.
  Right now the loop is opened and never closed.

---

## 3. Information architecture & navigation logic

**Problem:** nav is a flat list of suites; there's no sense of "home base."

**Target model — three altitudes:**
1. **Spine (always one tap away):** `/dashboard` (today), `/home` (network),
   `/messages` (conversations). These are the verbs of the daily loop.
2. **Suites (workbenches you go *into*):** Time, Money, (CRM later). You enter to
   do focused work, then return to the spine.
3. **Self (account):** `/me`, `/settings`.

**Concrete fixes:**
- Re-enable `/dashboard` and make it the login landing + first sidebar item.
- Keep the new **right presence rail** and **topbar messages/bell** as the
  persistent "social pulse" across all routes (already implemented).
- The mobile bottom-sheet nav (recently added) should mirror these three altitudes,
  Spine items first.

---

## 4. Specific logic gaps to fix (found in the current code)

| # | Area | Issue | Fix |
|---|------|-------|-----|
| 1 | **Presence** | "Online" = `last_seen` within **7s** (`computeOnlineFields`), but the friends rail polls every **20s** and the heartbeat is ~25s. Users will flicker offline constantly. | Widen the online window to ~45–60s (heartbeat interval + slack), or push presence over SSE instead of polling. Presence should be *forgiving*, not knife-edge. |
| 2 | **Favor economy** | `helpful_event` rows are logged but "NO balance touched" — the reward loop is opened and never closed. | Decide the payout (reputation score on profile, a credits balance, a "most helpful this week" surface) and render it. An unrewarded loop trains users to stop helping. |
| 3 | **Notifications** | Only `mark_read`; no history/pagination, no dedicated view. | Add a notifications page (or infinite dropdown) and per-item deep links (a comment notification should open the post). |
| 4 | **Onboarding data** | Tags/currency are hard dependencies with no collection flow (see §2.1). | Build onboarding; until then, surface inline prompts ("add skills to get matched"). |
| 5 | **Empty states** | Empty feed/dashboard/suites give no next action. | Every empty state gets one primary CTA wired to the daily loop. |
| 6 | **Auth edge** | Existing sessions kept the old 7-day token until next login (the 60-day change only applies to new logins). | Acceptable, but note it; consider a silent re-issue on next authenticated request. |
| 7 | **`/api/messages` scale** | `contacts` runs correlated subqueries per friend; fine for small graphs, will degrade. | Revisit with a `JOIN`/window function if friend counts grow. Not urgent. |

---

## 5. Data & state-flow architecture (keep it clean as it grows)

The current architecture is sound — preserve these boundaries:

- **One API boundary:** every route goes through `withAuth`/`withError`
  (`src/lib/api-auth.ts`). Business logic lives in `src/lib/services/*`, not in
  routes. *Rule: routes parse + dispatch; services decide.* Keep new logic in
  services so it stays unit-testable (see `*.test.ts`).
- **One realtime pipe:** SSE via `/api/stream` + `StreamWaiterContext`, with a
  per-user `stream_queue`. New live features = a new `order_name`, not a new
  transport. (`new_message`, `new_post`, `new_notification` already follow this.)
- **One source per concern on the client:** `MessagesContext` owns all DM state;
  `StreamWaiterContext` owns presence/notifications; `MoneyContext` owns balances.
  *Rule: don't duplicate a model into a page — lift it into the context* (this is
  exactly the cleanup that consolidated the old `/home`-only messaging).
- **Observability:** unexpected errors now email via `src/lib/bug-report.ts`
  (server boundary + client `ErrorReporter` + `global-error.tsx`). Keep *expected*
  failures as `HttpError` (not emailed) and let genuine bugs surface. Watch the
  inbox after each deploy — it's now the early-warning system.

**Conventions to enforce going forward:**
- Use the **Zomzam Kit** (`src/components/ui`) before writing new markup.
- Parameterized SQL only; ownership-scope every query to the acting user.
- New page = automatically protected by the default-deny proxy; no extra wiring.

---

## 6. Prioritized roadmap

**P0 — Make the spine real (1 flow, highest leverage)**
- Re-enable `/dashboard`; make it the post-login landing and the daily-loop home.
- Wire each suite's primary action to a visible dashboard delta.
- Fix presence window (gap #1) so the new social rail feels trustworthy.

**P1 — Close the loops**
- Onboarding flow (§2.1) — unlocks tags/currency dependencies.
- Favor-economy payout (gap #2) + notifications history (gap #3).
- Empty-state CTAs everywhere (gap #5).

**P2 — The moat**
- Bring back CRM and make the **cross-suite bridge** a first-class, *visible*
  story (a `win` post → income; a client task → invoice nudge).
- "Most helpful this week" / reputation surface to reward the favor economy.

**Always-on**
- Keep services unit-tested, keep the realtime pipe single, watch bug-report
  email after deploys, prune dead code as features consolidate (this pass removed
  the orphaned `messages?action=list` and unused `home/shared` types).

---

## 7. The one-line test for every future change

> *Does this make the daily loop tighter, or the cross-suite payoff more visible?*

If neither — it's probably noise, and the thesis in §1 says cut it.
