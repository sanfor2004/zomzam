# Zomzam UI / Visual Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the visual design system that `BrandGuideLine.md` already promises but the code never delivered — a real display/mono font pairing, a fluid `clamp()` type scale, and layered "shadow physics" depth — then apply them so the landing page and dashboard look intentionally designed rather than default-Tailwind.

**Architecture:** This is a **design-system foundation plan**, complementary to (and independent of) `UI-GSAP-plan.md` (which only adds motion). Work flows bottom-up: define tokens in `globals.css` `@theme` and load fonts in `layout.tsx` first, then apply those tokens to the hero and dashboard surfaces. No motion work here — the two plans can be executed in either order.

**Tech Stack:** Tailwind CSS v4 (`@theme` tokens), Next.js 15 `next/font/google`, React 19. No new npm dependencies.

---

## Why this plan exists (grounding)

`BrandGuideLine.md` specifies a Montserrat/Outfit **display** face, a JetBrains Mono **mono** face, a fluid `clamp()` type scale, and multi-layered shadow physics. None of it is implemented:

- `globals.css` `@theme` defines **only** `--font-sans: "Inter"`. There is **no** `--font-display`, `--font-mono`, `--text-display`, `--shadow-apple-sm`, or `--shadow-apple-lg`.
- Yet the app uses `font-display`, `font-mono`, `shadow-apple-sm`, and `shadow-apple-lg` in **69 places across 22 files**. Each silently resolves to nothing — headlines render in Inter (not a display face), "mono" numbers fall back to the browser default, and `shadow-apple-sm/lg` produce **no shadow at all**.
- This is the *exact* silent-failure class the codebase already documented for the `slate-450`/`slate-850` shades (see the comment block in `globals.css` lines 23–30).

So this plan is not speculative restyling — it makes 69 existing utility usages actually do what their authors intended, then leans into them.

---

## Global Constraints

- All design tokens are declared in the **`@theme` block** of `src/app/globals.css` (Tailwind v4 generates `font-*`, `text-*`, `shadow-*` utilities from `--font-*`, `--text-*`, `--shadow-*` variables).
- Fonts load through **`next/font/google`** in `src/app/layout.tsx` with `variable:` bindings — never via `<link>` tags or `@import` (avoids render-blocking and layout shift).
- Keep **Inter** as `--font-sans` (body). Add display + mono as **additional** faces; do not replace body text.
- Type-scale values are copied **verbatim** from `BrandGuideLine.md` §3B. Shadow values follow §3C "biological" multi-layer structure.
- Do not alter component logic, data flow, or the WebGL components (`Silk.tsx`, `LiquidEther.jsx`). This plan touches **tokens, fonts, and className/style attributes only**.
- Preserve existing behavior in light and dark mode and RTL — test both where a task changes a globally-applied token.
- Accessibility is the quality floor (per HIG §7.6 in `AGENTS.md`): keyboard focus must stay visible; contrast must not regress.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/app/layout.tsx` | Load Montserrat (display) + JetBrains Mono (mono) via `next/font` |
| Modify | `src/app/globals.css` | Add font, type-scale, and layered-shadow tokens; add `:focus-visible` ring |
| Modify | `src/app/page.tsx` | Apply display type scale to the hero headline + eyebrow |
| Modify | `src/app/(dashboard)/dashboard/page.tsx` | Apply display scale + layered elevation to dashboard headings/cards |

---

### Task 1: Font Foundation — Display + Mono Faces

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: working `font-display` (Montserrat) and `font-mono` (JetBrains Mono) utilities consumed by all 22 files that already reference them.

- [ ] **Step 1: Load the two faces in `layout.tsx`**

The current import line is:
```tsx
import { Inter } from 'next/font/google';
```
Replace with:
```tsx
import { Inter, Montserrat, JetBrains_Mono } from 'next/font/google';
```
After the existing `const inter = Inter({...});` block, add:
```tsx
const montserrat = Montserrat({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});
```

- [ ] **Step 2: Attach the font variables to `<html>`**

The current opening tag is:
```tsx
<html lang="en" className={`${inter.variable} dark h-full antialiased`}>
```
Replace with:
```tsx
<html lang="en" className={`${inter.variable} ${montserrat.variable} ${jetbrainsMono.variable} dark h-full antialiased`}>
```

- [ ] **Step 3: Register the font tokens in `@theme`**

In `src/app/globals.css`, the `@theme` block currently starts with `--font-sans: "Inter", ...`. Directly below that line, add:
```css
  --font-display: var(--font-display-face, "Montserrat"), "Inter", sans-serif;
  --font-mono: var(--font-mono-face, "JetBrains Mono"), "Fira Code", ui-monospace, monospace;
