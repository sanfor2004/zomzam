# GSAP & UI Animation Implementation Plan (Revision 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cinematic, accessible GSAP animations to the Zomzam landing page and dashboard, following official GSAP best practices (the `useGSAP()` React hook, `gsap.matchMedia()`, `SplitText`, `ScrollTrigger`), to replace the current static feel with a premium SaaS experience.

**Architecture:** GSAP 3.15 (installed) + the official `@gsap/react` package for the `useGSAP()` hook. A singleton `src/lib/gsap.ts` registers every plugin exactly once. Components animate inside `useGSAP()` (runs in a layout effect → no flash-of-unstyled-content, auto-reverts on unmount). All motion is wrapped in `gsap.matchMedia("(prefers-reduced-motion: no-preference)")` so reduced-motion users get the final state with zero animation and zero flash.

**Tech Stack:** GSAP 3.15.0, `@gsap/react` (`useGSAP`), ScrollTrigger, SplitText (both bundled free in `gsap`), Next.js 15 App Router (`'use client'`), Tailwind CSS v4, React 19.

---

## Changes From Revision 1 (why this rewrite exists)

This revision was rewritten after reading all seven GSAP skills (`gsap-core`, `gsap-react`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-performance`, `gsap-utils`). The concrete changes:

| Area | Revision 1 (CSS/manual) | Revision 2 (official GSAP) | Skill source |
|------|--------------------------|----------------------------|--------------|
| React integration | `useEffect` + manual `gsap.context()` + `ctx.revert()` | **`useGSAP()`** hook with `scope` (auto-cleanup, layout-effect timing) | gsap-react |
| Reduced motion | manual `window.matchMedia(...).matches` early-returns in every file | **`gsap.matchMedia("(prefers-reduced-motion: no-preference)")`** wrapping all motion (auto-reverts, no flash) | gsap-core |
| Hero text reveal | hand-wrapped `<span data-word>` for each word | **`SplitText`** plugin with `mask: "words"` for a clip-reveal | gsap-plugins |
| Fades | `opacity: 0/1` | **`autoAlpha`** (also toggles `visibility`, so hidden cards never block clicks) | gsap-core |
| Load sequence | stacked tweens with `delay` | a single **`gsap.timeline({ defaults })`** with the position parameter | gsap-timeline |
| Target collection | `Array.from(el.querySelectorAll(...))` | **`gsap.utils.toArray(selector, scope)`** | gsap-utils |
| Partner marquee | pure CSS `@keyframes` | **GSAP tween** (`xPercent`, `ease: "none"`, `repeat: -1`) with hover pause + listener cleanup | gsap-core, gsap-react |
| Heatmap reveal | per-row CSS | GSAP row stagger — **kept to 7 rows, not 168 cells, on purpose** (avoid hundreds of simultaneous tweens) | gsap-performance |
| Layer hints | none | `will-change-transform` (Tailwind utility) on the small set of elements that actually animate | gsap-performance |
| New dependency | none | **`@gsap/react`** added | gsap-react |
| New plugins registered | ScrollTrigger | **`useGSAP`, ScrollTrigger, SplitText** | gsap-plugins |

---

## Global Constraints

- GSAP runs **client-side only** — all animation lives inside `useGSAP()` (which uses an isomorphic layout effect). Never call `gsap.*` / `ScrollTrigger.*` / `SplitText.*` during SSR.
- `gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)` is called **exactly once** in `src/lib/gsap.ts`, guarded by `typeof window !== 'undefined'`. Never register inline in a component.
- **All motion is wrapped in `gsap.matchMedia("(prefers-reduced-motion: no-preference)", () => { ... })`.** Because the hide-then-reveal `gsap.set`/`gsap.from` calls live *inside* that handler, reduced-motion users never see elements hidden — they get the natural, already-visible DOM with no flash.
- Pass a **`scope`** (ref) to every `useGSAP()` call so selector text is contained to the component.
- Collect targets with **`gsap.utils.toArray(selector, scopeEl)`**, not raw `querySelectorAll`.
- Animate **transforms + `autoAlpha` only** (`x`, `y`, `xPercent`, `yPercent`, `scale`, `rotation`). Never animate `width`/`height`/`top`/`left`/`margin` for movement.
- Cleanup is automatic via `useGSAP()`. Any DOM event listener added inside a handler must be removed in that handler's returned cleanup function.
- Do **not** touch `Silk.tsx` or `LiquidEther.jsx` — they own their own WebGL render loop.
- Duration constants: micro = `0.15`, standard = `0.5`–`0.6`, cinematic = `0.75`. Easing default: `power3.out`. Marquee/scroll-linked easing: `none`.
- Every scroll entrance uses `once: true` (play once; do not reverse on scroll-back).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `package.json` (via npm) | Add `@gsap/react` |
| Create | `src/lib/gsap.ts` | Plugin registry singleton; re-exports `gsap`, `useGSAP`, `ScrollTrigger`, `SplitText` |
| Create | `src/components/ui/CountUp.tsx` | Scroll-triggered number counter (`useGSAP` + `matchMedia`) |
| Modify | `src/components/ui/index.ts` | Export `CountUp` |
| Modify | `src/app/globals.css` | Marquee wrapper mask + edge fade (visual only; motion is GSAP) |
| Modify | `src/app/page.tsx` | Hero `SplitText` reveal + bento load timeline + scroll batch + GSAP marquee |
| Modify | `src/app/(dashboard)/dashboard/page.tsx` | Welcome/HUD/pillar/details/heatmap reveals + `CountUp` stats |

---

### Task 1: Install `@gsap/react` and Create the Plugin Registry

**Files:**
- Modify: `package.json` (through `npm install`)
- Create: `src/lib/gsap.ts`

**Interfaces:**
- Produces: `gsap`, `useGSAP`, `ScrollTrigger`, `SplitText` — re-exported from `@/lib/gsap`; consumed by every later task. Importing this module is what triggers one-time registration.

- [ ] **Step 1: Install the official React package**

Run:
```bash
npm install @gsap/react
```
If npm reports a peer-dependency conflict against React 19, re-run with:
```bash
npm install @gsap/react --legacy-peer-deps
```
Expected: `@gsap/react` appears under `dependencies` in `package.json`; `gsap` stays at `^3.15.0`.

- [ ] **Step 2: Create the registry singleton**

```typescript
// src/lib/gsap.ts
// Single source of truth for GSAP. Importing this module registers every plugin
// exactly once (guarded to the browser), so components never double-register
// across Fast Refresh. Plugins are all free and bundled in the `gsap` package.
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

