# Performance Pass P3 — Site-wide 97+ (kill the dashboard WebGL)

## Context

The P1/P2 pass fixed the **landing page** by gating the `Silk` three.js shader to desktop-only
(mobile 45→97, desktop 100). But that fix never reached the **authenticated app shell**.

Local Lighthouse audits (current `main`, real `mosaad` login, prod build) measured every authed
route at **Perf 49–65 on mobile and 59–61 on desktop** — i.e. *desktop is broken too*. The
main-thread breakdown is unambiguous:

| Route (desktop) | Perf | TBT | "Other" (rAF/WebGL) main-thread |
|---|---|---|---|
| /dashboard | 61 | 11,420 ms | ~35,700 ms |
| /crm/leads | 59 | 12,720 ms | ~39,700 ms |
| /settings (blank form!) | 59 | 11,830 ms | ~40,200 ms |

Script evaluation is only ~2.5 s; the other **35–40 s is a non-stop `requestAnimationFrame` loop**.
The culprit is `src/components/LiquidEther.jsx` — a **full fluid simulation** (BFECC advection + 32
Poisson pressure iterations + viscous solve per frame) mounted full-bleed in `DashboardShell.tsx` at
**`opacity: 0.18`**. It is mounted on every route, gated only by `requestIdleCallback` (NOT by
device), so it runs identically on mobile and desktop. By contrast, `Silk` (a single-pass noise
shader) costs **0 ms** TBT on the landing desktop. The identical ~40 s "Other" on a blank
`/settings` proves the cost is the shared shell, not page content.

**Conclusion:** we are paying a catastrophic main-thread bill for a near-invisible (18% opacity)
effect. Per the project's own rule ("keep WebGL on desktop only if it's performance-friendly"),
`LiquidEther` fails even on desktop. **Replace it with a static CSS gradient on all devices.**

### Goal
Every route (public + authenticated) scores **Performance ≥ 97 on both mobile and desktop**
(target 100 where reachable), with no regression to the landing (`/` 97/100) or `/sign` (92/100).
Performance is the hard gate; trivial A11y/CLS wins are fixed opportunistically.

### Decisions locked (from grilling)
- LiquidEther → **CSS ambient, all devices** (no WebGL on the dashboard at all).
- Visual: **subtle static dark gradient, NO glow** blobs/halos.
- **Fully static** (no animation → zero compositor/main-thread cost, no reduced-motion edge cases).
- **Staged full pass**: swap → re-audit all routes → fix only stragglers under 97.
- Perf 97+ gate + cheap A11y/CLS wins only.

---

## Phase 1 — Remove the dashboard WebGL (the one big lever)

**File: `src/app/(dashboard)/DashboardShell.tsx`**
- Delete the `LiquidEther` dynamic import (line ~16) and the `BACKGROUND_COLORS` constant.
- Delete the `bgReady` state + its `requestIdleCallback` `useEffect` (lines ~37–54) — a static
  gradient needs no idle-deferral.
- Replace the fixed full-bleed WebGL `<div>` (lines ~169–191) with a static CSS gradient layer:
  a `fixed inset-0 z-0 pointer-events-none` div using a restrained dark radial/linear gradient in
  the existing surface/slate tokens (no orange bloom, no `blur`, no animation). Keep
  `aria-hidden="true"`.
- Net effect: removes the rAF loop and ~177 KB three.js chunk from **every** authenticated route.

**File: `src/components/LiquidEther.jsx`**
- Now unused (grep confirms `DashboardShell` was the only importer). **Delete it** (Phase 10 hygiene).
- `three` stays in `package.json` — `Silk.tsx` (landing) still uses it.

**Reduced-motion / idle patterns:** no longer relevant for the background (static). Leave the
existing GSAP entrance hooks (`usePageEntrance`, already `matchMedia`-gated) untouched.

## Phase 2 — Re-audit ALL routes, then fix only what's still < 97

Re-run the local authenticated Lighthouse harness (below) across the full route set — not just the
5 sampled. Expectation: most jump into the 90s from Phase 1 alone. Then apply targeted fixes **only**
where a route is still < 97 (measure first — no premature optimization):

- **`/crm` — Google Maps** (`@vis.gl/react-google-maps`, the heaviest known per-page cost):
  rendered by `src/app/(dashboard)/crm/page.tsx` via `src/components/crm/{ScraperPanel,
  MapAutocomplete,MapBoundaryHighlight}.tsx`. NOTE: `/crm` was **not** in the 5 sampled routes, so
  it is an *unmeasured* straggler — audit it explicitly in Phase 2. Fix: lazy-load the map so the
  Maps JS API is not fetched on initial paint — render a lightweight placeholder and mount the map
  on intersection/click (or `next/dynamic` + idle). (`/crm/leads`, which I did measure, has no map —
  its cost was purely `LiquidEther` and should clear in Phase 1.)
- **Heavy client pages** (social feed `/home`, `/time/tracker`, `/crm/pipeline`): `next/dynamic`
  for below-the-fold heavy subtrees; verify no large synchronous data transforms on mount
  (memoize per `react-performance` patterns if found).
- **Images:** ensure `next/image` with explicit `width`/`height` (kills CLS) and `priority` only on
  the LCP image; everything else lazy.
- **CLS:** reserve space for async-loaded content (skeletons already exist in the Kit).
- **Cheap A11y wins** surfaced by the audit: missing button/aria labels, low-contrast text, form
  labels — fix inline (do NOT commit to A11y 100 across all routes; that's a separate pass).

Iterate Phase 2 until every route is ≥ 97 mobile **and** desktop.

## Phase 3 — Docs & hygiene (same-turn, per Section 9)
- **README.md**: remove/adjust `LiquidEther` references (it's named in the tech-stack / ambient
  section); the dashboard ambient is now CSS, not `three`.
- **CLAUDE.md** Section 2 mentions `LiquidEther.jsx` as the dashboard background — update to the
  CSS gradient.
- Update `docs/performance-pass-summary.md` with the P3 result table.

---

## Verification (how we prove 97+)

Use the exact harness already validated this session (no code changes to test it):

1. `npm run build && npm run start` (prod build on :3000).
2. Login: `POST /api/auth?action=login` with the `mosaad` creds → capture `ZOMZAM_SESSION`.
3. For each route, run Lighthouse twice (mobile default + `--preset=desktop`) with
   `--extra-headers '{"Cookie":"ZOMZAM_SESSION=<jwt>"}'` against `http://localhost:3000/<route>`,
   categories `performance,accessibility,best-practices,seo`.
4. Extract Perf score + LCP/TBT/CLS; confirm **every route ≥ 97** on both form factors and that
   the "Other"/TBT main-thread time has collapsed.
5. Regression check: `/` and `/sign` must not drop below their current 97/92 (mobile) and 100/100
   (desktop).

**Acceptance:** all public + authenticated routes Perf ≥ 97 (mobile & desktop); landing/sign
unregressed; no `three.js` chunk loaded on any authenticated route (verify in the Lighthouse
network/treemap).

## Workflow (per collaboration norms)
- New feature branch off `main` (e.g. `perf/p3-dashboard-webgl`), commit, push, open a PR for the
  teammate's review before merge — do NOT push straight to `main`.

## Risk / rollback
- Low risk: the change is subtractive (removing a heavy background) + one static CSS layer.
- Visual diff is minimal (replacing an 18%-opacity fluid with a static gradient).
- Rollback = revert the single commit; `LiquidEther.jsx` recoverable from git history if ever wanted
  back for a desktop-only, FPS-capped experiment.
