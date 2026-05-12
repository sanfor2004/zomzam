<?php
/**
 * User Profile Page
 * 
 * View and edit user profile information
 */

require_once __DIR__ . '/../../config.php';

// Start session only if not already started
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

// Generate CSRF token if not exists
if (!isset($_SESSION['csrf_token'])) {
  $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

// Get user data
$userModel = new User();
$user = $userModel->getUserById($_SESSION['user_id']);

$pageTitle = 'My Profile - zomzam.com';
$pageDescription = 'View and edit your profile';

// Start building page content
ob_start();
?>

<div class="max-w-4xl mx-auto space-y-6">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">My Profile</h1>
    <p class="text-slate-500 dark:text-slate-400">Manage your account information and preferences</p>
  </div>

  <!-- Profile Form -->
  <div class="bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-apple">
    
    <!-- Success/Error Messages -->
    <div id="profileMessage" class="hidden mb-6 p-4 rounded-xl text-sm font-medium"></div>

    <form id="profileForm" class="space-y-8">
      
      <!-- CSRF Token -->
      <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($_SESSION['csrf_token']); ?>">
      
      <!-- Profile Picture -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div class="relative shrink-0">
          <div id="avatarPreview" class="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm border border-primary-500/20">
            <?php if (!empty($user['avatar'])): ?>
              <img src="<?php echo htmlspecialchars($user['avatar']); ?>" alt="Profile" class="w-full h-full object-cover">
            <?php else: ?>
              <?php echo strtoupper(substr($user['username'], 0, 1)); ?>
            <?php endif; ?>
          </div>
        </div>
        <div>
          <div class="flex items-center gap-3">
            <label class="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 font-medium rounded-xl transition-all cursor-pointer shadow-sm active:scale-[0.98]">
              <input type="file" id="avatarInput" name="avatar" accept="image/*" class="hidden">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Change Photo
            </label>
            <?php if (!empty($user['avatar'])): ?>
            <button type="button" onclick="removeAvatar()" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
              Remove
            </button>
            <?php endif; ?>
          </div>
          <p class="text-sm text-slate-500 mt-2.5">JPG, PNG, GIF or WEBP (Max 2MB)</p>
          <p class="text-xs text-slate-400 mt-1">Images are automatically optimized</p>
        </div>
      </div>

      <hr class="border-slate-100 dark:border-slate-800">

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Username (Read-only) -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Username</label>
          <input 
            type="text" 
            value="<?php echo htmlspecialchars($user['username']); ?>"
            disabled
            class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
          >
          <p class="text-xs text-slate-400 mt-1.5">Username cannot be changed</p>
        </div>

        <!-- Email (Read-only) -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email</label>
          <input 
            type="email" 
            value="<?php echo htmlspecialchars($user['email']); ?>"
            disabled
            class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 cursor-not-allowed"
          >
          <p class="text-xs text-slate-400 mt-1.5">Email cannot be changed</p>
        </div>

        <!-- First Name -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">First Name</label>
          <input 
            type="text" 
            name="first_name"
            value="<?php echo htmlspecialchars($user['first_name'] ?? ''); ?>"
            placeholder="Enter your first name"
            class="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
          >
        </div>

        <!-- Last Name -->
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Last Name</label>
          <input 
            type="text" 
            name="last_name"
            value="<?php echo htmlspecialchars($user['last_name'] ?? ''); ?>"
            placeholder="Enter your last name"
            class="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none"
          >
        </div>
      </div>

      <!-- Bio -->
      <div>
        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Bio</label>
        <textarea 
          name="bio"
          rows="4"
          placeholder="Tell us about yourself..."
          class="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none resize-none"
        ><?php echo htmlspecialchars($user['bio'] ?? ''); ?></textarea>
      </div>

      <!-- Save Button -->
      <div class="flex flex-col sm:flex-row gap-4 pt-4">
        <button 
          type="submit"
          class="px-8 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98] inline-flex items-center justify-center gap-2"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          Save Changes
        </button>
        <a href="/dashboard" class="px-8 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition-all text-center">
          Cancel
        </a>
      </div>
    </form>

  </div>

  <!-- Password Section -->
  <div class="bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-slate-800 p-8 shadow-apple">
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white mb-2">Security & Password</h2>
        <p class="text-slate-500 dark:text-slate-400">Keep your account secure by updating your password regularly.</p>
      </div>
      <a href="/change-password" class="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-medium rounded-xl transition-all shadow-sm active:scale-[0.98]">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Change Password
      </a>
    </div>
  </div>

</div>

<script>
// Client-side file validation constants
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// Handle avatar preview with security validation
document.getElementById('avatarInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const fileExtension = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    alert('Invalid file type. Only JPG, PNG, GIF, and WEBP images are allowed.');
    this.value = '';
    return;
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    alert('Invalid file format. Please select a valid image file.');
    this.value = '';
    return;
  }
  
  if (file.size > MAX_FILE_SIZE) {
    alert('File is too large. Maximum size is 2MB.');
    this.value = '';
    return;
  }
  
  if (file.size < 100) {
    alert('File is too small to be a valid image.');
    this.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      document.getElementById('avatarPreview').innerHTML = '<img src="' + e.target.result + '" alt="Preview" class="w-full h-full object-cover">';
    };
    img.onerror = function() {
      alert('The selected file is not a valid image.');
      document.getElementById('avatarInput').value = '';
    };
    img.src = e.target.result;
  };
  reader.onerror = function() {
    alert('Failed to read file.');
    document.getElementById('avatarInput').value = '';
  };
  reader.readAsDataURL(file);
});

