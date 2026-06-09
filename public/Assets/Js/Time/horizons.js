/**
 * Time Application - Horizons Module
 */
window.TimeApp = window.TimeApp || {};

(function(App) {
  const { state } = App;

  App.addHorizon = async function(type, content) {
    const res = await App.api('add_horizon', { type, content });
    if (res.success) {
      state.horizons[type] = state.horizons[type] || [];
      state.horizons[type].push(res.horizon);
      App.renderHorizons();
    }
  };

  App.deleteHorizon = async function(id, type) {
    await App.api('delete_horizon', { id });
    state.horizons[type] = state.horizons[type].filter(h => h.id != id);
    App.renderHorizons();
  };

  App.completeHorizon = async function(id, type) {
    await App.api('complete_horizon', { id });
    const h = state.horizons[type]?.find(h => h.id == id);
    if (h) h.status = 'completed';
    App.renderHorizons();
  };

  App.moveHorizon = async function(id, newType) {
    const res = await App.api('move_horizon', { id, type: newType });
    if (res.success) {
      let foundItem = null;
      ['week', 'month', 'year'].forEach(t => {
        const idx = state.horizons[t]?.findIndex(h => h.id == id);
        if (idx !== -1) {
          [foundItem] = state.horizons[t].splice(idx, 1);
        }
      });

      if (foundItem) {
        foundItem.type = newType;
        state.horizons[newType].push(foundItem);
      }
      App.renderHorizons();
      App.populateHorizonDropdown();
    }
  };

  App.initHorizonDragDrop = function() {
    const config = {
      week: { color: 'blue', ring: 'ring-blue-500/40' },
      month: { color: 'purple', ring: 'ring-purple-500/40' },
      year: { color: 'amber', ring: 'ring-amber-500/40' }
    };

    ['week', 'month', 'year'].forEach(type => {
      const container = document.getElementById(`horizon-${type}`);
      if (!container) return;

      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.classList.add('bg-slate-50', 'dark:bg-slate-800/20', 'ring-4', config[type].ring);
      });

      container.addEventListener('dragleave', () => {
        container.classList.remove('bg-slate-50', 'dark:bg-slate-800/20', 'ring-4', config[type].ring);
      });

      container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.classList.remove('bg-slate-50', 'dark:bg-slate-800/20', 'ring-4', config[type].ring);
        const id = e.dataTransfer.getData('text/plain');
        if (id) {
          App.moveHorizon(id, type);
        }
      });
    });
  };

})(window.TimeApp);
