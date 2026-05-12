<?php
/**
 * Forgot Password Page
 * 
 * Password reset for users who forgot their password
 */

require_once __DIR__ . '/../../config.php';

// Start session only if not already started
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$pageTitle = 'Forgot Password - zomzam.com';
$pageDescription = 'Reset your password';

// Start building page content
ob_start();
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo $pageTitle; ?></title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>
    * {
      font-family: 'Inter', sans-serif;
    }
    
    body {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      min-height: 100vh;
    }
  </style>
  
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: { 500: '#EE5712', 600: '#d64d10', 700: '#c4490e' }
          }
        }
      }
    }
  </script>
</head>
<body class="flex items-center justify-center min-h-screen p-4">

  <div class="w-full max-w-md">
    
    <!-- Logo -->
    <div class="text-center mb-8">
      <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com" class="h-12 mx-auto mb-4">
      <h1 class="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
      <p class="text-slate-400">No worries, we'll send you reset instructions</p>
    </div>

    <!-- Forgot Password Form -->
    <div class="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700 p-8 shadow-2xl">
      
      <!-- Success/Error Messages -->
      <div id="resetMessage" class="hidden mb-6 p-4 rounded-lg"></div>

      <!-- Email Form (Step 1) -->
      <form id="emailForm" class="space-y-6">
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">
            <i class="fas fa-envelope mr-2"></i>Email Address
          </label>
          <input 
            type="email" 
            name="email"
            required
            placeholder="Enter your email"
            class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-orange-600 focus:ring-2 focus:ring-orange-600/20 transition-all outline-none"
          >
          <p class="text-xs text-slate-500 mt-2">We'll send a password reset link to this email</p>
        </div>

        <button 
          type="submit"
          class="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-orange-600/50"
        >
          Send Reset Link
        </button>
      </form>

      <!-- Reset Form (Step 2 - Hidden by default) -->
      <form id="resetForm" class="space-y-6 hidden">
        <input type="hidden" name="reset_token" id="resetToken">
        
        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">
            <i class="fas fa-key mr-2"></i>New Password
          </label>
          <input 
            type="password" 
            name="new_password"
            required
            minlength="8"
            placeholder="Enter your new password"
            class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-orange-600 focus:ring-2 focus:ring-orange-600/20 transition-all outline-none"
          >
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-300 mb-2">
            <i class="fas fa-check-circle mr-2"></i>Confirm Password
          </label>
          <input 
            type="password" 
            name="confirm_password"
            required
            minlength="8"
            placeholder="Re-enter your new password"
            class="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-orange-600 focus:ring-2 focus:ring-orange-600/20 transition-all outline-none"
          >
        </div>

        <button 
          type="submit"
          class="w-full px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-orange-600/50"
        >
          Reset Password
        </button>
      </form>

      <!-- Back to Login -->
      <div class="mt-6 text-center">
        <a href="/login" class="text-orange-500 hover:text-orange-400 text-sm font-medium">
          <i class="fas fa-arrow-left mr-2"></i>Back to Sign In
        </a>
      </div>
    </div>

    <!-- Additional Info -->
    <div class="mt-6 text-center text-sm text-slate-500">
      <p>Need help? Contact us at <a href="mailto:support@zomzam.com" class="text-orange-500 hover:text-orange-400">support@zomzam.com</a></p>
    </div>

  </div>

  <script>
  // Check if token exists in URL (for step 2)
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');
  
  if (resetToken) {
    // Show reset form, hide email form
    document.getElementById('emailForm').classList.add('hidden');
    document.getElementById('resetForm').classList.remove('hidden');
    document.getElementById('resetToken').value = resetToken;
  }

  // Handle email form submission (Step 1)
  document.getElementById('emailForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.querySelector('[name="email"]').value;
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const result = await response.json();
      const messageDiv = document.getElementById('resetMessage');
      
      messageDiv.classList.remove('hidden');
      if (result.success) {
        messageDiv.className = 'mb-6 p-4 rounded-lg bg-green-500/20 border border-green-500/50 text-green-400';
        messageDiv.innerHTML = '<i class="fas fa-check-circle mr-2"></i>' + result.message;
        
        // For demo purposes, show the reset form immediately
        // In production, user would click link from email
        if (result.demo_token) {
          setTimeout(() => {
            document.getElementById('emailForm').classList.add('hidden');
            document.getElementById('resetForm').classList.remove('hidden');
            document.getElementById('resetToken').value = result.demo_token;
            messageDiv.classList.add('hidden');
          }, 2000);
        }
      } else {
        messageDiv.className = 'mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400';
        messageDiv.innerHTML = '<i class="fas fa-times-circle mr-2"></i>' + result.message;
      }
    } catch (error) {
      console.error('Error:', error);
      const messageDiv = document.getElementById('resetMessage');
      messageDiv.classList.remove('hidden');
      messageDiv.className = 'mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400';
      messageDiv.innerHTML = '<i class="fas fa-times-circle mr-2"></i>An error occurred. Please try again.';
    }
  });

  // Handle reset form submission (Step 2)
  document.getElementById('resetForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const token = document.getElementById('resetToken').value;
    const newPassword = document.querySelector('#resetForm [name="new_password"]').value;
    const confirmPassword = document.querySelector('#resetForm [name="confirm_password"]').value;
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      const messageDiv = document.getElementById('resetMessage');
      messageDiv.classList.remove('hidden');
      messageDiv.className = 'mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400';
      messageDiv.innerHTML = '<i class="fas fa-times-circle mr-2"></i>Passwords do not match!';
      return;
    }
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          new_password: newPassword
        })
      });
      
      const result = await response.json();
      const messageDiv = document.getElementById('resetMessage');
      
      messageDiv.classList.remove('hidden');
      if (result.success) {
        messageDiv.className = 'mb-6 p-4 rounded-lg bg-green-500/20 border border-green-500/50 text-green-400';
        messageDiv.innerHTML = '<i class="fas fa-check-circle mr-2"></i>' + result.message;
        
        // Redirect to login
        setTimeout(() => window.location.href = '/login', 2000);
      } else {
        messageDiv.className = 'mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400';
        messageDiv.innerHTML = '<i class="fas fa-times-circle mr-2"></i>' + result.message;
      }
    } catch (error) {
      console.error('Error:', error);
      const messageDiv = document.getElementById('resetMessage');
      messageDiv.classList.remove('hidden');
      messageDiv.className = 'mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400';
      messageDiv.innerHTML = '<i class="fas fa-times-circle mr-2"></i>An error occurred. Please try again.';
    }
  });
  </script>

</body>
</html>

<?php
ob_end_flush();
?>
