# zomzam.com 🚀

Professional life and money management platform with **Zenith-Tier architecture** and Cinematic UI/UX design.

## 🎯 Features

✅ **Zenith-Tier Design System** - Cinematic glassmorphism, fluid motion, and OLED-optimized dark modes.
✅ **Modular Architecture** - Highly maintainable decoupled JavaScript modules and centralized API handling.
✅ **Multi-Language Support (i18n)** - Real-time switching between 7 languages with RTL compatibility.
✅ **Time Management Suite** - Pomodoro timer, task stacking, and multi-horizon dream planning.
✅ **Modern Authentication Flow** - Split-pane dynamic Sign In/Sign Up interface.
✅ **Dragon-Tier Upload Security** - 8-layer validation protocol for all user-generated content.
✅ **High-Fidelity Observability** - Structured logging and performance-first engineering.

---

## 🚀 Quick Start

### 1. Database Setup

```bash
# Run database setup script
php setup_db.php
```

This creates the `zomzam_db` database and `users` table with the following test account:

**Test Credentials:**
- **Email:** `test@zomzam.com`
- **Username:** `testuser`
- **Password:** `test1234`

### 2. PHP Extensions Required

Ensure these PHP extensions are enabled in `php.ini`:

```ini
extension=pdo_mysql
extension=mysqli
extension=gd        # Required for secure image processing
extension=mbstring
extension=openssl
```

### 3. Access the Application

```
http://localhost/
```

**Login URL:** `http://localhost/`  
**Dashboard:** `http://localhost/dashboard`  
**Time Module:** `http://localhost/time`

---

## 🛡️ Security Features

### Dragon-Tier Upload Security (8 Layers)

Our profile avatar upload system implements **enterprise-grade security**:

1. **File Size Validation** - Max 2MB, prevents DOS attacks
2. **Real Image Validation** - Verifies actual image format (not just MIME type)
3. **File Type Whitelist** - Only JPG, PNG, GIF, WEBP allowed
4. **Dimension Validation** - Max 5000×5000 pixels, prevents image bombs
5. **Image Re-encoding** - Strips ALL metadata, embedded scripts, and malicious code
6. **Cryptographic Random Filenames** - `random_bytes(16)` prevents path traversal
7. **Upload Directory Hardening** - `.htaccess` blocks PHP execution
8. **Old File Cleanup** - Automatic deletion prevents disk abuse

---

## 🎨 Design System

### The Zenith Aesthetic
We don't use defaults. We build Cinematic Digital Surfaces.

- **Spatial Typography:** Sora/Montserrat (Display), Inter/Outfit (Body).
- **Dimensional Depth:** Layered shadows and backdrop-filter glassmorphism.
- **Motion Grammar:** fluid 60FPS transitions using cubic-bezier curves.
- **Framework:** Tailwind CSS 3.x + Radix-inspired components.

---

## 📁 Project Structure

```
zomzam.com/
├── index.php                 # Landing/login page
├── config.php                # Centralized configuration
├── setup_db.php              # Migration script
├── .htaccess                 # Zenith-Tier routing engine
│
├── Api_handler/              # Decoupled API Service Layer
│   ├── auth.php              # Auth service
│   ├── profile.php           # User profile service
│   └── time_api.php          # Time management service
│
├── Assets/
│   ├── Js/
│   │   ├── Time/             # Modular Time Application
│   │   │   ├── state.js      # Global state management
│   │   │   ├── api.js        # API bridge
│   │   │   ├── render.js     # UI engine
│   │   │   └── ...           # Feature modules
│   │   └── translator.js     # i18n engine
│   └── Css/
│       └── style.css         # Global design tokens
│
├── Models/                   # Data Access Layer
│   ├── Base.php              # Base PDO model
│   └── User.php              # User domain model
│
└── Views/                    # UI Component Layer
    ├── app_layout.php        # Core application wrapper
    ├── Time/                 # Time management views
    └── Money/                # Money management views
```

---

## 👨‍💻 Author

**zomzam.com Development Team**

- Professional life and money management platform
- Zenith-Tier architecture implementation
- Cinematic UI/UX with Tailwind CSS

---

**Version:** 2.0.0 (Modular Refactor)  
**Last Updated:** May 12, 2026  
**Status:** Zenith-Tier 🚀
