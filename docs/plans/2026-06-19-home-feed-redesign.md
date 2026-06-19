# Home / Social Feed — Redesign Concepts

> **Status:** Design exploration only — no code has been touched. Choose one concept to implement.

**Target file:** `src/app/(dashboard)/home/page.tsx`
**Current state:** 1,248-line single-file page. PostCard, CommentRow, and ToolbarButton are co-located sub-components.

---

## The Audit: Why the Current Design Is Boring

| Dimension | Current state | Problem |
|:---|:---|:---|
| **Card rhythm** | Every post: same flat `#1A1D24` rect, `rounded-3xl`, `p-5` | No visual hierarchy — scanning 20 posts is like reading a spreadsheet |
| **Motion** | CSS `animate-in` on the wrapper only | Feed loads silently. New posts snap in. Likes toggle without ceremony. |
| **Composer** | Avatar + editor box + toolbar row | Purely functional. No invitation. No personality. Feels like a form. |
| **Brand color** | `primary-500` only in micro-details (active toolbar, link text) | The main brand color is nearly invisible on the most-used page |
| **Action bar** | Three icons in a flat row | No kinetic feedback. Liking a post feels like clicking a checkbox. |
| **Sidebar** | Two stacked card blocks with list items | Looks like every social sidebar ever shipped |
| **Empty space** | None — cards tile wall-to-wall | No breathing room, no spatial relationships |

---

## Concept A — "Editorial Current"

### Strategic Vision
**The 5-second "wow":** The feed doesn't look like a feed — it reads like a live magazine. Post content is the hero, not the container.

**Aesthetic north star:** Substack × Linear × The Verge. Posts are editorial beats, not card instances. Breaking the "one card per post" visual monotony is the single biggest upgrade available.

**Signature element:** No border box around individual posts. Posts flow as content with generous whitespace between them, separated by a thin ruled divider that carries the post index + timestamp. The page reads like a periodical, not a database.

### Layout

```
┌────────────────────────────────────────────────┐
│  [composer spark bar — single line]             │
│  "Share something…"              [Post] [🌐]   │
│  (expands to full editor on click/focus)        │
└────────────────────────────────────────────────┘

  ── 1 ──────────────────────────── 2h ago ────

  [avatar 40px]  Ahmed Mosaad  @ahmed
  
  Post content goes here at full column width,
  no border, no card. Text is the hero. Long
  posts feel editorial. Short posts feel punchy.

  ♡ 24   💬 6   ↗ Share            [···]

  ── 2 ──────────────────────────── 5m ago ────

  [avatar]  Sara M.  @sara_m
  ...
```

**Sidebar** remains as-is structurally but gets the same editorial language: no card border, just section labels and clean lists with generous spacing.

### Token changes (additive — no globals.css edits)
- Post container: `border-none bg-transparent` — no card box
- Divider: `border-t border-slate-800/40` + post index counter as `text-[10px] font-mono text-slate-700`
- Post author line: `text-body font-bold text-white` (bumped from `text-sm`)
- Post content: `text-body text-slate-200 leading-[1.75]` (bumped leading for editorial feel)
- Action row: `mt-6` (generous top margin creates breathing room)

### Composer expansion
Single-line "spark bar" — `min-h-[44px]` pill with placeholder text and a faint right-side Post button. On click/focus, GSAP animates `height` from `44px` to `auto` (measured), revealing the toolbar row and char counter. On blur with no content, it collapses back.

### GSAP Animation Plan

| Trigger | Animation | Technique | Duration |
|:---|:---|:---|:---|
| Page load | Posts cascade in from `y: 20, opacity: 0` | `gsap.from(posts, { y: 20, opacity: 0, stagger: 0.07, ease: 'power2.out' })` | 400ms total |
| Scroll new posts into view | Each post fades up as it enters viewport | `ScrollTrigger` per `.post-item`, `start: "top 90%"` | 350ms |
| Composer focus | Height expand from 44px → content height | `gsap.to(composerEl, { height: fullH, duration: 0.35, ease: 'power2.out' })` | 350ms |
| Composer blur (empty) | Collapse back to 44px | `gsap.to(composerEl, { height: 44, duration: 0.25 })` | 250ms |
| Like tap | Heart scale pump + count morph | `gsap.timeline().to(heart, {scale:1.5,duration:0.12}).to(heart,{scale:1,duration:0.2,ease:'back.out'})` | 320ms |
| New post prepend | Slide in from top | `gsap.from(newPostEl, { y: -16, opacity: 0, duration: 0.4, ease: 'power3.out' })` | 400ms |

