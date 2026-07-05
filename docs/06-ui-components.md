# UI Components: The Zomzam Kit

The Zomzam Kit is the internal component system in `src/components/ui`. It is the first place to look before writing new markup.

Import primitives from:

```ts
import { Button, Card, Modal } from '@/components/ui';
```

## Live Showcase

Route: `/ui-kit`

File: `src/app/ui-kit/page.tsx`

The showcase renders every primitive with real variants and states. It is dev-only, unlinked from normal navigation, and should not read or write production data.

## Exported Primitives

The barrel file `src/components/ui/index.ts` exports:

- Accordion
- Alert
- AudienceSwitch
- Avatar
- Badge
- Breadcrumb
- Button
- Calendar
- Card
- Checkbox
- ComposerBanner
- ConfirmDialog
- CountUp
- DeleteButton
- Divider
- Dropdown
- Input
- Modal
- NumberInput
- Pagination
- PostCard
- PostComposer
- PostImageGrid
- ProLock
- Progress
- Radio
- SectionHeader
- SegmentedSwitch
- ShareButton
- Skeleton
- Slider
- Spinner
- Switch
- Tabs
- Textarea
- Toast
- Tooltip

## Primitive Contract

All new reusable primitives should follow the existing shape:

- `variant` for semantic style.
- `size` for density.
- `shape` when geometry matters.
- `className` merged with `cn(...)` from `src/lib/utils.ts`.
- Accessible labels for icon-only controls.
- Keyboard support for interactive elements.
- Visible focus state.
- Disabled and loading states where relevant.

Do not use template string concatenation for conditional class logic. Use `cn()`.

## Canonical Example: Button

File: `src/components/ui/Button.tsx`

`Button` defines the current conventions:

- Variants: `primary`, `secondary`, `danger`, `success`, `ghost`, `outline`, `soft`, `soft-danger`, `soft-success`, `soft-sky`, `link`, `unstyled`.
- Sizes: `xs`, `sm`, `md`, `lg`, `xl`, `icon`, `icon-sm`, `icon-lg`, `none`.
- Shapes: `rounded`, `lg`, `xs`, `2xl`, `pill`, `circle`, `none`.
- Supports `loading`, `fullWidth`, `active`, `leftIcon`, `rightIcon`, and `href`.
- Defaults `type="button"` to avoid accidental form submits.
- Renders `Next<Link>` when `href` is provided.
- Keeps disabled/loading links non-clickable and non-focusable.

Use `variant="unstyled"` for bespoke controls that still need consistent button behavior.

## Data-Aware UI Exceptions

Most UI primitives are pure. Two are intentionally feature-aware:

- `PostComposer`
- `PostCard`

They live in the Kit because they define the canonical feed UI, but they have service helpers:

- `PostComposer.services.ts`
- `PostCard.services.ts`
- `useComposerImages.ts`
- `usePostActions.ts`

They also support demo mode for `/ui-kit`, where interactions are local and skip network writes.

## Visual Tokens

Use tokens from `src/app/globals.css` and `BrandGuideLine.md`:

- `text-display`, `text-title`, `text-headline`, `text-body`, `text-footnote`.
- `primary-500` for Zomzam Orange.
- `surface-dark`, `surface-light`, `surface-hover`.
- Patched intermediate slate, rose, emerald, and purple shades.
- `shadow-apple-sm`, `shadow-apple`, `shadow-apple-lg`.
- `.glass-nav`, `.glass-header`, `.card-lift`.

Do not invent parallel color systems.

## Motion

Use `src/hooks/usePageEntrance.ts` for page entrance choreography:

- Put `ref={pageRef}` on the page root.
- Mark title elements with `data-entrance="title"`.
- Mark section wrappers with `data-entrance="card"`.
- Mark rows with `data-entrance="list-item"`.

GSAP must be imported from `src/lib/gsap.ts`, never directly from the `gsap` package.

## Extension Protocol

1. Check `src/components/ui` and `/ui-kit`.
2. If no primitive fits, build the one-off inline in the feature.
3. If the same pattern is needed a second time, promote it into `src/components/ui`.
4. Add it to `index.ts`.
5. Add a showcase block to `/ui-kit`.
6. Update this document.
