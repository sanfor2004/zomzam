# Zomzam.com 🚀 | Developer Documentation & Architecture Guide

Welcome to the **Zomzam** developer workspace! Zomzam is a custom, high-orbit personal operating system that merges time engineering and wealth management into a single, high-fidelity digital dashboard. Built with a **Zenith-Tier architecture**, cinematic UI/UX details, and real-time synchronization, it is designed to feel premium, bespoke, and state-of-the-art.

---

## 🌟 The Vision: What is Zomzam & Why We Are Building It

### What Zomzam is For
Zomzam is a unified control center for a user's life. Instead of forcing users to scatter their personal data across fragmented platforms—using one app for Pomodoro tracking, another for notes, a third for budgeting, and yet another for tracking debts—Zomzam merges these suites into a single, cohesive interface. It balances daily execution metrics (**Time Suite**) with long-term financial sovereignty (**Money Suite**).

### Why We Are Building It
1. **Technological Sovereignty**: In an era of intrusive tracking and ad-driven subscription bloat, Zomzam provides a privacy-first, fully owned repository for personal time and currency ledgers.
2. **Unified Cognitive Flow**: Transitioning between tasks and tracking financial records should not introduce cognitive load. Zomzam bridges the *Gulfs of Execution and Evaluation* by presenting clear, immediate feedback, and unified visual signifiers.
3. **Cinematic Visual Excellence**: Productivity tools shouldn't feel boring. We believe that tools which inspire interaction are tools that get used. Zomzam features sleek dark modes, fluid micro-animations, glassmorphism aesthetics, and real-time Server-Sent Events (SSE) presence synchronization.

---

## ⚡ Core Platform Functions & Capabilities

The platform is divided into three major suites:

### 1. ⏳ The Time Suite (Time Engineering)
* **Pomodoro Focus Engine** (`/time/execution`): A drift-corrected productivity timer that runs in real-time, allowing users to select tasks, manage custom focus and break durations, and persist timer states across multiple open browser tabs. Includes reward mechanics (particle confetti effects).
* **Task Checklist Manager** (`/time/tasks`): Create, edit, prioritize, and delete tasks. Integrates custom select inputs for priority levels (`Urgent`, `Medium`, `Maybe`, `Free`) and duration blocks, complete with safe undo actions to revert accidental deletions.
* **Dream Planning Board** (`/time/planning`): A drag-and-drop workflow visualizer dividing goals into three planning horizons: *This Week*, *This Month*, and *This Year*.
* **Idea Vault** (`/time/ideas`): A quick-capture scratchpad for writing down raw thoughts, notes, and log details.

### 2. 💰 The Money Suite (Wealth Ledger)
* **Financial Net Worth Dashboard** (`/money/dashboard`): Aggregate balances across all active cards, banks, and cash accounts, display real-time income/expense distribution, and automatically convert figures between custom Primary and Secondary currencies.
* **Bank Ledger & Accounts** (`/money/accounts`): Add, modify, and manage financial entities (Cash, Bank accounts, Credit/Debit cards) with initial balances and multi-currency denominations.
* **Income & Expense logs** (`/money/income` & `/money/expenses`): Categorized transaction ledgers that enforce the **50/30/20 Budgeting Rule** (categorizing transactions as *Needs*, *Wants*, or *Savings*).
* **Lending & Debt tracker** (`/money/lend`): Log outstanding loans and borrowings (`owe_me` or `i_owe`), define payment dates, and track settlement statuses (`pending`, `partial`, `settled`).

### 3. 💼 The CRM Suite (Client Relations & Lead Generation)
* **Map Leads Scraper** (`/crm`): A geographic prospecting interface that pulls active local business data directly from Google Maps (via custom Place Search proxy) and simulates lead acquisition pipelines.
* **Lead Vault Directory** (`/crm/leads`): A structured leads database supporting quick search, niche filtering, status adjustments, and batch deletion controls.
* **Kanban Pipeline Board** (`/crm/pipeline`): Visual deal-tracking columns representing lead lifecycles. Dragging a lead to `Qualified` launches a contract setup modal to select deposit accounts and payment dates, triggering multi-suite data bridges.
* **Client Profiles** (`/crm/contacts`): Standardized client contact directory.
* **Campaign Outreach Hub** (`/crm/outreach`): AI-assisted cold email writing tool using Claude Sonnet APIs (falling back to tailored design-audit templates if keys are missing) with signature customizations.
* **Projects Hub** (`/crm/projects`): Delivery tracking for won client contracts, mapping development milestones (`Planning`, `Design`, `Feedback Review`, `Production Delivered`) to automated task-completion indicators.

