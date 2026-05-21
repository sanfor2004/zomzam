<?php
/**
 * Change Password Page
 * 
 * Allow users to change their password (requires old password verification)
 */

require_once __DIR__ . '/../../config.php';

// Start session only if not already started
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

$pageTitle = 'Change Password - zomzam.com';
$pageDescription = 'Update your account password';

// Start building page content
ob_start();
?>

<div id="zz-view-container" class="max-w-6xl mx-auto p-4 md:p-8">

<div class="max-w-4xl mx-auto space-y-6">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Change Password</h1>
    <p class="text-slate-500 dark:text-slate-400">Update your account security and password</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Form Section -->
    <div class="lg:col-span-2">
      <div class="bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-apple">
        
        <!-- Success/Error Messages -->
        <div id="passwordMessage" class="hidden mb-6 p-4 rounded-xl text-sm font-medium"></div>

        <form id="changePasswordForm" class="space-y-6">
          
          <!-- Current Password -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Current Password</label>
            <input 
              type="password" 
              name="current_password"
              required
              placeholder="Enter your current password"
              class="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
            >
            <p class="text-xs text-slate-500 mt-2">
              <a href="/forgot-password" class="text-primary-500 hover:text-primary-600 font-medium transition-colors">Forgot your password?</a>
            </p>
          </div>

          <!-- New Password -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">New Password</label>
            <input 
              type="password" 
              name="new_password"
              required
              minlength="8"
              placeholder="Enter your new password"
              class="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
            >
            <p class="text-xs text-slate-400 mt-1.5">Minimum 8 characters</p>
          </div>

          <!-- Confirm New Password -->
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Confirm New Password</label>
            <input 
              type="password" 
              name="confirm_password"
              required
              minlength="8"
              placeholder="Re-enter your new password"
              class="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
            >
          </div>

          <!-- Password Strength Indicator -->
          <div id="passwordStrength" class="hidden pt-2">
            <div class="flex gap-1.5 mb-2">
              <div class="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors duration-300"></div>
              <div class="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors duration-300"></div>
              <div class="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors duration-300"></div>
              <div class="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors duration-300"></div>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400 font-medium" id="strengthText"></p>
          </div>

          <!-- Buttons -->
          <div class="flex flex-col sm:flex-row gap-4 pt-4">
            <button 
              type="submit"
              class="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98] inline-flex items-center justify-center gap-2"
            >
              Update Password
            </button>
            <a href="/me" class="px-8 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition-all text-center">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>

    <!-- Security Tips -->
    <div class="lg:col-span-1">
      <div class="bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 p-6 shadow-apple sticky top-24">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Security Tips
        </h3>
        <ul class="space-y-3 text-slate-600 dark:text-slate-400 text-sm">
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Use at least 8 characters with a mix of letters, numbers, and symbols</span>
          </li>
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Don't use personal information or common words</span>
          </li>
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Use a unique password for each account</span>
          </li>
          <li class="flex items-start gap-3">
            <svg class="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Consider using a password manager</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</div>

<script>
// Password strength checker
document.querySelector('[name="new_password"]').addEventListener('input', function(e) {
  const password = e.target.value;
  const strengthDiv = document.getElementById('passwordStrength');
  
  if (password.length === 0) {
    strengthDiv.classList.add('hidden');
    return;
  }
  
  strengthDiv.classList.remove('hidden');
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
  if (password.match(/\d/)) strength++;
  if (password.match(/[^a-zA-Z\d]/)) strength++;
  
  const bars = strengthDiv.querySelectorAll('.h-1\\.5');
  const strengthText = document.getElementById('strengthText');
  
  bars.forEach((bar, index) => {
    if (index < strength) {
      if (strength === 1) bar.className = 'h-1.5 flex-1 rounded-full bg-red-500 transition-colors duration-300';
      else if (strength === 2) bar.className = 'h-1.5 flex-1 rounded-full bg-orange-500 transition-colors duration-300';
      else if (strength === 3) bar.className = 'h-1.5 flex-1 rounded-full bg-yellow-500 transition-colors duration-300';
      else bar.className = 'h-1.5 flex-1 rounded-full bg-green-500 transition-colors duration-300';
    } else {
      bar.className = 'h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors duration-300';
    }
  });
  
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  strengthText.textContent = 'Password strength: ' + labels[strength - 1];
});

function showMessage(message, isSuccess) {
  const messageDiv = document.getElementById('passwordMessage');
  messageDiv.classList.remove('hidden');
  
  if (isSuccess) {
    messageDiv.className = 'mb-6 p-4 rounded-xl bg-green-50/50 border border-green-200 text-green-700 flex items-center gap-2.5';
    messageDiv.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' + message;
  } else {
    messageDiv.className = 'mb-6 p-4 rounded-xl bg-red-50/50 border border-red-200 text-red-700 flex items-center gap-2.5';
    messageDiv.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>' + message;
  }
}

// Handle form submission
document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const currentPassword = document.querySelector('[name="current_password"]').value;
  const newPassword = document.querySelector('[name="new_password"]').value;
  const confirmPassword = document.querySelector('[name="confirm_password"]').value;
  
  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showMessage('New passwords do not match!', false);
    return;
  }
  
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Updating...';
  
  try {
    const response = await fetch('/api/profile/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMessage(result.message, true);
      
      // Clear form
      document.getElementById('changePasswordForm').reset();
      document.getElementById('passwordStrength').classList.add('hidden');
      
      // Redirect after success
      setTimeout(() => window.location.href = '/me', 2000);
    } else {
      showMessage(result.message, false);
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('An error occurred. Please try again.', false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
});
</script>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
