/**
 * Zenith Stream Waiter - Client Engine (v4)
 * 
 * Handles real-time status updates including Idle (Yellow Dot) support.
 */

class StreamWaiter {
    constructor(options = {}) {
        this.viewingUserId = options.viewingUserId || null;
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnects = 15;
        this.isClosing = false;
        this.isIdle = false;
        this.idleTimer = null;
        this.idleTimeout = 60000; // 1 minute

        this.handlers = {
            'connection_established': (params) => {
                console.log('✅ Stream Waiter: Connection Established (' + (this.isIdle ? 'IDLE' : 'ACTIVE') + ')');
                this.updateCurrentUserUI(true);
            },
            'update_viewed_user_status': (params) => {
                this.updateViewedUserUI(params);
            },
            'new_notification': (params) => {
                this.handleNotification(params);
            },
            'force_refresh': () => {
                window.location.reload();
            }
        };

        this.init();
    }    init() {
        if (!window.EventSource) return;
        this.connect();
        this.setupActivityListeners();
        
        // Zenith-Tier Visibility Optimization
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                console.log('💤 Stream Waiter: Throttling (Tab Hidden)');
                // We keep connection open but can ignore non-critical UI updates
            } else {
                console.log('✨ Stream Waiter: Resuming (Tab Visible)');
                this.sendStatusUpdate(); // Immediate sync on return
            }
        });

        window.addEventListener('beforeunload', () => {
            this.isClosing = true;
            if (this.eventSource) this.eventSource.close();
        });
    }

    setupActivityListeners() {
        const resetTimer = () => {
            if (this.isIdle) this.setIdle(false);
            clearTimeout(this.idleTimer);
            // Zenith Debounce: Wait 60s before going idle
            this.idleTimer = setTimeout(() => this.setIdle(true), this.idleTimeout);
        };
        ['mousemove', 'keydown', 'scroll', 'click'].forEach(e => window.addEventListener(e, resetTimer));
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') resetTimer();
        });
        resetTimer();
    }

    async setIdle(idle) {
        if (this.isIdle === idle) return;
        
        this.isIdle = idle;
        this.updateCurrentUserUI(true);
        await this.sendStatusUpdate();
    }

    async sendStatusUpdate() {
        try {
            // Use Zenith.Fetch if available, else fallback to native fetch
            const fetcher = (window.Zenith && Zenith.Fetch) ? Zenith.Fetch : fetch;
            await fetcher('/api/heartbeat', {
                method: 'POST',
                body: { 
                    idle: this.isIdle ? 1 : 0,
                    viewing_user_id: this.viewingUserId 
                }
            });
        } catch (e) {
            console.error('❌ Stream Waiter: Status Update Failed', e);
        }
    }

    connect() {
        const url = `/api/stream?viewing_user_id=${this.viewingUserId || ''}`;
        this.eventSource = new EventSource(url);
        this.eventSource.addEventListener('order', (event) => {
            try { 
                if (document.visibilityState === 'hidden' && !JSON.parse(event.data).critical) return;
                this.executeOrder(JSON.parse(event.data)); 
            } catch (e) { }
        });
        this.eventSource.onerror = () => {
            if (this.isClosing) return;
            this.updateCurrentUserUI(false);
            this.eventSource.close();
            if (this.reconnectAttempts < this.maxReconnects) {
                this.reconnectAttempts++;
                const delay = Math.min(30000, 2000 * Math.pow(1.5, this.reconnectAttempts));
                setTimeout(() => this.connect(), delay);
            }
        };
    }

    executeOrder(order) {
        const { order_name, params } = order;
        if (this.handlers[order_name]) this.handlers[order_name](params);
    }

    updateCurrentUserUI(isHealthy) {
        const indicator = document.getElementById('current-user-online-indicator');
        const label = document.getElementById('current-user-online-label');
        const bg = document.getElementById('online-tracker-bg');
        if (!indicator) return;

        if (!isHealthy) {
            indicator.className = 'w-1.5 h-1.5 rounded-full bg-slate-400';
            if (label) label.textContent = 'Disconnected';
            if (bg) bg.style.background = 'linear-gradient(to top, rgba(100, 116, 139, 0.15) 0%, transparent 100%)';
            return;
        }

        if (this.isIdle) {
            indicator.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse';
            if (label) {
                label.textContent = 'Away';
                label.className = 'text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider';
            }
            if (bg) bg.style.background = 'linear-gradient(to top, rgba(251, 191, 36, 0.15) 0%, transparent 100%)';
        } else {
            indicator.className = 'w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse';
            if (label) {
                label.textContent = 'Online Mode';
                label.className = 'text-[9px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider';
            }
            if (bg) bg.style.background = 'linear-gradient(to top, rgba(34, 197, 94, 0.15) 0%, transparent 100%)';
        }
    }

    updateViewedUserUI(status) {
        const indicator = document.getElementById('viewed-user-online-indicator');
        const pulse = document.getElementById('viewed-user-online-pulse');
        const label = document.getElementById('viewed-user-online-label');
        const badge = document.getElementById('viewed-user-offline-badge');

        if (!indicator) return;

        if (status.is_online) {
            if (status.is_idle) {
                // Away State (Yellow)
                indicator.classList.remove('bg-slate-400', 'bg-emerald-500');
                indicator.classList.add('bg-amber-400');
                if (pulse) pulse.className = 'w-2 h-2 bg-white rounded-full opacity-50';
                if (label) {
                    label.textContent = 'Currently Away';
                    const dot = label.previousElementSibling;
                    if (dot) { dot.className = 'w-2 h-2 rounded-full bg-amber-400'; }
                }
            } else {
                // Active State (Green)
                indicator.classList.remove('bg-slate-400', 'bg-amber-400');
                indicator.classList.add('bg-emerald-500');
                if (pulse) pulse.className = 'w-2 h-2 bg-white rounded-full animate-pulse';
                if (label) {
                    label.textContent = 'Currently Online';
                    const dot = label.previousElementSibling;
                    if (dot) { dot.className = 'w-2 h-2 rounded-full bg-emerald-500'; }
                }
            }
            if (badge) badge.classList.add('hidden');
        } else {
            // Offline State
            indicator.className = 'w-8 h-8 bg-slate-400 rounded-2xl border-4 border-white dark:border-[#1a1d24] flex items-center justify-center shadow-sm';
            if (pulse) pulse.className = 'w-2 h-2 bg-white rounded-full opacity-50';
            if (label) {
                label.textContent = `Offline (${status.label})`;
                const dot = label.previousElementSibling;
                if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-400';
            }
            if (badge) {
                badge.classList.remove('hidden');
                badge.textContent = status.label;
            }
        }
    }

    handleNotification(params) {
        const counter = document.getElementById('notification-count');
        if (counter && params.count > 0) {
            counter.textContent = params.count;
            counter.classList.remove('hidden');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.zenithStreamWaiter = new StreamWaiter({
        viewingUserId: document.body.dataset.viewingUserId
    });
});
