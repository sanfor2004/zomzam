let lenOf = document.getElementsByTagName("script").length;
let ourSrc;
let useLang;
//identify the language we gonna translate to.
for (let i = 0; i < lenOf; i++) {
    ourSrc = document.getElementsByTagName("script")[i];
    if (ourSrc.hasAttribute("zlangu")) {
        useLang = ourSrc.getAttribute('zlangu');
    }
}

// Default to English if no language is specified
if (!useLang) {
    useLang = 'en';
}

// Embedded language configuration (avoids CORS issues)
const ZLANG_CONFIG = {
    "en": {
        "company_name": "zomzam",
        "tagline": "Software Developer />",
        "stat_team": "Team Members",
        "stat_partners": "Partners",
        "stat_requests": "Request Handled",
        "description": "Building innovative software solutions with cutting-edge technology. We transform ideas into powerful digital experiences that drive success and deliver exceptional results for businesses worldwide.",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "English",
        "nav_home": "Home",
        "nav_features": "Features",
        "nav_about": "About",
        "nav_signin": "Sign In",
        "nav_get_started": "Get Started",
        "nav_dashboard": "Dashboard",
        "nav_profile": "Profile",
        "nav_security": "Security",
        "nav_logout": "Logout",
        "nav_overview": "Overview",
        "nav_search": "Search...",
        "auth_back": "Back",
        "auth_signin": "Sign In",
        "auth_signup": "Create Account",
        "auth_signin_desc": "Welcome back! Please enter your details.",
        "auth_signup_desc": "Join us today. Please fill in your details.",
        "auth_email": "Email Address",
        "auth_password": "Password",
        "auth_forgot": "Forgot password?",
        "auth_fullname": "Username",
        "auth_pass_rule": "Must be at least 8 characters long.",
        "auth_terms": "By signing up, you agree to our Terms of Service and Privacy Policy.",
        "nav_time": "Time Management",
        "nav_money": "Money Management",
        "nav_community": "Community",
        "btn_add_task": "Add Task",
        "task_urgent": "Urgent",
        "task_medium": "Medium",
        "task_maybe": "Maybe",
        "task_free": "Free",
        "task_completed": "Completed",
        "task_board": "Task Board",
        "task_active": "Active Tasks",
        "task_placeholder": "What needs to be done?",
        "task_priority": "Priority",
        "task_duration": "Time Block"
    },
    "ar": {
        "company_name": "zomzam",
        "tagline": "مطور برمجيات />",
        "stat_team": "أعضاء الفريق",
        "stat_partners": "الشركاء",
        "stat_requests": "الطلبات المعالجة",
        "description": "نبني حلول برمجية مبتكرة بأحدث التقنيات. نحول الأفكار إلى تجارب رقمية قوية تدفع النجاح وتقدم نتائج استثنائية للشركات في جميع أنحاء العالم.",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "العربية",
        "nav_home": "الرئيسية",
        "nav_features": "الميزات",
        "nav_about": "عنا",
        "nav_signin": "تسجيل الدخول",
        "nav_get_started": "ابدأ الآن",
        "nav_dashboard": "لوحة القيادة",
        "nav_profile": "الملف الشخصي",
        "nav_security": "الأمان",
        "nav_logout": "تسجيل الخروج",
        "nav_overview": "نظرة عامة",
        "nav_search": "بحث...",
        "auth_back": "رجوع",
        "auth_signin": "تسجيل الدخول",
        "auth_signup": "إنشاء حساب",
        "auth_signin_desc": "مرحباً بعودتك! يرجى إدخال بياناتك.",
        "auth_signup_desc": "انضم إلينا اليوم. يرجى ملء بياناتك.",
        "auth_email": "البريد الإلكتروني",
        "auth_password": "كلمة المرور",
        "auth_forgot": "هل نسيت كلمة المرور؟",
        "auth_fullname": "اسم المستخدم",
        "auth_pass_rule": "يجب أن تتكون من 8 أحرف على الأقل.",
        "auth_terms": "بالتسجيل، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا.",
        "nav_time": "إدارة الوقت",
        "nav_money": "إدارة المال",
        "nav_community": "المجتمع",
        "btn_add_task": "إضافة مهمة",
        "task_urgent": "عاجل",
        "task_medium": "متوسط",
        "task_maybe": "ربما",
        "task_free": "حر",
        "task_completed": "المكتملة",
        "task_board": "لوحة المهام",
        "task_active": "المهام النشطة",
        "task_placeholder": "ما الذي يجب القيام به؟",
        "task_priority": "الأولوية",
        "task_duration": "الكتلة الزمنية"
    },
    "es": {
        "company_name": "zomzam",
        "tagline": "Desarrollador de Software />",
        "stat_team": "Miembros del Equipo",
        "stat_partners": "Socios",
        "stat_requests": "Solicitudes Atendidas",
        "description": "Construyendo soluciones de software innovadoras con tecnología de vanguardia. Transformamos ideas en experiencias digitales poderosas que impulsan el éxito y entregan resultados excepcionales para empresas en todo el mundo.",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "Español",
        "nav_home": "Inicio",
        "nav_features": "Características",
        "nav_about": "Acerca de",
        "nav_signin": "Iniciar Sesión",
        "nav_get_started": "Comenzar",
        "nav_dashboard": "Panel",
        "nav_profile": "Perfil",
        "nav_security": "Seguridad",
        "nav_logout": "Cerrar Sesión",
        "nav_overview": "Visión General",
        "nav_search": "Buscar...",
        "auth_back": "Volver",
        "auth_signin": "Iniciar Sesión",
        "auth_signup": "Crear Cuenta",
        "auth_signin_desc": "¡Bienvenido de nuevo! Por favor ingresa tus datos.",
        "auth_signup_desc": "Únete a nosotros hoy. Por favor completa tus datos.",
        "auth_email": "Correo Electrónico",
        "auth_password": "Contraseña",
        "auth_forgot": "¿Olvidaste tu contraseña?",
        "auth_fullname": "Nombre de usuario",
        "auth_pass_rule": "Debe tener al menos 8 caracteres.",
        "auth_terms": "Al registrarte, aceptas nuestros Términos de Servicio y Política de Privacidad.",
        "nav_time": "Gestión del Tiempo",
        "nav_money": "Gestión del Dinero",
        "nav_community": "Comunidad"
    },
    "fr": {
        "company_name": "zomzam",
        "tagline": "Développeur de Logiciels />",
        "stat_team": "Membres de l'Équipe",
        "stat_partners": "Partenaires",
        "stat_requests": "Demandes Traitées",
        "description": "Création de solutions logicielles innovantes avec une technologie de pointe. Nous transformons les idées en expériences numériques puissantes qui favorisent le succès et offrent des résultats exceptionnels aux entreprises du monde entier.",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "Français",
        "nav_home": "Accueil",
        "nav_features": "Caractéristiques",
        "nav_about": "À Propos",
        "nav_signin": "Se Connecter",
        "nav_get_started": "Commencer",
        "nav_dashboard": "Tableau de Bord",
        "nav_profile": "Profil",
        "nav_security": "Sécurité",
        "nav_logout": "Déconnexion",
        "nav_overview": "Aperçu",
        "nav_search": "Recherche...",
        "auth_back": "Retour",
        "auth_signin": "Se Connecter",
        "auth_signup": "Créer un Compte",
        "auth_signin_desc": "Bon retour ! Veuillez entrer vos coordonnées.",
        "auth_signup_desc": "Rejoignez-nous aujourd'hui. Veuillez remplir vos coordonnées.",
        "auth_email": "Adresse E-mail",
        "auth_password": "Mot de Passe",
        "auth_forgot": "Mot de passe oublié ?",
        "auth_fullname": "Nom Complet",
        "auth_pass_rule": "Doit contenir au moins 8 caractères.",
        "auth_terms": "En vous inscrivant, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité.",
        "nav_time": "Gestion du Temps",
        "nav_money": "Gestion de l'Argent"
    },
    "he": {
        "company_name": "zomzam",
        "tagline": "מפתח תוכנה />",
        "stat_team": "חברי צוות",
        "stat_partners": "שותפים",
        "stat_requests": "בקשות טופלו",
        "description": "בונים פתרונות תוכנה חדשניים עם טכנולוגיה מתקדמת. אנו הופכים רעיונות לחוויות דיגיטליות עוצמתיות המניעות הצלחה ומספקות תוצאות יוצאות דופן לעסקים ברחבי העולם.",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "עברית",
        "nav_home": "בית",
        "nav_features": "תכונות",
        "nav_about": "אודות",
        "nav_signin": "התחבר",
        "nav_get_started": "התחל",
        "nav_dashboard": "לוח בקרה",
        "nav_profile": "פרופיל",
        "nav_security": "אבטחה",
        "nav_logout": "התנתק",
        "nav_overview": "סקירה",
        "nav_search": "חפש...",
        "auth_back": "חזור",
        "auth_signin": "התחבר",
        "auth_signup": "צור חשבון",
        "auth_signin_desc": "ברוך שובך! אנא הזן את פרטיך.",
        "auth_signup_desc": "הצטרף אלינו היום. אנא מלא את פרטיך.",
        "auth_email": "כתובת אימייל",
        "auth_password": "סיסמה",
        "auth_forgot": "שכחת סיסמה?",
        "auth_fullname": "שם מלא",
        "auth_pass_rule": "חייב להכיל לפחות 8 תווים.",
        "auth_terms": "בעת ההרשמה, אתה מסכים לתנאי השירות ולמדיניות הפרטיות שלנו.",
        "nav_time": "ניהול זמן",
        "nav_money": "ניהול כספים"
    },
    "zh": {
        "company_name": "zomzam",
        "tagline": "软件开发者 />",
        "stat_team": "团队成员",
        "stat_partners": "合作伙伴",
        "stat_requests": "处理的请求",
        "description": "利用尖端技术构建创新的软件解决方案。我们将想法转化为强大的数字体验，推动成功并为全球企业提供卓越的成果。",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "中文",
        "nav_home": "主页",
        "nav_features": "特性",
        "nav_about": "关于",
        "nav_signin": "登录",
        "nav_get_started": "开始",
        "nav_dashboard": "仪表板",
        "nav_profile": "个人资料",
        "nav_security": "安全",
        "nav_logout": "登出",
        "nav_overview": "概览",
        "nav_search": "搜索...",
        "auth_back": "返回",
        "auth_signin": "登录",
        "auth_signup": "创建帐户",
        "auth_signin_desc": "欢迎回来！请输入您的详细信息。",
        "auth_signup_desc": "今天加入我们。请填写您的详细信息。",
        "auth_email": "电子邮件地址",
        "auth_password": "密码",
        "auth_forgot": "忘记密码？",
        "auth_fullname": "全名",
        "auth_pass_rule": "密码长度至少为 8 个字符。",
        "auth_terms": "注册即表示您同意我们的服务条款和隐私政策。",
        "nav_time": "时间管理",
        "nav_money": "财务管理"
    },
    "it": {
        "company_name": "zomzam",
        "tagline": "Sviluppatore Software />",
        "stat_team": "Membri del Team",
        "stat_partners": "Partner",
        "stat_requests": "Richieste Gestite",
        "description": "Costruire soluzioni software innovative con tecnologie all'avanguardia. Trasformiamo idee in potenti esperienze digitali che guidano il successo e offrono risultati eccezionali per le aziende in tutto il mondo.",
        "email": "info@zomzam.com",
        "phone": "+1 (234) 567-890",
        "lang_name": "Italiano",
        "nav_home": "Home",
        "nav_features": "Caratteristiche",
        "nav_about": "Chi Siamo",
        "nav_signin": "Accedi",
        "nav_get_started": "Inizia",
        "nav_dashboard": "Dashboard",
        "nav_profile": "Profilo",
        "nav_security": "Sicurezza",
        "nav_logout": "Esci",
        "nav_overview": "Panoramica",
        "nav_search": "Cerca...",
        "auth_back": "Indietro",
        "auth_signin": "Accedi",
        "auth_signup": "Crea Account",
        "auth_signin_desc": "Bentornato! Inserisci i tuoi dati.",
        "auth_signup_desc": "Unisciti a noi oggi. Inserisci i tuoi dati.",
        "auth_email": "Indirizzo Email",
        "auth_password": "Password",
        "auth_forgot": "Password dimenticata?",
        "auth_fullname": "Nome Completo",
        "auth_pass_rule": "Deve contenere almeno 8 caratteri.",
        "auth_terms": "Registrandoti, accetti i nostri Termini di Servizio e la nostra Informativa sulla Privacy.",
        "nav_time": "Gestione del Tempo",
        "nav_money": "Gestione del Denaro"
    }
};

