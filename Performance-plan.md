# Performance Plan — zomzam.com

> Source: web-performance audit of a fresh `next build` (Next 16.2.7 / React 19.2), gzipped
> chunk measurement, manifest mapping, and render-strategy review.
> Date: 2026-06-20.
> Scope: optimization backlog only — no code changed by this document.

---

## OUTCOME — executed 2026-06-21 (P1 + P2)

Branch `perf/p1-p2-pass`. Measured against a real production build + `next start` Lighthouse
run (single local run, GPU-disabled headless, localhost → no network latency, so optimistic vs
PageSpeed's infra — treat as directional, not absolute).

**Captured AFTER numbers (the plan's baseline was *estimated*, never measured, so there is no
clean before/after delta — only the corrected facts below):**

| | Score | LCP | TBT | CLS |
|---|---|---|---|---|
| 🖥️ Desktop | **100** | 0.6 s | 10 ms | 0 |
| 📱 Mobile | **97** | 2.3 s | 130 ms | 0 |

Both exceed the plan's targets (desktop 97–100, mobile 88–94). **Mobile is already above target, so
3.1 (landing server/client split) is not needed for performance** and stays deferred.

**What the build data corrected about this plan (it was measured on webpack; `next build` now uses
Turbopack, which chunks differently):**
- **1.1 (GSAP de-dup) — NO-OP.** Source is already clean (every consumer imports `@/lib/gsap`),
  and the `/` route loads GSAP core exactly once (a single 191 KB / 69 KB-gz chunk; the second
  ScrollTrigger-bearing chunk is the 21 KB page island, not a duplicate). No per-route duplication
  exists under Turbopack. The plan's "+5–8 pts" was a webpack-era artifact. Nothing to fix.
- **2.2 (trim 129 KB shared baseline) — ~NO HEADROOM.** `/` ships ~265 KB gz initial JS, but it's
  React (71 KB) + React-DOM/scheduler (39 KB) + Next runtime (40 KB) ≈ irreducible framework, plus
  the GSAP the landing genuinely uses. Root `Providers` is already lean (`TranslationProvider` only) —
  nothing route-specific leaks onto `/`. The only structural lever left for `/` is 3.1, which the
  measured score makes unnecessary.
- **1.3 — the seed avatars were NOT git-ignored as assumed; they were committed** (~1.3 MB). Fixed:
  `git rm --cached` + `/public/Assets/Uploads/avatars/*` ignored, dir kept via `.gitkeep`.
- **1.4 — `Silk.tsx` has ONE `<Canvas>`, not two** (one component instantiated twice). `frameloop="always"`
  was also undocumented by the plan. Capped `dpr` to 1.

**Shipped (working tree, not committed):**
- **1.2** removed dead `mounted` state on the landing page.
- **1.3** untracked + git-ignored the seed avatars.
- **1.4** `dpr={[1,2]}` → `dpr={1}` in `Silk.tsx`.
- **1.5** removed permanent `will-change-transform` from all 7 bento cards (GSAP manages it during tweens
  — confirmed against the GSAP performance guide).
- **2.1** landing `Silk` now renders only on real desktop pointers
  (`useDesktopWebGL` = `(min-width:1024px) and (pointer:fine)` + idle); phones/tablets get a static
  CSS-gradient fallback and **never download the 723 KB-raw / ~182 KB-gz three.js chunk**. This is the
  real mobile lever — the win is runtime network/CPU, not initial-JS bytes (Silk was already dynamic).

**Deferred:** 3.1 (not needed — mobile already 97). 1.1 / 2.2 closed as no-op / no-headroom.

---

## Estimated Baseline (before this plan)

| | Score | Driver |
|---|---|---|
| 🖥️ Desktop PageSpeed | **90–98** (~94) | Fast CPU absorbs JS; SSR text + good CLS carry it |
| 📱 Mobile PageSpeed | **72–85** (~78) | TBT from GSAP duplication + three.js parse is the ceiling |

**Target after this plan:** Desktop **97–100**, Mobile **88–94**.

Measured facts the plan acts on:
- Shared baseline JS (every route): **129 KB gzip** (5 chunks).
- three.js chunk: **708 KB raw / 177 KB gzip** (`WebGLRenderer` confirmed); `three` referenced in **3 chunks**.
- GSAP: **188 KB raw / 67 KB gzip**, **duplicated across 2 separate chunks**.
- Landing `/` is `'use client'` (618 lines); First-Load JS ≈ **~210–230 KB gzip** before three.js.
- 79 of 113 source files are client components.

What is already correct (do **not** regress): dynamic + `requestIdleCallback`-deferred shaders,
`next/font` with `display: swap`, AVIF/WebP via `next/image` with explicit dimensions,
lazy-loaded i18n dictionaries with non-blocking provider, server-resolved dashboard user,
`optimizePackageImports` for `lucide-react`.

---

## Priority 1 — Quick Wins (hours, low risk)

### 1.1 De-duplicate GSAP — ~67 KB gzip wasted, shipped twice
**Problem:** Two distinct 188 KB chunks each contain the full GSAP core (`gsap` ×61,
`ScrollTrigger`, `SplitText`). GSAP should resolve to a single shared chunk.

**Action:**
- Confirm every consumer imports from the single barrel `@/lib/gsap` — never from the `gsap`
  package directly (CLAUDE.md already mandates this; the duplication means something bypasses it).
- Audit with: `grep -rn "from 'gsap'" src` and `grep -rn "from \"gsap" src` — every hit that is
  not inside `src/lib/gsap.ts` is a leak that forks the chunk.
- Re-run `next build` and confirm only one chunk contains `ScrollTrigger`.

**Expected impact:** −67 KB gzip on any route that loads two GSAP copies; meaningful TBT drop on mobile.

### 1.2 Remove dead `mounted` state on the landing page
**Problem:** `src/app/page.tsx` declares `const [mounted, setMounted] = useState(false)` and sets it
in an effect, but the value is never read. Dead code + an extra render.

**Action:** Delete the `mounted` state and its `setMounted(true)` effect (keep the
`document.documentElement.classList.add('dark')` line if still needed).

**Expected impact:** Negligible runtime, but removes a confusing no-op.

### 1.3 Confirm seeded avatars never ship to production
**Problem:** Largest public asset is a 596 KB seeded avatar PNG (dev `db:seed` data).

**Action:** Verify `public/Assets/Uploads/avatars/*` seeded files are git-ignored / not referenced
by built output. They are dev-only; ensure prod avatars go through the `sharp` pipeline only.

### 1.4 Cap WebGL canvas resolution — `dpr={[1, 2]}` → `dpr={1}` on Silk
**Problem:** Both `<Silk>` instances on the landing page (Card 2 and Card 3) use `dpr={[1, 2]}`
on their `<Canvas>`. On a high-DPI mobile screen (most modern phones) this makes the WebGL
renderer draw at **2× resolution** — 4× the pixel count — doubling GPU fill-rate work on hardware
that is already stressed by two simultaneous WebGL contexts.

**Action:** Change both `<Canvas dpr={[1, 2]}>` calls inside `src/components/Silk.tsx` to
`<Canvas dpr={1}>`. The Silk shader is a blurred, low-frequency pattern; the visual difference
at 1× vs 2× is imperceptible, but the GPU cost is halved per canvas.

**Expected impact:** −3–5 pts TBT/INP on mobile; GPU memory pressure reduced meaningfully when
combined with two simultaneous WebGL contexts.

### 1.5 Remove `will-change-transform` from non-animating bento cards
**Problem:** All 7 bento cards on the landing page carry `will-change-transform` (via the
`will-change-transform` Tailwind utility in `page.tsx`). `will-change: transform` instructs the
browser to promote each element to its own GPU compositing layer *immediately* and hold it there
for the lifetime of the page. On a mobile device with limited VRAM, 7 promoted layers + 2 WebGL
contexts causes severe memory pressure and can trigger layer eviction / re-rasterisation — the
opposite of the intended speedup.

**Action:** Remove the `will-change-transform` class from the 5 cards that are **not** animated
on page load (Cards 3–7 — only Cards 1 and 2 animate immediately via the GSAP load timeline).
GSAP automatically adds `will-change` to elements it is actively tweening and removes it on
completion, so the scroll-reveal cards are already handled correctly without a permanent hint.

**Expected impact:** −2–3 pts rendering / memory pressure on mobile; no visual change.

---

## Priority 2 — Medium Effort (1–2 days, biggest mobile lever)

### 2.1 Gate three.js backgrounds on real intent, not idle time
**Problem:** three.js (177 KB gzip) is deferred with `requestIdleCallback({ timeout: 1500 })`. On a
4×-throttled mobile Lighthouse run that callback fires *inside* the trace window, so parsing 708 KB
+ WebGL shader compilation lands a large block of main-thread work → inflated **TBT** and worse **INP**.

**Action (choose one):**
- **Preferred:** Replace the landing-page `Silk` shader with the zero-JS `OrbitRings.tsx`
  (pure SVG + CSS `@keyframes`, already in the Kit and already used on `/sign`). The marketing page
  does not need a WebGL surface to feel premium.
- **Alternative:** Gate `Silk` / `LiquidEther` behind an `IntersectionObserver` (load when the
  background container is actually in view) or first user interaction, instead of `requestIdleCallback`.
  This keeps the shader off the initial mobile trace entirely.

**Expected impact:** The single largest mobile-score lever — moves mobile from ~78 toward high-80s/90s.

### 2.2 Trim the 129 KB gzip shared baseline
**Problem:** 129 KB gzip loads on *every* route, including the public landing page. Next's
"good" shared baseline is ~85–100 KB.

**Action:**
- Inspect what is forced into `rootMainFiles` (the shared chunks) via the build manifest.
- Move anything not truly global (e.g. heavy context/util only used on dashboard routes) out of the
  root layout / providers so it code-splits per route group instead of loading on `/`.
- Verify `TranslationProvider` and any global providers stay lean (the i18n English-inline approach
  is already correct — keep it).

**Expected impact:** Lower First-Load JS on the public page → better FCP/LCP/TBT on mobile.

---

## Priority 3 — Structural (consider, not urgent)

### 3.1 Reduce the client-component surface on the landing page
**Problem:** `/` is a 618-line `'use client'` page with GSAP eagerly imported into its chunk. The
text content is in SSR'd HTML (good for LCP), but all of it hydrates.

**Action:** Split the static marketing shell (hero copy, bento grid markup) into server components and
push only the interactive bits (language dropdown, GSAP-animated refs) into small client islands.
This shrinks the page's hydration JS without changing the visual result.

**Expected impact:** Lower TBT; incremental, do after P1/P2 are measured.

---

## Verification Protocol (do this before and after each priority)

1. `next build` → confirm chunk count and that GSAP/three appear in the expected single chunks.
2. Run a **real** Lighthouse trace against `next start` (mobile **and** desktop) — replace the
   estimates in this doc with captured numbers:
   ```
   next build && next start
   # then, against http://localhost:3000/
   npx lighthouse http://localhost:3000/ --only-categories=performance --form-factor=mobile --screenEmulation.mobile
   npx lighthouse http://localhost:3000/ --only-categories=performance --preset=desktop
   ```
3. Track the four numbers that move: **LCP, TBT, CLS, First-Load JS (gzip)**.
4. Re-test on the `/` route specifically (the URL PageSpeed Insights will hit), plus `/sign` and
   `/dashboard` as representative app routes.

---

## Effort vs. Impact Summary

| # | Item | Effort | Mobile impact |
|---|------|--------|---------------|
| 2.1 | Gate three.js on intent / swap to OrbitRings | 1–2 days | **Highest (~+15–20 pts)** |
| 1.1 | De-duplicate GSAP | Hours | High (~+5–8 pts) |
| 2.2 | Trim shared baseline | 1 day | Medium–High |
| 3.1 | Server/client split of landing page | 2+ days | Medium |
| 1.4 | Cap Silk canvas `dpr` to 1× | Minutes | Low–Medium (~+3–5 pts) |
| 1.5 | Remove `will-change-transform` from static cards | Minutes | Low–Medium (~+2–3 pts) |
| 1.2 | Remove dead `mounted` state | Minutes | Negligible (~+1–2 pts) |
| 1.3 | Confirm seed avatars excluded from prod | Minutes | Negligible (hygiene) |

Doing **1.1 + 2.1** alone is expected to close most of the gap.  
Adding **1.4 + 1.5** on top squeezes out another ~5–8 pts with near-zero effort.