// Handle avatar removal
async function removeAvatar() {
  if (!confirm('Are you sure you want to remove your profile photo?')) return;
  
  const csrfToken = document.querySelector('[name="csrf_token"]').value;
  const formData = new FormData();
  formData.append('csrf_token', csrfToken);
  formData.append('remove_avatar', '1');
  
  try {
    const response = await fetch('/api/profile/update', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMessage(result.message || 'Avatar removed successfully', true);
      setTimeout(() => location.reload(), 1000);
    } else {
      showMessage(result.message || 'Failed to remove avatar', false);
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('An error occurred while removing the avatar.', false);
  }
}

// Handle form submission
document.getElementById('profileForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const firstName = document.querySelector('[name="first_name"]').value;
  const lastName = document.querySelector('[name="last_name"]').value;
  const bio = document.querySelector('[name="bio"]').value;
  
  if (firstName.length > 100) {
    showMessage('First name is too long (max 100 characters).', false);
    return;
  }
  
  if (lastName.length > 100) {
    showMessage('Last name is too long (max 100 characters).', false);
    return;
  }
  
  if (bio.length > 500) {
    showMessage('Bio is too long (max 500 characters).', false);
    return;
  }
  
  const formData = new FormData();
  formData.append('first_name', firstName);
  formData.append('last_name', lastName);
  formData.append('bio', bio);
  
  const csrfToken = document.querySelector('[name="csrf_token"]').value;
  formData.append('csrf_token', csrfToken);
  
  const avatarFile = document.getElementById('avatarInput').files[0];
  if (avatarFile) {
    const fileExtension = avatarFile.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension) || !ALLOWED_TYPES.includes(avatarFile.type)) {
      showMessage('Invalid file type. Only JPG, PNG, GIF, and WEBP are allowed.', false);
      return;
    }
    
    if (avatarFile.size > MAX_FILE_SIZE) {
      showMessage('File too large. Maximum size is 2MB.', false);
      return;
    }
    
    formData.append('avatar', avatarFile);
  }
  
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<svg class="inline w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Saving...';
  
  try {
    const response = await fetch('/api/profile/update', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      showMessage(result.message, true);
      
      if (result.user && result.user.avatar) {
        document.getElementById('avatarPreview').innerHTML = '<img src="' + result.user.avatar + '?t=' + Date.now() + '" alt="Profile" class="w-full h-full object-cover">';
      }
      
      document.getElementById('avatarInput').value = '';
      
      setTimeout(() => location.reload(), 1500);
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

function showMessage(message, isSuccess) {
  const messageDiv = document.getElementById('profileMessage');
  messageDiv.classList.remove('hidden');
  
  if (isSuccess) {
    messageDiv.className = 'mb-6 p-4 rounded-xl bg-green-50/50 border border-green-200 text-green-700 flex items-center gap-2.5';
    messageDiv.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' + message;
  } else {
    messageDiv.className = 'mb-6 p-4 rounded-xl bg-red-50/50 border border-red-200 text-red-700 flex items-center gap-2.5';
    messageDiv.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>' + message;
  }
  
  messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
</script>

<?php
$content = ob_get_clean();

// Use the authenticated app layout
require_once __DIR__ . '/../app_layout.php';
?>
