<?php
/**
 * Main Entry Point - Landing Page
 * 
 * This is the main public landing page for the application.
 */

require_once __DIR__ . '/config.php';

$pageTitle = 'Welcome - zomzam.com';
$pageDescription = 'Modern web application with secure authentication';

// Start building page content
ob_start();
?>

<!-- Hero Section -->
<div style="text-align: center; padding: 4rem 0 3rem;">
  <h1 style="font-size: 3.5rem; font-weight: 800; margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--primary-color), var(--primary-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
    Welcome to zomzam.com
  </h1>
  <p style="font-size: 1.25rem; color: var(--text-muted); max-width: 600px; margin: 0 auto 2rem;">
    A modern, secure web application built with clean architecture and best practices.
  </p>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="#register" class="btn btn-primary" style="font-size: 1rem; padding: 0.875rem 2rem;">Get Started</a>
    <a href="#features" class="btn btn-outline" style="font-size: 1rem; padding: 0.875rem 2rem;">Learn More</a>
  </div>
</div>

<!-- Features Section -->
<div id="features" style="margin-top: 4rem;">
  <h2 style="text-align: center; font-size: 2rem; font-weight: 700; margin-bottom: 3rem;">Features</h2>
  
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem;">
    <!-- Feature 1 -->
    <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔐</div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Secure Authentication</h3>
      <p style="color: var(--text-muted); line-height: 1.6;">
        Industry-standard security with bcrypt password hashing, session management, and protection against common vulnerabilities.
      </p>
    </div>

    <!-- Feature 2 -->
    <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">🚀</div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">RESTful API</h3>
      <p style="color: var(--text-muted); line-height: 1.6;">
        Clean, JSON-based API endpoints for all operations. Easy integration with any frontend framework or mobile app.
      </p>
    </div>

    <!-- Feature 3 -->
    <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">🎨</div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Modern UI</h3>
      <p style="color: var(--text-muted); line-height: 1.6;">
        Responsive, beautiful interface built with modern design principles. Works perfectly on all devices.
      </p>
    </div>

    <!-- Feature 4 -->
    <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">⚡</div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Fast & Efficient</h3>
      <p style="color: var(--text-muted); line-height: 1.6;">
        Optimized database queries, efficient caching, and clean code architecture for maximum performance.
      </p>
    </div>

    <!-- Feature 5 -->
    <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">🛡️</div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Security First</h3>
      <p style="color: var(--text-muted); line-height: 1.6;">
        SQL injection prevention, XSS protection, CSRF tokens, and secure session handling built in.
      </p>
    </div>

    <!-- Feature 6 -->
    <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius); border: 1px solid var(--border-color);">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">📚</div>
      <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Well Documented</h3>
      <p style="color: var(--text-muted); line-height: 1.6;">
        Comprehensive documentation, code comments, and API reference for easy development and integration.
      </p>
    </div>
  </div>
</div>

<!-- CTA Section -->
<div id="register" style="background: var(--surface-color); padding: 3rem 2rem; border-radius: var(--radius); text-align: center; margin-top: 4rem; border: 1px solid var(--border-color);">
  <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 1rem;">Ready to Get Started?</h2>
  <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 1.125rem;">
    Create your account and start building amazing things.
  </p>
  
  <!-- Simple Registration Form -->
  <div style="max-width: 400px; margin: 0 auto;">
    <form id="registerForm" style="display: flex; flex-direction: column; gap: 1rem;">
      <input 
        type="text" 
        name="username" 
        placeholder="Username" 
        required
        style="padding: 0.875rem; border: 1px solid var(--border-color); border-radius: var(--radius); font-size: 1rem;"
      >
      <input 
        type="email" 
        name="email" 
        placeholder="Email" 
        required
        style="padding: 0.875rem; border: 1px solid var(--border-color); border-radius: var(--radius); font-size: 1rem;"
      >
      <input 
        type="password" 
        name="password" 
        placeholder="Password (min 8 characters)" 
        required
        style="padding: 0.875rem; border: 1px solid var(--border-color); border-radius: var(--radius); font-size: 1rem;"
      >
      <button type="submit" class="btn btn-primary" style="padding: 0.875rem; font-size: 1rem;">
        Create Account
      </button>
    </form>
    
    <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.875rem;">
      Already have an account? <a href="#login" style="color: var(--primary-color); text-decoration: none; font-weight: 500;">Login here</a>
    </p>
  </div>

  <div id="message" style="margin-top: 1rem; padding: 1rem; border-radius: var(--radius); display: none;"></div>
