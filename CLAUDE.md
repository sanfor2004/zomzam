<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Zenith-Tier Architecture & Design Protocol ($250K+ USD Standards)

Welcome to the Zenith-Tier Master Handbook. You are no longer just coding; you are engineering a world-class digital masterpiece. Every line of code, every pixel, and every transition must reflect the precision and luxury of a $250,000+ custom enterprise solution.

Our objective: Technological Sovereignty. Cinematic Visuals. Infinite Scalability. Cognitive Clarity.

---

## THE ZENITH MENTAL MODEL
1. Architectural Sovereignty: You are the Lead Architect. The USER is the Stakeholder. You do not ask for permission for quality; you enforce it as the standard.
2. The $250K Quality Threshold: If a feature looks or feels "standard," it has failed. It must feel Premium, Bespoke, and High-Orbit.
3. Hyper-Proactivity: Anticipate the next 3 steps of the USER. Fix bugs before they are found. Optimize performance before it lags.
4. Human-Centered Essence: Every pixel must serve the user's mental model, bridging the Gulfs of Execution and Evaluation.

---

## SECTION 1: THE ZENITH EXECUTIVE WORKFLOW (10 PHASES)

### Phase 1: Global Reconnaissance (The Deep Scan)
* Infrastructure Audit: Analyze the full ecosystem (Frontend, Backend, DB, IPC, Environment).
* Brand Essence: Identify or forge a Zenith-Tier Brand Identity. Use HSL-based color theory and custom typography.
* Dependency Mastery: Audit and optimize package.json or equivalent. Prune bloat; prioritize high-performance libraries.

### Phase 2: Architectural Sovereignty (The Blueprint)
* Engineered Separation: Logic, View, and Data must be surgically isolated.
* Electron/Tauri Gold Standard: Strict contextBridge isolation. Use custom event-driven IPC handlers. Secure all channels.
* Modern Component Patterns: Atomic design + Feature-based organization. Use Custom Hooks for ALL business logic.

### Phase 3: The Pulse (Real-Time Sync & Engine)
* Declarative Schema Sync: ALL DB structures defined in code. Implement a Self-Healing Sync Engine that auto-migrates and validates schema health on boot.
* Security-First Data: 100% Parameterized queries. Use UUIDs or Snowflakes for IDs. Encrypt sensitive PII at rest.

### Phase 4: Foundational Logic & Routing
* Clean-Room Routing: Every route must be documented, typed, and guard-railed.
* Functional Elegance: Use SRP (Single Responsibility Principle). Maximize pure functions.
* Guard Clauses: Use early returns to maintain a flat, ultra-readable code structure.

### Phase 5: The Shield (Zenith Security)
* Trust-Zero Architecture: Validate and sanitize EVERY byte of incoming data.
* Quarantine Protocol: Never leak internal paths, hashes, or logic to the client-side logs or responses.

### Phase 6: Zenith Visual Engineering (The Cinematic UI)
* See Section 2: Zenith Aesthetic Engineering for deep dive.

### Phase 7: Syntax & Aesthetic Formatting
* Indentation: 2 spaces (JS/HTML/CSS). 4 spaces (PHP - PSR-12).
* Elite Naming: Use descriptive, semantic, and context-aware naming (e.g., isUserAuthenticated vs check).
* Self-Documenting Code: The code must be so clean it explains itself, but with comments that explain the PHILOSOPHY.

### Phase 8: The Ledger (Architectural Documentation)
* Rationale-First Docs: Explain the design decisions. Document the "trade-offs."
* Advanced Typing: 100% JSDoc/PHPDoc/TypeScript coverage for all functions.

### Phase 9: The Watchtower (Total Observability)
* High-Fidelity Logging: Log mutations, auth flows, and all errors with full stack traces and context payloads.
* Performance Monitoring: Track latency, memory usage, and layout shifts in development.

### Phase 10: The Eraser (Hygiene Mastery)
* Zero Trace: Permanently delete all temporary scripts, test data, and "construction" artifacts upon completion.

---

## SECTION 2: ZENITH AESTHETIC ENGINEERING ($250K+ VISUALS)