### 4. 🌐 Preferences & Social Integration (Platform Core)
* **System Preferences** (`/settings`): Refactored to use unified UI selects for timezone adjustment (with live clock previews), multi-language configuration, and primary/secondary currency selections.
* **Vanity Public Profiles** (`/u/[username]`): Public profile directories featuring real-time presence indicators (Online, Away, Offline) synchronized dynamically via Server-Sent Events (SSE) based on user mouse movements and idle timers.
* **Social Connections** (`/community`): A member directory showing user availability, network contacts, and follows.
* **Strict Security Guardrails**: Dynamic JWT edge middleware routing checks, cryptographically secure Bcrypt password hashing, and zero leak logs.

---

## 🎯 Platform Overview & Core Tech Stack

Zomzam is designed to bridge the gap between day-to-day productivity (Time Suite) and long-term financial sovereignty (Money Suite). The system is fully reactive, localized, and multi-tenant ready.

| Layer | Technology | Rationale & Trade-offs |
| :--- | :--- | :--- |
| **Framework** | **Next.js 16.2 (App Router)** | SSR & Server Components for SEO and fast loading; Edge Route Handlers for high concurrency. |
| **UI Library** | **React 19** | Leverage Server Components, improved concurrent rendering, and native element hooks. |
| **Styling** | **Tailwind CSS v4 & Vanilla CSS** | Modern CSS variables, Tailwind engine for atomic utility styling, custom HSL palettes. |
| **Database** | **MySQL (via `mysql2/promise`)** | High performance, transaction safety, and sub-millisecond query execution on structured schemas. |
| **Security** | **Jose JWT (Edge) & BcryptJS** | Edge-runtime compatible token signing/validation; high-rounds bcrypt salt for password protection. |
| **Streaming** | **Server-Sent Events (SSE)** | Low-overhead server-push pipe for real-time presence sync without the overhead of WebSockets. |
| **Animation** | **GSAP (GreenSock) & Confetti** | 60FPS UI choreography and rewarding micro-interactions on task completions. |

---

## 📁 Repository Directory Structure

The Next.js codebase is structured to enforce **Atomic Separation of Concerns (SoC)**:

```bash
zomzam.com/
├── scripts/                  # Database schema synchronizers and seeding scripts
│   └── db-sync.ts            # Self-healing database migrator (seeding default accounts/categories)
├── src/
│   ├── app/                  # Next.js App Router root
│   │   ├── (dashboard)/      # Authenticated dashboard route group (shares layout wrapper)
│   │   │   ├── community/    # Developer directory and profile cards (accessible at /community)
│   │   │   ├── crm/          # CRM Dashboard, Lead Vault, Pipeline, Contacts, Outreach, Projects
│   │   │   ├── dashboard/    # Primary user dashboard (accessible at /dashboard)
│   │   │   ├── layout.tsx    # Central dashboard layout wrapper with navigation sidebar
│   │   │   ├── me/           # Settings page for user profiles (accessible at /me)
│   │   │   ├── money/        # Money account details, transactions, and lend tracking (accessible at /money/*)
│   │   │   ├── settings/     # Security, primary currency, and system preferences (accessible at /settings)
│   │   │   └── time/         # Time execution timers, planning boards, ideas, and tasks (accessible at /time/*)
│   │   ├── api/              # Serverless API routes (Heartbeats, SSE Stream, Auth, Time, Money, CRM)
│   │   │   ├── auth/         # Login, Registration, Password reset
│   │   │   ├── crm/          # Leads, Scraper Jobs, Claude settings, qualification API
│   │   │   ├── heartbeat/    # Out-of-band active state & notifications sync
│   │   │   ├── money/        # Transactions, Accounts, and Lending API
│   │   │   ├── profile/      # User info modifications & password updates
│   │   │   ├── social/       # User connection graphs (Friendships, Follows)
│   │   │   ├── stream/       # SSE (Server-Sent Events) streaming connection
│   │   │   └── time/         # Pomodoro timers, Ideas, Tasks, and Planning horizons API
│   │   ├── sign/             # Unified Sign In / Sign Up split-screen layout
│   │   ├── u/                # Public vanity profiles (e.g., /u/username)
│   │   ├── globals.css       # Core Tailwind configuration and global glassmorphism styles
│   │   ├── layout.tsx        # Base HTML Shell, provider wrappers, and language direction controllers
│   │   ├── page.tsx          # Marketing landing page with multi-language showcases
│   │   └── providers.tsx     # Global context aggregation wrapper
│   │
│   ├── context/              # Client-Side Global State Contexts
│   │   ├── MoneyContext.tsx  # Multi-currency balances, cash flows, and accounts context
│   │   ├── StreamWaiterContext.tsx # Active SSE listener, idle triggers, and toasts
│   │   └── TranslationContext.tsx # Dynamic multi-language dictionary (RTL support for Arabic/Hebrew)
│   │
│   ├── lib/                  # Backend Shared Logic
│   │   ├── auth.ts           # Token cryptography, verification, and hash parameters
│   │   ├── db.ts             # Connection pools and transaction callbacks
│   │   └── models/           # Database operations (user.ts, etc.)
│   │
│   └── proxy.ts               # Global routing guard validating JWT cookies on Edge
└── .env                      # Workspace environment definitions (Git-ignored)
```