</div>

<!-- Login Section -->
<div id="login" style="background: var(--surface-color); padding: 3rem 2rem; border-radius: var(--radius); text-align: center; margin-top: 2rem; border: 1px solid var(--border-color);">
  <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 1rem;">Login to Your Account</h2>
  <p style="color: var(--text-muted); margin-bottom: 2rem; font-size: 1.125rem;">
    Access your dashboard and continue where you left off.
  </p>
  
  <!-- Simple Login Form -->
  <div style="max-width: 400px; margin: 0 auto;">
    <form id="loginForm" style="display: flex; flex-direction: column; gap: 1rem;">
      <input 
        type="text" 
        name="identifier" 
        placeholder="Username or Email" 
        required
        style="padding: 0.875rem; border: 1px solid var(--border-color); border-radius: var(--radius); font-size: 1rem;"
      >
      <input 
        type="password" 
        name="password" 
        placeholder="Password" 
        required
        style="padding: 0.875rem; border: 1px solid var(--border-color); border-radius: var(--radius); font-size: 1rem;"
      >
      <button type="submit" class="btn btn-primary" style="padding: 0.875rem; font-size: 1rem;">
        Login
      </button>
    </form>
  </div>

  <div id="loginMessage" style="margin-top: 1rem; padding: 1rem; border-radius: var(--radius); display: none;"></div>
</div>

<script>
// Handle registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = {
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password')
  };
  
  try {
    const response = await fetch('/Api_handler/auth.php?action=register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    const messageDiv = document.getElementById('message');
    
    messageDiv.style.display = 'block';
    if (result.success) {
      messageDiv.style.background = 'var(--success-color)';
      messageDiv.style.color = 'white';
      messageDiv.textContent = result.message + ' - Redirecting to dashboard...';
      
      // Redirect to dashboard after successful registration
      setTimeout(() => {
        window.location.href = '/Views/Landing/main.php';
      }, 1500);
    } else {
      messageDiv.style.background = 'var(--error-color)';
      messageDiv.style.color = 'white';
      messageDiv.textContent = result.message;
    }
  } catch (error) {
    console.error('Registration error:', error);
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'block';
    messageDiv.style.background = 'var(--error-color)';
    messageDiv.style.color = 'white';
    messageDiv.textContent = 'An error occurred. Please try again.';
  }
});

// Handle login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = {
    identifier: formData.get('identifier'),
    password: formData.get('password')
  };
  
  try {
    const response = await fetch('/Api_handler/auth.php?action=login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    const messageDiv = document.getElementById('loginMessage');
    
    messageDiv.style.display = 'block';
    if (result.success) {
      messageDiv.style.background = 'var(--success-color)';
      messageDiv.style.color = 'white';
      messageDiv.textContent = result.message + ' - Redirecting to dashboard...';
      
      // Redirect to dashboard after successful login
      setTimeout(() => {
        window.location.href = '/Views/Landing/main.php';
      }, 1500);
    } else {
      messageDiv.style.background = 'var(--error-color)';
      messageDiv.style.color = 'white';
      messageDiv.textContent = result.message;
    }
  } catch (error) {
    console.error('Login error:', error);
    const messageDiv = document.getElementById('loginMessage');
    messageDiv.style.display = 'block';
    messageDiv.style.background = 'var(--error-color)';
    messageDiv.style.color = 'white';
    messageDiv.textContent = 'An error occurred. Please try again.';
  }
});
</script>

<?php
$content = ob_get_clean();

// Use the public layout
require_once __DIR__ . '/Views/public_layout.php';
?>