```
Then, because `next/font` assigns the generated family to `--font-display` / `--font-mono` on `<html>` and we must not let `@theme` overwrite that at runtime, rename the next/font bindings to dedicated vars. In `layout.tsx`, change `variable: '--font-display'` to `variable: '--font-display-face'` and `variable: '--font-mono'` to `variable: '--font-mono-face'`. (The `@theme` tokens above already fall back through `--font-display-face` / `--font-mono-face`.)

- [ ] **Step 4: Verify the faces render**

Run: `npm run dev`, open `http://localhost:3000`.
- The hero headline (`font-black`, currently Inter) — temporarily add `font-display` to the `<h1>` if it is not already present and confirm it switches to Montserrat's wider, more geometric letterforms. (Task 3 makes this permanent; here just confirm the face loads.)
- On `/dashboard`, the currency/number spans (which use `font-mono`) render in JetBrains Mono (note the slashed zero and fixed-width digits) instead of the browser default monospace.
- Check DevTools → Network → Fonts: Montserrat and JetBrains Mono load once, no FOUT flash (thanks to `display: 'swap'` + `next/font` self-hosting).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: load Montserrat display + JetBrains Mono faces and wire font-display/font-mono tokens"
```

---

### Task 2: Layered Shadow & Depth System

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: working `shadow-apple-sm` and `shadow-apple-lg` utilities (currently undefined → no shadow) plus an upgraded multi-layer `shadow-apple`, consumed by the dashboard and bento cards.

- [ ] **Step 1: Replace the flat shadow tokens with layered ones**

In `globals.css` `@theme`, the current shadow lines are:
```css
  --shadow-glass: 0 8px 32px 0 rgba(0, 0, 0, 0.05);
  --shadow-apple: 0 4px 24px -6px rgba(0, 0, 0, 0.08);
```
Replace those two lines with the layered "shadow physics" set from `BrandGuideLine.md` §3C (adds the two missing sizes):
```css
  --shadow-glass: 0 8px 32px 0 rgba(0, 0, 0, 0.05);
  --shadow-apple-sm:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 2px 8px -2px rgba(0, 0, 0, 0.06);
  --shadow-apple:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.08),
    0 12px 24px -4px rgba(0, 0, 0, 0.12);
  --shadow-apple-lg:
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 8px 24px -6px rgba(0, 0, 0, 0.14),
    0 18px 44px -10px rgba(0, 0, 0, 0.20);
```

- [ ] **Step 2: Verify shadows apply**

Run `npm run dev`. On `/dashboard`:
- The three-pillar cards (which use `shadow-apple hover:shadow-apple-lg`) now have a soft, multi-layer drop shadow that visibly deepens on hover (previously `hover:shadow-apple-lg` did nothing).
- The HUD rate cards (`hover:shadow-apple-sm`) gain a subtle lift on hover.
- Confirm dark mode still reads well — shadows on the dark `#1A1D24` surfaces should feel like gentle elevation, not muddy halos. If too heavy in dark mode, that is acceptable for now (shadows are tuned for the light surfaces; dark relies more on borders).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add layered shadow physics (shadow-apple-sm/lg) and upgrade shadow-apple"
```

---

### Task 3: Fluid Type Scale + Hero Headline Treatment

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `font-display` from Task 1
- Produces: `text-display`, `text-title`, `text-headline`, `text-footnote` utilities (fluid `clamp()`), applied to the landing hero as the page's signature type moment.

- [ ] **Step 1: Add the fluid type-scale tokens**

In `globals.css` `@theme`, after the shadow tokens from Task 2, add (values verbatim from `BrandGuideLine.md` §3B):
```css
  /* Fluid type scale (clamp): fonts grow with the viewport, no breakpoint jumps. */
  --text-display: clamp(2.5rem, 5vw + 1rem, 4.5rem);
  --text-title: clamp(1.5rem, 3vw + 0.5rem, 2.5rem);
  --text-headline: clamp(1.2rem, 1.5vw + 0.5rem, 1.75rem);
  --text-body: clamp(0.95rem, 0.2vw + 0.8rem, 1.0625rem);
  --text-footnote: 0.75rem;
