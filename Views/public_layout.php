<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="description" content="<?php echo $pageDescription ?? 'zomzam.com - Modern, secure web application'; ?>">
  <title><?php echo $pageTitle ?? 'Welcome - zomzam.com'; ?></title>
  
  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/Assets/Img/favicon.ico">
  
  <!-- Preconnect for performance -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  
  <!-- Modern Typography (Inter for pristine UI) -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class', // We can toggle this later
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
              hover: '#f8fafc',
            }
          },
          boxShadow: {
            'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
            'apple': '0 4px 24px -6px rgba(0, 0, 0, 0.08)',
          }
        }
      }
    }
  </script>
  
  <style>
    /* Custom Utilities & Glassmorphism */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    .glass-nav {
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }

    .dark .glass-nav {
      background: rgba(17, 19, 24, 0.7);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .nav-link {
      position: relative;
      transition: color 0.3s ease;
    }
    
    .nav-link::after {
      content: '';
      position: absolute;
      width: 0;
      height: 2px;
      bottom: -4px;
      left: 0;
      background-color: #EE5712;
      transition: width 0.3s ease;
    }
    
    .nav-link:hover::after {
      width: 100%;
    }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 dark:bg-surface-dark dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300">
  
  <!-- Navigation (Apple-style Glassmorphism) -->
  <nav class="fixed w-full top-0 z-50 glass-nav transition-all duration-300">
    <div class="max-w-7xl mx-auto px-6 lg:px-8">
      <div class="flex items-center justify-between h-20">
        
        <!-- Logo -->
        <a href="/" class="flex-shrink-0 flex items-center gap-3 group">
          <img src="/Assets/Img/logo-word-horizontal-orange.svg" alt="zomzam.com" class="h-8 transition-transform duration-300 group-hover:scale-105">
        </a>

        <!-- Desktop Menu -->
        <div class="hidden md:flex items-center gap-8">
          <a href="/" class="nav-link text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"><zlang key="nav_home">Home</zlang></a>
          <a href="#features" class="nav-link text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"><zlang key="nav_features">Features</zlang></a>
          <a href="#about" class="nav-link text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"><zlang key="nav_about">About</zlang></a>
        </div>

        <!-- CTA Buttons & Language Switcher -->
        <div class="hidden md:flex items-center gap-4">
          <!-- Language Switcher Dropdown -->
          <div class="relative group border-r border-slate-200 dark:border-slate-700 pr-4 mr-1">
            <button class="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-primary-500 dark:text-slate-400 transition-colors py-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
            </button>
            <div class="absolute right-4 top-full pt-1 hidden group-hover:block z-50">
              <div class="w-32 bg-white dark:bg-surface-dark rounded-xl shadow-glass border border-slate-100 dark:border-slate-800 py-2 overflow-hidden">
                <button onclick="switchLanguage('en')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">English</button>
                <button onclick="switchLanguage('ar')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">العربية</button>
                <button onclick="switchLanguage('es')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Español</button>
                <button onclick="switchLanguage('it')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Italiano</button>
                <button onclick="switchLanguage('fr')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">Français</button>
                <button onclick="switchLanguage('he')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">עברית</button>
                <button onclick="switchLanguage('zh')" class="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-500 transition-colors">中文</button>
              </div>
            </div>
          </div>
          <a href="/sign" class="text-sm font-semibold text-slate-900 dark:text-white hover:text-primary-500 dark:hover:text-primary-400 transition-colors"><zlang key="nav_signin">Sign In</zlang></a>
          <a href="/sign#signup" class="text-sm font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-5 py-2.5 rounded-full hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-apple hover:shadow-lg transform hover:-translate-y-0.5"><zlang key="nav_get_started">Get Started</zlang></a>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden flex items-center">
          <button type="button" class="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white focus:outline-none p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
        
      </div>
    </div>
  </nav>
  
  <!-- Main Content Area -->
  <main class="flex-grow pt-20">
    <?php echo $content ?? ''; ?>
  </main>
  
  <!-- Minimalist Footer -->
  <footer class="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-sm py-12 mt-auto">
    <div class="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
      <div class="flex items-center gap-2">
        <div class="w-6 h-6 bg-gradient-to-br from-primary-500 to-primary-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
          Z
        </div>
        <span class="text-slate-900 dark:text-white font-semibold text-sm">zomzam.com</span>
      </div>
      
      <p class="text-slate-500 dark:text-slate-400 text-sm">
        &copy; <?php echo date('Y'); ?> All rights reserved. Built with precision.
      </p>
      
      <div class="flex gap-6">
        <a href="#" class="text-slate-400 hover:text-primary-500 transition-colors"><span class="sr-only">Twitter</span><svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg></a>
        <a href="#" class="text-slate-400 hover:text-primary-500 transition-colors"><span class="sr-only">GitHub</span><svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd"/></svg></a>
      </div>
    </div>
  </footer>

  <!-- Translator Integration -->
  <script src="/Assets/Js/translator.js?v=<?php echo filemtime($_SERVER['DOCUMENT_ROOT'] . '/Assets/Js/translator.js'); ?>" zlangu="en"></script>

</body>
</html>
