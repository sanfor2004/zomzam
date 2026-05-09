# zomzam.com - Modern Web Application

A clean, minimal, and production-ready PHP web application with authentication, RESTful API, and modern frontend architecture.

## 🚀 Features

- **User Authentication System** - Secure registration, login, and logout
- **RESTful API** - JSON-based API endpoints for all operations
- **Session Management** - Secure session-based authentication
- **MVC Architecture** - Clean separation of concerns
- **Modern UI** - Responsive layouts for public and authenticated users
- **Database Auto-Sync** - Automatic schema synchronization
- **Security First** - Password hashing, input validation, SQL injection protection

## 📁 Project Structure

```
zomzam-com/
├── config.php                      # Application configuration & database connection
├── setup_db.php                    # Database setup and synchronization script
├── README.md                       # This file
│
├── Models/                         # Data layer (Database models)
│   ├── Base.php                    # Base model with common functionality
│   └── User.php                    # User model (authentication & user management)
│
├── Views/                          # Presentation layer (UI templates)
│   ├── public_layout.php           # Layout for public pages (landing, login, signup)
│   ├── app_layout.php              # Layout for authenticated users (dashboard)
│   ├── Landing/
│   │   └── main.php                # Main dashboard page
│   └── Errors/
│       ├── 403.php                 # Forbidden error page
│       ├── 404.php                 # Not found error page
│       └── 500.php                 # Server error page
│
├── Api_handler/                    # RESTful API endpoints
│   ├── .htaccess                   # API routing and CORS configuration
│   ├── index.php                   # API documentation endpoint
│   ├── auth.php                    # Authentication endpoints (login, register, logout)
│   └── user.php                    # User profile endpoints (profile, update, delete)
│
└── Assets/                         # Static resources
    ├── Css/
    │   └── style.css               # Global styles
    ├── Js/
    │   └── translator.js           # JavaScript utilities
    └── Img/                        # Images and icons
```

## 🛠️ Installation & Setup

### Prerequisites

- PHP 7.4 or higher
- MySQL 5.7 or higher
- Apache/Nginx web server
- Composer (optional, for dependencies)

### Step 1: Clone/Download Project

```bash
cd c:/www
# Your project is already here: c:/www/zomzam-com
```

### Step 2: Configure Database

Edit `config.php` and update database credentials:

```php
// Development Database
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'zomzam_test');
define('DB_USER', 'root');
define('DB_PASS', '');
```

### Step 3: Create Database

Create an empty database:

```sql
CREATE DATABASE zomzam_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 4: Run Database Setup

Execute the database synchronization script to create tables:

**Via Browser:**
```
http://localhost.zomzam/setup_db.php?run=yes
```

**Via Command Line:**
```bash
php setup_db.php
```

This will create the `users` table with the following structure:
- `id` - Auto-incrementing primary key
- `username` - Unique username
- `email` - Unique email address
- `password` - Bcrypt hashed password
- `role` - User role (user/admin)
- `avatar` - Profile picture URL
- `bio` - User biography
- `last_active_at` - Last activity timestamp
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

### Step 5: Test the Application

Visit your application:
```
http://localhost.zomzam/
```

## 🔌 API Documentation

All API endpoints return JSON responses.

### Base URL
```
http://localhost.zomzam/Api_handler/
```

### Authentication Endpoints

#### 1. Register User
```http
POST /Api_handler/auth.php?action=register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

#### 2. Login
```http
POST /Api_handler/auth.php?action=login
Content-Type: application/json

{
  "identifier": "johndoe",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### 3. Logout
```http
POST /Api_handler/auth.php?action=logout
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### 4. Check Authentication Status
```http
GET /Api_handler/auth.php?action=check
```

**Response (200 OK):**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

### User Profile Endpoints

**Note:** All profile endpoints require authentication (active session).

#### 1. Get User Profile
```http
GET /Api_handler/user.php?action=profile&id=1
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Web developer",
    "created_at": "2026-05-08 10:30:00"
  }
}
```

