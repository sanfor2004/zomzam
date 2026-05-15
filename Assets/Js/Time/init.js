/**
 * Time Application - Initialization
 */
window.TimeApp = window.TimeApp || {};

(function(App) {

  App.init = function() {
    App.loadFromServer();
    App.initPomodoro();
    App.initRichEditor();
    App.initHorizonDragDrop();
    App.bindForms();
  };

  App.bindForms = function() {
    const addTaskBtn = document.getElementById('btn-add-task');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        const title = document.getElementById('task-title')?.value?.trim();
        const priority = document.getElementById('task-priority')?.value || 'medium';
        const duration = parseInt(document.getElementById('task-duration')?.value) || 15;
        const horizonId = document.getElementById('task-horizon-select')?.value || null;
        if (!title) return App.shakeField('task-title');
        App.addTask({ title, priority, duration_block: duration, horizon_id: horizonId });
        document.getElementById('task-title').value = '';
      });
    }

    ['week', 'month', 'year'].forEach(type => {
      const btn = document.getElementById(`btn-add-${type}`);
      if (btn) {
        btn.addEventListener('click', () => {
          const input = document.getElementById(`horizon-input-${type}`);
          const content = input?.value?.trim();
          if (!content) return App.shakeField(`horizon-input-${type}`);
          App.addHorizon(type, content);
          if (input) input.value = '';
        });
        document.getElementById(`horizon-input-${type}`)?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btn.click();
        });
      }
    });

    document.getElementById('btn-submit-idea')?.addEventListener('click', App.submitIdea);
    
    // Global delegation for dynamic or rendered buttons
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('#btn-task-swap')) {
            App.swapTask();
        } else if (target.closest('#btn-task-done')) {
            App.handleDoneTask();
        }
    });
  };

  document.addEventListener('DOMContentLoaded', App.init);

})(window.TimeApp);
