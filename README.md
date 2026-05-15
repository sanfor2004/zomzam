# zomzam.com 🚀

Professional life and money management platform engineered with **Zenith-Tier architecture** and Cinematic UI/UX design. This platform bridges the gap between productivity and financial sovereignty through a high-fidelity, cognitive-first interface.

---

## 🎯 Zenith-Tier Features

### 💎 Cinematic Visual Engineering
*   **The Zenith Aesthetic** - Deep glassmorphism (`backdrop-filter`), multi-layered HSL shadows, and OLED-optimized dark modes.
*   **Fluid Motion Grammar** - 60FPS transitions using specialized cubic-bezier curves (`cubic-bezier(0.4, 0, 0.2, 1)`) and staggered reveal animations.
*   **Responsive Typography** - Sora & Montserrat for cinematic display; Inter & Outfit for crisp, professional body text.

### ⏳ High-Performance Time Suite
*   **Pomodoro Engine** - Advanced focus timer with task-stacking integration and real-time state persistence.
*   **Multi-Horizon Planning** - Strategic "Dream" planning across Weekly, Monthly, and Yearly horizons.
*   **Idea Vault** - Native multiline capture system with full CRUD management and cross-linking to tasks/horizons.
*   **Task Stacking** - Prioritized task management with automatic duration blocking and status tracking.

### 💰 Financial Sovereignty Engine
*   **Multi-Account Management** - Unified tracking for Bank accounts, Cash, PayPal, and digital wallets with multi-currency support (EGP, USD, EUR, GBP).
*   **50/30/20 Budgeting Logic** - Automated categorization into Needs, Wants, and Savings with visual budget tracking.
*   **Transaction Ledger** - High-fidelity logging for income, expenses, transfers, and lend/owe tracking.

### 👤 Identity & Social Architecture
*   **Vanity Routing Engine** - Public social profiles via `/u/{username}` and private management via `/me`.
*   **Community Hub** - Social discovery platform for platform users and public interaction.
*   **Zenith Onboarding** - Split-pane dynamic authentication flow with strict username sanitization and unique identity validation.

### 📡 Zenith Real-Time Sync Engine
*   **Persistent SSE Stream** - High-fidelity Server-Sent Events (SSE) for instant UI updates without polling overhead.
*   **State-Preserving Architecture** - Decoupled state updates (Idle/Active) via out-of-band Heartbeat API to maintain persistent connections.
*   **Intelligent Heartbeat** - Time-based pings (20s) ensure connection stability through aggressive proxies and firewalls.
*   **View Monitoring** - Real-time presence tracking for viewed user profiles with sub-second state synchronization.

### 🛡️ Dragon-Tier Security & Infrastructure
*   **8-Layer Upload Protocol** - Enterprise-grade profile avatar security (re-encoding, metadata stripping, cryptographic renaming).
*   **Trust-Zero API Architecture** - 100% Parameterized PDO/MySQLi queries with session hardening and CSRF protection.
*   **Automated Schema Sync** - Self-healing database engine (`setup_db.php`) that auto-migrates and validates schema health.

---

## 🚀 Quick Start

### 1. Database Initialization
Execute the Dragon-Tier sync engine to build the schema and seed initial data:
```bash
php setup_db.php
```

**Test Credentials:**
- **Email:** `test@zomzam.com`
- **Username:** `testuser`
- **Password:** `test1234`

### 2. Environment Requirements
Ensure your PHP environment (v8.2+) has the following modules enabled:
- `pdo_mysql` & `mysqli`
- `gd` (Required for secure image processing)
- `mbstring` & `openssl`

### 3. URL Access
- **Landing:** `http://localhost/`
- **Dashboard:** `http://localhost/dashboard`
- **Profile:** `http://localhost/me`
- **Time Module:** `http://localhost/time`

---

## 📁 Project Structure

```bash
zomzam.com/
├── Api_handler/              # Decoupled API Service Layer
│   ├── auth.php              # Auth service (Login/Register/Check)
│   ├── profile.php           # User profile & avatar management
│   ├── time_api.php          # Time suite logic & persistence
│   ├── stream_waiter.php     # Zenith Real-Time SSE Engine
│   └── heartbeat.php         # Out-of-band state & heartbeat API
│
├── Assets/
│   ├── Js/
│   │   ├── Time/             # Modular Time Application
│   │   │   ├── pomodoro.js   # Focus engine
│   │   │   ├── tasks.js      # Task management logic
│   │   │   └── api.js        # API bridge
│   │   ├── stream_waiter.js  # Client-side Stream Engine
│   │   ├── heartbeat_engine.js # Global state synchronization
│   │   ├── money_app.js      # Financial suite logic
│   │   └── translator.js     # i18n Translation Engine (7+ languages)
│   └── Css/
│       └── style.css         # Global Zenith Design Tokens
│
├── Models/                   # Data Access Layer (DAL)
│   ├── Base.php              # Base PDO/MySQLi abstraction
│   └── User.php              # User domain & authentication model
│
├── Views/                    # UI Component Layer (Atomic Design)
│   ├── App/                  # Private application views (Settings, Me, Community)
│   ├── Public/               # Public profiles (/u/{username})
│   ├── Time/                 # Time management interfaces
│   ├── Money/                # Financial management interfaces
│   └── app_layout.php        # Core application shell
│
├── config.php                # Centralized configuration & Middleware
└── setup_db.php              # Dragon-Tier Sync & Migration Engine
```

---

## 👨‍💻 Engineering Standards

- **Architecture:** Decoupled Logic, View, and Data.
- **Streaming:** Persistent SSE + Heartbeat Synchronization.
- **Styling:** Vanilla CSS + Tailwind Utility Tokens.
- **Localization:** Real-time i18n with RTL support.
- **Performance:** Lighthouse optimized (LCP < 1.2s).

**Version:** 2.2.0 (Sync Engine Refactor)  
**Last Updated:** May 15, 2026  
**Status:** Zenith-Tier 🚀
