/**
 * Time Application - Settings Module
 */
window.TimeApp = window.TimeApp || {};

(function(App) {
  
  App.initSettings = function() {
    const btnSave = document.getElementById('btn-save-settings');
    if (btnSave) {
      btnSave.addEventListener('click', App.saveTimerSettings);
    }

    // Instant permission request when toggle is flipped
    const notifToggle = document.getElementById('setting-notifications');
    if (notifToggle) {
      notifToggle.addEventListener('change', async (e) => {
        if (e.target.checked) {
          // Zenith-Tier Security: Check for secure context
          if (!window.isSecureContext || !window.Notification) {
            e.target.checked = false;
            alert('Desktop Notifications require a Secure Context (HTTPS or localhost). Since you are on an insecure origin, this feature is disabled.');
            return;
          }

          if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
              e.target.checked = false;
              alert('Notification permission denied. We cannot enable desktop alerts.');
            }
          }
        }
      });
    }
  };

  App.saveTimerSettings = async function() {
    const timezone = document.getElementById('setting-timezone').value;
    const notifications = document.getElementById('setting-notifications').checked ? 1 : 0;
    const btn = document.getElementById('btn-save-settings');

    // If enabling notifications, request permission
    if (notifications === 1) {
        if (!window.isSecureContext || !window.Notification) {
            document.getElementById('setting-notifications').checked = false;
            alert('Desktop Notifications require a Secure Context (HTTPS or localhost).');
            return;
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                // User denied, uncheck the box and show warning
                document.getElementById('setting-notifications').checked = false;
                alert('Notification permission denied. We cannot enable desktop alerts.');
                return;
            }
        }
    }
    
    // UI Feedback
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Saving...';

    try {
      const res = await App.api('update_settings', { 
        timezone,
        notifications_enabled: notifications
      }, '/api/auth');
      
      if (res.success) {
        // Success feedback
        btn.classList.replace('bg-primary-500', 'bg-emerald-500');
        btn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg> Settings Saved!';
        
        setTimeout(() => {
          btn.classList.replace('bg-emerald-500', 'bg-primary-500');
          btn.innerHTML = originalHtml;
          btn.disabled = false;
        }, 2000);
      } else {
        throw new Error(res.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Settings Error:', err);
      btn.classList.replace('bg-primary-500', 'bg-red-500');
      btn.innerHTML = 'Error Saving';
      
      setTimeout(() => {
        btn.classList.replace('bg-red-500', 'bg-primary-500');
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }, 3000);
    }
  };

})(window.TimeApp);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.TimeApp && window.TimeApp.initSettings) {
        window.TimeApp.initSettings();
    }
});