#### 2. Update Profile
```http
POST /Api_handler/user.php?action=update
Content-Type: application/json

{
  "username": "john_doe",
  "bio": "Full-stack developer",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

#### 3. Change Password
```http
POST /Api_handler/user.php?action=change_password
Content-Type: application/json

{
  "current_password": "oldpassword123",
  "new_password": "newpassword456"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### 4. Delete Account
```http
DELETE /Api_handler/user.php?action=delete
Content-Type: application/json

{
  "password": "currentpassword"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## 🎨 Frontend Integration

### Using Public Layout

For public pages (landing, login, signup):

```php
<?php
require_once __DIR__ . '/../../config.php';

$pageTitle = 'Login - zomzam.com';
$pageDescription = 'Login to your account';

ob_start();
?>

<!-- Your page content here -->
<div class="login-form">
  <h2>Login</h2>
  <!-- Form fields -->
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../public_layout.php';
?>
```

### Using App Layout

For authenticated pages (dashboard, profile):

```php
<?php
require_once __DIR__ . '/../../config.php';

$pageTitle = 'Dashboard';

ob_start();
?>

<!-- Your dashboard content here -->
<div class="card">
  <h2>Welcome to Dashboard</h2>
  <!-- Dashboard widgets -->
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
```

### JavaScript API Integration Example

```javascript
// Register new user
async function registerUser(username, email, password) {
  const response = await fetch('/Api_handler/auth.php?action=register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, email, password })
  });
  
  const result = await response.json();
  return result;
}

// Login user
async function loginUser(identifier, password) {
  const response = await fetch('/Api_handler/auth.php?action=login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ identifier, password })
  });
  
  const result = await response.json();
  return result;
}

// Check auth status
async function checkAuth() {
  const response = await fetch('/Api_handler/auth.php?action=check');
  const result = await response.json();
  return result;
}
```

## 🔐 Security Features

### Password Security
- **Bcrypt Hashing** - All passwords are hashed using bcrypt with cost factor 12
- **Minimum Length** - Passwords must be at least 8 characters
- **No Plain Text** - Passwords are never stored or logged in plain text

### SQL Injection Protection
- **Prepared Statements** - All database queries use PDO prepared statements
- **Parameter Binding** - No string concatenation in SQL queries

### Session Security
- **HTTP-Only Cookies** - Session cookies cannot be accessed via JavaScript
- **Secure Flag** - HTTPS-only cookies in production
- **Session Regeneration** - Session ID regenerated after login
- **SameSite Protection** - CSRF protection via SameSite attribute

### Input Validation
- **Server-Side Validation** - All inputs validated on the server
- **Email Validation** - Proper email format checking
- **Sanitization** - User inputs sanitized before processing

### XSS Protection
- **Output Escaping** - All user-generated content escaped with `htmlspecialchars()`
- **Content Security Policy** - CSP headers in production

## 📊 Database Schema

### users Table

| Column | Type | Description |
|--------|------|-------------|
| id | INT UNSIGNED | Primary key, auto-increment |
| username | VARCHAR(50) | Unique username |
| email | VARCHAR(255) | Unique email address |
| password | VARCHAR(255) | Bcrypt hashed password |
| role | ENUM | User role (user, admin) |
| avatar | VARCHAR(500) | Profile picture URL |
| bio | VARCHAR(500) | User biography |
| last_active_at | DATETIME | Last activity timestamp |
| created_at | DATETIME | Account creation timestamp |
| updated_at | DATETIME | Last update timestamp |

**Indexes:**
- Primary key on `id`
- Unique index on `username`
- Unique index on `email`
- Index on `email` for fast lookups

## 🏗️ Architecture

### MVC Pattern

This application follows the Model-View-Controller architectural pattern:

- **Models** (`/Models/`) - Handle data operations and business logic
  - `Base.php` - Provides database connection and common methods
  - `User.php` - User-specific operations (register, login, profile management)

- **Views** (`/Views/`) - Handle presentation and user interface
  - `public_layout.php` - Layout for public pages
  - `app_layout.php` - Layout for authenticated users
  - Page-specific views in subdirectories

- **Controllers** (`/Api_handler/`) - Handle HTTP requests and responses
  - RESTful API endpoints that process requests and return JSON

### Database Layer

- **PDO** - PHP Data Objects for database abstraction
- **Connection Pooling** - Static connection instance
- **Error Handling** - Exceptions caught and logged
- **Auto-Reconnect** - Database connection health checks

### Session Management

- **PHP Sessions** - Server-side session storage
- **Session Security** - Secure cookies, HTTP-only, SameSite
- **Auto-Logout** - Session expiration on inactivity

## 🚦 Error Handling

### HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid input or parameters
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **405 Method Not Allowed** - HTTP method not supported
- **500 Internal Server Error** - Server error

### Error Logging

All errors are logged to `/Logs/`:
- `auth.log` - Authentication events
- `auth_errors.log` - Authentication errors
- `user.log` - User operations
- `user_errors.log` - User operation errors

## 🧪 Testing

### Manual API Testing

Use tools like:
- **Postman** - GUI-based API testing
- **cURL** - Command-line testing
- **Thunder Client** - VS Code extension

Example cURL commands:

```bash
# Register
curl -X POST http://localhost.zomzam/Api_handler/auth.php?action=register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost.zomzam/Api_handler/auth.php?action=login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"identifier":"testuser","password":"password123"}'

