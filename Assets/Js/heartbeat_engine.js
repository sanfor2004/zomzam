/**
 * Zenith-Tier Heartbeat Engine
 * 
 * Handles real-time synchronization between the client and server.
 * Distinguishes between the current user's session and viewed user statuses.
 */

class HeartbeatEngine {
    constructor(options = {}) {
        this.interval = options.interval || 5000; // 5 seconds
        this.viewingUserId = options.viewingUserId || null;
        this.timer = null;
        this.isProcessing = false;
        
        this.init();
    }

    init() {
        console.log('🚀 Zenith Heartbeat Engine Initialized');
        this.startPolling();
        
        // Immediate first run after a small delay
        setTimeout(() => this.poll(), 100);
    }

    startPolling() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.poll(), this.interval);
    }

    async poll() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const response = await fetch('/api/heartbeat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    viewing_user_id: this.viewingUserId
                })
            });

            const result = await response.json();

            if (result.success) {
                this.handleUpdate(result.data);
            }
        } catch (error) {
            console.error('❌ Heartbeat Engine Poll Failed:', error);
            this.updateCurrentUserStatus(false);
        } finally {
            this.isProcessing = false;
        }
    }

    handleUpdate(data) {
        // 1. Update Current User Status (Sidebar)
        this.updateCurrentUserStatus(true);

        // 2. Update Viewed User Status (Profile Page)
        if (data.user_status) {
            this.updateViewedUserStatus(data.user_status);
        }

        // 3. Update Notifications
        if (data.notifications) {
            this.updateNotifications(data.notifications);
        }
        
        // Dispatch custom event for other scripts to listen to
        window.dispatchEvent(new CustomEvent('zenith:heartbeat_update', { detail: data }));
    }

    updateCurrentUserStatus(isHealthy) {
        const indicator = document.getElementById('current-user-online-indicator');
        const label = document.getElementById('current-user-online-label');

        if (!indicator) return;

        if (isHealthy) {
            indicator.classList.remove('bg-slate-400');
            indicator.classList.add('bg-green-500', 'animate-pulse');
            if (label) {
                label.textContent = 'Online Mode';
                label.classList.remove('text-slate-500');
                label.classList.add('text-green-600', 'dark:text-green-400');
            }
        } else {
            indicator.classList.remove('bg-green-500', 'animate-pulse');
            indicator.classList.add('bg-slate-400');
            if (label) {
                label.textContent = 'Connection Lost';
                label.classList.remove('text-green-600', 'dark:text-green-400');
                label.classList.add('text-slate-500');
            }
        }
    }

    updateViewedUserStatus(status) {
        const indicator = document.getElementById('viewed-user-online-indicator');
        const pulse = document.getElementById('viewed-user-online-pulse');
        const label = document.getElementById('viewed-user-online-label');
        const badge = document.getElementById('viewed-user-offline-badge');

        if (!indicator) return;

        if (status.is_online) {
            // Online State
            indicator.classList.remove('bg-slate-400');
            indicator.classList.add('bg-emerald-500');
            
            if (pulse) {
                pulse.classList.remove('opacity-50');
                pulse.classList.add('animate-pulse');
            }
            
            if (label) {
                label.textContent = 'Currently Online';
                if (label.previousElementSibling) {
                    label.previousElementSibling.classList.remove('bg-slate-400');
                    label.previousElementSibling.classList.add('bg-emerald-500');
                }
            }
            
            if (badge) badge.classList.add('hidden');
        } else {
            // Offline State
            indicator.classList.remove('bg-emerald-500');
            indicator.classList.add('bg-slate-400');
            
            if (pulse) {
                pulse.classList.remove('animate-pulse');
                pulse.classList.add('opacity-50');
            }
            
            if (label) {
                label.textContent = `Offline (${status.label})`;
                if (label.previousElementSibling) {
                    label.previousElementSibling.classList.remove('bg-emerald-500');
                    label.previousElementSibling.classList.add('bg-slate-400');
                }
            }
            
            if (badge) {
                badge.classList.remove('hidden');
                badge.textContent = status.label;
            }
        }
    }

    updateNotifications(notifications) {
        const counter = document.getElementById('notification-count');
        if (counter) {
            if (notifications.count > 0) {
                counter.textContent = notifications.count;
                counter.classList.remove('hidden');
            } else {
                counter.classList.add('hidden');
            }
        }
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const viewingUserId = document.body.dataset.viewingUserId;
    window.zenithHeartbeat = new HeartbeatEngine({
        viewingUserId: viewingUserId
    });
});
