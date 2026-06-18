# Zomzam Kit — how to build with it

This design system is **Zomzam Kit** (`window.ZomzamKit.*`). 28 React components, styled with **Tailwind CSS v4 utility classes** whose design tokens are defined in the shipped stylesheet. Build apps by composing these components and styling your own layout glue with the token-backed utilities below.

## Setup & wrapping

- **No theme/style provider is required.** Every component self-styles via Tailwind utility classes that are already compiled into the shipped CSS (`styles.css` → `_ds_bundle.css`). Just render the component and load `styles.css`.
- **Dark mode** is class-based, not a provider: add `class="dark"` to any ancestor (typically `<html>` or a top-level wrapper) and all components switch to their dark surfaces. Without it you get the light theme. There is no `ThemeProvider`.
- **Toasts are the one exception that needs context.** To show toasts, wrap the subtree in `<ToastProvider>` and call the `useToast()` hook (`const { toast } = useToast()`) from inside it — both are exports: `window.ZomzamKit.ToastProvider` and `window.ZomzamKit.useToast`. The toast viewport is `position: fixed`, so keep `ToastProvider` near the root.
- Icons (lucide-react) and GSAP are **inlined into the bundle** — no separate install or icon font needed.

## The styling idiom — Tailwind v4 utilities + Zomzam tokens

Style your own wrapper/layout markup with these utility families (real token names defined in the shipped CSS). Prefer them over arbitrary hex values so layouts stay on-brand:

| Concern | Utility classes (real names) |
|---|---|
| Brand color | `bg-primary-500` (Zomzam Orange `#EE5712`), full ramp `primary-50`…`primary-900`; `text-primary-600`, `border-primary-500` |
| Surfaces | `bg-surface-light` (`#fff`), `bg-surface-dark` (`#111318`), `bg-surface-hover` |
| Neutrals (dark-mode-tuned) | standard `slate-*` plus patched intermediates: `slate-250/350/450/455/505/550/650/750/850/855` (e.g. `bg-slate-850`, `text-slate-450`) |
| Semantic | `text-emerald-550`/`emerald-450`/`emerald-650` (success), `rose-450`/`rose-550` (error), `purple-650` |
| Fluid type | `text-display`, `text-title`, `text-headline`, `text-body`, `text-footnote` (all `clamp()`-based — no breakpoint jumps) |
| Fonts | `font-sans`/`font-display` (Inter), `font-mono` (JetBrains Mono) — loaded via the stylesheet |
| Elevation | `shadow-apple-sm`, `shadow-apple`, `shadow-apple-lg`, `shadow-glass` (shadows auto-deepen with a top-edge highlight in dark mode) |
| Signature utilities | `card-lift` (hover translateY -3px + deeper shadow), `hover-underline`, `glass-nav`, `glass-header`, `breathing`, `dot-pulse` |

Note: the shipped CSS contains the utilities actually used by this product. Common layout/spacing/flex utilities are present; for anything you're unsure about, read `styles.css` and its `@import` (`_ds_bundle.css`) to confirm a class resolves.

## Key component props

The shipped `<Name>.d.ts` contracts are intentionally minimal (props typed loosely), so use these source-verified vocabularies for the two most-used controls and follow the same `variant`/`size`/`shape` pattern for the rest:

- **`Button`** — `variant`: `primary` | `ghost` | `outline` | `soft` | `link` (+ more); `size`: `xs` | `sm` | `md` | `lg` | `xl` | `icon`; plus `shape` (e.g. `circle`), icon slots, and a `loading` state. Defaults: `variant="primary"`, `size="md"`.
- **`Badge`** — `variant`: `success` | `warning` | `error` | `neutral` | `info` | `primary` (default `neutral`); `pulse` (boolean) adds a status dot.

Prefer the `variant`/`size`/`shape` props over restyling a component with raw classes.

## Where the truth lives

- **Styling**: read `styles.css` (it `@import`s `_ds_bundle.css`, the compiled Tailwind output holding every token and utility rule).
- **Per-component API**: each component ships `<Name>.d.ts` and `<Name>.prompt.md`. They carry the export and load instructions; the props vocabulary above and this header are the primary API guidance for this build.

## One idiomatic snippet

```tsx
const { Card, Badge, Button } = window.ZomzamKit;

function LeadCard() {
  return (
    <Card className="max-w-sm card-lift">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-headline font-semibold">Marwa Hassan</h3>
          <p className="text-footnote text-slate-450">Map Leads Scraper</p>
        </div>
        <Badge variant="success">Live</Badge>
      </div>
      <div className="px-4 pb-4">
        <Button variant="primary" size="md">Add to pipeline</Button>
      </div>
    </Card>
  );
}
```

Use the library component for the control; the DS's utility classes for your own layout glue. Confirm each component's available props against its `<Name>.d.ts`.
