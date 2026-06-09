/**
 * Time Application - API Helpers
 */
window.TimeApp = window.TimeApp || {};

(function(App) {

  App.api = async function(action, data = {}, endpoint = '/time/api') {
    // Zenith-Tier API Wrapper
    if (window.Zenith && Zenith.Fetch) {
        return await Zenith.Fetch(endpoint, { body: { action, ...data } });
    }
    
    // Fallback
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ action, ...data })
      });
      return await res.json();
    } catch (e) {
      console.error('API Error:', e);
      return { success: false };
    }
  };

  App.loadFromServer = async function() {
    const res = await App.api('load');
    if (res.success) {
      App.state.tasks = res.tasks || [];
      App.state.horizons = res.horizons || { week: [], month: [], year: [] };
      App.state.ideas = res.ideas || [];
      App.state.userSettings = res.settings || { timezone: 'UTC', notifications_enabled: false };
      App.renderAll();
    }
  };

})(window.TimeApp);
