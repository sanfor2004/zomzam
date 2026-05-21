<?php
/**
 * Zomzam Time Suite - Execution View
 * This page contains the Pomodoro Timer and the Active Task Stack.
 */
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE)
  session_start();

$pageTitle = 'Pomodoro Timer - Time Management';
$pageDescription = 'Focus on your current task with the Pomodoro technique.';
$timeJsDir = '/Assets/Js/Time/';
$additionalJS = [
  $timeJsDir . 'state.js',
  $timeJsDir . 'api.js',
  $timeJsDir . 'utils.js',
  $timeJsDir . 'render.js',
  $timeJsDir . 'pomodoro.js',
  $timeJsDir . 'tasks.js',
  $timeJsDir . 'horizons.js',
  $timeJsDir . 'ideas.js',
  $timeJsDir . 'init.js'
];

ob_start();
?>

<div id="zz-view-container" class="max-w-6xl mx-auto p-4 md:p-8">
<!-- [PART: NOTIFICATION_OVERLAY] - Used for timer alerts and toasts -->
<div id="timer-notification" class="hidden"></div>

<!-- [PART: PAGE_HEADER] - Top bar with page title and session counter -->
<div id="zz-exec-header" class="flex items-center gap-3 mb-6">
  <div id="zz-exec-header-icon-box" class="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
    <svg id="zz-exec-header-svg" class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle id="zz-exec-header-svg-circle" cx="12" cy="12" r="10" />
      <polyline id="zz-exec-header-svg-poly" points="12 6 12 12 16 14" />
    </svg>
  </div>
  <div id="zz-exec-header-text-box">
    <h1 id="zz-exec-header-title" class="text-xl font-bold text-slate-900 dark:text-white">Pomodoro Timer</h1>
    <p id="zz-exec-header-subtitle" class="text-xs text-slate-400">Stay in the zone. One task at a time.</p>
  </div>
  <div id="zz-exec-header-stats-box"
    class="ml-auto flex items-center gap-2 bg-white dark:bg-[#1a1d24] rounded-xl px-4 py-2 border border-slate-100 dark:border-slate-800 shadow-sm">
    <svg id="zz-exec-header-stats-svg" class="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path id="zz-exec-header-stats-path"
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
    <span id="zz-exec-header-stats-label" class="text-xs font-semibold text-slate-600 dark:text-slate-300">Sessions today: <span id="pom-sessions"
        class="text-primary-500 font-bold">0</span></span>
  </div>
</div>

