# Zomzam — Business Model & Monetization Strategy 💼

> **Status:** Zomzam is **100% free today.** This document is a *forward-looking* business model — the recommended path to long-term sustainability **without** breaking the promise that connection is always free. Nothing here is enforced in the product yet; it exists so that when monetization becomes necessary, the decision is deliberate, data-backed, and aligned with the mission.

> **Mission anchor:** *Zomzam is the Life OS for freelancers who don't want to work alone.* Every monetization decision must protect the **network** (friends, posts, asking for help, co-focus) — because the network is both the product's soul and its growth engine. We monetize **business depth**, never **human connection**.

---

## 📋 Executive Summary

| Dimension | Recommendation |
| :--- | :--- |
| **Core model** | **Free-first → Open-core Freemium**, introduced only after network density is proven |
| **What's always free** | Everything social/viral: posting, Ask/Help requests, friends, circles, co-focus rooms, public profiles, core time + basic money |
| **What eventually pays** | Business *depth*: unlimited CRM, AI outreach, advanced finance/reporting, cosmetics, team/agency features |
| **Primary revenue (long-term)** | Subscription (**Zomzam Pro**, single low-cost tier) |
| **Secondary revenue** | Usage pass-through (AI), marketplace take-rate, cosmetic one-offs |
| **What we will NOT do** | Sell user data, run intrusive ads, paywall messaging/friends/posting, dark-pattern cancellation |
| **North-star metric (free phase)** | **Weekly Active Friend-Pairs** (two connected users both active in a week) — not revenue |
| **Trigger to monetize** | Sustained retention + network density + recurring infra cost (esp. AI) outgrowing goodwill |

---

## 🎯 Phase 1 — The Free Era (Now → Product-Market Fit)

**Goal:** Not money. **Network density and habit.** A solo time-tracker has no reason to invite anyone; Zomzam's entire defensibility is that *your friends are on it*. A paywall in this phase starves the friend graph and kills the only moat we have.

**Operating principles during the free era:**
1. **Generosity is marketing.** The free product must be good enough that users evangelize it. Word-of-mouth among freelancers (Discord, X, bootcamp cohorts, co-working spaces) is the cheapest, highest-trust acquisition channel.
2. **Instrument, don't gate.** Measure where power-users push limits (lead counts, AI sends, currency needs). These become tomorrow's pricing anchors — backed by real usage, not guesses.
3. **Keep burn low.** The expensive line items are AI (Claude API) and infra. Cap free AI usage *generously but finitely* so a viral spike can't bankrupt the project (see §Cost Control).
4. **Seed goodwill.** Track early adopters. When monetization arrives, they get a permanent **"Founder" perk** (free/discounted Pro) — rewarding the people who built the network.

**Phase-1 success criteria (move to Phase 2 only when all are true):**
- Strong week-4 retention among invited users (not just signups)
- A healthy ratio of **Active Friend-Pairs** to total users (the network is *used*, not just populated)
- A repeatable invite loop (existing users bring peers without prompting)
- Recurring infra/AI cost is real enough that "free forever, everything" is no longer financially honest

---

## 💸 Phase 2 — Open-Core Freemium (Post-PMF)

The recommended model. **Open core** = the social spine and personal-OS basics are free forever; **paid = depth that signals "I'm running a real business now."**

### The Golden Split

> **Never paywall anything social or viral. Charge for power, depth, and business operations.**

| Tier | Audience | Price (recommended) | Rationale |
| :--- | :--- | :--- | :--- |
| **Free** | Every freelancer, forever | **$0** | The growth engine. Generous, habit-forming, fully social. |
| **Zomzam Pro** | Freelancers running a real client business | **~$8–12 / month** (or ~$80–96/yr, ~2 months free) | One simple tier. No confusing matrix. Priced below "annoying to expense." |
| **Zomzam Teams** *(later, optional)* | Micro-agencies / pods of 2–6 | **~$6–8 / seat / month** | Only if real demand emerges from circles/pods. Don't build speculatively. |

### Free vs. Pro — Feature Allocation

**🟢 Free forever (the network + the habit):**
- All social: posting (public & private), **Ask/Help requests**, friends, **circles/pods**
- **Co-focus rooms** & live presence (reuses existing SSE — cheap to run, high stickiness)
- Public `/u/[username]` profile & social feed
- Full **Time Suite** (Pomodoro, tasks, planning, ideas)
- **Basic Money** — accounts, income/expense logs, single primary currency
- **Starter CRM** — capped (e.g. ~25 leads) so the value is obvious before the ceiling

**🟠 Zomzam Pro (business depth — the natural upgrade triggers):**
- **Unlimited CRM** — leads, pipeline, contacts, projects
- **AI Outreach** — Claude-powered cold emails (real per-use cost → fairest paywall)
- **Referral-commission tracking** — lead-sharing splits auto-recorded in the Money suite
- **Advanced Money** — multi-currency, net-worth analytics, **CSV/PDF export for taxes & invoicing**
- **Bigger pods**, raised circle limits, custom roles
- **Profile polish** — custom domain on public profile, verified/vouch badges, portfolio mode
- **Cosmetics** — themes, profile flair, premium badges (freelancers love status signals; high margin, zero harm to free users)

**Design rule:** Free users should hit limits *as a sign of success* ("you've outgrown the starter CRM — nice problem"), never as artificial friction on day one.

---

## 💰 Revenue Streams (ranked by fit)

