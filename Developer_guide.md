# Zomzam.com - Technical Architecture & Developer Guide

Welcome to the **zomzam.com** development team. This document provides a high-level overview of our "Zenith-Tier" technical stack, design philosophy, and core functionality to help you get started.

---

## 1. Architectural Overview

Zomzam is built on a clean, decoupled PHP architecture that separates logic, view, and data management. It prioritizes performance, security, and cinematic user experience.

### Directory Structure
- **`/Api_handler`**: Server-side logic for AJAX and real-time (SSE) requests.
- **`/Assets`**: Frontend resources (Vanilla JS, CSS, Audio, Images).
- **`/Models`**: The data layer. All models inherit from `Base.php`.
- **`/Views`**: PHP template files grouped by module (Time, Money, Auth, etc.).
- **`/Logs`**: Application and error logs.
- **`config.php`**: Global constants, database connections, and auth middleware.

### URL Routing
We use a **Custom Router** implemented via `.htaccess`. It maps "clean" URLs (e.g., `/time/execution`) to the actual PHP files.
- **Public Routes**: `/`, `/u/{username}`, `/sign`.
- **Authenticated Routes**: `/dashboard`, `/time/*`, `/money/*`, `/me`.

---

## 2. Core Technologies
    
| Layer | Technology |
| :--- | :--- |
| **Backend** | PHP 8.x (Native) |
| **Database** | MySQL (Dual connection: PDO for security, MySQLi for performance) |
| **Styling** | Tailwind CSS (Utility-first) + Custom Design Tokens |
| **Animation** | GSAP (GreenSock Animation Platform) |
| **Real-time** | SSE (Server-Sent Events) via `StreamWaiter` |
| **State** | `localStorage` (Frontend) + PHP Sessions/Cookies (Backend) |

---

## 3. Database & Data Layer

### `Base.php` (The Foundation)
Every model extends the `Base` class. It provides:
- **Automatic Connections**: Initializes both PDO and MySQLi.
- **Self-Healing**: `ensureConnection()` checks and reconnects if the DB goes idle.
- **Security**: Built-in sanitization and prepared statement support.

### `User.php`
Handles authentication, role management (User to Admin), and profile synchronization.

---

## 4. Frontend Design: The "Zenith-Tier" Standard

We do not build standard MVPs. We build **Cinematic Digital Surfaces**.

### Aesthetics
- **Glassmorphism 2.0**: Heavy use of `backdrop-blur`, `bg-white/10`, and layered shadows.
- **Dark Mode First**: OLED-optimized colors using HSL-based palettes.
- **Typography**: Professional, modern fonts (Outfit, Inter) with fluid scaling via `clamp()`.

### Global State & Real-time
- **`global_timer.js`**: Syncs the active Pomodoro timer across all browser tabs using `localStorage` and `storage` events.
- **`stream_waiter.js`**: Handles server-side notifications and status updates (Online/Away) in real-time.
- **`heartbeat_engine.js`**: Provides periodic health checks and data synchronization.

---

## 5. Functional Modules

### A. Time Management (`/time`)
- **Pomodoro Engine**: A high-performance timer that runs in the browser. It persists even on page refresh.
- **Live Session Indicator**: A global topbar element that keeps the user focused on their task regardless of the current page.

### B. Money Management (`/money`)
- **Financial Tracker**: Real-time income and expense logging with categorized accounts.
- **Lending System**: Specialized logic for tracking money lent or borrowed.

### C. Identity & Social (`/u/`)
- **Public Profiles**: Vanity URLs for every user.
- **Online Tracking**: Visual indicators for user availability and activity.

---

## 6. Developer Guidelines

1.  **Atomic Components**: Keep UI elements reusable and scoped.
2.  **Early Returns**: Use guard clauses in functions to keep code flat and readable.
3.  **Zero Trace**: Delete temporary test scripts and construction artifacts before commits.
4.  **Security First**: Never trust client-side data. Always sanitize via `Base::sanitize()` or `Security::sanitizeInput()`.

**Welcome aboard. Let's build something extraordinary.**
