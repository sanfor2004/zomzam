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
        "lang_name": "English"
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
        "lang_name": "العربية"
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
        "lang_name": "Español"
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
        "lang_name": "Français"
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
        "lang_name": "עברית"
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
        "lang_name": "中文"
    }
};

// Embedded image configuration for language-specific images (optional)
const ZLANG_IMAGES = {
    "en": {},
    "ar": {},
    "es": {},
    "fr": {},
    "he": {},
    "zh": {}
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
