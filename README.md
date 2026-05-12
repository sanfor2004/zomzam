# zomzam.com 🚀

Professional life and money management platform with **Dragon-Tier security** and modern UI/UX design.

## 🎯 Features

✅ **Multi-Language Support (i18n)** - Real-time switching between 7 languages (EN, AR, ES, IT, FR, HE, ZH) with RTL compatibility.
✅ **Premium Apple-Inspired Design** - Stunning glassmorphism UI, soft shadows, and clean typography using Tailwind CSS.
✅ **Modern Authentication Flow** - Split-pane dynamic Sign In/Sign Up interface.
✅ **Profile Management** - Avatar upload with elite 8-layer security protocols.
✅ **Password Management** - Change password with dynamic strength indicator.
✅ **Session Management** - Secure session handling with CSRF protection.
✅ **Responsive & Accessible** - Flawless scaling from mobile devices to ultrawide desktops.

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

### 3. Configuration

Edit `config.php` for your environment:

```php
define('ENVIRONMENT', 'development'); // development | production
```

**Development:**
- Database: `zomzam_db`
- Host: `localhost`
- URL: `http://localhost/`

**Production:**
- Update database credentials in config.php
- Set `ENVIRONMENT` to `'production'`
- Enable HTTPS and update cookie settings

### 4. Access the Application

```
http://localhost/
```

**Login URL:** `http://localhost/`  
**Dashboard:** `http://localhost/dashboard`  
**Profile:** `http://localhost/profile`

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

### Additional Security

- ✅ **CSRF Protection:** Random 32-byte tokens with timing-attack safe validation
- ✅ **Rate Limiting:** 5 updates per 60 seconds per user
- ✅ **Password Hashing:** bcrypt with cost factor 10
- ✅ **SQL Injection Prevention:** PDO prepared statements
- ✅ **XSS Protection:** htmlspecialchars on all output
- ✅ **Secure Sessions:** HttpOnly, Secure, SameSite=Strict cookies
- ✅ **Input Validation:** Server-side validation on all inputs
- ✅ **CORS Headers:** Configured for API security
- ✅ **Directory Protection:** .htaccess blocks sensitive files

---

## 🎨 Design System

### Color Palette

**Primary Blue** (Trust & Professionalism)
- Primary-500: `#2563eb`
- Primary-600: `#1e40af`
- Primary-700: `#1d4ed8`

**Accent Green** (Success & Growth)
- Accent-500: `#10b981`
- Accent-600: `#059669`

**Neutral Slate**
- Background: `#f8fafc`
- Text: `#1e293b`
- Muted: `#64748b`

### Typography

- **Font Family:** Inter (300, 400, 500, 600, 700, 800)
- **Source:** Google Fonts
- **Purpose:** Clean, modern, highly readable for financial/productivity apps

### Framework

- **CSS Framework:** Tailwind CSS 3.x (via Play CDN)
- **Architecture:** Utility-first responsive design
- **Components:** Custom components with Tailwind utilities

**For complete design documentation, see:** [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)

---

## 📱 Pages & Features

### Public Pages
- **Landing Page** (`/`) - Login/register interface
- **Login** (`/?action=login`) - User authentication
- **Register** (`/?action=register`) - Account creation
- **Forgot Password** (`/forgot-password`) - Password reset

### Authenticated Pages
- **Dashboard** (`/dashboard`) - User dashboard with quick actions
- **Profile** (`/profile`) - View/edit profile with secure avatar upload
- **Change Password** (`/change-password`) - Password management with strength indicator

### Features
- ✅ Top navbar navigation with user dropdown
- ✅ Mobile responsive design with hamburger menu
- ✅ Real-time password strength indicator
- ✅ Avatar upload with preview
- ✅ Success/error message notifications
- ✅ Active page highlighting
- ✅ Logout confirmation
- ✅ CSRF token protection on all forms

---

## 💻 Technology Stack

### Backend
- **Language:** PHP 8.x
- **Database:** MySQL/MariaDB 10.4+
- **PDO:** Database abstraction layer
- **Session Management:** Secure PHP sessions

### Frontend
- **CSS Framework:** Tailwind CSS 3.x
- **JavaScript:** Vanilla ES6+
- **Icons:** Custom SVG icons
- **Fonts:** Inter (Google Fonts)

### Server
- **Web Server:** Apache 2.4+ with mod_rewrite
- **PHP Extensions:** pdo_mysql, mysqli, gd, mbstring, openssl
- **URL Routing:** .htaccess clean URLs

---

## 📁 Project Structure

```
zomzam.com/
├── index.php                 # Landing/login page
├── config.php                # Database & environment config
├── setup_db.php              # Database migration script
├── .htaccess                 # URL routing & security rules
│
├── Api_handler/              # API endpoints
│   ├── auth.php              # Login/register/logout
│   └── profile.php           # Profile update & password change
│
├── Models/                   # Database models
│   ├── Base.php              # Base model with DB connection
│   └── User.php              # User CRUD operations
│
├── Views/                    # View templates
│   ├── public_layout.php     # Public pages layout
│   ├── app_layout.php        # Authenticated app layout (top navbar)
│   ├── Landing/              # Public pages
│   │   └── main.php          # Login/register page
│   └── Dashboard/            # Authenticated pages
│       ├── home.php          # Dashboard home
│       ├── profile.php       # Profile management
│       └── change-password.php  # Password change
│
├── Assets/                   # Static files
│   ├── Css/
│   │   └── style.css         # Global CSS variables
│   ├── Js/
│   │   └── translator.js     # i18n translation script
│   ├── Img/                  # Logo and brand assets
│   │   ├── Icon-white.svg
│   │   ├── Icon-orange.svg
│   │   └── logo-word-*.svg
│   └── Uploads/              # User uploads
│       └── avatars/          # Avatar images
│           └── .htaccess     # Security: blocks script execution
│
├── Logs/                     # Application logs (gitignored)
│
└── Documentation/
    ├── README.md             # This file
    └── DESIGN_SYSTEM.md      # Complete design documentation
```