---

## ⚙️ Setting Up the Developer Environment

Follow these steps to spin up the local development suite:

### 1. Prerequisites
Ensure you have **Node.js (v18+)** and a running **MySQL (v8.x+)** server.

### 2. Configure the Environment
Create a `.env` file in the root directory:
```env
# Database Credentials
DB_HOST=localhost
DB_PORT=3306
DB_NAME=zomzam_db
DB_USER=root
DB_PASS=your_mysql_password
DB_CHARSET=utf8mb4

# JSON Web Token Secret
JWT_SECRET=super_secret_zomzam_jwt_key_2026_zenith_tier

# Environment Settings
NODE_ENV=development
```

### 3. Initialize & Seed the Database
Execute the self-healing DB script to create the tables, verify column definitions, and seed initial metrics:
```bash
npx tsx scripts/db-sync.ts
```
*Note: This creates the default user profile accounts (cash, banks, cards) and budgets for `user_id = 1`.*

### 4. Install Dependencies & Start Dev Server
```bash
# Install NPM modules
npm install

# Boot local Next.js dev listener
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🔒 Authentication & Session Proxy

Zomzam implements a **Trust-Zero API Architecture** to protect private user workspaces:

```mermaid
sequenceDiagram
    participant User as Client Browser
    participant MW as NextJS Proxy (Edge)
    participant Route as App Route / Page
    participant DB as MySQL DB

    User->>MW: Request to /dashboard/* with ZOMZAM_SESSION cookie
    Note over MW: Reads cookie value & verifies via jose JWT
    alt Token Invalid / Expired
        MW->>User: 302 Redirect to /sign
    else Token Valid
        MW->>Route: Pass request headers/cookies forward
        Route->>DB: Query secure data using SQL prepared parameters
        DB->>Route: Return user records
        Route->>User: 200 OK (Render page / API payload)
    end
```

### Authentication Core Code:
* **Token Verification**: [auth.ts](file:///c:/www/zomzam.com/src/lib/auth.ts) signs and verifies user credentials.
* **Routing Guard**: [proxy.ts](file:///c:/www/zomzam.com/src/proxy.ts) dynamically matches paths (e.g., `/dashboard`, `/time`, `/money`, `/settings`) and intercepts unauthenticated requests. It uses the edge-optimized library `jose` to verify tokens cleanly without triggering Node-only environment crashes.

---

## 📡 Real-Time Presence & Sync Engine

Zomzam avoids polling overhead by maintaining a continuous data pipeline via **Server-Sent Events (SSE)**.

```mermaid
graph TD
    A[Client UI Action / MouseMove] -->|Heartbeat Ping /api/heartbeat| B(Heartbeat Route)
    B -->|Update DB: last_seen & is_idle| C[MySQL DB]
    D[Client Browser] -->|EventSource Stream /api/stream| E(Stream Route Handler)
    E -->|Query DB status changes every 2s/5s| C
    E -->|Stream Order: update_viewed_user_status| D
    E -->|Stream Order: new_notification| D
```

### Connection Walkthrough:
1. **Heartbeat API** ([route.ts](file:///c:/www/zomzam.com/src/app/api/heartbeat/route.ts)):
   Every 25 seconds (or upon mouse movement), the client sends an out-of-band POST request reporting if the user is `idle` (1) or `active` (0).
2. **EventSource Listener** ([StreamWaiterContext.tsx](file:///c:/www/zomzam.com/src/context/StreamWaiterContext.tsx)):
   Establishes a persistent GET request to `/api/stream`. If the connection drops, it executes a custom exponential backoff reconnection protocol.
3. **SSE Loop** ([route.ts](file:///c:/www/zomzam.com/src/app/api/stream/route.ts)):
   Keeps the connection open with a `ReadableStream`. It monitors the connection's abort signal, executing query lookups:
   * **Active state**: Polls every 2 seconds.
   * **Idle state**: Down-throttles to 5 seconds to conserve server resources.
   * Clears the user's `stream_queue` JSON array from MySQL and pushes notifications or availability changes to the client as structured SSE strings (`event: order`).
4. **Public Profile Syncing** ([PublicUserStatus.tsx](file:///c:/www/zomzam.com/src/app/u/[username]/PublicUserStatus.tsx)):
   When a viewer visits the public profile page `/u/[username]`, the client-side `PublicUserStatus` component mounts and initializes its own `StreamWaiterProvider`. On mount, it sets the `viewingUserId` to the profile owner's ID, initiating a connection to `/api/stream?viewing_user_id=[profileUserId]`. The server's stream loop checks for status updates on that specific user and pushes `update_viewed_user_status` orders to the browser, updating the badge (ONLINE, AWAY, OFFLINE) in real-time.

---

## ⏳ Time Management Architecture

The Time Management ecosystem consists of three main components:

### A. Focus Engine (Pomodoro)
* Code: [page.tsx](file:///c:/www/zomzam.com/src/app/(dashboard)/time/execution/page.tsx)
* Features:
  * Adjusts session timer intervals and break durations.
  * Handles focus durations dynamically using drift-corrected time stamps in `localStorage` so timers remain perfectly synced even across multiple open tabs.
  * Triggers particle confetti explosions upon task completion and focus completions.

### B. Dream Planning Board
* Code: [page.tsx](file:///c:/www/zomzam.com/src/app/(dashboard)/time/planning/page.tsx)
* Columns: `This Week`, `This Month`, `This Year`.
* Drag & Drop: Leverages standard HTML5 draggable elements. Dragging a goal between columns updates the DB record (`time_horizons.type`) via POST request to `/api/time` with action `move_horizon`.

### C. Idea Vault
* Multiline text capture that allows notes to be stored, edited, deleted, and optionally linked back to active focus tasks or planning horizons.

---

## 💰 Money Management Architecture

Financial transactions are governed by the **50/30/20 Budgeting Rule**:
* **Needs (50%)**: Mandatory living costs (Bills, rent, food).
* **Wants (30%)**: Lifestyle expenses (Hobbies, eating out).
* **Savings (20%)**: Financial growth (Investments, debt payoff, emergencies).

### Key Systems:
* **Ledger API**: Records balances, accounts, and lending records.
* **Multi-Currency Converter**: Displays net worth in the user's chosen primary and secondary currencies.
* **Lending System**: Tracks debts owed to the user (`owe_me`) or by the user (`i_owe`) with status parameters (`pending`, `partial`, `settled`).

---

## 🔗 Cross-Suite Data Bridges & Transaction Engine

Zomzam's unique value is its interconnectedness. Instead of siloed databases, events in one module automatically cascade across the entire platform through transactional integrity.

### The Deal Qualification Bridge
When a deal is qualified (moved to **Closed Won** / **Qualified** on the Kanban Board):
1. **CRM State**: Updates lead status to `qualified`.
2. **Projects State**: Spawns a new delivery tracker inside `crm_projects` with milestone stages.
3. **Time Suite Sync**: Seeds 4 task blocks in the task queue (`time_tasks`) representing standard development deliverables:
   * *Client Kickoff Consultation*
   * *Mockup Blueprint Redesign*
   * *Outreach Feedback Review*
   * *Production Delivery & Launch*
4. **Money Suite Sync**:
   * Creates an income entry in `money_transactions` categorized under `Salary/Outreach` for the contract's total amount.
   * Increments the user's chosen deposit bank account balance.
   * If a due date is specified, creates an outstanding debtor ledger entry under `money_lend` (`owe_me`), tracking that the client owes the user that amount.

### The Delivery Completion Bridge
When the final development task (containing the phrase `Production Delivery & Launch`) is completed on the **Task Board**, the database trigger intercepts the mutation:
* Automatically updates the associated project delivery status to `delivered`.

---

## 🌐 Dynamic Localization & RTL Support

Internationalization (i18n) is managed natively without heavy packages:
* **Translation Store**: Defined within [TranslationContext.tsx](file:///c:/www/zomzam.com/src/context/TranslationContext.tsx).
* **RTL Language Detection**: When the language is set to Arabic (`ar`) or Hebrew (`he`), the context automatically adjusts the `<html>` document tag:
  ```typescript
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.setAttribute('lang', language);
  ```
  All layouts instantly flip direction naturally thanks to Tailwind's logical layout tags (like `start-0`, `end-0`, and `flex-row-reverse`).

---

## 🛠️ Developer Contribution Guidelines

To maintain Zenith-Tier code standards, please follow these guidelines:

1. **Keep Code Structures Flat**:
   Use **Early Return Guard Clauses** to keep nesting to a minimum.
   ```typescript
   // Correct Pattern
   if (!user) return NextResponse.json({ success: false }, { status: 401 });
   if (!title) return NextResponse.json({ success: false, error: 'Empty Title' });
   // Execute logic...
   ```
2. **Maintain Type Safety**:
   Provide TypeScript interfaces for all data rows and API payload types.
3. **Database Security**:
   Always use parameterized prepared statements in DB queries. Never concatenate SQL parameters.
4. **Clean up Resources**:
   When writing React hooks, always return cleanup functions to clear background intervals, SSE listeners, or DOM event listeners.

Let's build something extraordinary! 🚀
