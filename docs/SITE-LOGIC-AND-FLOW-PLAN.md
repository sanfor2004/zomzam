# Zomzam — Site Logic, Flow & Monetization Plan

> How Zomzam should *think* (its logic), how a user should *move through it* (its
> flow), and how it *makes money* (CRM + Leads as a paid tier). Written against
> the codebase as it stands today, with a prioritized path to ship.

---

## 1. The product thesis (social-first)

**Zomzam is a social network for solo professionals — freelancers, agencies,
operators — where you build a real network, then turn that network into clients.
The social layer is the free, sticky core; the productivity suites deepen the
daily habit; and the CRM + Leads-generation suite is the paid engine that
converts connections into revenue.**

The order of operations matters and drives every decision below:

1. **Social is the product** (free, the reason people show up and come back).
2. **Time + Money are the habit** (free; they make Zomzam a *daily* open, not a
   weekly one — they keep people inside the social graph).
3. **CRM + Leads is the business** (paid; the place users happily pay because it
   makes them money).

Test for any change: *does it make the social loop tighter, the daily habit
stickier, or the paid conversion more obvious?* If none — cut it.

### Current reality vs thesis
- ✅ **Social layer** — feed, posts/`@mentions`, live messaging, presence,
  notifications, friends/followers, public profiles, favor economy. **This is now
  the front door** (`/home` after login). Correct.
- ✅ **Time Suite** & ✅ **Money Suite** — built; the free engagement deepeners.
- 💰 **CRM Suite + Map Leads Scraper + AI Outreach** — built but parked. This is
  the **paid tier** (see §5). Re-enabling it *behind a paywall* is the monetization.
- The earlier worry that "the app opens on the feed" is, under a social-first
  thesis, **a feature, not a bug.** `/home` as the landing is right. `/dashboard`
  becomes an optional "command center," not the forced front door.

---

## 2. The social loops (the retention engine — top priority)

Social-first means these loops are P0. They're mostly built; the work is
*tightening* them so the network feels alive.

### 2.1 The presence loop — *"my people are here"*  ✅ just fixed
A network feels alive when you can see who's around. Two bugs that broke this
were fixed in this pass:
- **Texting/notifying someone falsely flipped them "online" then back offline.**
  Root cause: `pushStreamOrder` defaulted to bumping the *recipient's*
  `last_seen`. Delivering a message/notification/social-update to a user is not
  *activity by* them — those calls now pass `touchLastSeen=false`.
- **Presence flickered even for genuinely-online friends.** The "online" window
  was 7s while the heartbeat is ~25s. Widened to **35s** (`ONLINE_WINDOW_SECONDS`)
  so a connected user stays steadily online and fades to "active recently" for
  ~30s after leaving.
- **Next:** show "active recently" / "last seen" text (not just a dot), and an
  "Active now" count, so presence reads as a living room, not a status light.

### 2.2 The conversation loop — *"talk to my network live"*  ✅ built
Global docked chat (`ChatDock`), `/messages` hub, topbar unread dot, contacts
ordered by last-chatted. Next tightening:
- Typing indicators + read receipts over the existing SSE pipe (new `order_name`s).
- Message reactions; share a post into a DM (turns the feed into conversations).

### 2.3 The content loop — *"post → reach → reaction → reply"*  ✅ built
Feed, live "new posts" pill, likes/comments, ask/win posts. Next:
- Richer reactions; @mention notifications that deep-link to the post.
- A "who saw your win/ask" surface to reward posting.

### 2.4 The favor economy — *"help & get known for it"*  ⚠️ loop is open-ended
`ask`/`win` posts + skill matching exist, and `helpful_event` rows are logged —
but "**NO balance touched**," so helping earns nothing visible. **An unrewarded
loop trains people to stop.** Close it: a **reputation/helpful score** on the
profile, a weekly "Most helpful" surface, and badges. This is pure social fuel
and should ship before monetization polish.

---

## 3. The daily-habit loop (Time + Money keep people in the graph)

These free suites aren't a separate app — they're *why a social user opens Zomzam
daily* instead of weekly. The logic that makes them serve the social thesis:

