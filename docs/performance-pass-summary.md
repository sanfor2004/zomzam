# Performance Optimization Pass — Summary

**Date:** 2026-06-20
**Branch:** committed directly to `main` (11 commits)
**Scope:** App-wide performance sweep (load speed + React runtime) driven by two audits — a Core Web Vitals audit and a React render audit. Every change was verified with a clean production build; the dashboard was smoke-tested in dev.

---

## TL;DR (the headline wins)

- 🗑️ Deleted a **2.3 MB** unused image that was sitting in the repo.
- 🖼️ All avatars/photos now go through **`next/image`** → served as **AVIF/WebP**, resized, lazy-loaded (one tiny icon went 3,211 B → **711 B**; real avatars save far more).
- ⚡ Notifications/real-time updates **no longer re-render the whole dashboard**, and typing a post **no longer re-renders the feed**.
- 🔤 Fixed invisible-text-on-load (font flash) and trimmed unused font weights.
- 📦 Removed 3 unused animation plugins and lazy-loaded 6 languages, shrinking the JS that loads up front.
- 🔐 The dashboard now loads the logged-in user **on the server** — no more loading spinner waterfall on every visit.

---

## What changed, in plain language

| # | Area | What we did | Why it helps |
|---|------|-------------|--------------|
| 1 | **Assets** | Deleted unused `auth-split-bg.jpg` (2.3 MB) | Dead weight in the repo; nothing referenced it. |
| 2 | **Fonts** | Added `display: swap` to Inter + dropped an unused weight | Text shows instantly instead of being invisible while the font loads (helps LCP). |
| 3 | **Config** | Enabled AVIF/WebP in `next.config.ts` | Modern, much smaller image formats for everything below. |
| 4 | **Real-time state** | Split + memoized the "StreamWaiter" context (presence vs. notifications) | A single notification used to re-render the whole dashboard; now it only updates what changed. |
| 5 | **Money state** | Memoized the Money context | Stops needless re-renders across the money pages. |
| 6 | **Feed** | Wrapped `PostCard` in `React.memo` + stable handlers | Typing/other updates no longer re-render every post card on screen. |
| 7 | **Lists** | Used stable keys (IDs) instead of array index | Prevents subtle list-update bugs and wasted re-renders. |
| 8 | **Images** | Migrated ~25 raw `<img>` to `next/image` | Smaller images (AVIF/WebP), automatic resizing, lazy loading, no layout shift. |
| 9 | **Animation** | Removed 3 GSAP plugins that were registered but never used | Smaller shared JS bundle on every animated page (~20 KB off those chunks). |
| 10 | **Translations** | Lazy-load the 6 non-English dictionaries | English-only users don't download other languages up front. |
| 11 | **Auth** | Resolve the dashboard user on the server | Removes a post-load network round-trip + the full-screen spinner on every dashboard visit. |
| 12 | **Composer** | Extracted a self-contained `<PostComposer>` component | Typing a post now re-renders only the composer, not the feed/sidebar (the "move state down" best practice). |

> A small follow-up (`fix(images)`) whitelisted the `i.pravatar.cc` host so seeded dev data renders through `next/image`.

---

## Measured impact

- **Images:** AVIF served where supported (e.g. a default avatar: 3.2 KB PNG → 0.7 KB AVIF). User-uploaded avatars (up to ~600 KB) and post photos (up to 5 MB) get the biggest savings.
- **JS bundle:** GSAP chunks dropped ~207 KB → ~187 KB; 6 language dictionaries (~8 KB) moved out of the initial load into an on-demand chunk.
- **Render work:** notifications and post-composer typing no longer cascade re-renders across the dashboard/feed.
- **Dashboard load:** user data is server-rendered — the old "spinner → fetch → render" sequence is gone.

---

## How it was verified

- ✅ Clean production build (`next build`) after every change — TypeScript + lint passing.
- ✅ Dashboard smoke-tested in dev (authenticated): renders correctly, no spinner, `next/image` serving AVIF, no console/server errors.
- ✅ The big composer refactor produced **byte-identical** server HTML — behavior preserved.

---

## Follow-up: P3 pass — dashboard WebGL removed (2026-06-21)

The "3D ambient backgrounds" item below (deferred for a visual sign-off) was actioned for the
**dashboard shell**. The landing `Silk` shader stays (desktop-gated, 0 ms TBT, scores 100); the
dashboard's `LiquidEther` — a full fluid simulation (BFECC advection + 32 Poisson/viscous
iterations per frame) rendered at **0.18 opacity** — was deleted and replaced with a **static CSS
gradient** (no JS, no `requestAnimationFrame` loop). It had been running on *every* authenticated
route, mobile and desktop alike.

**Measured (local production build, Lighthouse, authenticated as a real user):**

| | Before (LiquidEther) | After (CSS gradient) |
|---|---|---|
| Desktop Perf (dashboard / settings / crm) | 61 / 59 / — | **99 / 100 / 99** ✅ |
| Desktop TBT | ~11,000–13,000 ms | **10–70 ms** |
| Mobile Perf (range across routes) | 49–65 | **75–92** |
| Mobile TBT | 4,200–8,700 ms | **180–570 ms** |
| Main-thread "Other" (rAF/WebGL) | ~35,000–40,000 ms | collapsed |

**Desktop now meets the 97+ goal everywhere.** Mobile improved ~30 points but does **not** yet reach
97: with the rAF loop gone, the limiter is now **LCP (~3.5 s)** — pure client-render/hydration cost
of the `'use client'` dashboard shell on a 4×-throttled CPU (the *identical* markup renders LCP in
0.8 s on desktop). Closing it requires an architectural change (server-render the dashboard content
/ defer context providers), which is a **deliberate decision** tracked separately — not done
silently here. See `docs/performance-pass-P3-plan.md`.

---

## One item intentionally left for later (from the 2026-06-20 pass)

- **3D ambient backgrounds (three.js — Silk / LiquidEther):** they cost ~177 KB gzipped and run a continuous GPU loop for a very subtle (0.18 opacity) effect. Replacing them with a near-free CSS/SVG version is on the table, but it's a **visual/brand decision**, so it was deferred for a deliberate look-and-feel sign-off rather than removed silently. *(Resolved for the dashboard in the P3 pass above; the landing `Silk` is kept, desktop-gated.)*

---

*No behavior or features were removed — these are under-the-hood performance changes. If anything looks off in the UI (especially avatars/photos), flag it and it's a quick fix.*
