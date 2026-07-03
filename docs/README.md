# Zomzam Documentation Index

This folder is the project documentation source of truth. The old mixed archive/spec/strategy tree was replaced with section-level docs so each system can be read and updated independently.

## Root Section Files

- [01-site-overview.md](01-site-overview.md) - product thesis, audience, suites, and core value loop.
- [02-architecture.md](02-architecture.md) - framework structure, runtime boundaries, providers, routes, and source map.
- [03-routes-and-api.md](03-routes-and-api.md) - page routes and API route/action reference.
- [04-auth-security.md](04-auth-security.md) - session model, default-deny page proxy, route gates, OAuth, uploads, and error safety.
- [05-realtime-sse-and-heartbeat.md](05-realtime-sse-and-heartbeat.md) - live sync, SSE, heartbeat, presence, messages, and notifications.
- [06-ui-components.md](06-ui-components.md) - Zomzam Kit primitive contract and component usage.
- [07-data-and-database.md](07-data-and-database.md) - MySQL schema ownership, `db-sync`, and major tables.
- [08-feature-suites.md](08-feature-suites.md) - Time, Money, CRM, Social, profile, settings, and public surfaces.
- [09-cross-suite-bridges.md](09-cross-suite-bridges.md) - how CRM, Money, Time, posts, notifications, and realtime connect.
- [10-performance-and-observability.md](10-performance-and-observability.md) - performance posture, WebGL policy, testing, logging, and error reports.
- [11-development-workflow.md](11-development-workflow.md) - local setup, contribution rules, docs sync, and implementation standards.

## Strategy And Research

- [Marketing Strategy/README.md](Marketing%20Strategy/README.md) - go-to-market hub.
- [Marketing Strategy/positioning-and-growth.md](Marketing%20Strategy/positioning-and-growth.md) - audience, positioning, loops, and 90-day plan.
- [Marketing Strategy/monetization.md](Marketing%20Strategy/monetization.md) - free era, Pro gating, credits, and paid CRM logic.
- [Research/README.md](Research/README.md) - research hub.
- [Research/outreach-providers.md](Research/outreach-providers.md) - email/SMS outreach provider notes and decision framework.

## Update Rule

When code changes alter routes, API actions, core data flow, the UI Kit, or marketing/business direction, update the matching file in this folder during the same turn.
