/**
 * Time Application - API Helpers
 */
window.TimeApp = window.TimeApp || {};

(function(App) {

  App.api = async function(action, data = {}) {
    try {
      const res = await fetch('/time/api', {
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
      App.renderAll();
    }
  };

})(window.TimeApp);