```

- [ ] **Step 2: Apply the display scale to the hero headline**

In `src/app/page.tsx`, the hero `<h1>` currently is:
```tsx
<h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
```
Replace its classes with the display face + fluid scale (drops the manual `text-3xl sm:text-5xl` breakpoint pair in favor of one fluid token):
```tsx
<h1 className="font-display text-title md:text-display font-black text-white tracking-tight leading-[1.05]">
```
Inside that headline, the inline "Time" pill `<span>` currently reads `... text-2xl sm:text-4xl`. Replace `text-2xl sm:text-4xl` with `text-[0.8em]` so the pill scales proportionally with the now-fluid headline:
```tsx
<span className="inline-block px-5 py-1 bg-primary-500/20 text-primary-500 rounded-full font-black border border-primary-500/10 mx-1 align-middle text-[0.8em]">
  Time
</span>
```

- [ ] **Step 3: Promote the eyebrow label**

Above the `<h1>`, the eyebrow badge is:
```tsx
<span className="inline-block px-3 py-1 bg-primary-500/10 text-primary-500 rounded-full text-xs font-bold uppercase tracking-wider">
  Zenith-Tier Platform
</span>
```
Tighten it to a more intentional, restrained signifier (mono face ties it to the "engineer" persona; wider tracking reads as a label, not a button):
```tsx
<span className="inline-flex items-center gap-2 text-primary-500 font-mono text-[0.7rem] font-bold uppercase tracking-[0.2em]">
  <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
  Zenith-Tier Platform
</span>
```

- [ ] **Step 4: Verify the hero**

Run `npm run dev`, open `http://localhost:3000`, and slowly resize the window from mobile to desktop width.
- The headline grows **smoothly** with the viewport (no snap at the `sm:` breakpoint) and renders in Montserrat.
- The orange "Time" pill scales in proportion and stays vertically centered.
- The eyebrow now reads as a small mono label with a dot signifier, not a pill button.
- Check the headline still wraps cleanly at ~375px width and does not overflow.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/page.tsx
git commit -m "feat: add fluid clamp type scale and apply display treatment to landing hero"
```

---

### Task 4: Dashboard Heading & Surface Polish

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `font-display`, `text-title`/`text-headline`, layered shadows from Tasks 1–3
- Produces: consistent display-face headings and elevation on the dashboard's primary surfaces.

- [ ] **Step 1: Apply the display face to the welcome heading**

In `src/app/(dashboard)/dashboard/page.tsx`, the welcome `<h2>` currently is:
```tsx
<h2 className="text-3xl sm:text-4xl font-black tracking-tight font-display">
  Welcome back, {profile.username}!
</h2>
```
Replace `text-3xl sm:text-4xl` with the fluid title token (it already has `font-display`, which now actually resolves to Montserrat):
```tsx
<h2 className="text-title font-black tracking-tight font-display">
  Welcome back, {profile.username}!
