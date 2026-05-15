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
    
    const workInput = document.getElementById('pom-work-input');
    if (workInput) {
      workInput.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value) || 15;
        App.setupSegments(mins);
        App.savePomodoroState();
      });

      document.getElementById('pom-work-up')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(workInput.value) || 15;
        // Jump to next multiple of 5
        let nextVal = Math.floor(val / 5) * 5 + 5;
        workInput.value = Math.min(120, nextVal);
        workInput.dispatchEvent(new Event('change'));
      });

      document.getElementById('pom-work-down')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(workInput.value) || 15;
        // Jump to previous multiple of 5
        let nextVal = Math.ceil(val / 5) * 5 - 5;
        workInput.value = Math.max(5, nextVal);
        workInput.dispatchEvent(new Event('change'));
      });
    }

    const breakInput = document.getElementById('pom-break-input');
    if (breakInput) {
      breakInput.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value) || 5;
        state.pomodoro.breakDuration = mins * 60;
        App.savePomodoroState();
      });
      
      document.getElementById('pom-break-up')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(breakInput.value) || 5;
        let nextVal = Math.floor(val / 5) * 5 + 5;
        breakInput.value = Math.min(60, nextVal);
        breakInput.dispatchEvent(new Event('change'));
      });

      document.getElementById('pom-break-down')?.addEventListener('click', () => {
        if (state.pomodoro.isRunning) return;
        let val = parseInt(breakInput.value) || 5;
        let nextVal = Math.ceil(val / 5) * 5 - 5;
        breakInput.value = Math.max(1, nextVal);
        breakInput.dispatchEvent(new Event('change'));
      });
    }

    App.loadPomodoroState();
  };

  App.setupSegments = function(totalMins) {
    // Zenith: Return to "Normal" behavior. No auto-splitting into segments.
    // The user sets a time, and that time is the duration of the focus session.
    state.pomodoro.duration = totalMins * 60;
    state.pomodoro.remaining = totalMins * 60;
    state.pomodoro.isBreak = false;
    state.pomodoro.segments = [];
    state.pomodoro.currentSegmentIndex = 0;
    
    App.renderTimer();
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
      taskName: taskName,
      segments: state.pomodoro.segments,
      currentSegmentIndex: state.pomodoro.currentSegmentIndex,
      currentTaskStartTime: state.pomodoro.currentTaskStartTime
    };
    localStorage.setItem('zomzam_pomodoro', JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('pomodoroUpdate'));
  };

  App.loadPomodoroState = function() {
    const saved = localStorage.getItem('zomzam_pomodoro');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      state.pomodoro.duration = data.duration || 15 * 60;
      state.pomodoro.breakDuration = data.breakDuration || 5 * 60;
      state.pomodoro.isBreak = !!data.isBreak;
      state.pomodoro.sessions = data.sessions || 0;
      state.pomodoro.segments = data.segments || [];
      state.pomodoro.currentSegmentIndex = data.currentSegmentIndex || 0;
      state.pomodoro.currentTaskStartTime = data.currentTaskStartTime || null;
      
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
        if (data.isRunning) App.startTimer();
      }
      
      const workInput = document.getElementById('pom-work-input');
      if (workInput) workInput.value = Math.floor(data.duration / 60);
      App.renderTimer();
    } catch (e) { }
  };

  App.toggleTimer = function() {
    if (state.pomodoro.isRunning) {
      App.pauseTimer();
    } else {
      App.startTimer();
    }
  };

  App.updatePlayPauseBtn = function(isRunning) {
    const btn = document.getElementById('btn-play-pause');
    const swapBtn = document.getElementById('btn-task-swap');
    
    if (btn) {
      if (isRunning) {
        btn.innerHTML = '<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        btn.classList.remove('bg-primary-500');
        btn.classList.add('bg-slate-800');
      } else {
        btn.innerHTML = '<svg class="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>';
        btn.classList.remove('bg-slate-800');
        btn.classList.add('bg-primary-500');
      }
    }

    if (swapBtn) {
        if (isRunning) {
            swapBtn.setAttribute('disabled', 'true');
            swapBtn.classList.add('opacity-40', 'cursor-not-allowed', 'grayscale');
            swapBtn.style.pointerEvents = 'none';
        } else {
            swapBtn.removeAttribute('disabled');
            swapBtn.classList.remove('opacity-40', 'cursor-not-allowed', 'grayscale');
            swapBtn.style.pointerEvents = '';
        }
    }
  };

  App.startTimer = function() {
    if (state.pomodoro.interval) clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = true;
    
    if (!state.pomodoro.currentTaskStartTime && !state.pomodoro.isBreak) {
        state.pomodoro.currentTaskStartTime = Date.now();
    }

    App.updatePlayPauseBtn(true);
    
    // Zenith Drift-Correction Engine
    const startTime = Date.now();
    const initialRemaining = state.pomodoro.remaining;

    const tick = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      state.pomodoro.remaining = Math.max(0, initialRemaining - elapsed);
      
      App.renderTimer();
      App.savePomodoroState();

      if (state.pomodoro.remaining <= 0) {
        if (state.pomodoro.interval) clearInterval(state.pomodoro.interval);
        state.pomodoro.isRunning = false;
        App.savePomodoroState();
        App.onTimerEnd();
      }
    };

    // Set interval FIRST so tick can clear it if needed
    state.pomodoro.interval = setInterval(tick, 1000);
    tick(); // Execute immediately
  };

  App.pauseTimer = function() {
    clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = false;
    App.updatePlayPauseBtn(false);
    App.savePomodoroState();
  };

  App.resetTimer = function() {
    App.pauseTimer();
    if (state.pomodoro.segments.length > 0) {
        const seg = state.pomodoro.segments[state.pomodoro.currentSegmentIndex];
        state.pomodoro.remaining = seg.duration;
    } else {
        state.pomodoro.remaining = state.pomodoro.isBreak ? state.pomodoro.breakDuration : state.pomodoro.duration;
    }
    App.renderTimer();
    App.savePomodoroState();
  };

  App.onTimerEnd = function() {
    App.updatePlayPauseBtn(false);
    
    // Move to next segment if available
    if (state.pomodoro.segments.length > 0 && state.pomodoro.currentSegmentIndex < state.pomodoro.segments.length - 1) {
        state.pomodoro.currentSegmentIndex++;
        const next = state.pomodoro.segments[state.pomodoro.currentSegmentIndex];
        state.pomodoro.isBreak = next.type === 'break';
        state.pomodoro.duration = next.duration;
        state.pomodoro.remaining = next.duration;
        
        const msg = state.pomodoro.isBreak ? 'Time for a break!' : 'Back to work!';
        const type = state.pomodoro.isBreak ? 'success' : 'warning';
        App.showTimerNotification(msg, type);
        if (window.Zenith) Zenith.UI.toast(msg, type);
    } else {
        // Session Finished
        state.pomodoro.sessions++;
        state.pomodoro.isBreak = !state.pomodoro.isBreak;
        state.pomodoro.remaining = state.pomodoro.isBreak ? state.pomodoro.breakDuration : state.pomodoro.duration;
        
        App.showTimerNotification('Session Finished!', 'success');
        if (window.Zenith) Zenith.UI.toast('Session Complete! You are on fire. 🚀', 'success');

        // Zenith-Tier Wow Factor: Confetti
        if (window.confetti) {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#EE5712', '#ff9874', '#ffffff']
            });
        }
    }

    App.renderTimer();
    App.renderTaskStack();
    App.triggerTimerRing();
    App.savePomodoroState();
  };

  App.skipBreak = function() {
    if (!state.pomodoro.isBreak) return;
    App.onTimerEnd();
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
    state.pomodoro.currentTaskStartTime = null;
    state.pomodoro.segments = [];
    App.renderTimer();
    App.renderTaskStack();
    App.savePomodoroState();
  };

  App.handleDoneTask = function() {
    const pending = state.tasks.filter(t => t.status !== 'completed');
    if (pending.length === 0) return;
    
    const task = pending[0];
    const startTime = state.pomodoro.currentTaskStartTime || Date.now();
    const actualSecs = Math.floor((Date.now() - startTime) / 1000);
    const actualMins = Math.round(actualSecs / 60) || 1;
    const plannedMins = task.duration_block;
    
    const diff = plannedMins - actualMins;
    state.pomodoro.lastCompletionStats = {
        taskId: task.id,
        saved: diff > 0 ? diff : 0,
        passed: diff < 0 ? Math.abs(diff) : 0,
        actual: actualMins,
        planned: plannedMins
    };

    App.completeTask(task.id, actualMins);
    state.pomodoro.currentTaskStartTime = null;
    state.pomodoro.isRunning = false;
    state.pomodoro.segments = [];
    clearInterval(state.pomodoro.interval);
    
    App.renderTaskStack();
    App.renderTimer();
    App.savePomodoroState();
  };

  App.swapTask = function() {
    if (state.pomodoro.isRunning) return;
    console.log('🔄 Swap Task Triggered');
    const pending = state.tasks.filter(t => t.status !== 'completed');
    if (pending.length < 2) {
        console.warn('⚠️ Swap Task: Not enough pending tasks', pending.length);
        return;
    }
    
    const task1 = pending[0];
    const task2 = pending[1];
    
    const idx1 = state.tasks.findIndex(t => t.id == task1.id);
    const idx2 = state.tasks.findIndex(t => t.id == task2.id);
    
    if (idx1 !== -1 && idx2 !== -1) {
        const temp = state.tasks[idx1];
        state.tasks[idx1] = state.tasks[idx2];
        state.tasks[idx2] = temp;
        console.log('✅ Swap Successful');
    }
    
    App.pauseTimer();
    state.pomodoro.currentTaskStartTime = null;
    
    // RE-INITIALIZE segments for the new top task
    const newTask = state.tasks.filter(t => t.status !== 'completed')[0];
    if (newTask) {
        App.setupSegments(newTask.duration_block);
    } else {
        state.pomodoro.segments = [];
    }
    
    const swapBtn = document.getElementById('btn-task-swap');
    if (swapBtn) {
        swapBtn.classList.add('animate-pulse', 'border-primary-500');
        setTimeout(() => swapBtn.classList.remove('animate-pulse', 'border-primary-500'), 500);
    }
    
    App.renderTaskStack();
    App.renderTimer();
    App.savePomodoroState();
  };

  App.showTimerNotification = function(message, type = 'info') {
    const el = document.getElementById('timer-notification');
    if (!el) return;
    el.textContent = message;
    el.className = `fixed top-24 right-6 px-6 py-3 rounded-2xl text-white font-bold shadow-2xl transition-all duration-500 z-50 ${
      type === 'success' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : 'bg-primary-500'
    }`;
    el.classList.remove('hidden', 'translate-y-[-20px]', 'opacity-0');
    
    setTimeout(() => {
        el.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => el.classList.add('hidden'), 500);
    }, 5000);
  };

  App.triggerTimerRing = function() {
    // Zenith Audio feedback
    try {
        const audio = new Audio('/Assets/Audio/timer-ring.mp3');
        audio.play().catch(() => {});
    } catch(e) {}
    
    const ring = document.getElementById('timer-ring');
    if (ring && window.gsap) {
        gsap.to(ring, { stroke: '#EE5712', repeat: 5, yoyo: true, duration: 0.2, onComplete: () => {
            ring.style.stroke = '';
        }});
    }
  };

})(window.TimeApp);