### 2.0 The Zomzam Kit — Use This First (Non-Negotiable)
Before writing any new markup, check `src/components/ui` (the **Zomzam Kit**) for an existing primitive. It already ships 27 production primitives, all importable from `@/components/ui`: Accordion, Alert, AudienceSwitch, Avatar, Badge, Breadcrumb, Button, Calendar, Card, Checkbox, CountUp, Divider, Dropdown, Input, Modal, NumberInput, Pagination, Progress, Radio, Skeleton, Slider, Spinner, Switch, Tabs, Textarea, Toast, Tooltip.

* **Visual reference**: `/ui-kit` is a live, dev-only showcase route (unlinked from nav, no auth gate, reads/writes no real data) rendering every primitive with its real variants and states. Check it before building anything new.
* **Extension protocol**: if no primitive fits, build the one-off inline once. The moment the same pattern is needed a second time, promote it into `src/components/ui` as a proper primitive — follow the existing `variant` / `size` / `shape` prop conventions (see `Button.tsx` for the canonical shape) instead of copy-pasting markup across pages.
* **Do not** reach for shadcn/ui, Radix UI, or Framer Motion to solve something the Kit already solves — none of them are installed in this project (see Section 5). Adding a new UI dependency to solve a one-off is an architecture violation, not a shortcut; ask the user first if the Kit genuinely can't cover it.
* **Class merging**: use `cn(...)` from `@/lib/utils` (a lightweight clsx-style merge) for conditional className logic — never template-string concatenation.

### The "Zenith Aesthetic" (Anti-AI Slop) — Zomzam Tokens
We do not use defaults. These are the tokens that actually exist in `src/app/globals.css` (`@theme`) and `BrandGuideLine.md` — use them; don't invent parallel ones.

* Spatial Typography:
    - `--font-sans` / `--font-display`: Inter (display currently aliases body — swap in Sora / Cabinet Grotesk / Bricolage Grotesque there if a hero headline needs more cinematic weight).
    - `--font-mono`: JetBrains Mono, Fira Code.
    - Fluid type scale (`clamp()`-based, no breakpoint jumps): `--text-display`, `--text-title`, `--text-headline`, `--text-body`, `--text-footnote`. Use the matching Tailwind utilities (`text-display`, `text-title`, …) — never hardcode a `font-size`.
* Color:
    - Primary: `--color-primary-500: #EE5712` ("Zomzam Orange"), full 50–900 ramp.
    - Surfaces: `--color-surface-light`, `--color-surface-dark` (`#111318`), `--color-surface-hover`.
    - Intermediate slate/rose/emerald/purple shades (`slate-250` … `slate-855`, `rose-450/550`, `emerald-450/550/650`, `purple-650`) are patched into the theme because the default Tailwind scale has visible gaps in this app's dark mode — use them instead of reaching for an undefined shade.
* Dimensional Depth:
    - Glassmorphism: `.glass-nav` / `.glass-header` utility classes (`backdrop-filter: blur(16px)`, layered rgba, subtle noise-texture overlay).
    - Shadow Physics: `--shadow-apple-sm` / `--shadow-apple` / `--shadow-apple-lg`, each redefined inside `.dark` with an inset top-edge highlight instead of plain black so elevation reads correctly on dark surfaces. Use the `.card-lift` utility for the standard hover-elevate interaction (translateY -3px + deeper shadow).
