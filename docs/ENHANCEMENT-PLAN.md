# Zomzam Enhancement Plan

> A grounded roadmap for evolving the platform, tied to what actually exists in
> the repo (architecture, stack, routes) rather than generic advice. Pair this
> with `README.md` (architecture map of record) and `CLAUDE.md` (Zenith-Tier
> standards).

## Where the site stands today

**Strong:** Mature feature surface (Time / Money / CRM / Social suites), a clean
service-layer split with unit tests, SSE real-time presence, a homegrown
27-primitive UI kit, JWT/edge-proxy default-deny auth, and a recent perf pass
(removed the WebGL fluid sim). The messaging layer was recently upgraded (idle
dot, emoji picker, typing indicator, live presence sync in the dock).

**Gaps worth closing:** messaging is half-built; real-time is uneven across
features; no PWA / web-push (a "personal OS" lives or dies on re-engagement); no
E2E tests or CI; no global search; "technological sovereignty" is promised but
there's no data export; and a couple of genuine architectural risks (in-memory
rate limiter on serverless).

---

## Track A — Finish the Messaging Layer *(high impact, medium effort)*

The dock now has presence/typing, but the schema already carries `read_at` and
the `sharp` → Vercel Blob pipeline exists — several high-value features are
within reach:

1. **"Seen" receipts** — surface the existing `read_at` as a Messenger-style
   "Seen" marker under the last message (data already flows; it's a UI + a small
   SSE `read` order).
2. **Image/file attachments** — reuse the `sharp` → Blob pipeline already used
   for avatars/posts.
3. **Unsend / delete message** + **message reactions** (emoji react, mirroring
   the picker already in the dock composer).
4. **In-thread search** and **infinite history** (current thread is capped at
   200 messages).
5. **Push contact presence over SSE** instead of the 20s poll, so dots update
   instantly.

## Track B — PWA + Web Push *(high impact, medium effort)*

The single biggest engagement lever for a daily-use personal OS, currently
absent.

- Installable PWA (manifest + service worker), offline shell for the dashboard.
- **Web Push** for messages, friend requests, and lend due-dates — extends the
  existing notification model beyond in-app only.
- Background sync for the Pomodoro timer and offline idea capture.

## Track C — Real-Time Unification *(medium impact, medium effort)*

The SSE pipe already exists (`pushStreamOrder` → `zz-*` events). Extend it so the
app feels uniformly live:

- Live comments/likes on the feed and `/p/[postId]` (today the feed only shows a
  "new posts" pill).
- Live Kanban updates on `/crm/pipeline`.
- Optimistic, reconciling mutations everywhere (the chat send path is a good
  template to generalize).

## Track D — AI Assistant Layer *(high impact, medium effort)*

Only CRM outreach uses Claude today. Expand it, using the latest models
(**Opus 4.8** for deep reasoning, **Haiku 4.5** for cheap/fast inline tasks):

- **Weekly review**: auto-summarize focus sessions + spending + deals into a
  digest.
- **Smart capture**: turn a raw Idea Vault note into tasks/planning horizons.
- **Financial insights**: natural-language Q&A over the Money ledger; 50/30/20
  coaching.
- **Semantic search** across ideas, notes, and posts.

## Track E — Data Sovereignty & Money Depth *(medium impact, low–medium effort)*

- **Export/Import** (CSV/JSON) and a full account data download — directly
  fulfills the "Technological Sovereignty" promise in the README, which
  currently has no backing feature.
- **Recurring transactions**, budget-vs-actual, and lightweight forecasting in
  the Money suite (bespoke SVG per the no-charting-lib rule).

## Track F — Quality, A11y & Observability *(foundational, ongoing)*

- **E2E tests (Playwright) + CI** — today there are only service-layer unit
  tests and no CI gate; auth flows, the qualify-lead bridge, and chat are the
  highest-value paths to cover.
- **Accessibility pass** — CLAUDE mandates WCAG AA/AAA; add automated axe checks
  and audit keyboard nav for the dock, Kanban drag-drop, and modals.
- **Lighthouse / Speed-Insights budget** — `@vercel/speed-insights` is already a
  dependency but underused; wire a perf budget into CI.

## Track G — Security Hardening *(targeted, low effort, high value)*

- ⚠️ **Verify the rate limiter**: `src/lib/rate-limit.ts` is an *in-memory*
  sliding-window limiter. On Vercel serverless that state isn't shared across
  instances, so login/register throttling may be largely ineffective in
  production — confirm, and move to a shared store (e.g. Upstash/DB) if so.
- **2FA (TOTP)** and a **session management UI** (the schema already has
  `token_version` for revocation — surface it).
- **CSP + security headers**, and a global search endpoint with proper authz
  scoping.

---

## Suggested phased roadmap

| Phase | Focus | Items |
|---|---|---|
| **P0 — Now** | Finish what's started + close a real risk | Track A (seen receipts, attachments, reactions) · Track G rate-limiter verification |
| **P1 — Next** | Engagement + trust | Track B (PWA + Web Push) · Track F (Playwright + CI) |
| **P2 — Then** | Differentiation | Track D (AI assistant) · Track C (real-time unification) |
| **P3 — Later** | Breadth + polish | Track E (export + money depth) · Track G (2FA, CSP) · full a11y pass |

**Recommendation:** start with **Track A** (momentum + infra already in place for
fast wins) and run the **Track G rate-limiter check** immediately — it's a
genuine production-correctness risk, not just a feature.