export { gsap, useGSAP, ScrollTrigger, SplitText };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors. (If `gsap/SplitText` types are missing, confirm `gsap` is `^3.15.0` — SplitText ships with it.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/gsap.ts
git commit -m "feat: add @gsap/react and register GSAP plugins (useGSAP, ScrollTrigger, SplitText) once"
```

---

### Task 2: Landing Page — Hero SplitText Reveal + Bento Load Timeline + Scroll Batch

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `gsap`, `useGSAP`, `ScrollTrigger`, `SplitText` from `@/lib/gsap`
- Produces: On load, the hero headline reveals word-by-word from behind a mask while the first two bento cards rise in (one timeline). The remaining five cards animate via `ScrollTrigger.batch` as they enter the viewport.

- [ ] **Step 1: Swap imports**

The existing top of `src/app/page.tsx` is:
```tsx
import React, { useState, useEffect } from 'react';
```
Replace with:
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, SplitText } from '@/lib/gsap';
```

- [ ] **Step 2: Add refs inside `LandingPage()`**

After the existing `const [mounted, setMounted] = useState(false);` line, add:
```tsx
const bentoRef = useRef<HTMLDivElement>(null);
const heroTitleRef = useRef<HTMLHeadingElement>(null);
```

- [ ] **Step 3: Tag the 7 bento cards with `data-animate`**

Add `data-animate="bento-card"` as the first attribute on each of the 7 bento card `<div>`s (the `lg:col-span-*` elements). For example, Card 1 becomes:
```tsx
<div data-animate="bento-card" className="lg:col-span-8 bg-[#161920] border border-slate-800/80 rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between shadow-apple min-h-[360px] relative overflow-hidden group will-change-transform">
```
Do the same for the other six cards. Also append `will-change-transform` to each card's existing `className` (Tailwind v4 ships this utility; it promotes only these animating cards to their own layer — a deliberate, scoped use per the performance guidance, not a blanket hint).

The seven target `<div>`s are identified by these class prefixes:
1. `lg:col-span-8 ... min-h-[360px] ... group` (hero text card)
2. `lg:col-span-4 ... min-h-[360px] ... group` (Silk goal card)
3. `lg:col-span-8 bg-slate-900 ... min-h-[460px]` (large canvas card)
4. `lg:col-span-4 ... min-h-[460px] ... group` (community card)
5. `lg:col-span-4 bg-primary-500 ... group` (orange tools card)
6. `lg:col-span-4 bg-slate-950 ...` (security card)
7. `lg:col-span-4 ... min-h-[220px]` (real-time sync card)

- [ ] **Step 4: Attach the grid and headline refs**

Grid container:
```tsx
<div ref={bentoRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full mt-4">
```
Headline `<h1>` inside Card 1:
```tsx
<h1 ref={heroTitleRef} className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
```

- [ ] **Step 5: Mark the arrow link so SplitText ignores it**

Inside the `<h1>`, the in-headline anchor currently is:
```tsx
<a href="#features" className="inline-flex items-center justify-center w-9 h-9 border border-slate-800 rounded-full text-slate-500 hover:text-white hover:border-slate-700 transition-colors ml-3 align-middle cursor-pointer">
```
Add the `hero-cta-arrow` class so SplitText leaves it intact:
```tsx
<a href="#features" className="hero-cta-arrow inline-flex items-center justify-center w-9 h-9 border border-slate-800 rounded-full text-slate-500 hover:text-white hover:border-slate-700 transition-colors ml-3 align-middle cursor-pointer">
```
Leave the rest of the `<h1>` markup (the "Time" pill `<span>` and plain text) exactly as-is — SplitText preserves the pill element and its styling while still revealing it as a word.

- [ ] **Step 6: Replace the existing `useEffect` and add the `useGSAP` animation**

The current effect is:
```tsx
useEffect(() => {
  setMounted(true);
  document.documentElement.classList.add('dark');
}, []);
```
Keep it (it sets dark mode), then add a `useGSAP` call directly after it:
```tsx
useEffect(() => {
  setMounted(true);
  document.documentElement.classList.add('dark');
}, []);

useGSAP(() => {
  const root = bentoRef.current;
  const title = heroTitleRef.current;
  if (!root || !title) return;

  const cards = gsap.utils.toArray<HTMLElement>('[data-animate="bento-card"]', root);

  // All motion lives inside matchMedia: reduced-motion users get the natural,
  // already-visible DOM with no hide/reveal flash because none of these set()/from()
  // calls run for them.
  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // --- Page-load timeline: headline reveal + first two cards ---
    const split = SplitText.create(title, {
      type: 'words',
      mask: 'words',          // wraps each word in an overflow-clip mask for a wipe reveal
      ignore: '.hero-cta-arrow',
      wordsClass: 'hero-word',
    });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    tl.from(cards.slice(0, 2), {
      autoAlpha: 0,
      y: 52,
      duration: 0.75,
      stagger: 0.13,
    }, 0.1);

    tl.from(split.words, {
      yPercent: 110,          // slide up from behind the mask
      duration: 0.6,
      stagger: 0.07,
    }, 0.2);

    // --- Scroll batch: remaining five cards ---
    const rest = cards.slice(2);
    gsap.set(rest, { autoAlpha: 0, y: 52 });
    ScrollTrigger.batch(rest, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          stagger: 0.1,
          overwrite: true,
        }),
    });

    // SplitText is reverted automatically when useGSAP cleans up the context.
  });
}, { scope: bentoRef });
```

- [ ] **Step 7: Run dev server and verify**

Run: `npm run dev`, open `http://localhost:3000`.

Verify:
1. On load: "Master Your Time & Capital" reveals word-by-word, each word wiping up from behind its own line (mask effect). The orange "Time" pill stays styled; the down-arrow link stays in place and clickable.
2. Simultaneously the hero card and the Silk goal card rise + fade in (stagger).
3. Scrolling down: cards 3–7 fade/rise in as they cross 88% of the viewport, staggered.
4. DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" → reload: headline and all cards appear instantly, fully visible, no animation, no flash. The "Time" pill and arrow are intact (SplitText never ran).

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add GSAP SplitText hero reveal and staggered bento entrances to landing page"
```

---

### Task 3: Landing Page — GSAP Partner Logo Marquee

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `gsap`, `useGSAP` from `@/lib/gsap` (already imported in Task 2)
- Produces: An infinite horizontal logo marquee driven by a GSAP tween (`xPercent: -50`, `ease: "none"`, `repeat: -1`), paused on hover via event listeners that are cleaned up, with CSS edge-fade masks.

- [ ] **Step 1: Add the wrapper mask CSS (visual only — no keyframes)**

Open `src/app/globals.css`. After the existing `@keyframes fadeOut` block, add:
```css
/* Partner marquee: motion is driven by GSAP (see page.tsx). This only provides
   the overflow clip, the edge fade, and a compositor hint for the moving track. */
.marquee-wrapper {
  overflow: hidden;
  mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
}

.marquee-track {
  display: flex;
  width: max-content;
  will-change: transform;
}
```

- [ ] **Step 2: Add marquee refs inside `LandingPage()`**

After the `heroTitleRef` declaration from Task 2, add:
```tsx
const marqueeWrapRef = useRef<HTMLDivElement>(null);
const marqueeTrackRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Replace the static partner logo bar**

Replace the entire `<div id="features" ...>` partner logo section (the bar containing `ADIDAS NETFLIX AMAZON SPOTIFY MCDONALD'S`) with:
```tsx
{/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: PARTNER LOGO MARQUEE
    Contains: GSAP-driven infinite brand ticker, edge fade masks, hover-pause
    ────────────────────────────────────────────────────────── */}
<div id="features" className="max-w-7xl mx-auto w-full py-12 mt-12 border-t border-slate-800/60">
  <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-600 mb-8">
    Trusted by teams at
  </p>
  <div ref={marqueeWrapRef} className="marquee-wrapper">
    <div ref={marqueeTrackRef} className="marquee-track">
      {/* Two identical sets so an xPercent:-50 shift loops seamlessly */}
      {['ADIDAS', 'NETFLIX', 'AMAZON', 'SPOTIFY', "MCDONALD'S", 'ADOBE', 'STRIPE',
        'ADIDAS', 'NETFLIX', 'AMAZON', 'SPOTIFY', "MCDONALD'S", 'ADOBE', 'STRIPE'].map((name, i) => (
        <span
          key={i}
          className="font-black text-base tracking-widest font-mono text-slate-700 hover:text-slate-400 transition-colors duration-200 px-10 flex-shrink-0 select-none"
        >
          {name}
        </span>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Add the marquee `useGSAP` after the Task 2 `useGSAP`**

```tsx
useGSAP(() => {
  const wrap = marqueeWrapRef.current;
  const track = marqueeTrackRef.current;
  if (!wrap || !track) return;

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Two identical sets in the track, so -50% advances by exactly one set → seamless.
    const loop = gsap.to(track, {
      xPercent: -50,
      duration: 24,
      ease: 'none',     // required for constant-speed, seam-free looping
      repeat: -1,
    });

    const pause = () => loop.pause();
    const resume = () => loop.play();
    wrap.addEventListener('mouseenter', pause);
    wrap.addEventListener('mouseleave', resume);

    // Listeners are added in this handler, so remove them in its cleanup.
    return () => {
      wrap.removeEventListener('mouseenter', pause);
      wrap.removeEventListener('mouseleave', resume);
    };
  });
}, { scope: marqueeWrapRef });
```

- [ ] **Step 5: Verify the marquee**

Open `http://localhost:3000`, scroll to the partner bar.
1. Logos scroll continuously left at a steady pace and loop with no visible jump.
2. Hovering the strip pauses it; leaving resumes.
3. Both edges fade to transparent.
4. With `prefers-reduced-motion: reduce` emulated and reload: the strip is static (no GSAP tween created), still showing logos.

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/app/page.tsx
git commit -m "feat: add GSAP-driven infinite partner logo marquee with hover pause"
```

---

### Task 4: CountUp Component (`useGSAP` + `matchMedia`)

**Files:**
- Create: `src/components/ui/CountUp.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `gsap`, `useGSAP` from `@/lib/gsap`
- Produces: `<CountUp value={n} prefix="$" suffix="%" decimals={2} duration={1.3} className="..." />` — counts 0 → `value` when scrolled into view; renders the final value immediately for reduced-motion users.