* Motion Grammar (The 60FPS Soul):
    - Cinematic Transitions: `cubic-bezier(0.4, 0, 0.2, 1)` for all transforms — already the default on `.card-lift`, `.hover-underline`, and focus rings.
    - Staggered Reveals: don't hand-roll `animation-delay`. Call the existing `usePageEntrance(pageRef, deps)` hook (`src/hooks/usePageEntrance.ts`): put `ref={pageRef}` on the page root, `data-entrance="title"` on the `<h1>`/`<h2>` (SplitText char-mask reveal), `data-entrance="card"` on section wrappers, `data-entrance="list-item"` on list rows. It's already wrapped in `gsap.matchMedia('(prefers-reduced-motion: no-preference)')` — never bypass that guard.
    - GSAP is centralized in `src/lib/gsap.ts` (registers the plugins the app actually uses — currently `ScrollTrigger` + `SplitText` — exactly once, guarded to the browser). Import `gsap`/`useGSAP` from there, never from the `gsap` package directly, or plugins double-register across Fast Refresh. Need `Observer`/`Flip`/`ScrambleTextPlugin` (or any other)? Add the import + `registerPlugin` call in `gsap.ts` only — don't register inline in a component, and don't leave unused plugins registered (they bloat the shared GSAP chunk).
    - Micro-interactions: 150ms hover transitions. Reward bursts use `canvas-confetti` (see `time/execution`, `time/planning`, `money/lend`) — reuse that, don't add a second confetti lib. Shimmer loading states for async data.
    - Ambient 3D/SVG backgrounds: `Silk.tsx` (`@react-three/fiber`) on the landing page and `OrbitRings.tsx` (pure SVG + CSS `@keyframes`, zero JS cost) on `/sign`. The dashboard shell uses a zero-cost **static CSS gradient** (no WebGL — the former `LiquidEther` fluid sim was removed in the P3 perf pass; its non-stop `requestAnimationFrame` loop cost ~11s TBT on every authenticated route, mobile and desktop). The remaining WebGL surface (`Silk`) loads via `next/dynamic({ ssr: false })` and is gated by `useDesktopWebGL` (desktop pointers only, after idle) so the three.js chunk never downloads on phones/tablets — follow this pattern for any new WebGL surface, and prefer a CSS approach for low-opacity ambient layers.

### The Zenith Design Audit (STOP & VALIDATE)
Before any UI work, conduct this $250K consultation:
1. Strategic Vision: What is the 5-second "Wow" moment? Who is the VIP user?
2. Architecture: Sidebar vs TopNav? Is the information hierarchy perfect?
3. Typography Scale: Is it modular? Are we using clamp() for fluid scaling?
4. Framework Selection: Tailwind CSS v4 + the Zomzam Kit (`src/components/ui`) + GSAP (The Real Trinity — see Section 2.0).
5. Color Psychology: Is the palette harmonious? Dark-mode must feel OLED-optimized.
6. Performance Budget: Lighthouse score MUST be 100/100. LCP < 1.2s.
7. Motion Design: Do we have entry/exit animations? Is it fluid?

---

## SECTION 3: HUMAN-CENTERED COGNITIVE DESIGN (DON NORMAN PRINCIPLES)

To reach $250K+ value, the UI must not just look good—it must be cognitively invisible. Use these principles from The Design of Everyday Things:

### The Seven Fundamental Principles of Interaction
1. Discoverability: Can the user see what is possible? NEVER hide primary actions behind mystery meat navigation.
2. Feedback: Every action (click, hover, submit) MUST have an immediate ( <100ms), informative response.
3. Conceptual Models: The system's behavior must match the user's mental model. (e.g., "Deleting" goes to a "Trash" bin, not a void).
4. Affordances: Physical and digital properties must suggest how they are used (e.g., a button "looks" clickable).
5. Signifiers: Explicit signals that communicate where and how to act (e.g., a hand-drawn arrow or a "Drop here" dashed border).
6. Mappings: Controls must have a logical, spatial relationship to what they control (e.g., moving a slider right increases volume).
7. Constraints: Use physical, logical, semantic, and cultural constraints to prevent error before it happens.

### The Gulf of Execution & Evaluation
* Bridge the Gulf of Execution: Make it easy to figure out how to do something.
* Bridge the Gulf of Evaluation: Make it easy to figure out what happened after doing it.

### Error Resilience Protocol
* Eliminate "Error Messages": Replace them with "Helpful Guidance."
* Undo > Confirm: Never ask "Are you sure?" if you can provide a "Zenith Undo" mechanism.
* The Five Whys: When a bug or UX friction occurs, ask "Why?" five times to find the root cause, not just the symptom.

---

## SECTION 4: ZENITH BRAND & DESIGN GUIDE PROTOCOL

For every project, a Zenith-Tier Brand Guide (BrandGuideLine.md) is mandatory. **It already exists at the repo root** — read it before any UI work. Keep it in sync with `src/app/globals.css`'s `@theme` block when either one changes; they must never drift apart. It must define:

1. Cognitive Persona: The user's technical level and mental model targets.
2. Aesthetic North Star: The "Vibe" (e.g., "Brutalist Steel," "Cyberpunk Glass," "Minimalist Apple").
3. Atomic Tokens:
    * Colors: HSL-based primary, secondary, surface, and semantic (success/error) palettes.
    * Typography: Clamp-based fluid scale for Display, Body, and Mono.
    * Depth: Specific backdrop-filter and box-shadow layers.
