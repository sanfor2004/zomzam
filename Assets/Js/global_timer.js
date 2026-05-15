/**
 * Zenith Global Timer Sync Engine
 * Synchronizes the topbar "Live Session" indicator with the active Pomodoro state.
 */

class GlobalTimerSync {
    constructor() {
        this.container = document.getElementById('global-timer-container');
        this.clockEl = document.getElementById('global-timer-clock');
        this.taskEl = document.getElementById('global-timer-task');
        this.interval = null;
        this.state = null;

        if (!this.container) return;

        this.init();
    }

    init() {
        this.sync();
        
        // Listen for internal app updates (same tab)
        window.addEventListener('pomodoroUpdate', () => this.sync());
        
        // Listen for cross-tab updates
        window.addEventListener('storage', (e) => {
            if (e.key === 'zomzam_pomodoro') this.sync();
        });

        console.log('⏱️ Zenith Global Timer Sync Active');
    }

    sync() {
        const saved = localStorage.getItem('zomzam_pomodoro');
        if (!saved) {
            this.hide();
            return;
        }

        try {
            const data = JSON.parse(saved);
            this.state = data;
            
            if (!data.isRunning && data.remaining <= 0) {
                this.hide();
                return;
            }

            this.show();
            this.updateUI();

            if (data.isRunning) {
                this.startTicking();
            } else {
                this.stopTicking();
            }
        } catch (e) {
            this.hide();
        }
    }

    startTicking() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.tick(), 1000);
    }

    stopTicking() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    tick() {
        if (!this.state || !this.state.isRunning) {
            this.stopTicking();
            return;
        }

        // Calculate elapsed since last save
        const elapsed = Math.floor((Date.now() - this.state.lastUpdate) / 1000);
        const currentRemaining = Math.max(0, this.state.remaining - elapsed);

        if (currentRemaining <= 0) {
            this.sync(); // Refresh from source
            return;
        }

        this.updateClock(currentRemaining);
    }

    updateUI() {
        if (!this.state) return;

        if (this.taskEl) {
            let label = this.state.isBreak ? 'Brain Rest' : 'Focusing';
            if (this.state.taskName && !this.state.isBreak) {
                // Shorten task name if too long
                const cleanName = this.state.taskName.length > 20 ? this.state.taskName.substring(0, 17) + '...' : this.state.taskName;
                label = cleanName;
            }
            this.taskEl.textContent = label;
            this.taskEl.className = `text-[9px] font-black uppercase tracking-widest leading-none mb-1 ${this.state.isBreak ? 'text-emerald-500' : 'text-primary-600 dark:text-primary-400'}`;
        }

        this.updateClock(this.state.remaining);
        
        // Update the pinging dot color
        const ping = document.getElementById('zz-global-timer-ping');
        const dot = document.getElementById('zz-global-timer-dot');
        if (ping) ping.className = `absolute inset-0 rounded-full animate-ping opacity-75 ${this.state.isBreak ? 'bg-emerald-500' : 'bg-primary-500'}`;
        if (dot) dot.className = `relative block w-2 h-2 rounded-full ${this.state.isBreak ? 'bg-emerald-500' : 'bg-primary-500'}`;
    }

    updateClock(seconds) {
        if (!this.clockEl) return;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        this.clockEl.textContent = `${mins}:${secs}`;
    }

    show() {
        if (this.container) {
            this.container.classList.remove('hidden');
            // Zenith: Stagger reveal animation if GSAP is available
            if (window.gsap && this.container.classList.contains('hidden')) {
                gsap.fromTo(this.container, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
            }
        }
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
            this.stopTicking();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.zenithGlobalTimer = new GlobalTimerSync();
});