- Surface productivity *socially*: a finished focus streak or a money milestone
  can become an optional `win` post — habit feeds content feeds network.
- A lightweight optional **`/dashboard`** stays as a personal "command center"
  (hours focused, money in/out, streak, pending help requests, unread) — but it
  is *not* the forced landing. `/home` (the network) is.

---

## 4. The monetized value loop (network → clients → revenue)

The reason a free social user converts to paid: **Zomzam is where their network
already is, so it's the natural place to find and close business.**

```
Grow your network (free, social)
   → spot opportunity (a friend needs what you sell; a niche to prospect)
   → CRM + Leads (PAID): scrape leads, run AI outreach, work the pipeline
   → close a deal → the cross-suite bridge logs income + seeds delivery tasks
   → post the `win` → social proof pulls in more network → repeat
```

The cross-suite bridge already exists (`qualify_lead` seeds Money income + Time
tasks + a debtor ledger row). Making it *visible* is what justifies the price.

---

## 5. Monetization — CRM + Leads as a paid tier

### 5.1 What's free vs paid
| Tier | Price | What you get |
|------|-------|--------------|
| **Free** | **$0 forever** | The entire social platform (feed, messaging, presence, notifications, profiles, favor economy) + the full **Time** and **Money** suites. The product is genuinely useful and viral at $0. |
| **Pro** | **$19/mo** (or **$15/mo billed annually**, $180/yr) | Everything free **+ CRM Suite** (contacts, Kanban pipeline, projects) + **Map Leads Scraper (300 leads/mo)** + **AI Outreach (100 emails/mo)** + Lead Vault + the won-deal → income/tasks bridge. |
| **Agency** | **$49/mo** (or **$39/mo annually**, $468/yr) | Everything in Pro + **1,500 leads/mo** + **500 AI emails/mo** + priority enrichment/support + higher API limits + early access to team seats. |

### 5.2 How the price was calculated
**Value anchor (what the market charges):** standalone lead-gen tools — Apollo
(~$49+/mo), Hunter (~$34+/mo), Instantly (~$37+/mo) — sell *only* prospecting.
Zomzam Pro at **$19** (annual $15) **undercuts all of them** while bundling CRM +
AI outreach **and** the social graph the leads live next to. Pricing below the
category anchor is deliberate: the social network is the moat, lead-gen is the
upsell — we win on bundle value, not on being the cheapest scraper.

**Cost to serve (why the caps exist, and the margin):**
- *Lead scrape* — Google Places (Nearby + Details) ≈ **$0.03–0.06 per enriched
  lead**. Pro's 300/mo cap ⇒ ~$9–18 COGS *only if maxed*; typical users pull far
  less, so blended gross margin lands ~50–70%. Agency's 1,500/mo cap is priced
  for users converting leads into real contract revenue.
- *AI outreach* — a cold email ≈ 1–2k tokens via Claude ⇒ **fractions of a cent**.
  100/mo is <$1 COGS; 500/mo a few dollars. Negligible vs the price.
- *Free tier* — near-zero COGS (no lead API, no AI). It's the funnel: every free
  social user is a future Pro prospect the moment they want to sell to their network.

**Annual discount:** ~20% off (Pro $180/yr, Agency $468/yr) to pull cash forward
and cut churn. Shown via the monthly/annual toggle on `/pricing`.

**Conversion thesis:** Free grows the graph → the moment a user wants to *monetize*
that graph (sell to connections, prospect a niche), Pro is the obvious unlock.
We sell *outcomes* (clients, revenue), not *features*.

### 5.3 The subscribe flow (built + the gap)
- **`/pricing`** (public, in the proxy allowlist) — built this pass. Free/Pro/
  Agency cards, monthly/annual toggle with live savings, feature lists, CTAs.
  Reachable via the sidebar **"Upgrade"** entry (desktop + mobile nav).
- **CTA behavior today:** logged-out → routed to sign-up; logged-in → records
  intent (honest "checkout launching soon" toast). **No charge happens yet.**
- **The gap to real revenue (next build, needs a decision):** wire **Stripe
  Checkout** + a webhook. This needs a payment processor choice + keys — *flagged
  for the owner*; not added speculatively (no new dependency without sign-off).

