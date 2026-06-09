/**
 * Zenith-Tier Core Engine
 * Architectural Sovereignty & Cinematic UI Helpers
 */

window.Zenith = window.Zenith || {};

(function(Z) {
    'use strict';

    // --- UI ENGINE ---
    Z.UI = {
        /**
         * Stackable Cinematic Toasts
         */
        toast: function(message, type = 'info', duration = 4000) {
            let container = document.getElementById('zenith-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'zenith-toast-container';
                container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none';
                document.body.appendChild(container);
            }

            const toast = document.createElement('div');
            const icon = {
                success: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
                error: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
                warning: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
                info: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            }[type];

            const colors = {
                success: 'bg-emerald-500 text-white shadow-emerald-500/20',
                error: 'bg-rose-500 text-white shadow-rose-500/20',
                warning: 'bg-amber-500 text-white shadow-amber-500/20',
                info: 'bg-primary-500 text-white shadow-primary-500/20'
            }[type];

            toast.className = `pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl ${colors} shadow-2xl border border-white/10 backdrop-blur-xl translate-x-full opacity-0 transition-all duration-500 ease-out transform scale-90`;
            toast.innerHTML = `
                <div class="flex-shrink-0">${icon}</div>
                <div class="text-sm font-bold tracking-tight">${message}</div>
            `;

            container.appendChild(toast);

            // Animate In (Zenith Motion)
            requestAnimationFrame(() => {
                toast.classList.remove('translate-x-full', 'opacity-0', 'scale-90');
            });

            // Animate Out
            const remove = () => {
                toast.classList.add('translate-x-full', 'opacity-0', 'scale-90');
                setTimeout(() => toast.remove(), 500);
            };

            const timer = setTimeout(remove, duration);
            toast.onclick = () => { clearTimeout(timer); remove(); };
        },

        shimmer: {
            add: (el) => el.classList.add('animate-pulse', 'bg-slate-200', 'dark:bg-slate-800', 'rounded-xl'),
            remove: (el) => el.classList.remove('animate-pulse', 'bg-slate-200', 'dark:bg-slate-800')
        }
    };

    // --- FETCH ENGINE ---
    Z.Fetch = async function(url, options = {}) {
        const defaults = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        const config = { ...defaults, ...options };
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok || (data && data.success === false)) {
                const errorMsg = data.message || data.error || `HTTP Error ${response.status}`;
                throw new Error(errorMsg);
            }
            return data;
        } catch (error) {
            console.error('❌ Zenith Fetch Error:', error);
            Z.UI.toast(error.message, 'error');
            return { success: false, error: error.message };
        }
    };

    // --- UTILS ENGINE ---
    Z.Utils = {
        esc: function(str) {
            const div = document.createElement('div');
            div.textContent = str || '';
            return div.innerHTML;
        },

        debounce: function(fn, wait) {
            let timeout;
            return function(...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => fn.apply(this, args), wait);
            };
        },

        formatDate: function(dateStr) {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            });
        }
    };

    // --- ANIMATION ENGINE (GSAP REQUIRED) ---
    Z.Anim = {
        staggerReveal: function(selector, options = {}) {
            if (window.gsap) {
                gsap.from(selector, {
                    y: 20,
                    opacity: 0,
                    duration: 0.6,
                    stagger: 0.1,
                    ease: "power2.out",
                    ...options
                });
            }
        },

        pop: function(el) {
            if (window.gsap) {
                gsap.fromTo(el, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" });
            }
        }
    };

    // --- GLOBAL THEME ENGINE ---
    /**
     * Toggles between light and dark mode
     * Persists choice in localStorage and updates root class
     */
    window.toggleTheme = function() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        // Optional: Dispatch event for components that need to react to theme changes
        window.dispatchEvent(new CustomEvent('zenith:theme_change', { detail: { isDark } }));
    };

    /**
     * Handles user logout by redirecting to the logout endpoint
     */
    window.handleLogout = function() {
        // We use a direct redirect to the logout handler which destroys session
        window.location.href = '/logout';
    };

})(window.Zenith);
