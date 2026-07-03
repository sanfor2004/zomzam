# Development Workflow

This file defines how to work in the Zomzam codebase without breaking architecture, security, or design consistency.

## Local Setup

Install dependencies:

```bash
npm install
```

Create environment variables from `.env.example` and project secrets.

Sync database:

```bash
npm run db:sync
```

Start dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Build production:

```bash
npm run build
```

## Before UI Work

1. Read `BrandGuideLine.md`.
2. Check `src/app/globals.css` tokens.
3. Check `src/components/ui`.
4. Visit `/ui-kit` if a dev server is running.
5. Use the Kit before writing bespoke markup.

## Before Next.js Code Work

This project uses Next.js 16 and may differ from older Next.js assumptions. Read relevant local docs under:

```text
node_modules/next/dist/docs/
```

before changing framework-specific APIs, routing, caching, metadata, proxy/middleware behavior, server actions, or route handlers.

## Code Standards

- Keep route handlers thin.
- Move business rules into services/models.
- Use early returns and guard clauses.
- Scope private data by `user_id`.
- Use parameterized SQL.
- Never leak internal errors to clients.
- Use `cn()` for conditional class merging.
- Import UI primitives from `@/components/ui`.
- Import GSAP from `@/lib/gsap`.
- Add accessible labels to icon buttons.
- Preserve keyboard and focus behavior.

## DOM Section Markers

Large JSX sections should use the project navigator comment format:

```tsx
{/* ----------------------------------------------------------
    DEVELOPMENT NAVIGATOR: SECTION_NAME
    Contains: key controls/content
    ---------------------------------------------------------- */}
```

Use it before major page regions and large component regions.

## Docs Sync

Update docs in the same turn when changing:

- Routes or API actions: update `03-routes-and-api.md`.
- Auth/session/security behavior: update `04-auth-security.md`.
- SSE/heartbeat/live payloads: update `05-realtime-sse-and-heartbeat.md`.
- UI primitives or `/ui-kit`: update `06-ui-components.md`.
- Tables/schema/data ownership: update `07-data-and-database.md`.
- Feature behavior: update `08-feature-suites.md`.
- Cross-suite automation: update `09-cross-suite-bridges.md`.
- Performance, testing, or observability posture: update `10-performance-and-observability.md`.
- Marketing/business strategy: update files under `Marketing Strategy`.
- Research notes: update files under `Research`.

## Dependency Rule

Ask before adding a dependency not already in `package.json`. The project intentionally avoids extra UI/form/chart/animation dependencies when the Zomzam Kit and existing stack can handle the work.

## Delivery Checklist

- Code matches local architecture.
- UI uses existing tokens and primitives.
- Auth/data boundaries are protected.
- Realtime side effects are documented.
- Tests/lint/build run when relevant.
- Docs are synced if behavior changed.
