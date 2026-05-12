<?php
/**
 * Sign In & Sign Up Page
 * Split View Design
 */

require_once __DIR__ . '/../../config.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
  session_start();
}

// Redirect if already logged in
if (isset($_SESSION['user_id'])) {
  header('Location: /dashboard');
  exit;
}

$pageTitle = 'Sign In to zomzam.com';
$pageDescription = 'Access your Zomzam account';

// We don't use public_layout.php here because we want a full screen custom split layout
?>
<!DOCTYPE html>
<html lang="en" class="h-full antialiased">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo $pageTitle; ?></title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          },
          colors: {
            primary: {
              50: '#fff0eb',
              100: '#ffdcd1',
              200: '#ffbfa8',
              300: '#ff9874',
              400: '#ff6633',
              500: '#EE5712', // Zomzam Orange
              600: '#df3c0b',
              700: '#b92b0b',
              800: '#94240e',
              900: '#77200e',
            },
            surface: {
              light: '#ffffff',
              dark: '#111318',
            }
          },
          boxShadow: {
            'apple': '0 8px 32px -4px rgba(0, 0, 0, 0.1), 0 4px 16px -4px rgba(0, 0, 0, 0.05)',
          }
        }
      }
    }
  </script>
  <script>
    // Theme initialization
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    function toggleTheme() {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
  </script>
</head>
<body class="h-full flex bg-slate-50 dark:bg-[#0f1115] text-slate-900 dark:text-slate-100 selection:bg-primary-500/30">

  <!-- Left Side: Image Box (Hidden on Mobile) -->
  <div class="hidden lg:flex w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center">
    
    <!-- User's Custom Image (Placeholder) -->
    <!-- You can replace this src with your actual drawn image -->
    <img src="/Assets/Img/auth-split-bg.jpg" 
         alt="Zomzam Visuals" 
         class="absolute inset-0 w-full h-full object-cover z-10 opacity-70 mix-blend-screen"
         onerror="this.style.display='none'">
         
    <!-- Fallback beautiful gradient if image is missing -->
    <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#1A1D24] to-primary-900/40 z-0"></div>
    
    <!-- Decorative floating elements -->
    <div class="absolute top-20 left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl z-0"></div>
    <div class="absolute bottom-20 right-20 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl z-0"></div>
    
    <!-- Content Overlay -->
    <div class="relative z-20 flex flex-col items-center justify-center p-12 text-center">
      <img src="/Assets/Img/logo-word-horizontal-white.svg" alt="zomzam.com" class="h-16 mb-8 drop-shadow-lg">
      <h2 class="text-4xl font-bold text-white mb-4 tracking-tight drop-shadow-md">Welcome to the Future</h2>
      <p class="text-lg text-slate-300 max-w-md drop-shadow">Experience a seamless, secure, and intuitive dashboard environment designed for elite performance.</p>
    </div>
  </div>

  <!-- Right Side: Form Box -->
  <div class="w-full lg:w-1/2 relative flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
    
    <!-- Top Right Controls -->
    <div class="absolute top-6 right-6 lg:top-8 lg:right-8 flex items-center gap-3 z-10">
      
      <!-- Theme Toggle -->
      <button onclick="toggleTheme()" class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all bg-white dark:bg-[#1A1D24] shadow-sm">
        <svg class="w-4 h-4 dark:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        <svg class="w-4 h-4 hidden dark:block text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      </button>

      <!-- Language Switcher -->
      <div class="relative group">
        <button class="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-primary-500 dark:text-slate-400 transition-colors bg-white dark:bg-[#1A1D24] px-4 py-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
        </button>
        <div class="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
          <div class="w-32 bg-white dark:bg-[#1A1D24] rounded-xl shadow-glass border border-slate-100 dark:border-slate-800 py-2 overflow-hidden">
            <button onclick="switchLanguage('en')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">English</button>
            <button onclick="switchLanguage('ar')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">العربية</button>
            <button onclick="switchLanguage('es')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">Español</button>
            <button onclick="switchLanguage('it')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">Italiano</button>
            <button onclick="switchLanguage('fr')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">Français</button>
            <button onclick="switchLanguage('he')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">עברית</button>
            <button onclick="switchLanguage('zh')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#252830] hover:text-primary-500 transition-colors">中文</button>
          </div>
        </div>
      </div>

      <!-- Back to Home Button -->
      <a href="/" class="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2 font-medium text-sm bg-white dark:bg-[#1A1D24] px-4 py-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <zlang key="auth_back">Back</zlang>
      </a>
    </div>

    <!-- Main Form Container -->
    <div class="w-full max-w-lg bg-white dark:bg-[#1A1D24] rounded-[2rem] p-8 sm:p-12 shadow-apple border border-slate-100 dark:border-slate-800/60 relative z-0 mt-8 lg:mt-0">
      
      <div class="text-center mb-8">
        <!-- Show logo only on mobile -->
        <div class="lg:hidden flex justify-center mb-6">
          <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com" class="h-10">
        </div>
        <h1 class="text-3xl font-bold text-slate-900 dark:text-white tracking-tight" id="authTitle"><zlang key="auth_signin">Sign In</zlang></h1>
        <p class="text-slate-500 dark:text-slate-400 mt-2" id="authDesc"><zlang key="auth_signin_desc">Welcome back! Please enter your details.</zlang></p>
      </div>

      <!-- Auth Tabs -->
      <div class="flex p-1.5 bg-slate-100 dark:bg-[#0f1115] rounded-2xl mb-8 relative">
        <button onclick="switchTab('signin')" id="tab-signin" class="flex-1 py-3 text-sm font-semibold rounded-xl transition-all shadow-sm bg-white dark:bg-[#252830] text-slate-900 dark:text-white z-10">
          Sign In
        </button>
        <button onclick="switchTab('signup')" id="tab-signup" class="flex-1 py-3 text-sm font-semibold rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white z-10">
          Create Account
        </button>
      </div>

      <div id="authMessage" class="hidden mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-3"></div>

      <!-- Sign In Form -->
      <form id="signInForm" class="space-y-5 transition-all duration-300">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"><zlang key="auth_email">Email Address</zlang></label>
          <input type="email" name="email" required placeholder="name@company.com" class="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none">
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300"><zlang key="auth_password">Password</zlang></label>
            <a href="/forgot-password" class="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors"><zlang key="auth_forgot">Forgot password?</zlang></a>
          </div>
          <input type="password" name="password" required placeholder="••••••••" class="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none">
        </div>
        
        <div class="pt-2">
          <button type="submit" class="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex justify-center items-center gap-2">
            Sign In
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>

      <!-- Sign Up Form -->
      <form id="signUpForm" class="hidden space-y-5 transition-all duration-300">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"><zlang key="auth_fullname">Full Name</zlang></label>
          <input type="text" name="username" required minlength="3" placeholder="John Doe" class="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"><zlang key="auth_email">Email Address</zlang></label>
          <input type="email" name="email" required placeholder="name@company.com" class="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"><zlang key="auth_password">Password</zlang></label>
          <input type="password" name="password" required minlength="8" placeholder="••••••••" class="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none">
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-2"><zlang key="auth_pass_rule">Must be at least 8 characters long.</zlang></p>
        </div>
        
        <div class="pt-2">
          <button type="submit" class="w-full py-4 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex justify-center items-center gap-2">
            Create Account
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        <p class="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
          By signing up, you agree to our <a href="#" class="text-primary-500 hover:underline">Terms of Service</a> and <a href="#" class="text-primary-500 hover:underline">Privacy Policy</a>.
        </p>
      </form>
      
    </div>
  </div>

  <script>
    // Tab Switching Logic
    function switchTab(tab) {
      const signInForm = document.getElementById('signInForm');
      const signUpForm = document.getElementById('signUpForm');
      const tabSignIn = document.getElementById('tab-signin');
      const tabSignUp = document.getElementById('tab-signup');
      const authTitle = document.getElementById('authTitle');
      const authDesc = document.getElementById('authDesc');
      const messageDiv = document.getElementById('authMessage');

      // Clear any messages
      messageDiv.classList.add('hidden');
      
      const activeClasses = ['bg-white', 'dark:bg-[#252830]', 'shadow-sm', 'text-slate-900', 'dark:text-white'];
      const inactiveClasses = ['text-slate-500', 'dark:text-slate-400', 'hover:text-slate-900', 'dark:hover:text-white', 'bg-transparent'];

      if (tab === 'signin') {
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
        
        tabSignIn.classList.add(...activeClasses);
        tabSignIn.classList.remove(...inactiveClasses);
        
        tabSignUp.classList.add(...inactiveClasses);
        tabSignUp.classList.remove(...activeClasses);
        
        authTitle.innerHTML = '<zlang key="auth_signin">Sign In</zlang>';
        authDesc.innerHTML = '<zlang key="auth_signin_desc">Welcome back! Please enter your details.</zlang>';
        if (typeof useLang !== 'undefined') { const t = new zlanguageTranslator(useLang); t.translatePage(); }
        
        // Update URL hash without jumping
        history.replaceState(null, null, ' ');
      } else {
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
        
        tabSignUp.classList.add(...activeClasses);
        tabSignUp.classList.remove(...inactiveClasses);
        
        tabSignIn.classList.add(...inactiveClasses);
        tabSignIn.classList.remove(...activeClasses);
        
        authTitle.innerHTML = '<zlang key="auth_signup">Create Account</zlang>';
        authDesc.innerHTML = '<zlang key="auth_signup_desc">Join us today. Please fill in your details.</zlang>';
        if (typeof useLang !== 'undefined') { const t = new zlanguageTranslator(useLang); t.translatePage(); }
        
        history.replaceState(null, null, '#signup');
      }
    }

    // Check URL Hash on Load
    if (window.location.hash === '#signup') {
      switchTab('signup');
    }

    function showMessage(msg, isSuccess) {
      const messageDiv = document.getElementById('authMessage');
      messageDiv.classList.remove('hidden');
      
      if (isSuccess) {
        messageDiv.className = 'mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400 flex items-start gap-3';
        messageDiv.innerHTML = '<svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><div><p class="font-semibold text-sm">Success</p><p class="text-sm mt-0.5 opacity-90">' + msg + '</p></div>';
      } else {
        messageDiv.className = 'mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 flex items-start gap-3';
        messageDiv.innerHTML = '<svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><div><p class="font-semibold text-sm">Error</p><p class="text-sm mt-0.5 opacity-90">' + msg + '</p></div>';
      }
    }

    // Generic form handler
    async function handleAuth(e, action) {
      e.preventDefault();
      
      const form = e.target;
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn.innerHTML;
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mr-3 inline-block" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Please wait...';
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const response = await fetch('/api/auth?action=' + action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
          showMessage('Authentication successful. Redirecting...', true);
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 1000);
        } else {
          showMessage(result.message, false);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      } catch (error) {
        showMessage('An error occurred. Please try again.', false);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }

    // Attach event listeners
    document.getElementById('signInForm').addEventListener('submit', (e) => handleAuth(e, 'login'));
    document.getElementById('signUpForm').addEventListener('submit', (e) => handleAuth(e, 'register'));
  </script>
  <!-- Translator Integration -->
  <script src="/Assets/Js/translator.js?v=<?php echo filemtime($_SERVER['DOCUMENT_ROOT'] . '/Assets/Js/translator.js'); ?>" zlangu="en"></script>
</body>
</html>
