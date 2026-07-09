# Site Overview

Zomzam is a personal operating system for builders, freelancers, and small service operators. It combines social presence, direct messages, post-based collaboration, productivity execution, personal finance, and CRM lead generation in one authenticated dashboard.

## Product Thesis

The product is social-first: users come back because their people, conversations, help requests, posts, and client opportunities are live in one place. Time and Money are the daily habit loops. CRM is the monetizable value loop.

The site is not just a dashboard. It is a private control room with a public identity layer:

- Public identity: `/u/[username]`, `/p/[postId]`, the social feed, follows/friends, public asks, and wins.
- Private execution: Time tasks, Pomodoro, planning, ideas, Money accounts, income, expenses, lending, CRM leads, projects, and outreach.
- Live feedback: presence, messages, notifications, post fan-out, and profile status updates through SSE/heartbeat sync.

## VIP User

The primary user is a builder/freelancer who wants fewer tools and more control:

- They want a professional public profile without maintaining a separate portfolio site.
- They want a lightweight social graph around work, help, and reputation.
- They want CRM and outreach tied to revenue and delivery, not isolated in a spreadsheet.
- They want personal finance and time execution in the same mental model as client work.

## Core Suites

### Social Core

Routes: `/home`, `/saved`, `/messages`, `/notifications`, `/community`, `/community/connections`, `/community/discover`, `/community/requests`, `/u/[username]`, `/p/[postId]`.

Purpose: make Zomzam feel alive. It includes the feed, post composer, ask/win/status posts, likes, comments, reposts, bookmarks, reports, connection requests, direct messages, notification toasts, and live profile presence.

### Time Suite

Routes: `/time/execution`, `/time/tasks`, `/time/planning`, `/time/ideas`, `/time/tracker`.

Purpose: convert goals into daily execution. It includes Pomodoro focus, task management, planning horizons, idea capture, and the daily tracker.

### Money Suite

Routes: `/money/dashboard`, `/money/accounts`, `/money/income`, `/money/expenses`, `/money/lend`.

Purpose: show cash position, accounts, income, expenses, lending, debts, and personal budget structure.

### CRM Suite

Routes: `/crm`, `/crm/leads`, `/crm/pipeline`, `/crm/contacts`, `/crm/outreach`, `/crm/projects`.

Purpose: turn network and prospecting into paid work. It includes Google Maps lead search, lead vault, Kanban pipeline, client directory, outreach generation, and delivery projects.

### Settings And Identity

Routes: `/settings`, `/me`, `/sign`, `/forgot-password`, `/pricing`, `/ui-kit`.

Purpose: session entry, profile maintenance, localization, timezone/currency preferences, upgrade surface, and UI system inspection.

## High-Level Flow

1. A visitor lands on `/` or `/pricing`.
2. They sign in or register through `/sign`.
3. The proxy redirects authenticated users away from public entry pages into `/home`.
4. The dashboard shell mounts global providers for current user, live sync, messages, and money.
5. The user interacts with posts, messages, tasks, money, or CRM.
6. Mutations write through API routes into MySQL.
7. Realtime consequences are queued into `user_online_status.stream_queue`.
8. `/api/stream` or `/api/heartbeat` drains that queue and applies updates client-side.

## Current Strategic Direction

The strongest wedge is the collaboration/social layer, not a generic productivity dashboard. The product should prioritize loops that make users invite peers:

- Presence: "my people are here."
- Conversation: "I can talk to them now."
- Content: "I can share work, ask for help, and get reactions."
- Reputation: "wins, accepted answers, and useful posts make me look credible."
- Revenue: "CRM turns visibility into clients."