- [ ] **Step 1: Create `CountUp.tsx`**

```tsx
// src/components/ui/CountUp.tsx
'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function CountUp({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.3,
  className,
}: CountUpProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const el = spanRef.current;
    if (!el) return;

    const format = (v: number) =>
      `${prefix}${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

    const mm = gsap.matchMedia();

    // Reduced motion: show the final value with no tween.
    mm.add('(prefers-reduced-motion: reduce)', () => {
      el.textContent = format(value);
    });

    // Normal: count up when the element scrolls into view.
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const counter = { val: 0 };
      gsap.to(counter, {
        val: value,
        duration,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: () => { el.textContent = format(counter.val); },
        onComplete: () => { el.textContent = format(value); },
      });
    });
  }, { scope: spanRef, dependencies: [value, prefix, suffix, decimals, duration] });

  return (
    <span ref={spanRef} className={className}>
      {prefix}0{suffix}
    </span>
  );
}
```

- [ ] **Step 2: Export it**

In `src/components/ui/index.ts`, after the existing exports, add:
```ts
export * from './CountUp';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CountUp.tsx src/components/ui/index.ts
git commit -m "feat: add CountUp component (useGSAP + matchMedia + ScrollTrigger)"
```

---

### Task 5: Dashboard — Section Reveals + CountUp Stats

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `gsap`, `useGSAP`, `ScrollTrigger` from `@/lib/gsap`; `CountUp` from `@/components/ui`
- Produces: Welcome banner rises on data load; HUD cards, pillar cards, and details columns stagger in on scroll; heatmap reveals row-by-row; numeric stats count up via `CountUp`.

- [ ] **Step 1: Swap imports**

Existing:
```tsx
import React, { useState, useEffect } from 'react';
```
Replace with:
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger } from '@/lib/gsap';
import { CountUp } from '@/components/ui';
```