### 5.4 Entitlements & metering (how gating should work)
When CRM/Leads is re-enabled behind the paywall:
- Add `users.plan` (`free|pro|agency`) + `plan_status` + `plan_renews_at`, and
  monthly usage counters (`leads_used`, `ai_emails_used`) that reset on renewal.
- Gate at the **service boundary**, not just the UI: a `requirePlan('pro')` guard
  in the CRM/leads routes (mirrors `withAuth`) so the entitlement can't be
  bypassed by hitting the API directly. The UI shows locked states + an Upgrade CTA.
- **Meter** each lead scrape and AI email against the cap; at the cap, return a
  clean "limit reached — upgrade or wait for reset" (an `HttpError`, not a bug).
- Stripe webhook is the *only* writer of `plan`/`plan_status` (never trust the client).

---

## 6. Information architecture (social-first)

**Three altitudes:**
1. **Spine (the social pulse, one tap away):** `/home` (network feed — the
   landing), `/messages` (conversations), notifications + presence rail
   (persistent across routes — built).
2. **Habit suites (free workbenches):** Time, Money. Enter to do focused work,
   return to the network.
3. **Business (paid):** CRM, Leads, Pipeline, Outreach — gated to Pro/Agency,
   entered via **Upgrade** / `/pricing`.
4. **Self:** `/me`, `/settings`.

Keep the **right presence rail** and **topbar messages/bell** everywhere — they
are the "someone's around" signal that makes a social product feel inhabited.

---

## 7. Data & state-flow architecture (keep it clean as it grows)

- **One API boundary:** every route via `withAuth`/`withError` (`src/lib/api-auth.ts`);
  business logic in `src/lib/services/*` (unit-tested). Routes parse + dispatch;
  services decide. Plan gating will live here too (`requirePlan`).
- **One realtime pipe:** SSE `/api/stream` + `StreamWaiterContext`, per-user
  `stream_queue`. New live features = a new `order_name`, not a new transport.
  **Presence rule (now enforced):** cross-user pushes use `touchLastSeen=false`;
  only a user's *own* heartbeat/SSE loop updates their `last_seen`.
- **One source per concern on the client:** `MessagesContext` (DMs),
  `StreamWaiterContext` (presence/notifications), `MoneyContext` (balances).
  Don't duplicate a model into a page — lift it into the context.
- **Observability:** unexpected errors email via `src/lib/bug-report.ts` (server
  boundary + client `ErrorReporter` + `global-error.tsx`). Expected failures stay
  `HttpError` (not emailed). Watch the inbox after deploys.
- **Conventions:** Zomzam Kit before new markup; parameterized + owner-scoped SQL;
  new pages auto-protected by default-deny (public pages are explicitly allowlisted).

---

## 8. Prioritized roadmap

**P0 — Make the network feel alive (social-first core)**
- ✅ Fix presence flicker (texting false-online + 7s→35s window) — done this pass.
- Favor-economy payout (§2.4): reputation/helpful score + "Most helpful this week".
- Presence polish: "active recently" text + "Active now" count.

**P1 — Tighten the conversation & content loops**
- Typing indicators + read receipts (new SSE orders).
- @mention/comment notifications with deep links + a notifications history view.
- Share-post-to-DM; richer reactions.

**P2 — Turn it on as a business (monetization)**
- ✅ `/pricing` page + Upgrade entry + public allowlist — done this pass.
- Entitlements: `users.plan` + usage counters + `requirePlan` service guard (§5.4).
- **Stripe Checkout + webhook** (owner decision required) — the step that turns
  the page into revenue.
- Re-enable CRM/Leads **behind the paywall**, with locked states + metering, and
  make the won-deal → income/tasks **bridge visible** (the thing people pay for).

**Always-on**
- Services unit-tested; single realtime pipe; watch bug-report email; prune dead
  code as features consolidate.

---

## 9. The one-line test for every future change

> *Does this make the social loop tighter, the daily habit stickier, or the paid
> conversion more obvious?*

If none — the thesis in §1 says cut it.