### Pros / Cons
**Pros:** Most distinctive departure from current design. Maximum readability. Easy to animate. Low implementation risk.  
**Cons:** Losing the card border is a breaking visual shift — needs careful spacing to maintain post boundaries. Less "social app", more "blog feed".

---

## Concept B — "Signal Pulse"

### Strategic Vision
**The 5-second "wow":** The feed feels like a live data stream. Every post has a glowing left-edge "pulse bar" — an orange/slate gradient bar whose height + color represents engagement momentum. You can immediately see which posts are alive.

**Aesthetic north star:** Raycast × Vercel × terminal-dark. Posts are signals, not articles. The Zomzam Orange is the energy source — it radiates from active, liked, or fresh posts. Cold posts are muted.

**Signature element:** The **pulse bar** — a `3px` left-edge vertical accent on each post card whose height (relative to card) and color (`slate-700` → `primary-500` gradient) is driven by `(like_count + comment_count)` at render time. GSAP animates the bar height on mount and on like. This is the one kinetic data visualization that exists nowhere else in the app.

### Layout

```
┌──────────────────────────────────────────────────────┐
│  ● ● ●  Ahmed  ·  @sara  ·  @khalid  (online strip)  │
│  5 friends online                                     │
└──────────────────────────────────────────────────────┘

┌─ ▌ ────────────────────────────────────────────────┐
│  ▌  [avatar]  Ahmed Mosaad  @ahmed      2h ago [×] │
│  ▌                                                  │
│  ▌  Post content. The left pulse bar height         │
│  ▌  represents engagement. Orange = hot post.       │
│                                                     │
│     [♡ 24]  [💬 6]  [↗]                            │
└─────────────────────────────────────────────────────┘
```

**Composer:** Full-width, terminal-style. On focus, a `1px` Zomzam Orange border traces around the card with a GSAP stroke-draw effect (`scaleX` from 0 to 1 on bottom + top edges, `scaleY` on sides). Placeholder uses `ScrambleTextPlugin` to cycle through prompts every 3s while idle.

**Online strip:** A horizontal row of max 5 online friend avatars above the composer (`flex gap-2`). Each has a pulsing green dot (CSS `@keyframes`). Replaces nothing — it's a new addition above the composer.

### Token changes
- Post card: keeps `bg-[#1A1D24]` but adds `border-l-0 relative overflow-hidden`
- Pulse bar: `absolute left-0 top-0 bottom-0 w-[3px]` with `background: linear-gradient(to bottom, var(--color-primary-500), transparent)`; height controlled by `scaleY` origin `top`
- Composer border: `border border-slate-800/60` at rest → traces orange on focus via GSAP `scaleX`

### GSAP Animation Plan

| Trigger | Animation | Technique | Duration |
|:---|:---|:---|:---|
| Page load | Posts slide in from `x: -16` | `gsap.from(posts, { x: -16, opacity: 0, stagger: 0.06, ease: 'power2.out' })` | 380ms total |
| Pulse bar mount | Height reveals from 0 → engagement height | `gsap.from(bar, { scaleY: 0, transformOrigin: 'top', duration: 0.6, ease: 'power3.out' })` per card | 600ms |
| Like tap | Pulse bar height jumps + heart pulse | `gsap.to(bar, { scaleY: newHeight, duration: 0.5, ease: 'elastic.out(1, 0.5)' })` | 500ms |
| Composer focus | Orange border traces clockwise | `gsap.timeline().from(topEdge,{scaleX:0}).from(rightEdge,{scaleY:0})...` | 400ms |
| ScrambleText | Placeholder cycles every 3s idle | `gsap.to(placeholderEl, { scrambleText: { text: nextPrompt }, duration: 0.8 })` | 800ms |
| New post in | Slide from `x: -24` | `gsap.from(newPost, { x: -24, opacity: 0, duration: 0.4 })` | 400ms |