// Embedded image configuration for language-specific images (optional)
const ZLANG_IMAGES = {
    "en": {},
    "ar": {},
    "es": {},
    "fr": {},
    "he": {},
    "zh": {},
    "it": {}
};

class zlanguageTranslator {
    constructor(zlangu) {
        this.language = zlangu;
        this.availableLangsData = ZLANG_CONFIG;
        this.imageData = ZLANG_IMAGES;
    }

    availableLanguage() {
        return this.availableLangsData;
    }

    availableImages() {
        return this.imageData;
    }

    translateText(key) {
        const availableLangs = this.availableLanguage();
        if (!availableLangs) {
            return "Error: Language data not loaded.";
        }

        if (!availableLangs[this.language]) {
            return `Error: Language '${this.language}' not found in configuration.`;
        }

        if (availableLangs[this.language][key]) {
            return availableLangs[this.language][key];
        } else {
            return `Key '${key}' not found in language '${this.language}'.`;
        }
    }

    getImage(key) {
        const images = this.availableImages();
        if (!images || !images[this.language]) {
            return null;
        }

        return images[this.language][key] || null;
    }

    translatePage() {
        // Translate text elements
        const zlangElements = document.querySelectorAll('zlang');
        for (const element of zlangElements) {
            const key = element.getAttribute('key');
            if (key) {
                const translatedText = this.translateText(key);
                element.textContent = translatedText;
            } else {
                console.warn("<zlang> tag found without 'key' attribute.");
            }
        }

        // Translate images
        const zlangImgElements = document.querySelectorAll('[zlang-img]');
        for (const element of zlangImgElements) {
            const key = element.getAttribute('zlang-img');
            if (key) {
                const imageSrc = this.getImage(key);
                if (imageSrc) {
                    element.src = imageSrc;
                }
            } else {
                console.warn("Element with zlang-img attribute found without a key value.");
            }
        }
        
        // Update direction for RTL languages
        if (this.language === 'ar' || this.language === 'he') {
            document.documentElement.setAttribute('dir', 'rtl');
            document.body.style.direction = 'rtl';
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
            document.body.style.direction = 'ltr';
        }
    }
}

// Initialize translation when the DOM is fully loaded
function initializeTranslation() {
    const translator = new zlanguageTranslator(useLang);
    translator.translatePage();
}

// Function to switch language dynamically
function switchLanguage(newLang) {
    // Update the language attribute
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i++) {
        if (scripts[i].src.includes('translator.js')) {
            scripts[i].setAttribute('zlangu', newLang);
        }
    }
    
    // Update global language variable
    useLang = newLang;
    
    // Retranslate the page
    const translator = new zlanguageTranslator(newLang);
    translator.translatePage();
    
    // Store preference in localStorage
    localStorage.setItem('preferredLanguage', newLang);
}

// Load preferred language from localStorage on page load
function loadPreferredLanguage() {
    const preferredLang = localStorage.getItem('preferredLanguage');
    if (preferredLang && preferredLang !== useLang) {
        useLang = preferredLang;
        const translator = new zlanguageTranslator(useLang);
        translator.translatePage();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadPreferredLanguage();
    initializeTranslation();
});