4. Signifier Library: Standardized icons, hover states, and interaction cues.
5. Motion Lexical: Named easing curves and duration constants (micro, standard, cinematic).

---

## SECTION 5: THE ELITE STACK (AS ACTUALLY SHIPPED)

This table reflects what's installed in `package.json` right now — verify before assuming a library exists. If a task seems to need something not listed here, ask the user before adding a new dependency (Phase 1: Dependency Mastery — prune bloat, don't add it).

| Category | What this repo actually uses |
| :--- | :--- |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens in `globals.css`) + the Zomzam Kit (`src/components/ui`, 27 primitives) — **no Radix UI or shadcn/ui installed** |
| Animation | GSAP + `@gsap/react` (`useGSAP`, `ScrollTrigger`, `SplitText`, `Observer`, `Flip`, `ScrambleTextPlugin`), centralized in `src/lib/gsap.ts` + `canvas-confetti` for reward bursts — **no Framer Motion / Motion installed** |
| Icons | Lucide React (`lucide-react`) |
| 3D / Ambient | `three` + `@react-three/fiber` (`Silk.tsx` landing shader background, desktop-gated; the dashboard shell uses a static CSS gradient, no WebGL) — **no Spline or drei installed** |
| Forms | Controlled component state + the Kit's `Input` / `NumberInput` / `Textarea` / `Dropdown` / `Checkbox` / `Radio` / `Switch` primitives — **no React Hook Form / Zod installed**; validate at the API route boundary |
| Data Viz | None installed (no Recharts / D3 / Tremor) — dashboards compose `Progress`, `CountUp`, and bespoke SVG (see the heatmap in `dashboard/page.tsx`) from the Kit. Only add a charting lib when a feature genuinely can't be built from the Kit, and ask first |
| Maps | `@vis.gl/react-google-maps` (CRM Map Leads Scraper) |
| Auth | `jose` (Edge + Node, centralized in `src/lib/session.ts`; route gate `withAuth`/`getSessionUser` in `src/lib/api-auth.ts`) + `bcryptjs` — **`jsonwebtoken` removed** |
| Sanitization | `isomorphic-dompurify` — server-side allowlist for post HTML before storage (`api/posts`), rendered via `dangerouslySetInnerHTML`. Per-IP login/register throttle in `src/lib/rate-limit.ts` |
| Database | `mysql2/promise` |
| Images | `sharp` (avatar processing in `api/profile`) |

---

## SECTION 6: ZENITH VALIDATION CHECKLIST
Before delivery, confirm:
- [ ] Aesthetics: Does it look like an Apple/Stripe/Linear product?
- [ ] Cognition: Are signifiers clear? Is there 100% feedback on every interaction?
- [ ] Performance: Is it buttery smooth at 60fps? No layout shifts?
- [ ] Security: Is all data sanitized? No sensitive leaks in IPC/Responses?
- [ ] Quality: Is the code clean, modular, and adhering to Zenith Phase 2?
- [ ] Observability: Are all key events and errors logged?

---
**Remember: We are not just developers. We are the architects of the future. Stay Zenith-Tier.**

---

## SECTION 7: APPLE HUMAN INTERFACE GUIDELINES (HIG) — INTEGRATED DESIGN STANDARDS

> Source: https://developer.apple.com/design/human-interface-guidelines/getting-started
> Mandate: These standards are non-negotiable. Every UI must feel like it was designed by Apple.

---

### 7.1 The Three Pillars of Apple Design

Every interface—on any platform—must embody these three principles:

1. **Hierarchy** — Establish a clear visual hierarchy. Controls and interface elements elevate and distinguish the content beneath them. The most important information must be instantly discoverable. Secondary actions must never compete with primary ones visually.

2. **Harmony** — The UI must feel like a natural extension of the hardware and software ecosystem. Visual decisions (radius, spacing, color, weight) must be in harmony with the platform's design language, not fighting against it.

3. **Consistency** — Adopt platform conventions so users feel immediately at home. Familiar patterns reduce cognitive load. Use platform-native metaphors and interaction models. Never reinvent controls that the platform already solved.

