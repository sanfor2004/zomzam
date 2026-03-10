<?php
// Cache version for images - update this when images change
$imageVersion = '1.0.0';
?><!DOCTYPE html>
<html lang="en">
<head>
    <!-- Essential Meta Tags -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <!-- Primary Meta Tags -->
    <title>ZomZam</title>
    <meta name="title" content="ZomZam - Great you are here!">
    <meta name="description" content="Welcome to ZomZam - A modern, professional website. Discover our services and content.">
    <meta name="keywords" content="zomzam, website, services, professional">
    <meta name="author" content="ZomZam">
    <meta name="robots" content="index, follow">
    
    <!-- Canonical URL -->
    <link rel="canonical" href="https://www.zomzam.com/">
    
    <!-- Google Fonts - Preconnect for Performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.zomzam.com/">
    <meta property="og:title" content="ZomZam - Great you are here!">
    <meta property="og:description" content="Welcome to ZomZam - A modern, professional website. Discover our services and content.">
    <meta property="og:image" content="https://www.zomzam.com/images/og-image.png?v=<?php echo $imageVersion; ?>">
    <meta property="og:site_name" content="ZomZam">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="https://www.zomzam.com/">
    <meta name="twitter:title" content="ZomZam - Great you are here!">
    <meta name="twitter:description" content="Welcome to ZomZam - A modern, professional website. Discover our services and content.">
    <meta name="twitter:image" content="https://www.zomzam.com/images/twitter-image.png?v=<?php echo $imageVersion; ?>">
    
    <!-- Favicons -->
    <link rel="icon" type="image/x-icon" href="/favicon.ico?v=<?php echo $imageVersion; ?>">
    <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png?v=<?php echo $imageVersion; ?>">
    <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png?v=<?php echo $imageVersion; ?>">
    <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png?v=<?php echo $imageVersion; ?>">
    <link rel="icon" type="image/png" sizes="192x192" href="/images/android-chrome-192x192.png?v=<?php echo $imageVersion; ?>">
    <link rel="icon" type="image/png" sizes="512x512" href="/images/android-chrome-512x512.png?v=<?php echo $imageVersion; ?>">
    
    <!-- Theme Color -->
    <meta name="theme-color" content="#ffffff">
    <meta name="msapplication-TileColor" content="#ffffff">
    
    <!-- Manifest for PWA -->
    <link rel="manifest" href="/manifest.json">
    
    <!-- Stylesheet -->
    <link rel="stylesheet" href="style.css?v=<?php echo $imageVersion; ?>">
    
    <!-- Translation System -->
    <script type="text/javascript" src="translator.js?v=<?php echo $imageVersion; ?>" zlangu="en"></script>
</head>
<body>
    <main>
        <div class="hero-container">
            <div class="hero-top">
                <div class="hero-content">
                    <img src="images/logo.svg?v=<?php echo $imageVersion; ?>" alt="ZomZam Logo" class="logo">
                    <div class="hero-text">
                        <h1 class="company-name"><i><zlang key="company_name"></zlang></i></h1>
                        <p class="tagline"><zlang key="tagline"></zlang></p>
                    </div>
                </div>
                
                <div class="language-selector">
                    <button class="language-btn" id="languageBtn" aria-label="Change Language">
                        <img src="images/flowbite_language-outline.svg?v=<?php echo $imageVersion; ?>" alt="Language">
                        <span id="currentLang"><zlang key="lang_name"></zlang></span>
                        <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 4.5L6 7.5L9 4.5"/>
                        </svg>
                    </button>
                    <div class="language-dropdown" id="languageDropdown">
                        <button class="lang-option" onclick="switchLanguage('en')" data-lang="en">
                            <span class="lang-flag">🇬🇧</span>
                            <span>English</span>
                        </button>
                        <button class="lang-option" onclick="switchLanguage('ar')" data-lang="ar">
                            <span class="lang-flag">🇸🇦</span>
                            <span>العربية</span>
                        </button>
                        <button class="lang-option" onclick="switchLanguage('es')" data-lang="es">
                            <span class="lang-flag">🇪🇸</span>
                            <span>Español</span>
                        </button>
                        <button class="lang-option" onclick="switchLanguage('fr')" data-lang="fr">
                            <span class="lang-flag">🇫🇷</span>
                            <span>Français</span>
                        </button>
                        <button class="lang-option" onclick="switchLanguage('he')" data-lang="he">
                            <span class="lang-flag">🇺🇸</span>
                            <span>עברית</span>
                        </button>
                        <button class="lang-option" onclick="switchLanguage('zh')" data-lang="zh">
                            <span class="lang-flag">🇨🇳</span>
                            <span>中文</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="stats-container">
                <div class="stat-item">
                    <div class="stat-number">20+</div>
                    <div class="stat-label"><zlang key="stat_team"></zlang></div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">120+</div>
                    <div class="stat-label"><zlang key="stat_partners"></zlang></div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">200,000+</div>
                    <div class="stat-label"><zlang key="stat_requests"></zlang></div>
                </div>
            </div>
            
            <p class="company-description">
                <zlang key="description"></zlang>
            </p>
            
            <div class="contact-buttons">
                <a href="mailto:info@zomzam.com" class="contact-btn icon-only email-btn" title="Email us">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="m2 7 10 7 10-7"/>
                    </svg>
                </a>
                <a href="tel:+1234567890" class="contact-btn icon-only phone-btn" title="Call us">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                </a>
                <a href="https://www.linkedin.com/company/zomzam" target="_blank" rel="noopener noreferrer" class="contact-btn icon-only linkedin-btn" title="LinkedIn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                        <rect x="2" y="9" width="4" height="12"/>
                        <circle cx="4" cy="4" r="2"/>
                    </svg>
                </a>
                <a href="https://www.facebook.com/zomzam" target="_blank" rel="noopener noreferrer" class="contact-btn icon-only facebook-btn" title="Facebook">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                    </svg>
                </a>
            </div>
        </div>
    </main>
    
    <script>
        // Language dropdown toggle
        const languageBtn = document.getElementById('languageBtn');
        const languageDropdown = document.getElementById('languageDropdown');
        
        languageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            languageDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            languageDropdown.classList.remove('show');
        });
        
        // Prevent dropdown from closing when clicking inside it
        languageDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    </script>
</body>
</html>