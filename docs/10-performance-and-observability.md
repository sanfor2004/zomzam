# Performance And Observability

Zomzam is performance-sensitive because it combines a dashboard shell, realtime channels, rich feed UI, and occasional WebGL.

## Current Performance Posture

The previous performance pass measured strong local production results:

- Desktop Lighthouse: 100 performance, 0.6s LCP, 10ms TBT, 0 CLS.
- Mobile Lighthouse: 97 performance, 2.3s LCP, 130ms TBT, 0 CLS.

Those numbers were local and optimistic, but they show the current architecture is healthy.

## WebGL Policy

Files:

- `src/components/Silk.tsx`
- `src/hooks/useDesktopWebGL.ts`
- `src/app/page.tsx`

Rules:

- WebGL belongs on the landing page only unless a new feature has a strong reason.
- Load WebGL with `next/dynamic({ ssr: false })`.
- Gate it to desktop pointers and idle readiness with `useDesktopWebGL`.
- Mobile/tablet should receive a static CSS fallback.
- Dashboard ambient backgrounds should stay CSS-only.

## Animation Policy

Files:

- `src/lib/gsap.ts`
- `src/hooks/usePageEntrance.ts`
- `src/app/globals.css`

Rules:

- Import GSAP only from `@/lib/gsap`.
- Register GSAP plugins once in `src/lib/gsap.ts`.
- Respect `prefers-reduced-motion`.
- Use `usePageEntrance()` for standard page reveals.
- Use `canvas-confetti` for reward bursts; do not add another confetti library.

## Realtime Performance

SSE loop:

- Ticks every 2 seconds.
- Emits only non-empty sync frames.
- Sends keepalive pings every 20 seconds.
- Contacts presence snapshot is throttled to about every 20 seconds.

Heartbeat:

- Runs every 5 seconds only while AFK.
- Is rate-limited.
- Uses the same payload as SSE.

This avoids concurrent polling and streaming while keeping notifications/messages alive.

## Error Observability

Files:

- `src/lib/api-auth.ts`
- `src/lib/bug-report.ts`
- `src/components/ErrorReporter.tsx`
- `src/app/api/report-error/route.ts`
- `src/app/global-error.tsx`

Unexpected API errors:

1. Log server-side.
2. Report through `reportBug()`.
3. Return generic `Internal Server Error`.

Client runtime errors:

1. `ErrorReporter` catches uncaught errors and unhandled rejections.
2. Sends a size-capped payload to `/api/report-error`.
3. Route throttles by IP.
4. Bug reporter sends email when configured.

## Tests

Run:

```bash
npm test
```

The project uses Node's built-in test runner through `tsx`:

```bash
npx tsx --test --experimental-test-module-mocks "src/**/*.test.ts"
```

Existing coverage focuses on service logic and route-adjacent helpers:

- CRM service.
- Posts services.
- Live sync.
- Notifications.
- Email.
- Google auth.
- Page service modules.

## Build And Lint

Run:

```bash
npm run lint
npm run build
```

Use a production build when validating bundle/performance behavior. Development mode is not representative.

## Performance Risks To Avoid

- Do not mount heavy providers in the root app layout unless every route needs them.
- Do not import dashboard-only code into public landing components.
- Do not import `three` or `gsap` outside their approved wrappers.
- Do not add charting/UI/form libraries for one-off UI.
- Do not use idle loops or always-on animation in dashboard chrome.
- Do not force-refresh live feed data when a soft realtime pill is enough.