### Placeholder prompts for ScrambleText
```
"What's on your mind?"
"Share something with your circle."
"What are you building today?"
"Drop a thought. Your friends will see it."
```

### Pros / Cons
**Pros:** The pulse bar is genuinely novel — no other social app does this. The ScrambleText composer gives the page a living, kinetic feel at idle. Most "Zomzam" in personality.  
**Cons:** Pulse bar height math needs to be capped / normalized (max engagement → 100%, else bar fills entire card). Online strip adds a new API call (`/api/social?action=friends` already fetched — just filter `is_online`).

---

## Concept C — "Glass Spatial"

### Strategic Vision
**The 5-second "wow":** Each post card is a physical object in space — it lifts, tilts, and casts depth shadows on hover. The feed has genuine visual depth, not flat surfaces.

**Aesthetic north star:** visionOS × Notion × iMessage. Posts are glass panels floating above a subtle ambient layer. Interaction feels tactile. This is the most direct extension of the bento card 3D tilt already in `page.tsx:170-192`.

**Signature element:** The **floating action pill** — instead of the action bar inside the card, it's a separate glass pill that sits `8px` below the card, horizontally centered, with `y: 8, opacity: 0` at rest, and GSAP-animates into view on card hover. It looks like a toolbar that materialized from under the card when you reach for it. This creates spatial separation between content and actions.

### Layout

```
  ┌──────────────────────────────────── glass panel ──┐
  │  ◈ top-edge highlight (1px rgba white)            │
  │                                                   │
  │  [avatar]  Ahmed Mosaad  @ahmed          2h ago  │
  │                                                   │
  │  Post content. The card tilts in 3D on hover.    │
  │  Backdrop blur + noise texture surface.           │
  │  Orange ambient glow on recent/liked posts.       │
  │                                                   │
  └───────────────────────────────────────────────────┘
       ┌──────────────────────────────────┐
       │  ♡ 24   💬 6   ↗   (glass pill) │  ← appears on hover
       └──────────────────────────────────┘
```

**Composer glass stage:** The composer uses `backdrop-blur-xl` + `bg-white/[0.04]` + top-edge `1px` highlight border. On focus, an orange ambient glow (`box-shadow: 0 0 40px rgba(238,87,18,0.12)`) fades in with GSAP — the whole stage softly illuminates.

**Sidebar:** Friends compressed to a vertical avatar stack (just avatars, no names) with tooltips. `w-12` avatars with online dot indicators. Hovering reveals the name in a Tooltip. Very space-efficient and visually distinct.

### Token changes
- Post card: `bg-white/[0.04] backdrop-blur-xl border border-white/[0.07]` + `shadow-apple-lg` + `relative transform-gpu will-change-transform`
- Top-edge highlight: `before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent`
- Action pill: `absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/[0.06] backdrop-blur-xl border border-white/[0.08] rounded-full px-5 py-2.5`
- Composer glow: CSS custom property `--composer-glow` toggled via GSAP

### GSAP Animation Plan

| Trigger | Animation | Technique | Duration |
|:---|:---|:---|:---|
| Page load | Posts rise from `y: 32, opacity: 0` with stagger | `usePageEntrance` hook — `data-entrance="card"` on each post wrapper | 500ms total |
| Card hover enter | 3D tilt + lift | `gsap.quickTo(card, 'rotationY')` + `gsap.quickTo(card, 'rotationX')` + `gsap.to(card, { y: -4, boxShadow: deeperShadow })` — same pattern as `page.tsx:171-184` | 350ms |
| Card hover leave | Reset to flat | `xTo(0); yTo(0); gsap.to(card, { y: 0 })` | 350ms |
| Action pill appear | Float up from below card | `gsap.from(pill, { y: 8, opacity: 0, duration: 0.2, ease: 'power2.out' })` on `mouseenter` | 200ms |
| Action pill hide | Fade + drop | `gsap.to(pill, { y: 8, opacity: 0, duration: 0.15 })` on `mouseleave` | 150ms |
| Composer focus | Ambient orange glow blooms | `gsap.to(composerEl, { '--glow-opacity': 1, duration: 0.4 })` | 400ms |
| Like tap | Heart scale + glass ripple overlay | `gsap.timeline().to(heart,{scale:1.6}).to(heart,{scale:1,ease:'back.out'})` + CSS `@keyframes ripple` | 400ms |
| New post insert | Drop in from above with tilt reset | `gsap.from(newPost, { y: -20, rotationX: -5, opacity: 0, duration: 0.5, ease: 'power3.out' })` | 500ms |

