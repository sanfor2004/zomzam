/**
 * Time Application - Pomodoro Module
 */
window.TimeApp = window.TimeApp || {};

(function(App) {
  const { state } = App;

  App.initPomodoro = function() {
    App.renderTimer();
    App.renderTaskStack();
    document.getElementById('btn-play-pause')?.addEventListener('click', App.toggleTimer);
    document.getElementById('btn-skip')?.addEventListener('click', App.skipTask);
    document.getElementById('btn-reset')?.addEventListener('click', App.resetTimer);
    document.getElementById('btn-skip-break')?.addEventListener('click', App.skipBreak);
    document.getElementById('btn-task-done')?.addEventListener('click', () => {
      const pending = state.tasks.filter(t => t.status !== 'completed');
      if (pending.length > 0) {
        const task = pending[0];
        const plannedSecs = state.pomodoro.duration;
        const remainingSecs = state.pomodoro.remaining;
        const actualSecs = Math.max(1, plannedSecs - remainingSecs);
        const actualMins = Math.round(actualSecs / 60) || 1;
        
        App.markTaskComplete(task.id, actualMins);
        App.resetTimer();
        App.onTimerEnd(); // Trigger break
      }
    });
    
    const workInput = document.getElementById('pom-work-input');
    if (workInput) {
      workInput.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value) || 25;
        state.pomodoro.duration = mins * 60;
        if (!state.pomodoro.isRunning && !state.pomodoro.isBreak) {
          state.pomodoro.remaining = state.pomodoro.duration;
          App.renderTimer();
        }
        App.savePomodoroState();
      });

      document.getElementById('pom-work-up')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(workInput.value) || 25;
        workInput.value = Math.min(120, val + 5);
        workInput.dispatchEvent(new Event('change'));
      });

      document.getElementById('pom-work-down')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(workInput.value) || 25;
        workInput.value = Math.max(1, val - 5);
        workInput.dispatchEvent(new Event('change'));
      });
    }

    const breakInput = document.getElementById('pom-break-input');
    if (breakInput) {
      breakInput.addEventListener('change', (e) => {
        if (state.pomodoro.isRunning) {
            e.target.value = Math.floor(state.pomodoro.breakDuration / 60);
            return;
        }
        const mins = parseInt(e.target.value) || 5;
        state.pomodoro.breakDuration = mins * 60;
        if (!state.pomodoro.isRunning && state.pomodoro.isBreak) {
          state.pomodoro.remaining = state.pomodoro.breakDuration;
          App.renderTimer();
        }
        App.savePomodoroState();
      });

      document.getElementById('pom-break-up')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(breakInput.value) || 5;
        breakInput.value = Math.min(60, val + 1);
        breakInput.dispatchEvent(new Event('change'));
      });

      document.getElementById('pom-break-down')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(breakInput.value) || 5;
        breakInput.value = Math.max(1, val - 1);
        breakInput.dispatchEvent(new Event('change'));
      });
    }

    App.loadPomodoroState();
  };

  App.savePomodoroState = function() {
    const pending = state.tasks.filter(t => t.status !== 'completed');
    const taskName = pending.length > 0 ? pending[0].title : (state.pomodoro.isBreak ? 'Break' : 'Focusing');

    const data = {
      remaining: state.pomodoro.remaining,
      isRunning: state.pomodoro.isRunning,
      isBreak: state.pomodoro.isBreak,
      duration: state.pomodoro.duration,
      breakDuration: state.pomodoro.breakDuration,
      lastUpdate: Date.now(),
      sessions: state.pomodoro.sessions,
      taskName: taskName
    };
    localStorage.setItem('zomzam_pomodoro', JSON.stringify(data));
    
    // Notify global UI (e.g., in app_layout.php)
    window.dispatchEvent(new CustomEvent('pomodoroUpdate'));
  };

  App.loadPomodoroState = function() {
    const saved = localStorage.getItem('zomzam_pomodoro');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      state.pomodoro.duration = data.duration || 25 * 60;
      state.pomodoro.breakDuration = data.breakDuration || 5 * 60;
      state.pomodoro.isBreak = !!data.isBreak;
      state.pomodoro.sessions = data.sessions || 0;
      
      let remaining = data.remaining;
      if (data.isRunning) {
        const elapsed = Math.floor((Date.now() - data.lastUpdate) / 1000);
        remaining -= elapsed;
      }
      
      if (remaining <= 0) {
        state.pomodoro.remaining = 0;
        state.pomodoro.isRunning = false;
      } else {
        state.pomodoro.remaining = remaining;
        if (data.isRunning) {
          App.startTimer();
        }
      }
      
      const workInput = document.getElementById('pom-work-input');
      if (workInput) workInput.value = Math.floor(state.pomodoro.duration / 60);
      const breakInput = document.getElementById('pom-break-input');
      if (breakInput) breakInput.value = Math.floor(state.pomodoro.breakDuration / 60);
      
      App.renderTimer();
    } catch (e) {
      console.error('Pomodoro load error:', e);
    }
  };

  App.toggleTimer = function() {
    if (state.pomodoro.isRunning) {
      App.pauseTimer();
    } else {
      App.startTimer();
    }
  };

  App.startTimer = function() {
    if (state.pomodoro.interval) clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = true;
    App.updatePlayPauseBtn(true);
    
    // Instant feedback: decrement and render immediately
    state.pomodoro.remaining--;
    App.renderTimer();
    App.savePomodoroState();

    state.pomodoro.interval = setInterval(() => {
      state.pomodoro.remaining--;
      App.renderTimer();
      App.savePomodoroState();

      if (state.pomodoro.remaining <= 0) {
        clearInterval(state.pomodoro.interval);
        state.pomodoro.isRunning = false;
        App.savePomodoroState();
        App.onTimerEnd();
      }
    }, 1000);
  };

  App.pauseTimer = function() {
    clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = false;
    App.updatePlayPauseBtn(false);
    App.savePomodoroState();
  };

  App.resetTimer = function() {
    App.pauseTimer();
    state.pomodoro.remaining = state.pomodoro.isBreak ? state.pomodoro.breakDuration : state.pomodoro.duration;
    App.renderTimer();
    App.savePomodoroState();
  };

  App.onTimerEnd = function() {
    App.updatePlayPauseBtn(false);
    const isBreak = state.pomodoro.isBreak;

    if (!isBreak) {
      const pending = state.tasks.filter(t => t.status !== 'completed');
      if (pending.length > 0) {
        App.markTaskComplete(pending[0].id, pending[0].duration_block);
        state.pomodoro.sessions++;
      }
      state.pomodoro.isBreak = true;
      state.pomodoro.remaining = state.pomodoro.breakDuration;
      App.showTimerNotification('Session Complete! Time for a break.', 'success');
    } else {
      state.pomodoro.isBreak = false;
      state.pomodoro.remaining = state.pomodoro.duration;
      App.showTimerNotification('Break over! Back to work.', 'warning');
    }

    App.renderTimer();
    App.renderTaskStack();
    App.triggerTimerRing();
    App.savePomodoroState();
  };

  App.skipBreak = function() {
    if (!state.pomodoro.isBreak) return;
    App.pauseTimer();
    state.pomodoro.isBreak = false;
    state.pomodoro.remaining = state.pomodoro.duration;
    App.renderTimer();
    App.savePomodoroState();
  };

  App.skipTask = function() {
    const pending = state.tasks.filter(t => t.status !== 'completed');
    if (pending.length < 2) return;
    const idx = state.tasks.findIndex(t => t.id === pending[0].id);
    if (idx !== -1) {
      const [task] = state.tasks.splice(idx, 1);
      state.tasks.push(task);
    }
    App.pauseTimer();
    state.pomodoro.remaining = state.pomodoro.duration;
    state.pomodoro.isBreak = false;
    App.renderTimer();
    App.renderTaskStack();
    App.savePomodoroState();
  };

})(window.TimeApp);
