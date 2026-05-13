/**
 * Time Application - Render Engine
 */
window.TimeApp = window.TimeApp || {};

(function(App) {
  const { state } = App;

  App.renderAll = function() {
    App.renderTaskList();
    App.renderTaskStack();
    App.renderHorizons();
    App.renderIdeas();
    App.populateHorizonDropdown();
  };

  App.renderTimer = function() {
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
      ring.style.transition = state.pomodoro.isRunning ? 'stroke-dashoffset 1s linear' : 'stroke-dashoffset 0.3s ease';
      ring.style.strokeDashoffset = offset;
    }
    if (label) {
      label.textContent = state.pomodoro.isBreak ? 'Break Time' : 'Focus Time';
      label.className = state.pomodoro.isBreak ? 'text-xs font-semibold uppercase tracking-widest text-emerald-500' : 'text-xs font-semibold uppercase tracking-widest text-primary-500';
    }

    const sesEl = document.getElementById('pom-sessions');
    if (sesEl) sesEl.textContent = state.pomodoro.sessions;
    const skipBreakBtn = document.getElementById('btn-skip-break');
    if (skipBreakBtn) {
      if (state.pomodoro.isBreak) skipBreakBtn.classList.remove('hidden');
      else skipBreakBtn.classList.add('hidden');
    }

    const workInput = document.getElementById('pom-work-input');
    const breakInput = document.getElementById('pom-break-input');
    const adjustBtns = document.querySelectorAll('.pom-adjust-btn');
    if (workInput) {
        workInput.disabled = state.pomodoro.isRunning;
        workInput.classList.toggle('opacity-50', state.pomodoro.isRunning);
    }
    if (breakInput) {
        breakInput.disabled = state.pomodoro.isRunning;
        breakInput.classList.toggle('opacity-50', state.pomodoro.isRunning);
    }
    adjustBtns.forEach(btn => {
        btn.disabled = state.pomodoro.isRunning;
        btn.classList.toggle('opacity-30', state.pomodoro.isRunning);
        btn.classList.toggle('cursor-not-allowed', state.pomodoro.isRunning);
    });
  };

  App.renderTaskStack = function() {
    const pending   = state.tasks.filter(t => t.status !== 'completed');
    const completed = state.tasks.filter(t => t.status === 'completed');
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
        const hContent = App.getHorizonContent(current.horizon_id);
        const dreamHtml = hContent ? `<p class="text-[15px] text-purple-500/90 font-semibold mt-1.5 flex items-center gap-1.5"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> ${App.escHtml(hContent)}</p>` : '';
        elCurrent.innerHTML = `${App.escHtml(current.title)}${dreamHtml}`;
        const badgeEl = document.getElementById('task-current-badge');
        if (badgeEl) {
          badgeEl.textContent = current.priority.toUpperCase();
          badgeEl.className = `${App.priorityColor(current.priority)} text-xs font-bold px-2 py-0.5 rounded-full`;
        }
        const durEl = document.getElementById('task-current-dur');
        if (durEl) durEl.textContent = App.formatDuration(current.duration_block);
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
  };

  App.renderTaskList = function() {
    const container = document.getElementById('task-list');
    const completedContainer = document.getElementById('task-list-completed');
    if (!container) return;

    const priorities = ['urgent', 'medium', 'maybe', 'free'];
    const grouped = {};
    const completedTasks = [];
    priorities.forEach(p => { grouped[p] = []; });
    state.tasks.forEach(t => {
      if (t.status === 'completed') completedTasks.push(t);
      else if (grouped[t.priority]) grouped[t.priority].push(t);
    });

    container.innerHTML = '';
    let hasAny = false;
    priorities.forEach(priority => {
      if (grouped[priority].length === 0) return;
      hasAny = true;
      const section = document.createElement('div');
      section.className = 'mb-4';
      section.innerHTML = `<div class="flex items-center gap-2 mb-2"><span class="${App.priorityColor(priority)} text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">${priority}</span></div>`;
      section.innerHTML += grouped[priority].map(task => {
        const hContent = App.getHorizonContent(task.horizon_id);
        const dreamHtml = hContent ? ` <span class="text-purple-500/80 font-bold">· 🎯 ${App.escHtml(hContent)}</span>` : '';
        return `
        <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-2 group border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all shadow-sm hover:shadow-apple">
          <button onclick="TimeApp.completeTask(${task.id})" title="Mark Complete" class="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700 flex-shrink-0 hover:border-emerald-500 hover:bg-emerald-500 transition-colors flex items-center justify-center group/btn">
            <svg class="w-3.5 h-3.5 text-white opacity-0 group-hover/btn:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">${App.escHtml(task.title)}</p>
            <p class="text-[10px] text-slate-400 uppercase tracking-widest font-black flex items-center gap-1">${task.duration_block} MIN ${dreamHtml}</p>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="TimeApp.openEditTask(${task.id})" class="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-primary-500 transition-all"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button onclick="TimeApp.deleteTask(${task.id})" class="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
          </div>
        </div>`;
      }).join('');
      container.appendChild(section);
    });
    if (!hasAny) container.innerHTML = `<div class="text-center py-8 text-slate-400"><svg class="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg><p class="text-sm">No tasks yet. Add one below!</p></div>`;

    if (completedContainer) {
      completedTasks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const countEl = document.getElementById('completed-tasks-count');
      if (countEl) countEl.textContent = completedTasks.length;
      if (completedTasks.length === 0) completedContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No completed tasks yet.</p>`;
      else completedContainer.innerHTML = completedTasks.map(task => `
        <div class="flex items-center gap-3 p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl mb-2 group border border-slate-100 dark:border-slate-800 transition-all opacity-75 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-800/50">
          <div class="w-5 h-5 rounded-full bg-emerald-500 flex-shrink-0 flex items-center justify-center"><svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="flex-1 min-w-0"><p class="text-sm font-medium text-slate-500 line-through truncate">${App.escHtml(task.title)}</p><p class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">${task.priority} Priority</p></div>
          <button onclick="TimeApp.restoreTask(${task.id})" class="opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-700 text-slate-500 hover:text-primary-500 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-bold transition-all flex-shrink-0 shadow-sm">RESTORE</button>
          <button onclick="TimeApp.deleteTask(${task.id})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0 ml-1"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
        </div>`).join('');
    }
  };

  App.renderHorizons = function() {
    let allArchived = [];
    ['week', 'month', 'year'].forEach(type => {
      const container = document.getElementById(`horizon-${type}`);
      if (!container) return;
      const items = state.horizons[type] || [];
      const activeItems = items.filter(h => h.status !== 'completed');
      const archivedItems = items.filter(h => h.status === 'completed');
      allArchived = allArchived.concat(archivedItems.map(h => ({ ...h, type })));
      container.innerHTML = activeItems.map(h => `
        <div data-horizon-item draggable="true" ondragstart="event.dataTransfer.setData('text/plain', ${h.id})" class="group flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 mb-2 transition-all hover:border-slate-300 dark:hover:border-slate-600 cursor-grab active:cursor-grabbing">
          <div class="mt-1 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></div>
          <button onclick="TimeApp.completeHorizon(${h.id}, '${type}')" class="mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 transition-colors flex items-center justify-center"></button>
          <p class="flex-1 text-sm text-slate-700 dark:text-slate-300">${App.escHtml(h.content)}</p>
          <button onclick="TimeApp.deleteHorizon(${h.id}, '${type}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`).join('') || `<p class="text-xs text-slate-400 text-center py-4">Nothing planned yet.</p>`;
    });

    const archivedContainer = document.getElementById('horizon-archived');
    if (archivedContainer) {
      allArchived.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      if (allArchived.length === 0) archivedContainer.innerHTML = `<div class="col-span-full py-6 text-center text-slate-400 text-xs">No archived goals yet. Keep pushing!</div>`;
      else archivedContainer.innerHTML = allArchived.map(h => `
        <div class="group flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 mb-2 opacity-75 hover:opacity-100 transition-all">
          <div class="mt-0.5 w-4 h-4 rounded flex-shrink-0 bg-emerald-500 flex items-center justify-center"><svg class="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="flex-1 min-w-0"><p class="text-sm line-through text-slate-500 truncate">${App.escHtml(h.content)}</p><p class="text-[10px] uppercase font-bold text-slate-400 mt-1">${h.type} goal</p></div>
          <button onclick="TimeApp.deleteHorizon(${h.id}, '${h.type}')" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>`).join('');
      const countEl = document.getElementById('archived-count');
      if (countEl) countEl.textContent = allArchived.length;
    }
  };

  App.renderIdeas = function() {
    const container = document.getElementById('ideas-list');
    if (!container) return;
    if (state.ideas.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-slate-400"><svg class="w-12 h-12 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><p class="text-sm font-medium">Your vault is empty.</p><p class="text-xs mt-1">Write your first idea!</p></div>`;
      return;
    }
    container.innerHTML = state.ideas.map(idea => {
      const isEditing = state.editingIdeaId == idea.id;
      const animClass = idea._isNew ? 'animate-in fade-in slide-in-from-top-4 duration-700 ease-out' : '';
      return `
        <div class="p-3.5 bg-white dark:bg-slate-800/30 rounded-xl border ${isEditing ? 'border-primary-500 shadow-primary-100 dark:shadow-none' : 'border-slate-100 dark:border-slate-700/50'} mb-2 group relative transition-all ${animClass}">
          <div class="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button onclick="TimeApp.editIdea(${idea.id})" class="p-1.5 rounded-lg ${isEditing ? 'text-primary-500' : 'text-slate-400'} hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-all"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button onclick="TimeApp.deleteIdea(${idea.id})" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
          <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pr-8 whitespace-pre-wrap">${App.formatIdeaContent(idea.content)}</p>
          <div class="flex items-center justify-between mt-2">
            <span class="text-xs text-slate-400">${App.timeAgo(idea.created_at)}</span>
            <div class="flex items-center gap-2">
              ${idea.linked_task_id ? (() => { const t = state.tasks.find(x => x.id == idea.linked_task_id); return `<span class="text-[10px] bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">📌 ${t ? App.escHtml(t.title) : 'Task'}</span>`; })() : ''}
              ${idea.linked_horizon_id ? (() => { const c = App.getHorizonContent(idea.linked_horizon_id); return `<span class="text-[10px] bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-tight">🎯 ${c ? App.escHtml(c) : 'Plan'}</span>`; })() : ''}
            </div>
          </div>
        </div>`;
    }).join('');
    const countEl = document.getElementById('ideas-count');
    if (countEl) countEl.textContent = state.ideas.length + (state.ideas.length === 1 ? ' idea' : ' ideas');
  };

  App.formatIdeaContent = function(text) {
    return App.escHtml(text)
      .replace(/@task:(\d+)/g, (m, id) => { const t = state.tasks.find(x => x.id == id); return `<span class="text-primary-500 font-bold">@${t ? App.escHtml(t.title) : 'Task:'+id}</span>`; })
      .replace(/@plan:(\d+)/g, (m, id) => { const c = App.getHorizonContent(id); return `<span class="text-purple-500 font-bold">@${c ? App.escHtml(c) : 'Plan:'+id}</span>`; })
      .replace(/\r?\n/g, '<br>');
  };

  App.getHorizonContent = function(id) {
    if (!id) return null;
    return ['week', 'month', 'year'].flatMap(k => state.horizons[k] || []).find(h => h.id == id)?.content || null;
  };

  App.populateHorizonDropdown = function() {
    const sel = document.getElementById('task-horizon-select');
    if (!sel) return;
    const all = ['week', 'month', 'year'].flatMap(type => (state.horizons[type] || []).map(h => ({ ...h, type }))).filter(h => h.status === 'active');
    sel.innerHTML = `<option value="">— No Dream Link —</option>` + all.map(h => `<option value="${h.id}">[${h.type.toUpperCase()}] ${App.escHtml(h.content)}</option>`).join('');
  };

  App.showIdeaFeedback = function() {
    const btn = document.getElementById('btn-submit-idea');
    if (btn) {
      const old = btn.innerHTML;
      btn.innerHTML = state.editingIdeaId ? 'Updated!' : 'Captured!';
      btn.classList.add('bg-emerald-600');
      setTimeout(() => { btn.innerHTML = old; btn.classList.remove('bg-emerald-600'); }, 2000);
    }
  };

  App.updateCaptureAreaUI = function() {
    const btn = document.getElementById('btn-submit-idea');
    if (!btn) return;
    if (state.editingIdeaId) {
      btn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Update Idea`;
      btn.classList.replace('bg-emerald-500', 'bg-primary-500');
      btn.classList.replace('hover:bg-emerald-600', 'hover:bg-primary-600');
    } else {
      btn.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Capture Idea`;
      btn.classList.replace('bg-primary-500', 'bg-emerald-500');
      btn.classList.replace('hover:bg-primary-600', 'hover:bg-emerald-600');
    }
    let cancelBtn = document.getElementById('btn-cancel-idea-edit');
    if (state.editingIdeaId) {
      if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btn-cancel-idea-edit';
        cancelBtn.className = 'text-[10px] font-bold uppercase text-slate-400 hover:text-slate-600 transition-colors mr-3';
        cancelBtn.textContent = 'Cancel Edit';
        cancelBtn.onclick = App.cancelEdit;
        btn.parentNode.insertBefore(cancelBtn, btn);
      }
    } else if (cancelBtn) cancelBtn.remove();
  };

  App.updatePlayPauseBtn = function(isRunning) {
    const btn = document.getElementById('btn-play-pause');
    if (!btn) return;
    btn.innerHTML = isRunning ? `<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>` : `<svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>`;
    
    // Consistent two-color design: Primary (Orange) and White
    btn.className = "w-16 h-16 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-200 dark:shadow-none hover:bg-primary-600 hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95";
  };

  App.triggerTimerRing = function() {
    const ring = document.getElementById('timer-ring-container');
    if (ring) {
      ring.classList.add('animate-ping-once');
      setTimeout(() => ring.classList.remove('animate-ping-once'), 600);
    }
  };

  App.showTimerNotification = function(msg, type) {
    const notif = document.getElementById('timer-notification');
    if (!notif) return;
    notif.textContent = msg;
    notif.className = `fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl transition-all ${type === 'success' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`;
    setTimeout(() => { notif.className = 'hidden'; }, 4000);
  };

})(window.TimeApp);