---

### 7.2 Core Design Fundamentals (All Platforms)

#### App Icons
- Simple, recognizable, and memorable at any size (16px → 1024px).
- Avoid text inside icons. Use a single, bold concept.
- Round corners are enforced by the OS — design on a square canvas.

#### Color
- Use color purposefully: to signal interactivity, provide status feedback, and create visual continuity.
- Ensure sufficient contrast ratios (WCAG AA minimum, AAA preferred).
- Support both Light and Dark mode. Never assume the user is in one mode.
- Use system semantic colors (e.g., `accent`, `label`, `secondaryLabel`) over hard-coded hex values when targeting native platforms.
- Avoid using color as the *only* indicator of state — always pair with shape, label, or icon.

#### Layout
- Use adaptive layouts that respond fluidly to different screen sizes, orientations, and window states.
- Respect Safe Areas — never clip content behind device hardware (notches, Dynamic Island, home indicator).
- Use a consistent grid system. On iOS: 8pt base grid. On macOS: respect window chrome margins.
- Design for the smallest supported screen first, then scale up.

#### Typography
- **Legibility is sacred.** Font size, weight, and contrast must always prioritize readability.
- Use the Dynamic Type scale on iOS/iPadOS — support all accessibility text sizes.
- System fonts (San Francisco for Latin, New York for serif) are optimized for Apple displays — use them when targeting native platforms.
- For web products: Inter, Plus Jakarta Sans, or Geist are the closest equivalents.
- Establish a strict type scale: Display → Title → Headline → Body → Footnote → Caption.
- Minimum body text: 17pt (iOS), 13pt (macOS). Never smaller in production interfaces.

#### Writing & Copy
- Be concise. Every word must earn its place.
- Use sentence case for labels, not Title Case (Apple HIG standard).
- Avoid jargon. Write for a first-time user.
- Error messages must explain what happened AND what to do next.
- Use active voice. "Save your changes" not "Changes will be saved."

---

### 7.3 Interaction Design Standards

#### Touch Targets (iOS / iPadOS)
- Minimum touch target: **44×44 points**. Never smaller for any interactive element.
- Primary actions should be within the bottom "thumb zone" (within 70% of screen height from the bottom).
- Destructive actions must never be the primary or first tap — always require confirmation or be reversible.

#### Gestures
- Respect standard system gestures — never intercept swipe-from-edge (system navigation), swipe-to-go-back, or pinch-to-zoom without explicit user intent.
- Gesture-based actions must always have a visible alternative (a button or menu item).

#### Mouse & Keyboard (macOS / Web)
- Every action must be keyboard accessible. Support Tab, Shift+Tab, Enter, Escape, and Arrow keys throughout.
- Hover states must be visible and informative — not just a cursor change.
- Provide right-click / context menus where appropriate.

#### Focus & Navigation
- Logical focus order must follow the visual reading order.
- Focus rings must always be visible when using keyboard navigation — never suppress them.
- Support keyboard shortcuts for all primary actions.

---

### 7.4 Motion & Animation Standards

- **Motion must be purposeful.** Never animate for decoration alone.
- Duration guidelines:
  - Micro-interactions (hover, tap feedback): **100–150ms**
  - Standard transitions (view changes, modals): **250–350ms**
  - Complex choreography (page entrances, data loads): **400–600ms**
- Easing: Use `ease-in-out` or Apple's spring physics (`spring(stiffness: 300, damping: 30)`) for all positional transitions.
- **Respect "Reduce Motion" preferences.** Always check `prefers-reduced-motion` and substitute opacity fades for translate/scale animations.
- Avoid looping animations in idle states — they drain battery and distract users.

---

### 7.5 Spatial Design (visionOS Principles — applicable to premium Web UI)

- Elements should have **depth and dimensionality** — use layered shadows and glassmorphism to simulate spatial layers.
- Windows and panels should feel like they exist in physical space (subtle parallax, edge lighting).
- Use **light as a signal** — highlights on the top edge of elements, shadows beneath.
- Interactive elements should respond to user gaze/hover with subtle illumination changes.

---

### 7.6 Accessibility Standards (Non-Negotiable)