</h2>
```

- [ ] **Step 2: Promote the section headings to the display face**

The two section headings inside the HUD and heatmap cards currently read:
```tsx
<h3 className="text-xl font-black text-white tracking-tight">
```
Replace each of those two occurrences with:
```tsx
<h3 className="font-display text-headline font-black text-white tracking-tight">
```
(There are two: "Freelancer Efficiency Analyzer" and "Productivity Pixel Grid".)

- [ ] **Step 3: Apply elevation to the pillar cards**

The three pillar cards currently use `shadow-apple hover:shadow-apple-lg` — which now works after Task 2, so no class change is needed. Confirm each pillar card's class list still contains `shadow-apple hover:shadow-apple-lg transition-all duration-300`. If any pillar card is missing `hover:shadow-apple-lg`, add it so all three lift consistently on hover.

- [ ] **Step 4: Verify the dashboard**

Run `npm run dev`, sign in, open `/dashboard`.
- "Welcome back, …", "Freelancer Efficiency Analyzer", and "Productivity Pixel Grid" all render in Montserrat and scale fluidly on resize.
- Hovering each of the three pillar cards produces a clear, layered lift.
- Numbers/currency in the HUD and pillar cards render in JetBrains Mono.
- Verify light mode (if reachable) and RTL layout still read correctly.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: apply display type scale and layered elevation to dashboard surfaces"
```

---

### Task 5: Accessibility Quality Floor — Visible Focus Ring

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: a consistent, brand-colored `:focus-visible` ring across all interactive elements (keyboard users), satisfying the HIG accessibility floor without affecting mouse users.

- [ ] **Step 1: Add a global `:focus-visible` ring in the base layer**

In `globals.css`, inside the existing `@layer base { ... }` block that styles cursors (the one starting `button, [role="button"], a[href] { cursor: pointer; }`), add a focus-visible rule:
```css
  :where(button, [role="button"], a[href], input, select, textarea, summary, [tabindex]):focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
    border-radius: 0.375rem;
  }
```

- [ ] **Step 2: Verify keyboard focus**

Run `npm run dev`. On the landing page and dashboard:
- Press `Tab` repeatedly. Every link, button, and input shows a clear orange focus ring in logical reading order.
- Click the same elements with the mouse — **no** ring appears (because `:focus-visible`, not `:focus`).
- Confirm the ring is visible against both the dark hero and the orange welcome banner (the `outline-offset` keeps it legible on colored surfaces).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add brand-colored focus-visible ring for keyboard accessibility"
```

---

## Self-Review

### Spec coverage (user asked for typography, color, spacing, layout, components)
- ✅ **Typography** — real display (Montserrat) + mono (JetBrains Mono) faces (Task 1); fluid `clamp()` scale (Tasks 3–4). This is the plan's core.
- ✅ **Depth / "color" of surfaces** — layered shadow physics replacing flat shadows (Task 2).
- ✅ **Hero layout / signature** — fluid headline, proportional pill, refined eyebrow (Task 3).
- ✅ **Components / surfaces** — dashboard headings + card elevation (Task 4).
- ✅ **Accessibility quality floor** — focus-visible ring (Task 5).
- ⚠️ **Not covered:** palette re-theming and spacing-grid rework. The existing HSL palette and 8pt-ish spacing are already consistent; re-theming them is out of scope and would be a separate brief. Flagged so it is a conscious omission, not a gap.

### Placeholder scan
- No TBD/TODO. Every step gives exact classes, exact token values, and a concrete verification. All paths exact.

### Token consistency
- `--font-display` / `--font-mono` defined in `@theme` (Task 1) and consumed via `font-display` / `font-mono` everywhere — including the 69 pre-existing usages that were previously dead.
- next/font binds to `--font-display-face` / `--font-mono-face`; `@theme` tokens fall back through those exact names (Task 1, Step 3) — no runtime overwrite conflict.
- `--shadow-apple-sm` / `--shadow-apple` / `--shadow-apple-lg` defined once (Task 2), consumed by Tasks 2 & 4 and the pre-existing `shadow-apple*` usages.
- `--text-display/title/headline/body/footnote` defined once (Task 3), consumed by Tasks 3 & 4 with matching names.

### Relationship to the other plan
- Independent of `UI-GSAP-plan.md`. If both run, this plan changes only tokens/fonts/classNames while the GSAP plan adds `data-animate` attributes and `useGSAP` calls — they touch different attributes on the same files and do not conflict. Either order works.