- [ ] **Step 2: Add refs inside `DashboardPage()`**

After the existing `const cardRef = React.useRef<HTMLDivElement>(null);` line, add:
```tsx
const pageRef = useRef<HTMLDivElement>(null);
const welcomeRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 3: Attach refs and tag animated elements with `data-animate`**

1. Outer wrapper (currently `<div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">`) — remove the `animate-in fade-in slide-in-from-bottom-4 duration-500` classes (GSAP replaces them) and add `ref={pageRef}`:
```tsx
<div ref={pageRef} className="max-w-6xl mx-auto space-y-8 pb-12">
```
2. Welcome banner outer div — add `ref={welcomeRef}` and `will-change-transform`:
```tsx
<div ref={welcomeRef} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 via-primary-570 to-primary-600 p-8 sm:p-10 text-white shadow-apple border border-primary-400/20 will-change-transform">
```
3. The three HUD cards (inside the `grid grid-cols-1 md:grid-cols-3 gap-6` under the "CORE HOURLY RATE HUD" section) — add `data-animate="hud-card"` and `will-change-transform` to each of the three card `<div>`s (Effective Income Rate, Delivered Contract Rate, Tracked Metrics).
4. The three pillar cards (under "THREE-PILLAR STATS GRID") — add `data-animate="pillar-card"` and `will-change-transform` to each (Time, Money, CRM).
5. The two details columns (under "DETAILS & DEEP DIVE SECTION", the `grid grid-cols-1 lg:grid-cols-2 gap-8` children) — add `data-animate="detail-col"` and `will-change-transform` to each (Recent Task Backlog, CRM Project Revenue).
6. The heatmap day rows — each generated `<div key={dayName} className="flex items-center">` becomes:
```tsx
<div key={dayName} data-animate="heatmap-row" className="flex items-center">
```