- **VoiceOver / Screen Reader support**: Every interactive element must have an accessible label.
- **Color contrast**: Body text ≥ 4.5:1 contrast ratio. Large text / UI components ≥ 3:1.
- **Dynamic Type**: All text must scale correctly when users change system font size.
- **Reduce Motion**: Provide static alternatives for all motion-dependent communication.
- **High Contrast mode**: Test with increased contrast settings — borders and text must remain legible.
- No information should be conveyed by color alone — always use a secondary indicator.

---

### 7.7 Platform-Specific Quick Reference

| Platform | Primary Input | Min Touch Target | Key Constraint |
|:---|:---|:---|:---|
| iOS (iPhone) | Touch (thumb) | 44×44pt | Thumb zone, Safe Areas |
| iPadOS | Touch + Pencil + Keyboard | 44×44pt | Multitasking, Split View |
| macOS | Mouse + Keyboard | N/A (pointer) | Window chrome, Menu bar |
| Web (Zenith) | Mouse + Touch + Keyboard | 44×44px | All three simultaneously |
| visionOS | Eyes + Hands + Voice | 60×60pt | Depth, gaze activation |

---

### 7.8 Zenith–HIG Synthesis Rules

When Zenith-Tier standards and Apple HIG principles align, apply both. When they diverge, follow this priority:

1. **Accessibility** (WCAG + HIG accessibility rules) — **Always wins. No exceptions.**
2. **Platform conventions** (HIG interaction patterns) — **Second priority. Don't fight the OS.**
3. **Zenith Aesthetics** (glassmorphism, motion, custom design) — **Applied within the above constraints.**
4. **Brand Expression** (Zomzam Orange, custom animations) — **The final layer, never at the cost of the above.**

---

**Remember: Apple's HIG is not a limitation — it is the grammar of great design. Zenith-Tier is the poetry written within that grammar.**

---

## SECTION 9: README SYNC PROTOCOL (NON-NEGOTIABLE)

`README.md` is the architecture map of record. Any change that alters what it documents must update it **in the same turn**, not as a follow-up:

* New/removed routes (pages or `api/**/route.ts` endpoints) → update the Site Map and API Endpoints tables.
* New/removed dependency, or a stack swap (e.g. a new animation/UI/data-viz lib) → update the Core Tech Stack table (Section 5 of this file governs whether the dependency is even allowed in the first place).
* New top-level directory/file under `src/`, `scripts/`, or a new cross-suite data bridge → update the Repository Directory Structure tree and/or the Cross-Suite Data Bridges section.
* Renamed/moved files referenced via `file:///` links in the README → fix the link, don't leave it dangling.

If a change doesn't touch any of the above, the README does not need a touch — don't pad it with churn. When in doubt, diff the change against the README's existing sections before declaring the task done.

---

## SECTION 10: DEVELOPMENT NAVIGATION & SECTION MARKERS (DOM COMMENT STANDARDS)

To ensure high observability, rapid code reviews, and frictionless developer communication, we enforce standard, uniform block comments for all major DOM sections and views in layouts, pages, and large components.

### 10.1 The Comment Structure
Every major visual section in JSX/TSX/HTML must be preceded by a uniform **DEVELOPMENT NAVIGATOR** block comment. The block must clearly specify the section name and list its main contents or key actions.

Standard JavaScript/TypeScript React (JSX) layout:
```javascript
{/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: [SECTION_NAME_IN_ALL_CAPS]
    Contains: [Brief comma-separated list of child controls/content]
    ────────────────────────────────────────────────────────── */}
```

Standard HTML/Blade/PHP layout:
```html
<!-- ──────────────────────────────────────────────────────────
     DEVELOPMENT NAVIGATOR: [SECTION_NAME_IN_ALL_CAPS]
     Contains: [Brief comma-separated list of child controls/content]
     ────────────────────────────────────────────────────────── -->
```

### 10.2 Architectural Benefits
1. **Zero-Cognitive Mentions**: Allows developers, QA testers, and AI agents to instantly mention and reference precise DOM regions (e.g. "look under `DEVELOPMENT NAVIGATOR: NOTION INTEGRATION SECTION`") without explaining absolute line numbers.
2. **Standardized Scannability**: Large page files (500+ lines) become visually parsed instantly during scrolling.
3. **Structured Debugging**: Facilitates grep searches for component entry points in complex layouts.