1. **Subscription — Zomzam Pro** *(primary, long-term)*
   Predictable recurring revenue. One low-cost tier keeps the decision frictionless. This should be the backbone.

2. **AI usage pass-through** *(self-funding a real cost)*
   Claude API calls cost money per request. Free users get a generous monthly allotment; heavy senders upgrade. This makes AI *self-funding* instead of a liability — arguably the single most important monetization lever given infra reality.

3. **Cosmetic & vanity one-offs** *(high margin, mission-safe)*
   Profile themes, flair, badges, custom-domain profiles. Freelancers signal status; this is pure margin with zero degradation of anyone else's experience.

4. **Marketplace / referral take-rate** *(future, only if organic)*
   If lead-sharing and "hire-a-friend" behavior emerges naturally, Zomzam could take a small, transparent percentage on referral payouts processed through the platform. **Only build this if users are already doing it manually** — don't force a marketplace into existence.

5. **Affiliate / partner integrations** *(opportunistic, never intrusive)*
   Freelancer-relevant tools (invoicing, payments, banking-for-freelancers). Clearly labeled, opt-in, genuinely useful — never disguised ads.

---

## 🚫 Anti-Patterns — What Zomzam Will *Not* Do

These protect trust, which for a network product *is* the asset:

- ❌ **No selling or brokering user data.** Privacy-first is in the mission; violating it kills the brand.
- ❌ **No intrusive/feed ads.** A freelancer's focus space must stay clean.
- ❌ **No paywalling connection.** Posting, asking for help, friends, circles, co-focus → free forever.
- ❌ **No dark patterns.** One-click cancel, no guilt screens, no hidden auto-renew traps.
- ❌ **No crippling the free tier** to coerce upgrades. Free must stay genuinely lovable.
- ❌ **No speculative enterprise/Teams build** before demand is proven by real pod behavior.

---

## 🧮 Cost Control (Why Monetization Eventually Becomes Honest)

The free era can't be infinite at infinite scale because some costs are **per-user variable**, not fixed:

| Cost driver | Nature | Mitigation |
| :--- | :--- | :--- |
| **Claude AI (outreach)** | Per-request, scales with usage | Generous-but-capped free allotment; pass-through to Pro for heavy users |
| **Database / hosting** | Scales with active users & data | Efficient queries (already a project standard), archival of stale data |
| **Image processing (`sharp`)** | Per-upload CPU | Size limits, caching, lazy processing |
| **SSE / presence / co-focus** | Cheap per-connection | Already low-overhead vs. WebSockets — a deliberate architectural win |
| **Maps / Places (CRM scraper)** | Per-API-call billing | Rate-limit free tier; count toward Pro value |

**Takeaway:** Co-focus and social are *cheap* to keep free forever (good — they're the growth loop). **AI and Maps are the genuinely metered costs** — which is exactly why they belong in Pro. Monetization isn't greed; it's making the expensive features pay for themselves so the free network can stay free.

---

## 🛠️ Implementation Readiness (When the Time Comes)

Recommended *future* engineering prep — **not to be built now**, but designed so the switch is a config change, not a refactor:

1. **`plan` field** on the user model (`free` | `pro`), defaulting to `free` for everyone.
2. **A single `usePlan()` / server-side gate** helper — one source of truth for entitlement checks.
3. **Usage counters** (leads created, AI sends, exports) — instrument *now-ish* to learn limits even while everything is free.
4. **Founder flag** — mark early adopters so the loyalty perk is trivial to honor later.

> Until the team explicitly decides to monetize, none of this is enforced. The product stays fully free; the architecture merely stays *ready*.

---

## 📈 Recommended Roadmap

| Stage | Focus | Monetization posture |
| :--- | :--- | :--- |
| **Months 1–4** | Ship the collaboration core (Ask/Help requests, co-focus rooms, earned credits). Seed ONE beachhead niche. Grow the friend graph. | **Zero revenue, on purpose.** Optimize for Weekly Active Friend-Pairs. |
| **Next** | Instrument usage. Identify which limits power-users hit. Earn Founders' goodwill. | Free, but *measuring* future pricing anchors. |
| **Post-PMF** | Turn on the **hybrid**: earned credits + optional **top-up** + optional **Zomzam Pro** (~$8–12/mo). AI + unlimited CRM + advanced money. | Effort-powered freemium. Connection stays free. |
| **Mature** | **Marketplace take-rate** (small % when freelancers hire each other / share leads — the biggest engine), cosmetics, optional Teams for pods. | Diversified, but mission-protective. |

> **Recommended profit model = hybrid:** earned **Credits** (free path) + optional **top-up** (pay-as-you-go) + optional **Pro** subscription (recurring), with a **marketplace take-rate** as the long-term engine once peer-hiring is already organic. See [`credits-economy.md`](./credits-economy.md) and [`master-plan.md`](./master-plan.md).

---

## ✅ Summary Recommendation

**Adopt a Free-First → Open-Core Freemium model.** Stay completely free until the freelancer network is dense and habitual — because the network is the moat. When recurring AI/infra costs make "everything free forever" financially dishonest, introduce **one simple Pro tier** that charges for *business depth* (unlimited CRM, AI outreach, advanced finance, cosmetics) while keeping **every social and collaborative feature free forever.** Monetize the work, never the friendship.

> *Free is part of the pitch — not a trial. Pro is for freelancers whose business outgrew the starter kit.*