- [ ] **Step 4: Add the `useGSAP` reveal effect after the existing data-fetch `useEffect`**

The existing `useEffect(() => { fetchDashboardData(); }, [])` stays. Add after it:
```tsx
useGSAP(() => {
  const root = pageRef.current;
  if (loading || !root) return; // wait until data has rendered the real DOM

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // Welcome banner: rises on load.
    if (welcomeRef.current) {
      gsap.from(welcomeRef.current, {
        autoAlpha: 0, y: 44, duration: 0.65, ease: 'power3.out', delay: 0.05,
      });
    }

    // Helper: hide a group, then stagger-reveal it on scroll.
    const revealOnScroll = (selector: string, y: number, stagger: number) => {
      const items = gsap.utils.toArray<HTMLElement>(selector, root);
      if (!items.length) return;
      gsap.set(items, { autoAlpha: 0, y });
      ScrollTrigger.batch(items, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger, overwrite: true,
          }),
      });
    };

    revealOnScroll('[data-animate="hud-card"]', 28, 0.1);
    revealOnScroll('[data-animate="pillar-card"]', 32, 0.12);
    revealOnScroll('[data-animate="detail-col"]', 40, 0.14);

    // Heatmap: reveal by ROW (7 elements), not by cell (168) — animating 168
    // simultaneous tweens risks jank on low-end devices (performance guidance).
    const rows = gsap.utils.toArray<HTMLElement>('[data-animate="heatmap-row"]', root);
    if (rows.length) {
      gsap.set(rows, { autoAlpha: 0, x: -20 });
      ScrollTrigger.create({
        trigger: rows[0],
        start: 'top 85%',
        once: true,
        onEnter: () =>
          gsap.to(rows, {
            autoAlpha: 1, x: 0, duration: 0.38, ease: 'power2.out', stagger: 0.06,
          }),
      });
    }
  });
}, { scope: pageRef, dependencies: [loading], revertOnUpdate: true });
```