<div id="zz-exec-main-grid" class="grid grid-cols-1 lg:grid-cols-5 gap-6">

  <!-- [PART: TIMER_SECTION] - Left column containing the visual ring and controls -->
  <div id="zz-exec-timer-section"
    class="lg:col-span-2 self-start bg-white dark:bg-[#1a1d24] rounded-3xl p-8 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col items-center">
    
    <!-- [SUB-PART: RING_VISUAL] - The SVG ring and countdown display -->
    <div id="timer-ring-container" class="relative w-56 h-56 mb-6">
      <svg id="zz-exec-timer-svg" class="w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle id="zz-exec-timer-bg-circle" cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="6"
          class="text-slate-100 dark:text-slate-800" />
        <circle id="timer-ring" cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="<?= round(2 * M_PI * 88) ?>"
          stroke-dashoffset="<?= round(2 * M_PI * 88) ?>" class="text-primary-500" />
      </svg>
      <div id="zz-exec-timer-display-box" class="absolute inset-0 flex flex-col items-center justify-center">
        <span id="timer-label" class="text-xs font-semibold uppercase tracking-widest text-primary-500">Focus
          Time</span>
        <span id="timer-display"
          class="text-5xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">15:00</span>
      </div>
    </div>

    <!-- [SUB-PART: TIMER_CONTROLS] - Play, Pause, Reset, and Skip buttons -->
    <div id="zz-exec-timer-controls-box" class="flex flex-col items-center gap-4 mb-5">
      <div id="zz-exec-timer-btn-row" class="flex items-center gap-4">
        <button id="btn-reset" title="Reset"
          class="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg id="zz-exec-reset-svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline id="zz-exec-reset-poly" points="1 4 1 10 7 10" />
            <path id="zz-exec-reset-path" d="M3.51 15a9 9 0 1 0 .49-4.95" />
          </svg>
        </button>
        <button id="btn-play-pause"
          class="w-16 h-16 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-200 dark:shadow-none hover:bg-primary-600 hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95">
          <svg id="zz-exec-play-svg" class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <polygon id="zz-exec-play-poly" points="5,3 19,12 5,21" />
          </svg>
        </button>
        <button id="btn-skip" title="Skip task"
          class="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg id="zz-exec-skip-svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon id="zz-exec-skip-poly" points="5 4 15 12 5 20" />
            <line id="zz-exec-skip-line" x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      </div>
      <button id="btn-skip-break"
        class="hidden px-4 py-2 text-xs font-black text-primary-500 hover:text-primary-600 uppercase tracking-widest transition-all bg-primary-50 dark:bg-primary-900/20 rounded-full border border-primary-100 dark:border-primary-800/30">
        Skip Break
      </button>
    </div>

    <!-- [SUB-PART: DURATION_SETTINGS] - Adjustment inputs for Focus and Break times -->
    <div id="zz-exec-duration-settings" class="flex items-center gap-3 text-sm">
      <!-- Focus Duration Adjuster -->
      <div id="zz-exec-focus-adjust-box" class="flex items-center gap-1.5">
        <label id="zz-exec-focus-label" class="text-xs text-slate-400">Focus</label>
        <div id="zz-exec-focus-input-wrap"
          class="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
          <button id="pom-work-down"
            class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700">
            <svg id="zz-exec-work-down-svg" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="zz-exec-work-down-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <input id="pom-work-input" type="text" value="15"
            class="w-10 text-center py-1 text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none"
            oninput="this.value = this.value.replace(/[^0-9]/g, '')">
          <button id="pom-work-up"
            class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l border-slate-200 dark:border-slate-700">
            <svg id="zz-exec-work-up-svg" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="zz-exec-work-up-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
        <span id="zz-exec-focus-unit" class="text-xs text-slate-400">min</span>
      </div>
      <span id="zz-exec-divider-1" class="text-slate-200 dark:text-slate-700">|</span>
      <!-- Break Duration Adjuster -->
      <div id="zz-exec-break-adjust-box" class="flex items-center gap-1.5">
        <label id="zz-exec-break-label" class="text-xs text-slate-400">Break</label>
        <div id="zz-exec-break-input-wrap"
          class="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
          <button id="pom-break-down"
            class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700">
            <svg id="zz-exec-break-down-svg" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="zz-exec-break-down-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <input id="pom-break-input" type="text" value="5"
            class="w-10 text-center py-1 text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none"
            oninput="this.value = this.value.replace(/[^0-9]/g, '')">
          <button id="pom-break-up"
            class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l border-slate-200 dark:border-slate-700">
            <svg id="zz-exec-break-up-svg" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path id="zz-exec-break-up-path" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
        <span id="zz-exec-break-unit" class="text-xs text-slate-400">min</span>
      </div>
    </div>
  </div>

  <!-- [PART: TASK_STACK_SECTION] - Right column for active, previous, and next tasks -->
  <div id="zz-exec-task-stack-section" class="lg:col-span-3 flex flex-col gap-4">

    <!-- [SUB-PART: PREVIOUS_TASK] - Last completed or skipped task -->
    <div id="zz-exec-previous-task-card"
      class="bg-white dark:bg-[#1a1d24] rounded-2xl px-6 py-4 border border-slate-100 dark:border-slate-800 shadow-sm opacity-60">
      <p id="zz-exec-prev-label" class="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-1">Previous</p>
      <p id="task-previous" class="text-sm text-slate-400 dark:text-slate-500 line-through truncate">—</p>
    </div>

    <!-- [SUB-PART: CURRENT_TASK_CARD] - Main display for the active focus task -->
    <div id="zz-exec-current-task-card"
      class="bg-gradient-to-br from-primary-50 via-white to-amber-50 dark:from-primary-900/20 dark:via-[#111318] dark:to-amber-900/5 rounded-3xl p-8 border border-primary-100 dark:border-primary-800/30 shadow-apple flex-1 transition-all duration-500 hover:shadow-2xl flex flex-col justify-between">
      <div id="zz-exec-current-task-top">
        <div id="zz-exec-current-task-badge-row" class="flex items-center gap-2 mb-4">
          <span id="task-current-badge"
            class="bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">FOCUS
            MODE</span>
          <span id="task-current-dur" class="text-xs font-bold text-slate-400 ml-auto tracking-tight"></span>
        </div>
        <p id="task-current" class="text-3xl font-black text-slate-900 dark:text-white leading-tight">No tasks — <a id="zz-exec-add-task-link"
            href="/time/tasks" class="text-primary-500 underline underline-offset-2 hover:text-primary-600">add one
            here!</a></p>
        <div id="task-current-desc" class="mt-4"></div>
      </div>

      <!-- Current Task Contextual Actions (Done / Swap) -->
      <div id="task-action-container" class="mt-8 flex flex-col gap-3">
        <button id="btn-task-done"
          class="hidden w-full py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold tracking-widest rounded-xl shadow-sm hover:shadow-md transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]">
          <svg id="zz-exec-done-svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline id="zz-exec-done-poly" points="20 6 9 17 4 12" />
          </svg>
          <span id="zz-exec-done-text">Done It</span>
        </button>

        <button id="btn-task-swap"
          class="hidden w-full py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary-500 hover:border-primary-500 rounded-xl shadow-sm transition-all duration-300 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest group">
          <svg id="zz-exec-swap-svg" class="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5">
            <path id="zz-exec-swap-p1" d="M17 1l4 4-4 4" />
            <path id="zz-exec-swap-p2" d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path id="zz-exec-swap-p3" d="M7 23l-4-4 4-4" />
            <path id="zz-exec-swap-p4" d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <span id="zz-exec-swap-text">Switching task</span>
        </button>
      </div>
    </div>

    <!-- [SUB-PART: NEXT_TASK] - Teaser for the upcoming task in queue -->
    <div id="zz-exec-next-task-card"
      class="bg-white dark:bg-[#1a1d24] rounded-2xl px-6 py-4 border border-slate-100 dark:border-slate-800 shadow-sm">
      <p id="zz-exec-next-label" class="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-1">Next Up</p>
      <p id="task-next" class="text-sm text-slate-600 dark:text-slate-300 truncate font-medium">—</p>
    </div>

    <!-- [PART: QUICK_ACTIONS] - Shortcuts to Manage Tasks or Capture Ideas -->
    <div id="zz-exec-quick-actions" class="grid grid-cols-2 gap-3">
      <a id="zz-exec-manage-tasks-btn" href="/time/tasks"
        class="flex items-center gap-2 bg-white dark:bg-[#1a1d24] rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary-300 hover:shadow-apple transition-all group">
        <svg id="zz-exec-manage-tasks-svg" class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path id="zz-exec-manage-tasks-p1" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect id="zz-exec-manage-tasks-rect" x="9" y="3" width="6" height="4" rx="1" />
        </svg>
        <span id="zz-exec-manage-tasks-text"
          class="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary-500 transition-colors">Manage
          Tasks</span>
      </a>
      <a id="zz-exec-capture-idea-btn" href="/time/ideas"
        class="flex items-center gap-2 bg-white dark:bg-[#1a1d24] rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-300 hover:shadow-apple transition-all group">
        <svg id="zz-exec-capture-idea-svg" class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path id="zz-exec-capture-idea-p1" d="M12 20h9" />
          <path id="zz-exec-capture-idea-p2" d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span id="zz-exec-capture-idea-text"
          class="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-500 transition-colors">Capture
          Idea</span>
      </a>
    </div>
  </div>
</div>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>