---

## 🗄️ Database Schema

### users Table

| Column | Type | Null | Description |
|--------|------|------|-------------|
| `id` | INT UNSIGNED | No | Primary key, auto-increment |
| `username` | VARCHAR(50) | No | Unique username (3-50 chars) |
| `first_name` | VARCHAR(100) | Yes | User's first name |
| `last_name` | VARCHAR(100) | Yes | User's last name |
| `email` | VARCHAR(255) | No | Unique email address |
| `password` | VARCHAR(255) | No | Bcrypt hashed password |
| `role` | ENUM('user','admin') | No | User role (default: 'user') |
| `avatar` | VARCHAR(500) | Yes | Avatar image path |
| `bio` | VARCHAR(500) | Yes | User biography (max 500 chars) |
| `created_at` | DATETIME | No | Account creation timestamp |
| `updated_at` | DATETIME | No | Last profile update timestamp |
| `last_active_at` | DATETIME | Yes | Last activity timestamp |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`username`)
- UNIQUE KEY (`email`)

**Default Charset:** utf8mb4  
**Collation:** utf8mb4_general_ci

---

## 🔌 API Endpoints

### Authentication

**POST** `/api/auth` - User authentication operations  
- Login: `?action=login` (identifier + password)
- Register: `?action=register` (username + email + password)
- Logout: `?action=logout`

### Profile Management

**POST** `/api/profile/update` - Update user profile  
- Accepts: first_name, last_name, bio, avatar (file upload)
- Security: CSRF token required, rate limited (5/min)
- Avatar: Automatic security processing (re-encoding, sanitization)

**POST** `/api/profile/change-password` - Change password  
- Requires: current_password, new_password, new_password_confirm
- Validation: Password strength checking

---

## 🚀 Deployment

### Requirements
- **PHP:** 8.0 or higher
- **MySQL/MariaDB:** 5.7+ / 10.4+
- **Apache:** 2.4+ with mod_rewrite enabled
- **PHP Extensions:** pdo_mysql, mysqli, gd, mbstring, openssl

### Production Setup

1. **Update Configuration**
```php
// config.php
define('ENVIRONMENT', 'production');
```

2. **Secure File Permissions**
```bash
chmod 755 /path/to/zomzam.com
chmod 644 /path/to/zomzam.com/config.php
chmod 777 /path/to/zomzam.com/Assets/Uploads/avatars
chmod 644 /path/to/zomzam.com/Assets/Uploads/avatars/.htaccess
```

3. **Enable HTTPS**
- Update Apache VirtualHost to force HTTPS
- Update session cookie settings for secure flag

4. **Database Security**
- Use strong database passwords
- Restrict database user privileges
- Enable MySQL slow query log

5. **Monitoring**
- Enable error logging
- Monitor upload directory size
- Set up automated backups

---

## 🧪 Testing

### Manual Testing Checklist

**Authentication:**
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Register new account
- ✅ Logout functionality

**Profile:**
- ✅ Update first name, last name, bio
- ✅ Upload avatar (JPG, PNG, GIF, WEBP)
- ✅ Test upload security (try PHP file)
- ✅ Test file size limit (>2MB)
- ✅ Test rate limiting (6 rapid updates)

**Password:**
- ✅ Change password with correct old password
- ✅ Change password with wrong old password
- ✅ Password strength indicator
- ✅ Password confirmation matching

**Security:**
- ✅ CSRF token validation
- ✅ Session timeout
- ✅ XSS prevention
- ✅ SQL injection prevention
- ✅ Upload directory script execution blocked

---

## 📝 Development Notes

### Code Standards
- **PHP:** PSR-12 coding standards (4 spaces indentation)
- **JavaScript:** ES6+ with 2 spaces indentation
- **HTML/CSS:** 2 spaces indentation
- **Strings:** Single quotes for standard strings, double for interpolation

### Architecture Principles
- **MVC Pattern:** Strict separation of Models, Views, Controllers
- **Single Responsibility:** Each function has one clear purpose
- **Early Returns:** Guard clauses to reduce nesting
- **Security First:** All inputs validated, all outputs escaped
- **Documentation:** JSDoc/PHPDoc for all functions

### Git Workflow
```bash
# Feature development
git checkout -b feature/new-feature
git commit -m "Add: Description of feature"
git push origin feature/new-feature

# Bug fixes
git checkout -b fix/bug-description
git commit -m "Fix: Description of bug fix"
```

---

## 📚 Documentation

- **[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)** - Complete UI/UX design guide

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add: amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - feel free to use for any project.

---

## 👨‍💻 Author

**zomzam.com Development Team**

- Professional life and money management platform
- Dragon-Tier security implementation
- Modern UI/UX with Tailwind CSS

---

## 🔗 Quick Links

- **Live Demo:** http://localhost/
- **Dashboard:** http://localhost/dashboard
- **Profile:** http://localhost/profile
- **Documentation:** See `/docs` folder

---

**Version:** 1.0.0  
**Last Updated:** May 11, 2026  
**Status:** Production Ready 🚀