# Check auth (with session)
curl http://localhost.zomzam/Api_handler/auth.php?action=check -b cookies.txt
```

## 📝 Development Guidelines

### Code Style
- **Indentation** - 2 spaces for JS/HTML/CSS
- **Naming** - camelCase for variables, PascalCase for classes
- **Comments** - Document WHY, not WHAT
- **Functions** - Single Responsibility Principle

### Adding New Features

1. **Model** - Create/update model in `/Models/`
2. **API Endpoint** - Create endpoint in `/Api_handler/`
3. **View** - Create view file or update layout
4. **Test** - Test via API and UI

### Database Changes

1. Update `setup_db.php` schema
2. Run `setup_db.php?run=yes`
3. Schema auto-syncs (creates/modifies tables)

## 🔧 Configuration

### Environment Settings

Edit `config.php` to change:

```php
define('ENVIRONMENT', 'development'); // development | production

// Database
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'zomzam_test');
define('DB_USER', 'root');
define('DB_PASS', '');

// Site
define('SITE_NAME', 'zomzam.com');
define('SITE_URL', 'http://localhost.zomzam/');

// Security
define('CSRF_ENABLED', true);
define('SESSION_COOKIE_SECURE', false); // true in production
```

## 📦 Deployment

### Production Checklist

1. **Set Environment**
   ```php
   define('ENVIRONMENT', 'production');
   ```

2. **Update Database Credentials**
   ```php
   define('DB_HOST', 'production-host');
   define('DB_NAME', 'production-db');
   define('DB_USER', 'production-user');
   define('DB_PASS', 'secure-password');
   ```

3. **Enable HTTPS**
   ```php
   define('SESSION_COOKIE_SECURE', true);
   ```

4. **Set Proper Site URL**
   ```php
   define('SITE_URL', 'https://zomzam.com/');
   ```

5. **Disable Error Display**
   ```php
   ini_set('display_errors', 0);
   ini_set('log_errors', 1);
   ```

6. **File Permissions**
   ```bash
   chmod 755 /path/to/zomzam-com
   chmod 644 config.php
   chmod -R 777 Logs/
   ```

## 📞 Support

For issues, questions, or contributions:
- Create an issue in the project repository
- Contact the development team

## 📄 License

This project is proprietary software. All rights reserved.

---

**Built with ❤️ using Dragon-Tier development practices**