- [ ] **Step 5: Replace static numeric values with `<CountUp>`**

Add this currency-symbol helper just above the `return (` in `DashboardPage()` (it is only reached when `!loading && data`):
```tsx
const currencySymbol = (c: string) =>
  c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : 'E£';
```

Then replace these display values (the rest of each line's classes are unchanged):

HUD — Effective Income Rate:
```tsx
<CountUp value={rates.hourlyRateIncome} prefix={currencySymbol(profile.primary_currency)} decimals={2} duration={1.4} className="text-4xl font-black tracking-tight text-white font-mono" />
```
HUD — Delivered Contract Rate:
```tsx
<CountUp value={rates.hourlyRateProjects} prefix={currencySymbol(profile.primary_currency)} decimals={2} duration={1.4} className="text-4xl font-black tracking-tight text-white font-mono" />
```
HUD — Tracked Metrics (Total Time, then Tasks Done):
```tsx
<CountUp value={time.completedHours} suffix="h" className="text-2xl font-black text-white font-mono" />
```
```tsx
<CountUp value={time.completedTasksCount} className="text-2xl font-black text-white font-mono" />
```
Pillar Time card (In Progress, then Pending):
```tsx
<CountUp value={time.inProgressTasksCount} className="font-bold text-slate-200" />
```
```tsx
<CountUp value={time.pendingTasksCount} className="font-bold text-slate-200" />
```
Pillar Money card (Total Income, then Total Expenses):
```tsx
<CountUp value={money.totalIncomePrimary} prefix={currencySymbol(profile.primary_currency)} decimals={2} className="font-bold text-emerald-500" />
```
```tsx
<CountUp value={money.totalExpensePrimary} prefix={currencySymbol(profile.primary_currency)} decimals={2} className="font-bold text-rose-500" />
```
Pillar CRM card (Active Leads, then Conversion Rate):
```tsx
<CountUp value={activeLeads} className="font-bold text-slate-200" />
```
```tsx
<CountUp value={conversionRate} suffix="%" className="font-bold text-violet-500" />
```

- [ ] **Step 6: Verify all dashboard animations**

Run `npm run dev`, sign in, go to `/dashboard`.
1. After data loads: welcome banner rises from below (no flash before it).
2. Scrolling: HUD cards stagger → pillar cards stagger → heatmap rows slide in Mon→Sun → details columns stagger.
3. Every numeric stat counts up from 0 as its card enters view.
4. Emulate `prefers-reduced-motion: reduce`, reload: all sections appear instantly and fully visible; numbers show final values immediately; no flash.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: add GSAP scroll reveals and CountUp stats to dashboard"
```

---

## Self-Review

### Spec coverage
- ✅ Scroll-triggered stagger entrances for bento cards — Task 2 (`ScrollTrigger.batch`)
- ✅ Cinematic hero text reveal — Task 2 (`SplitText` mask reveal, the gsap-plugins approach)
- ✅ Animated number counters — Tasks 4 & 5 (`CountUp`)
- ✅ Partner logo marquee — Task 3 (GSAP `xPercent` loop, not CSS)
- ✅ Heatmap stagger — Task 5 (row-based, performance-bounded)
- ✅ Dashboard section reveals — Task 5
- ✅ All seven GSAP skills applied — see "Changes From Revision 1" table

### Skill-application check
- gsap-react: `useGSAP()` + `scope` + auto-cleanup + listener cleanup in handler — Tasks 2, 3, 4, 5 ✅
- gsap-core: `gsap.matchMedia()` for reduced motion, `autoAlpha`, transform-only, built-in eases — all tasks ✅
- gsap-timeline: load sequence is one `gsap.timeline({ defaults })` with position params — Task 2 ✅
- gsap-scrolltrigger: `ScrollTrigger.batch`, `once: true`, `start: "top 88%"` — Tasks 2, 5; `scrollTrigger` on a top-level tween in `CountUp` — Task 4 ✅
- gsap-plugins: `SplitText` (registered, `mask`, `ignore`, auto-revert) — Tasks 1, 2 ✅
- gsap-performance: transforms + `autoAlpha` only, `will-change-transform` only on animating elements, heatmap by row not cell, `stagger` over manual delays — Tasks 2, 3, 5 ✅
- gsap-utils: `gsap.utils.toArray(selector, scope)` for all target collection — Tasks 2, 5 ✅

### Placeholder scan
- No TBD/TODO/"implement later". Every code step is complete and copy-pasteable. All paths exact.

### Type consistency
- Registry exports `gsap`, `useGSAP`, `ScrollTrigger`, `SplitText` (Task 1) — imported identically everywhere.
- `useGSAP(fn, { scope, dependencies, revertOnUpdate })` config shape used consistently (Tasks 2, 4, 5).
- `CountUp` props (`value`, `prefix?`, `suffix?`, `decimals?`, `duration?`, `className?`) match every call site in Task 5.
- `data-animate` values (`bento-card`, `hud-card`, `pillar-card`, `detail-col`, `heatmap-row`) each defined where the element is tagged and queried with the same string.
- `currencySymbol` defined once in Task 5, used by all currency `CountUp`s.
