/**
 * Time Management Application Engine
 * Handles: Pomodoro Timer, Task Management, Horizon Planning, Idea Capture
 */

const TimeApp = (() => {

  // ─── State ──────────────────────────────────────────────────────────────────
  let state = {
    tasks: [],
    horizons: { week: [], month: [], year: [] },
    ideas: [],
    editingIdeaId: null,
    currentTaskIndex: 0,
    lastCurrentTaskId: null,
    pomodoro: {
      duration: 25 * 60, // seconds
      breakDuration: 5 * 60,
      remaining: 25 * 60,
      isRunning: false,
      isBreak: false,
      interval: null,
      sessions: 0,
    }
  };

  // ─── Init ────────────────────────────────────────────────────────────────────
  function init() {
    loadFromServer();
    initPomodoro();
    initRichEditor();
    initHorizonDragDrop();
  }

  // ─── API Helpers ─────────────────────────────────────────────────────────────
  async function api(action, data = {}) {
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
  }

  async function loadFromServer() {
    const res = await api('load');
    if (res.success) {
      state.tasks = res.tasks || [];
      state.horizons = res.horizons || { week: [], month: [], year: [] };
      state.ideas = res.ideas || [];
      renderAll();
    }
  }

  // ─── Pomodoro Timer ──────────────────────────────────────────────────────────
  function initPomodoro() {
    renderTimer();
    renderTaskStack();
    document.getElementById('btn-play-pause')?.addEventListener('click', toggleTimer);
    document.getElementById('btn-skip')?.addEventListener('click', skipTask);
    document.getElementById('btn-reset')?.addEventListener('click', resetTimer);
    document.getElementById('btn-skip-break')?.addEventListener('click', skipBreak);
    document.getElementById('btn-task-done')?.addEventListener('click', () => {
      const pending = state.tasks.filter(t => t.status !== 'completed');
      if (pending.length > 0) {
        const task = pending[0];
        const plannedSecs = state.pomodoro.duration;
        const remainingSecs = state.pomodoro.remaining;
        const actualSecs = Math.max(1, plannedSecs - remainingSecs);
        const actualMins = Math.round(actualSecs / 60) || 1;
        
        markTaskComplete(task.id, actualMins);
        resetTimer();
        onTimerEnd(); // Trigger break
      }
    });
    
    const workInput = document.getElementById('pom-work-input');
    if (workInput) {
      workInput.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value) || 25;
        state.pomodoro.duration = mins * 60;
        if (!state.pomodoro.isRunning && !state.pomodoro.isBreak) {
          state.pomodoro.remaining = state.pomodoro.duration;
          renderTimer();
        }
        savePomodoroState();
      });

      document.getElementById('pom-work-up')?.addEventListener('click', () => {
        let val = parseInt(workInput.value) || 25;
        workInput.value = Math.min(120, val + 5);
        workInput.dispatchEvent(new Event('change'));
      });

      document.getElementById('pom-work-down')?.addEventListener('click', () => {
        let val = parseInt(workInput.value) || 25;
        workInput.value = Math.max(1, val - 5);
        workInput.dispatchEvent(new Event('change'));
      });
    }

    const breakInput = document.getElementById('pom-break-input');
    if (breakInput) {
      breakInput.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value) || 5;
        state.pomodoro.breakDuration = mins * 60;
        if (!state.pomodoro.isRunning && state.pomodoro.isBreak) {
          state.pomodoro.remaining = state.pomodoro.breakDuration;
          renderTimer();
        }
        savePomodoroState();
      });

      document.getElementById('pom-break-up')?.addEventListener('click', () => {
        let val = parseInt(breakInput.value) || 5;
        breakInput.value = Math.min(60, val + 1);
        breakInput.dispatchEvent(new Event('change'));
      });

      document.getElementById('pom-break-down')?.addEventListener('click', () => {
        let val = parseInt(breakInput.value) || 5;
        breakInput.value = Math.max(1, val - 1);
        breakInput.dispatchEvent(new Event('change'));
      });
    }

    // Load persisted state
    loadPomodoroState();
  }

  function savePomodoroState() {
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
  }

  function loadPomodoroState() {
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
          startTimer();
        }
      }
      
      const workInput = document.getElementById('pom-work-input');
      if (workInput) workInput.value = Math.floor(state.pomodoro.duration / 60);
      const breakInput = document.getElementById('pom-break-input');
      if (breakInput) breakInput.value = Math.floor(state.pomodoro.breakDuration / 60);
      
      renderTimer();
    } catch (e) {
      console.error('Pomodoro load error:', e);
    }
  }

  function toggleTimer() {
    if (state.pomodoro.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  function startTimer() {
    if (state.pomodoro.interval) clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = true;
    updatePlayPauseBtn(true);

    state.pomodoro.interval = setInterval(() => {
      state.pomodoro.remaining--;
      renderTimer();
      savePomodoroState();

      if (state.pomodoro.remaining <= 0) {
        clearInterval(state.pomodoro.interval);
        state.pomodoro.isRunning = false;
        savePomodoroState();
        onTimerEnd();
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(state.pomodoro.interval);
    state.pomodoro.isRunning = false;
    updatePlayPauseBtn(false);
    savePomodoroState();
  }

  function resetTimer() {
    pauseTimer();
    state.pomodoro.remaining = state.pomodoro.isBreak ? state.pomodoro.breakDuration : state.pomodoro.duration;
    renderTimer();
    savePomodoroState();
  }

  function onTimerEnd() {
    updatePlayPauseBtn(false);
    const isBreak = state.pomodoro.isBreak;

    if (!isBreak) {
      // Complete the first pending task
      const pending = state.tasks.filter(t => t.status !== 'completed');
      if (pending.length > 0) {
        markTaskComplete(pending[0].id, pending[0].duration_block);
        state.pomodoro.sessions++;
      }
      // Start break
      state.pomodoro.isBreak = true;
      state.pomodoro.remaining = state.pomodoro.breakDuration;
      showTimerNotification('✅ Session Complete! Time for a break.', 'success');
    } else {
      state.pomodoro.isBreak = false;
      state.pomodoro.remaining = state.pomodoro.duration;
      showTimerNotification('🔥 Break over! Back to work.', 'warning');
    }

    renderTimer();
    renderTaskStack();
    triggerTimerRing();
    savePomodoroState();
  }

  function skipBreak() {
    if (!state.pomodoro.isBreak) return;
    pauseTimer();
    state.pomodoro.isBreak = false;
    state.pomodoro.remaining = state.pomodoro.duration;
    renderTimer();
    savePomodoroState();
  }

  function skipTask() {
    const pending = state.tasks.filter(t => t.status !== 'completed');
    if (pending.length < 2) return; // nothing to skip to
    // Move the first pending task to the end of the main array
    const idx = state.tasks.findIndex(t => t.id === pending[0].id);
    if (idx !== -1) {
      const [task] = state.tasks.splice(idx, 1);
      state.tasks.push(task);
    }
    pauseTimer();
    state.pomodoro.remaining = state.pomodoro.duration;
    state.pomodoro.isBreak = false;
    renderTimer();
    renderTaskStack();
    savePomodoroState();
  }

  function renderTimer() {
    const mins = Math.floor(state.pomodoro.remaining / 60).toString().padStart(2, '0');
    const secs = (state.pomodoro.remaining % 60).toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    const ring = document.getElementById('timer-ring');
    const label = document.getElementById('timer-label');

    if (display) display.textContent = `${mins}:${secs}`;

    const total = Math.max(1, state.pomodoro.isBreak ? state.pomodoro.breakDuration : state.pomodoro.duration);
    if (ring) {
      const circumference = 553; 
      const progress = state.pomodoro.remaining / total;
      const offset = circumference * (1 - progress);
      
      ring.setAttribute('stroke-dasharray', circumference);
      
      if (state.pomodoro.isRunning) {
        ring.style.transition = 'stroke-dashoffset 1s linear';
      } else {
        ring.style.transition = 'none';
      }
      
      ring.style.strokeDashoffset = offset;
    }
    if (label) {
      label.textContent = state.pomodoro.isBreak ? 'Break Time' : 'Focus Time';
      label.className = state.pomodoro.isBreak
        ? 'text-xs font-semibold uppercase tracking-widest text-emerald-500'
        : 'text-xs font-semibold uppercase tracking-widest text-primary-500';
    }

    // Sessions badge
    const sesEl = document.getElementById('pom-sessions');
    if (sesEl) sesEl.textContent = state.pomodoro.sessions;
    const skipBreakBtn = document.getElementById('btn-skip-break');
    if (skipBreakBtn) {
      if (state.pomodoro.isBreak) skipBreakBtn.classList.remove('hidden');
      else skipBreakBtn.classList.add('hidden');
    }
  }

  function updatePlayPauseBtn(isRunning) {
    const btn = document.getElementById('btn-play-pause');
    if (!btn) return;
    btn.innerHTML = isRunning
      ? `<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
      : `<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>`;
    btn.classList.toggle('bg-primary-500', isRunning);
    btn.classList.toggle('bg-white', !isRunning);
    btn.classList.toggle('text-white', isRunning);
    btn.classList.toggle('text-primary-500', !isRunning);
  }

  function triggerTimerRing() {
    const ring = document.getElementById('timer-ring-container');
    if (ring) {
      ring.classList.add('animate-ping-once');
      setTimeout(() => ring.classList.remove('animate-ping-once'), 600);
    }
    try { new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAA==').play(); } catch(e) {}
  }

  function renderTaskStack() {
    const pending   = state.tasks.filter(t => t.status !== 'completed');
    const completed = state.tasks.filter(t => t.status === 'completed');

    // Always show the first pending task as current
    const current = pending[0] || null;
    const next    = pending[1] || null;
    const prev    = completed.length > 0 ? completed[completed.length - 1] : null;

    const elPrev    = document.getElementById('task-previous');
    const elCurrent = document.getElementById('task-current');
    const elNext    = document.getElementById('task-next');

    if (elPrev) elPrev.textContent = prev ? `✓ ${prev.title}` : '—';

    if (elCurrent) {
      if (current) {
        if (state.lastCurrentTaskId !== current.id) {
          state.lastCurrentTaskId = current.id;
          const input = document.getElementById('pom-work-input');
          if (input) {
            input.value = current.duration_block || 25;
            input.dispatchEvent(new Event('change'));
          }
        }

        const hContent = getHorizonContent(current.horizon_id);
        const dreamHtml = hContent ? `<p class="text-[15px] text-purple-500/90 font-semibold mt-1.5 flex items-center gap-1.5"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${escHtml(hContent)}</p>` : '';
        
        elCurrent.innerHTML = `${escHtml(current.title)}${dreamHtml}`;
        const badgeEl = document.getElementById('task-current-badge');
        if (badgeEl) {
          badgeEl.textContent = current.priority.toUpperCase();
          badgeEl.className = `${priorityColor(current.priority)} text-xs font-bold px-2 py-0.5 rounded-full`;
        }
        const durEl = document.getElementById('task-current-dur');
        if (durEl) durEl.textContent = formatDuration(current.duration_block);
        document.getElementById('btn-task-done')?.classList.remove('hidden');
      } else {
        state.lastCurrentTaskId = null;
        elCurrent.innerHTML = `No tasks — <a href="/time/tasks" class="text-primary-500 underline underline-offset-2 hover:text-primary-600">add one here!</a>`;
        const durEl = document.getElementById('task-current-dur');
        if (durEl) durEl.textContent = '';
        document.getElementById('btn-task-done')?.classList.add('hidden');
      }
    }

    if (elNext) elNext.textContent = next ? `→ ${next.title}` : '—';
  }

  // ─── Tasks ───────────────────────────────────────────────────────────────────
  async function addTask(data) {
    const res = await api('add_task', data);
    if (res.success) {
      state.tasks.push(res.task);
      renderTaskList();
      renderTaskStack();
    }
  }

  async function markTaskComplete(id, actualDuration = null) {
    // Optimistic update — update state immediately so UI reflects change at once
    const task = state.tasks.find(t => t.id == id);
    if (task) {
      task.status = 'completed';
      task.actual_duration = actualDuration;
    }
    renderTaskList();
    renderTaskStack();
    // Then persist to server in background
    await api('complete_task', { id, actual_duration: actualDuration });
  }

  async function deleteTask(id) {
    await api('delete_task', { id });
    state.tasks = state.tasks.filter(t => t.id != id);
    if (state.currentTaskIndex >= state.tasks.filter(t => t.status !== 'completed').length) {
      state.currentTaskIndex = Math.max(0, state.currentTaskIndex - 1);
    }
    renderTaskList();
    renderTaskStack();
  }

  async function restoreTask(id) {
    // Optimistic update
    const task = state.tasks.find(t => t.id == id);
    if (task) task.status = 'pending';
    renderTaskList();
    renderTaskStack();
    await api('restore_task', { id });
  }



  function getHorizonContent(id) {
    if (!id) return null;
    const all = [
      ...(state.horizons.week || []),
      ...(state.horizons.month || []),
      ...(state.horizons.year || [])
    ];
    const h = all.find(x => x.id == id);
    return h ? h.content : null;
  }

  function renderTaskList() {
    const container = document.getElementById('task-list');
    const completedContainer = document.getElementById('task-list-completed');
    if (!container) return;

    const priorities = ['urgent', 'medium', 'maybe', 'free'];
    const grouped = {};
    const completedTasks = [];
    
    priorities.forEach(p => { grouped[p] = []; });
    
    state.tasks.forEach(t => {
      if (t.status === 'completed') {
        completedTasks.push(t);
      } else {
        if (grouped[t.priority]) grouped[t.priority].push(t);
      }
    });

    container.innerHTML = '';
    let hasAny = false;

    priorities.forEach(priority => {
      if (grouped[priority].length === 0) return;
      hasAny = true;

      const section = document.createElement('div');
      section.className = 'mb-4';
      section.innerHTML = `<div class="flex items-center gap-2 mb-2">
        <span class="${priorityColor(priority)} text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">${priority}</span>
      </div>`;

      const taskCards = grouped[priority].map(task => {
        const hContent = getHorizonContent(task.horizon_id);
        const dreamHtml = hContent ? ` <span class="text-purple-500/80">· 🎯 ${escHtml(hContent)}</span>` : '';
        return `
        <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-2 group border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
          <button onclick="TimeApp.completeTask(${task.id})" class="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0 hover:border-primary-500 hover:bg-primary-500 transition-colors flex items-center justify-center"></button>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">${escHtml(task.title)}</p>
            <p class="text-xs text-slate-400 truncate">${formatDuration(task.duration_block)}${dreamHtml}</p>
          </div>
          <button onclick="TimeApp.deleteTask(${task.id})" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      `}).join('');

      section.innerHTML += taskCards;
      container.appendChild(section);
    });

    if (!hasAny) {
      container.innerHTML = `<div class="text-center py-8 text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <p class="text-sm">No tasks yet. Add one below!</p>
      </div>`;
    }

    // Render Completed Tasks
    if (completedContainer) {
      completedTasks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // Newest first
      
      const countEl = document.getElementById('completed-tasks-count');
      if (countEl) countEl.textContent = completedTasks.length;

      if (completedTasks.length === 0) {
        completedContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No completed tasks yet.</p>`;
      } else {
        completedContainer.innerHTML = completedTasks.map(task => `
          <div class="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl mb-2 group border border-slate-100 dark:border-slate-800 transition-all opacity-75 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <div class="w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0 flex items-center justify-center">
              <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-500 line-through truncate">${escHtml(task.title)}</p>
              <p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">${task.priority} Priority</p>
            </div>
            <button onclick="TimeApp.restoreTask(${task.id})" title="Restore to Active Tasks" class="opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-700 text-slate-500 hover:text-primary-500 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold transition-all flex-shrink-0 shadow-sm">
              RESTORE
            </button>
            <button onclick="TimeApp.deleteTask(${task.id})" title="Delete Permanently" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0 ml-1">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        `).join('');
      }
    }
  }

  // ─── Horizons ────────────────────────────────────────────────────────────────
  async function addHorizon(type, content) {
    const res = await api('add_horizon', { type, content });
    if (res.success) {
      state.horizons[type] = state.horizons[type] || [];
      state.horizons[type].push(res.horizon);
      renderHorizons();
    }
  }

  async function deleteHorizon(id, type) {
    await api('delete_horizon', { id });
    state.horizons[type] = state.horizons[type].filter(h => h.id != id);
    renderHorizons();
  }

  async function completeHorizon(id, type) {
    await api('complete_horizon', { id });
    const h = state.horizons[type]?.find(h => h.id == id);
    if (h) h.status = 'completed';
    renderHorizons();
  }

  function renderHorizons() {
    let allArchived = [];

    ['week', 'month', 'year'].forEach(type => {
      const container = document.getElementById(`horizon-${type}`);
      if (!container) return;

      const items = state.horizons[type] || [];
      const activeItems = items.filter(h => h.status !== 'completed');
      const archivedItems = items.filter(h => h.status === 'completed');

      allArchived = allArchived.concat(archivedItems.map(h => ({ ...h, type })));

      container.innerHTML = activeItems.map(h => `
        <div data-horizon-item class="group flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 mb-2 transition-all hover:border-slate-300 dark:hover:border-slate-600">
          <button onclick="TimeApp.completeHorizon(${h.id}, '${type}')" title="Mark as Done" class="mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 transition-colors flex items-center justify-center">
          </button>
          <p class="flex-1 text-sm text-slate-700 dark:text-slate-300">${escHtml(h.content)}</p>
          <button onclick="TimeApp.deleteHorizon(${h.id}, '${type}')" title="Delete" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('') || `<p class="text-xs text-slate-400 text-center py-4">Nothing planned yet.</p>`;
    });

    const archivedContainer = document.getElementById('horizon-archived');
    if (archivedContainer) {
      allArchived.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)); // Sort newest first if possible
      
      if (allArchived.length === 0) {
          archivedContainer.innerHTML = `<div class="col-span-full py-6 text-center text-slate-400 text-xs">No archived goals yet. Keep pushing!</div>`;
      } else {
          archivedContainer.innerHTML = allArchived.map(h => `
            <div class="group flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 mb-2 opacity-75 hover:opacity-100 transition-all">
              <div class="mt-0.5 w-4 h-4 rounded flex-shrink-0 bg-emerald-500 flex items-center justify-center">
                <svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm line-through text-slate-500 truncate">${escHtml(h.content)}</p>
                <p class="text-[10px] uppercase font-bold text-slate-400 mt-1">${h.type} goal</p>
              </div>
              <button onclick="TimeApp.deleteHorizon(${h.id}, '${h.type}')" title="Delete Permanently" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('');
      }

      const countEl = document.getElementById('archived-count');
      if (countEl) countEl.textContent = allArchived.length;
    }
  }

  // ─── Idea Capture & Rich Editor ──────────────────────────────────────────────
  let mentionState = { active: false, query: '', node: null, offset: 0, selectedIndex: 0, items: [] };

  function initRichEditor() {
    const editor = document.getElementById('idea-editor');
    if (!editor) return;

    editor.addEventListener('keydown', handleEditorKeydown);
    editor.addEventListener('input', handleEditorInput);
    editor.addEventListener('blur', () => setTimeout(closeMentionDropdown, 200));

    // Handle tooltips via event delegation
    editor.addEventListener('mouseover', (e) => {
      const pill = e.target.closest('[data-type]');
      if (pill) showTagTooltip(pill);
    });
    editor.addEventListener('mouseout', (e) => {
      if (e.target.closest('[data-type]')) hideTagTooltip();
    });

    // Submitting idea with Ctrl+Enter
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        submitIdea();
      }
    });

    // Handle mention click
    const dropdown = document.getElementById('mention-dropdown');
    if (dropdown) {
      dropdown.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.mention-item');
        if (item) {
          e.preventDefault(); // keep focus
          const idx = parseInt(item.getAttribute('data-mention-idx'));
          if (!isNaN(idx) && mentionState.items[idx]) {
            insertTagPill(mentionState.items[idx]);
          }
        }
      });
    }

    // Character counting
    editor.addEventListener('input', () => {
      const el = document.getElementById('idea-char-count');
      if (el) el.textContent = editor.innerText.length + ' chars';
    });
  }

  function handleEditorInput() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    
    // Ensure we are in a text node
    if (node.nodeType !== Node.TEXT_NODE) {
      closeMentionDropdown();
      return;
    }

    const textBeforeCaret = node.textContent.substring(0, range.startOffset);
    const match = textBeforeCaret.match(/@(\w*)$/);

    if (match) {
      mentionState.active = true;
      mentionState.query = match[1].toLowerCase();
      mentionState.node = node;
      mentionState.offset = match.index;
      mentionState.selectedIndex = 0;
      updateMentionDropdown();
      positionMentionDropdown(range);
    } else {
      closeMentionDropdown();
    }
  }

  function handleEditorKeydown(e) {
    if (!mentionState.active) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      mentionState.selectedIndex = (mentionState.selectedIndex + 1) % mentionState.items.length;
      renderMentionDropdownItems();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      mentionState.selectedIndex = (mentionState.selectedIndex - 1 + mentionState.items.length) % mentionState.items.length;
      renderMentionDropdownItems();
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionState.items.length > 0) {
        e.preventDefault();
        insertTagPill(mentionState.items[mentionState.selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMentionDropdown();
    }
  }

  function updateMentionDropdown() {
    // Collect all tasks and plans
    const pendingTasks = state.tasks.filter(t => t.status !== 'completed').map(t => ({ ...t, _tagType: 'task' }));
    const allPlans = [
      ...(state.horizons.week || []),
      ...(state.horizons.month || []),
      ...(state.horizons.year || [])
    ].filter(h => h.status === 'active').map(h => ({ ...h, _tagType: 'plan' }));

    let combined = [...pendingTasks, ...allPlans];
    
    if (mentionState.query) {
      combined = combined.filter(item => {
        const title = item._tagType === 'task' ? item.title : item.content;
        return title.toLowerCase().includes(mentionState.query);
      });
    }

    mentionState.items = combined.slice(0, 10); // Limit to 10

    if (mentionState.items.length > 0) {
      renderMentionDropdownItems();
      const dd = document.getElementById('mention-dropdown');
      dd.classList.remove('hidden', 'opacity-0', 'scale-95');
    } else {
      closeMentionDropdown();
    }
  }

  function renderMentionDropdownItems() {
    const list = document.getElementById('mention-list');
    if (!list) return;

    list.innerHTML = mentionState.items.map((item, idx) => {
      const isSelected = idx === mentionState.selectedIndex;
      const title = item._tagType === 'task' ? item.title : item.content;
      const icon = item._tagType === 'task' ? '📌 Task' : '🎯 Plan';
      const color = item._tagType === 'task' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      
      return `
        <div data-mention-idx="${idx}" class="mention-item cursor-pointer px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${isSelected ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">${escHtml(title)}</span>
          <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${color}">${icon}</span>
        </div>
      `;
    }).join('');
  }

  function positionMentionDropdown(range) {
    const dd = document.getElementById('mention-dropdown');
    if (!dd) return;
    
    const rect = range.getBoundingClientRect();
    const editorRect = document.getElementById('idea-editor').getBoundingClientRect();
    
    // Position relative to editor container
    let top = rect.bottom - editorRect.top + 8;
    let left = rect.left - editorRect.left;

    dd.style.top = `${top}px`;
    dd.style.left = `${left}px`;
  }

  function closeMentionDropdown() {
    mentionState.active = false;
    const dd = document.getElementById('mention-dropdown');
    if (dd) dd.classList.add('hidden', 'opacity-0', 'scale-95');
  }

  function insertTagPill(item) {
    if (!mentionState.node) return;

    const title = item._tagType === 'task' ? item.title : item.content;
    const isTask = item._tagType === 'task';
    const pillHtml = `<span contenteditable="false" data-type="${item._tagType}" data-id="${item.id}" class="inline-flex items-center gap-1 align-baseline px-1.5 py-0.5 mx-1 rounded-md text-xs font-bold border cursor-default select-none transition-colors ${isTask ? 'bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800 hover:bg-primary-100' : 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800 hover:bg-purple-100'}">@${escHtml(title)}</span>`;

    // Extract text before and after the @query
    const textBefore = mentionState.node.textContent.substring(0, mentionState.offset);
    const textAfter = mentionState.node.textContent.substring(mentionState.offset + 1 + mentionState.query.length);

    // Create document fragment
    const frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(textBefore));
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = pillHtml;
    const pillNode = tempDiv.firstChild;
    frag.appendChild(pillNode);
    
    const spaceNode = document.createTextNode('\u00A0' + textAfter); // Non-breaking space + rest
    frag.appendChild(spaceNode);

    // Replace the old text node
    mentionState.node.parentNode.replaceChild(frag, mentionState.node);

    // Move caret after the space
    const sel = window.getSelection();
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.setStart(spaceNode, 1);
    newRange.collapse(true);
    sel.addRange(newRange);

    closeMentionDropdown();
    document.getElementById('idea-editor')?.focus();
  }

  function showTagTooltip(pill) {
    const tooltip = document.getElementById('tag-tooltip');
    const content = document.getElementById('tag-tooltip-content');
    if (!tooltip || !content) return;

    const type = pill.getAttribute('data-type');
    const id = pill.getAttribute('data-id');

    let item;
    if (type === 'task') {
      item = state.tasks.find(t => t.id == id);
      if (item) {
        content.innerHTML = `
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-bold uppercase tracking-wider text-primary-500">📌 Task</span>
            <span class="${priorityColor(item.priority)} text-[10px] px-1.5 py-0.5 rounded-sm uppercase font-bold">${item.priority}</span>
          </div>
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">${escHtml(item.title)}</p>
          <p class="text-xs text-slate-500 mt-1">Duration: ${formatDuration(item.duration_block)}</p>
        `;
      }
    } else {
      item = ['week', 'month', 'year'].flatMap(k => state.horizons[k] || []).find(h => h.id == id);
      if (item) {
        content.innerHTML = `
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-bold uppercase tracking-wider text-purple-500">🎯 Dream Plan</span>
          </div>
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">${escHtml(item.content)}</p>
        `;
      }
    }

    if (!item) return;

    // Position tooltip
    const pillRect = pill.getBoundingClientRect();
    const editorRect = document.getElementById('idea-editor').getBoundingClientRect();
    
    tooltip.style.top = `${pillRect.bottom - editorRect.top + 8}px`;
    tooltip.style.left = `${pillRect.left - editorRect.left}px`;
    
    tooltip.classList.remove('hidden', 'opacity-0', '-translate-y-2');
  }

  function hideTagTooltip() {
    const tooltip = document.getElementById('tag-tooltip');
    if (tooltip) tooltip.classList.add('hidden', 'opacity-0', '-translate-y-2');
  }

  async function submitIdea() {
    const editor = document.getElementById('idea-editor');
    const textarea = document.getElementById('idea-textarea');
    
    if (!editor && !textarea) return;

    let content = '';
    let linkedTaskId = null;
    let linkedHorizonId = null;

    // Handle Rich Editor (ContentEditable)
    if (editor && editor.innerText.trim()) {
      const pills = editor.querySelectorAll('[data-type]');
      const originalStates = [];
      
      // Momentarily swap pill text for tag versions to capture the raw content
      pills.forEach(pill => {
        const type = pill.getAttribute('data-type');
        const id = pill.getAttribute('data-id');
        if (type === 'task' && !linkedTaskId) linkedTaskId = parseInt(id);
        if (type === 'plan' && !linkedHorizonId) linkedHorizonId = parseInt(id);
        
        originalStates.push({ pill, text: pill.innerText });
        pill.innerText = `@${type}:${id}`;
      });
      
      content = editor.innerText.trim();
      
      // Restore pill visual state
      originalStates.forEach(item => {
        item.pill.innerText = item.text;
      });

      // Normalize whitespace: trim and collapse excessive newlines
      content = content.replace(/\r?\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    } 
    // Handle Dashboard Textarea
    else if (textarea && textarea.value.trim()) {
      content = textarea.value.trim();
      const taskMatch = content.match(/@task:(\d+)/);
      if (taskMatch) linkedTaskId = parseInt(taskMatch[1]);
      const planMatch = content.match(/@plan:(\d+)/);
      if (planMatch) linkedHorizonId = parseInt(planMatch[1]);
    } else {
      return;
    }

    const res = await api('add_idea', {
      content,
      linked_task_id: linkedTaskId,
      linked_horizon_id: linkedHorizonId
    });

    if (res.success) {
      if (editor) editor.innerHTML = '';
      if (textarea) textarea.value = '';
      renderIdeas();
      
      // Success feedback
      const btn = document.getElementById('btn-submit-idea');
      if (btn) {
        const originalHtml = btn.innerHTML;
        btn.innerHTML = 'Captured!';
        btn.classList.add('bg-emerald-600');
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.classList.remove('bg-emerald-600');
        }, 2000);
      }
    }
  }

  async function deleteIdea(id) {
    if (!confirm('Are you sure you want to delete this idea?')) return;
    const res = await api('delete_idea', { id });
    if (res.success) {
      state.ideas = state.ideas.filter(i => i.id != id);
      renderIdeas();
    }
  }

  function editIdea(id) {
    state.editingIdeaId = id;
    renderIdeas();
  }

  function cancelEdit() {
    state.editingIdeaId = null;
    renderIdeas();
  }

  async function saveEdit(id) {
    const textarea = document.getElementById(`edit-idea-${id}`);
    if (!textarea) return;
    const content = textarea.value.trim();
    if (!content) return;

    const res = await api('update_idea', { id, content });
    if (res.success) {
      const idea = state.ideas.find(i => i.id == id);
      if (idea) idea.content = content;
      state.editingIdeaId = null;
      renderIdeas();
    }
  }

  function renderIdeas() {
    const container = document.getElementById('ideas-list');
    if (!container) return;

    container.innerHTML = state.ideas.map(idea => {
      if (state.editingIdeaId == idea.id) {
        return `
          <div class="p-3.5 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-200 dark:border-primary-800/50 mb-2">
            <textarea id="edit-idea-${idea.id}" class="w-full bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none resize-none leading-relaxed" rows="3">${escHtml(idea.content)}</textarea>
            <div class="flex justify-end gap-2 mt-2">
              <button onclick="TimeApp.cancelEdit()" class="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button onclick="TimeApp.saveEdit(${idea.id})" class="text-[10px] font-bold uppercase text-primary-500 hover:text-primary-600 transition-colors">Save Changes</button>
            </div>
          </div>
        `;
      }

      return `
        <div class="p-3.5 bg-white dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-700/50 mb-2 group relative">
          <!-- Management Actions -->
          <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button onclick="TimeApp.editIdea(${idea.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all" title="Edit Idea">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button onclick="TimeApp.deleteIdea(${idea.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all" title="Delete Idea">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>

          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pr-8">${formatIdeaContent(idea.content)}</p>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-slate-400">${timeAgo(idea.created_at)}</span>
            <div class="flex items-center gap-2">
              ${idea.linked_task_id ? (() => {
                  const task = state.tasks.find(t => t.id == idea.linked_task_id);
                  return `<span class="text-[10px] bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">📌 ${task ? escHtml(task.title) : 'Task'}</span>`;
              })() : ''}
              ${idea.linked_horizon_id ? (() => {
                  const content = getHorizonContent(idea.linked_horizon_id);
                  return `<span class="text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">🎯 ${content ? escHtml(content) : 'Plan'}</span>`;
              })() : ''}
            </div>
          </div>
        </div>
      `;
    }).join('') || `<p class="text-xs text-slate-400 text-center py-6">Your idea vault is empty. Start writing!</p>`;
    
    const countEl = document.getElementById('ideas-count');
    if (countEl) countEl.textContent = state.ideas.length + (state.ideas.length === 1 ? ' idea' : ' ideas');
  }

  function initHorizonDragDrop() { /* future enhancement */ }

  // ─── Render All ──────────────────────────────────────────────────────────────
  function renderAll() {
    renderTaskList();
    renderTaskStack();
    renderHorizons();
    renderIdeas();
    populateHorizonDropdown();
  }

  function populateHorizonDropdown() {
    const sel = document.getElementById('task-horizon-select');
    if (!sel) return;
    const all = [
      ...(state.horizons.week || []).map(h => ({ ...h, type: 'week' })),
      ...(state.horizons.month || []).map(h => ({ ...h, type: 'month' })),
      ...(state.horizons.year || []).map(h => ({ ...h, type: 'year' }))
    ].filter(h => h.status === 'active');

    sel.innerHTML = `<option value="">— No Dream Link —</option>` +
      all.map(h => `<option value="${h.id}">[${h.type.toUpperCase()}] ${escHtml(h.content)}</option>`).join('');
  }

  // ─── Form Bindings ───────────────────────────────────────────────────────────
  function bindForms() {
    // Add Task form
    const addTaskBtn = document.getElementById('btn-add-task');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        const title = document.getElementById('task-title')?.value?.trim();
        const priority = document.getElementById('task-priority')?.value || 'medium';
        const duration = parseInt(document.getElementById('task-duration')?.value) || 25;
        const horizonId = document.getElementById('task-horizon-select')?.value || null;
        if (!title) return shakeField('task-title');
        addTask({ title, priority, duration_block: duration, horizon_id: horizonId });
        document.getElementById('task-title').value = '';
      });
    }

    // Add Horizon forms
    ['week', 'month', 'year'].forEach(type => {
      const btn = document.getElementById(`btn-add-${type}`);
      if (btn) {
        btn.addEventListener('click', () => {
          const input = document.getElementById(`horizon-input-${type}`);
          const content = input?.value?.trim();
          if (!content) return shakeField(`horizon-input-${type}`);
          addHorizon(type, content);
          if (input) input.value = '';
        });
        // Enter key
        document.getElementById(`horizon-input-${type}`)?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') btn.click();
        });
      }
    });

    // Idea submit btn
    document.getElementById('btn-submit-idea')?.addEventListener('click', submitIdea);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────
  function priorityBadge(priority) {
    const el = document.createElement('span');
    el.id = 'task-current-badge';
    el.className = `${priorityColor(priority)} text-xs font-bold px-2 py-0.5 rounded-full`;
    el.textContent = priority.toUpperCase();
    return el;
  }

  function priorityColor(p) {
    return {
      urgent: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      maybe: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      free: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    }[p] || 'bg-slate-100 text-slate-500';
  }

  function formatDuration(mins) {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  function formatIdeaContent(text) {
    return escHtml(text)
      .replace(/@task:(\d+)/g, (match, id) => {
        const task = state.tasks.find(t => t.id == id);
        return `<span class="text-primary-500 font-bold" title="Task ID: ${id}">@${task ? escHtml(task.title) : 'Task:'+id}</span>`;
      })
      .replace(/@plan:(\d+)/g, (match, id) => {
        const content = getHorizonContent(id);
        return `<span class="text-purple-500 font-bold" title="Plan ID: ${id}">@${content ? escHtml(content) : 'Plan:'+id}</span>`;
      })
      .replace(/\r?\n/g, '<br>');
  }

  function timeAgo(dateStr) {
    if (!dateStr) return 'just now';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }

  function escHtml(text) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(text || ''));
    return d.innerHTML;
  }

  function shakeField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('ring-2', 'ring-red-400');
    el.focus();
    setTimeout(() => el.classList.remove('ring-2', 'ring-red-400'), 1500);
  }

  function showTimerNotification(msg, type) {
    const notif = document.getElementById('timer-notification');
    if (!notif) return;
    notif.textContent = msg;
    notif.className = `fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl transition-all ${
      type === 'success' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
    }`;
    setTimeout(() => { notif.className = 'hidden'; }, 4000);
  }

  // ─── Public API ──────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    init();
    bindForms();
  });

  return {
    completeTask: markTaskComplete,
    deleteTask: deleteTask,
    deleteHorizon: deleteHorizon,
    completeHorizon: completeHorizon,
    submitIdea: submitIdea,
    restoreTask: restoreTask,
    editIdea: editIdea,
    cancelEdit: cancelEdit,
    saveEdit: saveEdit,
    deleteIdea: deleteIdea
  };

})();
