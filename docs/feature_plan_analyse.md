# Feature Plan & Analyse Protocol

Nothing gets built on Zomzam before it is analysed and planned here. This file is the mandatory pre-build gate: run the Analyse phase, fill the Plan template, and only then write code. Skipping this protocol is an architecture violation.

Applies to: every new feature, page route, API route/action, DB schema change, UI surface, realtime/SSE change, or cross-suite bridge.
Exempt: typo fixes, copy tweaks, and single-line style corrections that change no behavior.

## Phase A: Analyse (Reconnaissance Before Any Code)

Work through every row that touches the feature. The goal is to know what already exists so nothing is duplicated, contradicted, or broken.

| Area | Read first | What you are checking |
| --- | --- | --- |
| Product fit | `docs/01-site-overview.md` | Which suite owns this? Does it serve the core value loop? |
| Architecture | `docs/02-architecture.md`, `README.md` directory tree | Where does the code live? Which runtime boundary (Edge/Node/client)? |
| Routes & API | `docs/03-routes-and-api.md` | Does a route/action already exist or nearly exist? Naming conventions? |
| Auth & security | `docs/04-auth-security.md` | Session gate (`withAuth`/`getSessionUser`), ownership scoping, rate limits |
| Realtime | `docs/05-realtime-sse-and-heartbeat.md` | Does this need a `stream_queue` order? `touchLastSeen` implications? |
| UI Kit | `docs/06-ui-components.md`, `src/components/ui`, `/ui-kit` | Which of the 28 primitives cover the UI? What genuinely needs a one-off? |
| Data | `docs/07-data-and-database.md`, `scripts/` db-sync | Which tables? New columns vs new table? Migration via declarative sync |
| Feature suites | `docs/08-feature-suites.md` | Overlap with existing Time/Money/CRM/Social behavior |
| Bridges | `docs/09-cross-suite-bridges.md` | Does this trigger or belong to a cross-suite bridge? |
| Performance | `docs/10-performance-and-observability.md` | Bundle/WebGL policy, TBT/LCP budget, logging expectations |
| Workflow | `docs/11-development-workflow.md` | Code standards, docs-sync obligations, delivery checklist |
| Brand | `BrandGuideLine.md`, `src/app/globals.css` `@theme` | Tokens, type scale, motion grammar — never invent parallel ones |
| Framework | `node_modules/next/dist/docs/` | Next.js 16 behavior for any framework API you will touch |
| Similar code | The closest existing feature in `src/` | Copy its architecture, naming, and patterns — do not reinvent |

Analyse output: a short written summary of findings (what exists, what is reusable, what conflicts). If the analysis reveals the feature is already possible with existing code, stop and say so instead of building.

## Phase B: Plan (Fill This Template Before the First Line of Code)

Copy the template below. For small features it can live in the conversation/PR description; for major features save the filled copy as `docs/plans/<yyyy-mm-dd>-<feature-name>.md` and delete or archive it once shipped and documented in the section docs.

```markdown
# Feature Plan: <name>
Date: <yyyy-mm-dd>
Suite: Time | Money | CRM | Social | Platform Core

## 1. Problem & Goal
- Problem being solved (one paragraph, user language):
- Definition of done (observable behavior, not code):
- VIP user & 5-second "wow" moment:

## 2. Scope
- In scope:
- Explicitly out of scope:

## 3. Analyse Findings (from Phase A)
- Existing code/routes/primitives that will be reused:
- Conflicts or overlaps found and how they are resolved:
- Closest existing feature used as the pattern reference:

## 4. Routes & API Impact
- New/changed pages:
- New/changed API routes or actions (method, path, action, auth gate):
- Validation rules at the route boundary:

## 5. Data & DB Impact
- Tables/columns added or changed (declarative db-sync definition):
- Ownership/scoping column (`user_id`) and indexes:
- Backfill/migration considerations:

## 6. UI Plan
- Kit primitives used (from `@/components/ui`):
- One-offs required and why the Kit cannot cover them:
- Tokens/type-scale/motion used (`usePageEntrance`, `.card-lift`, etc.):
- Accessibility: labels, focus order, contrast, reduced-motion fallback:

## 7. Security
- Auth gate and ownership checks:
- Input sanitization/parameterized queries:
- What must never leak to the client:

## 8. Realtime Impact
- New `stream_queue` orders (name, payload, `touchLastSeen` value):
- Client `applySync()`/event handling changes:
- None — explain why:

## 9. Performance Budget
- Expected bundle impact (new deps are forbidden without asking — see Section 5 of CLAUDE.md/AGENTS.md):
- Heavy surfaces (WebGL/canvas/large lists) and their gating strategy:

## 10. Docs To Update (same turn as the build)
- docs/ section files affected:
- Root README sections affected (Site Map, API tables, directory tree):

## 11. Test & Verification Plan
- Unit/route tests to add (`*.test.ts` beside the route):
- Manual verification flow (exact clicks/requests to prove it works):

## 12. Risks & Rollback
- Top risks:
- How to revert cleanly if it fails:
```

## Exit Gate

Do not start building until every box is true:

- [ ] Phase A completed against every relevant row, with findings written down.
- [ ] The plan template is filled — no section left as "TBD".
- [ ] No new dependency is required, or the stakeholder explicitly approved one.
- [ ] The feature reuses the closest existing pattern instead of inventing a parallel one.
- [ ] Docs-to-update list is known before the code is written, not discovered after.