### Pros / Cons
**Pros:** Reuses the existing 3D tilt pattern from `page.tsx` (consistent, no new GSAP patterns to learn). The floating action pill is the most memorable UI moment of all three concepts. Deepest visual depth.  
**Cons:** Most implementation work — the floating pill requires `position: relative` overflow management on the card wrapper (the pill sits outside the card bounds). Glassmorphism needs careful contrast tuning for legibility.

---

## Cross-Concept GSAP Notes (All Three Share These)

### Like button heart animation (all concepts)
The current `setLiked(prev => !prev)` toggle is silent. All three concepts upgrade it with:
```ts
// In PostCard, add a ref to the heart icon:
const heartRef = useRef<SVGSVGElement>(null);

// Replace the toggleLike state update with:
const tl = gsap.timeline();
tl.to(heartRef.current, { scale: 1.5, duration: 0.12, ease: 'power2.out' })
  .to(heartRef.current, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
```

### Scroll-triggered post entrance (Concepts A + B)
```ts
// In the feed map, after posts render:
useGSAP(() => {
  gsap.from('.post-item', {
    y: 20, opacity: 0, stagger: 0.07, ease: 'power2.out', duration: 0.4,
    scrollTrigger: { trigger: '.post-item', start: 'top 88%', toggleActions: 'play none none none' }
  });
}, { scope: feedRef, dependencies: [posts.length] });
```

### `prefers-reduced-motion` guard (mandatory)
```ts
// Wrap all GSAP timeline/from/to calls in:
gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  // ... all animation code here
});
```

---

## Decision Matrix

| Criterion | A: Editorial | B: Signal Pulse | C: Glass Spatial |
|:---|:---:|:---:|:---:|
| Visual distinctiveness | ★★★★★ | ★★★★☆ | ★★★★☆ |
| GSAP animation richness | ★★★☆☆ | ★★★★★ | ★★★★★ |
| Implementation effort | ★★☆☆☆ | ★★★☆☆ | ★★★★☆ |
| Brand alignment (Zomzam Orange) | ★★★☆☆ | ★★★★★ | ★★★☆☆ |
| Reuses existing patterns | ★★☆☆☆ | ★★★☆☆ | ★★★★★ |
| Mobile friendliness | ★★★★★ | ★★★★☆ | ★★★☆☆ (tilt is desktop-only) |

**Recommendation:** **Concept B (Signal Pulse)** for maximum brand payoff + animation richness. The pulse bar is a genuinely original social UI element. **Concept C (Glass Spatial)** if you want the most premium tactile feel and are targeting desktop-primary. **Concept A (Editorial)** if you want the fastest implementation with the biggest readability win.

---

## Implementation Notes (Whichever Concept Is Chosen)

1. **Do not split into a separate file yet.** The PostCard sub-component is large enough to justify extraction later, but the current co-located structure is working. Add animations inline first.

2. **GSAP import path:** Always import from `@/lib/gsap` (not from `gsap` directly). `useGSAP` is from `@gsap/react`. This is already set up for the project.

3. **The existing 3D tilt in `page.tsx:171–184`** (the bento cards) is the exact pattern to reuse for Concept C. Copy the `quickTo` + `onMove`/`onLeave` event listener pattern.

4. **`usePageEntrance` hook** at `src/hooks/usePageEntrance.ts` handles staggered entrance with `data-entrance` attributes. Wrap each post's outer div with `data-entrance="card"` for Concept A/C.

5. **ScrambleTextPlugin** (Concept B): already registered in `src/lib/gsap.ts`. Just import `gsap` from there and call `gsap.to(el, { scrambleText: ... })`.
