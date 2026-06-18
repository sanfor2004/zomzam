# design-sync notes — Zomzam Kit

Repo-specific gotchas for future syncs. Read this before re-running.

## Build shape (important)

- **Synth-entry, no `dist/`.** `zomzam-kit` is not a separately-built package — the components live in `src/components/ui` and ship via Next.js. There is no compiled `dist/index.js`, so `package-build.mjs` falls back to **synthesizing the entry from `src/`** (you'll see `[NO_DIST] … synthesizing from N src files` — this is expected, not an error). `cfg.entry` is left as `dist/index.js` purely so the converter takes the synth fallback; do **not** add `--entry`.
- **CSS is built separately.** `cfg.buildCmd` = `node .design-sync/build-tailwind-css.mjs` compiles `src/app/globals.css` through the repo's own Tailwind v4 PostCSS pipeline into `.design-sync/tailwind-build.css` (= `cfg.cssEntry`). Run it **before** `package-build.mjs` on every sync. `next build` is **not** usable here — it's blocked by a pre-existing, unrelated TS error in `usePageEntrance.ts`.
- Build/validate run order: `build-tailwind-css.mjs` → `package-build.mjs` → `package-validate.mjs`. `--node-modules ./node_modules` (single-package repo, react resolves there).
- Playwright for the render check lives in `.ds-sync/node_modules` and pins **chromium build 1228**, which matches the machine's `~/AppData/Local/ms-playwright` cache. Fresh clone → re-install `.ds-sync` deps (`npm i esbuild ts-morph @types/react playwright`) and `npx playwright install chromium`.

## Component source fix made during sync

- **`src/components/ui/Dropdown.tsx` was edited to fix a real positioning bug** (the menu/select panel used `top-full` and rendered mis-anchored). The fix is required for the Dropdown preview to render correctly and is a genuine product improvement — keep it / commit it. Not a design-sync artifact.

## Fonts

- Inter + JetBrains Mono are loaded via a **Google Fonts CDN `@import`** prepended in `build-tailwind-css.mjs`, not self-hosted. The app itself uses `next/font/google` (self-hosted at Next build time), which a standalone PostCSS pass can't reproduce. The families are genuine Google Fonts, so the CDN import is a faithful substitute. Validate reports `[FONT_REMOTE] "Inter", "Fira Code"` — **informational, expected, non-blocking.**

## Config specifics

- `componentSrcMap` excludes 6 `.d.ts`-exported internals that aren't standalone components: `OrbitRings` (SVG ambient bg), `DropdownItem`/`DropdownShell`/`DropdownSelect`/`DropdownMenu` (Dropdown internals), `Select` (internal). Keep these excluded.
- `overrides`: `Modal`, `Dropdown`, `ToastProvider` use `cardMode: single` with fixed viewports — they're overlay/portal components whose open state must render inside one card.
- Overlay/fixed components (Modal, Toast) **portal to `document.body`** in their previews to escape the card harness's `transform` containing-block. See `previews/Modal.tsx` and `previews/ToastProvider.tsx`.

## Authored previews (9) — all graded good

Badge, Dropdown, Modal, Tabs, Tooltip, ToastProvider, Progress, Slider, Spinner. The other 19 components ship the honest **floor card** (fully functional, just no rich preview) — authorable incrementally on any later sync.

## Known render warns

- None currently. (Earlier `[RENDER_BLANK] Progress` / `[RENDER_THIN] Slider, Spinner` were resolved by authoring previews for those three inherently-minimal components.) `[FONT_REMOTE]` is the only standing informational line — see Fonts above.

## Re-sync risks (watch-list)

- **Weak `.d.ts` contracts.** Because the build is synth-entry (no real dist + emitted types), every shipped `<Name>.d.ts` is `{ [key: string]: unknown }` and `.prompt.md` files are one-liners. The design agent gets almost no per-component API guidance from the bundle itself — `conventions.md` (the README header) carries the only prop vocabulary (Button/Badge documented there, source-verified). **Recommendation for a future pass:** either add a real type-emitting build for the kit, or populate `cfg.dtsPropsFor` for the core components (Button, Badge, Input, Card, Switch, Checkbox, Slider, Progress, Tabs…) by porting the prop interfaces from `src/components/ui/<Name>.tsx`. This would materially improve import fidelity.
- **`conventions.md` prop vocabulary is source-pinned, not contract-pinned.** The Button/Badge variant lists in the header were verified against `src/components/ui/{Button,Badge}.tsx` at sync time. If those variant unions change, re-validate the header against source (the `.d.ts` won't catch drift because it's loosely typed).
- **CDN fonts depend on `fonts.googleapis.com` at runtime.** If the brand ever needs self-hosted/offline fonts in designs, wire `cfg.extraFonts` to real woff2 files instead of the CDN `@import`.
- **Tailwind utilities are JIT-scoped to this repo's usage.** `_ds_bundle.css` contains only the classes actually used across the repo source (the build scans `base: '.'`). A class the design agent invents that no repo file uses may have no compiled rule. Common layout/spacing utilities are present; the header tells the agent to confirm against `styles.css`.
