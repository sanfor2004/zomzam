<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Pomodoro Timer - Time Management';
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

<div id="timer-notification" class="hidden"></div>

<!-- Page Header -->
<div class="flex items-center gap-3 mb-6">
  <div class="w-9 h-9 rounded-xl bg-primary-500 flex items-center justify-center shadow-sm">
    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-slate-900 dark:text-white">Pomodoro Timer</h1>
    <p class="text-xs text-slate-400">Stay in the zone. One task at a time.</p>
  </div>
  <div class="ml-auto flex items-center gap-2 bg-white dark:bg-[#1a1d24] rounded-xl px-4 py-2 border border-slate-100 dark:border-slate-800 shadow-sm">
    <svg class="w-4 h-4 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
    <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Sessions today: <span id="pom-sessions" class="text-primary-500 font-bold">0</span></span>
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

  <!-- ── Timer Ring ── -->
  <div class="lg:col-span-2 bg-white dark:bg-[#1a1d24] rounded-3xl p-8 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col items-center">
    <div id="timer-ring-container" class="relative w-56 h-56 mb-6">
      <svg class="w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="6" class="text-slate-100 dark:text-slate-800"/>
        <circle id="timer-ring" cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="6"
          stroke-linecap="round"
          stroke-dasharray="<?= round(2 * M_PI * 88) ?>"
          stroke-dashoffset="<?= round(2 * M_PI * 88) ?>"
          class="text-primary-500"/>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span id="timer-label" class="text-xs font-semibold uppercase tracking-widest text-primary-500">Focus Time</span>
        <span id="timer-display" class="text-5xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">25:00</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex flex-col items-center gap-4 mb-5">
      <div class="flex items-center gap-4">
        <button id="btn-reset" title="Reset" class="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
        </button>
        <button id="btn-play-pause" class="w-16 h-16 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-200 dark:shadow-none hover:bg-primary-600 hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95">
          <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
        <button id="btn-skip" title="Skip task" class="w-11 h-11 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
      </div>
      <button id="btn-skip-break" class="hidden px-4 py-2 text-xs font-black text-primary-500 hover:text-primary-600 uppercase tracking-widest transition-all bg-primary-50 dark:bg-primary-900/20 rounded-full border border-primary-100 dark:border-primary-800/30">
        Skip Break
      </button>
    </div>

    <!-- Duration -->
    <div class="flex items-center gap-3 text-sm">
      <div class="flex items-center gap-1.5">
        <label class="text-xs text-slate-400">Focus</label>
        <div class="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
          <button id="pom-work-down" class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <input id="pom-work-input" type="text" value="25" class="w-10 text-center py-1 text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
          <button id="pom-work-up" class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l border-slate-200 dark:border-slate-700">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
        <span class="text-xs text-slate-400">min</span>
      </div>
      <span class="text-slate-200 dark:text-slate-700">|</span>
      <div class="flex items-center gap-1.5">
        <label class="text-xs text-slate-400">Break</label>
        <div class="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
          <button id="pom-break-down" class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
          </button>
          <input id="pom-break-input" type="text" value="5" class="w-10 text-center py-1 text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
          <button id="pom-break-up" class="pom-adjust-btn px-2 py-1 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-l border-slate-200 dark:border-slate-700">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
        <span class="text-xs text-slate-400">min</span>
      </div>
    </div>
  </div>

  <!-- ── Task Stack ── -->
  <div class="lg:col-span-3 flex flex-col gap-4">

    <!-- Previous -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-2xl px-6 py-4 border border-slate-100 dark:border-slate-800 shadow-sm opacity-60">
      <p class="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-1">Previous</p>
      <p id="task-previous" class="text-sm text-slate-400 dark:text-slate-500 line-through truncate">—</p>
    </div>

    <!-- Current -->
    <div class="bg-gradient-to-br from-primary-50 via-white to-amber-50 dark:from-primary-900/20 dark:via-[#111318] dark:to-amber-900/5 rounded-3xl p-6 border border-primary-100 dark:border-primary-800/30 shadow-apple flex-1 transition-colors duration-300">
      <div class="flex items-center gap-2 mb-3">
        <span id="task-current-badge" class="bg-primary-500 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">NOW FOCUS</span>
        <span id="task-current-dur" class="text-xs text-slate-400 ml-auto font-medium"></span>
        <button id="btn-task-done" class="hidden ml-2 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-sm transition-all transform active:scale-95">Done</button>
      </div>
      <p id="task-current" class="text-2xl font-bold text-slate-900 dark:text-white leading-snug">No tasks — <a href="/time/tasks" class="text-primary-500 underline underline-offset-2 hover:text-primary-600">add one here!</a></p>
      <p id="task-current-desc" class="text-sm text-slate-500 dark:text-slate-400 mt-2 italic line-clamp-2"></p>
    </div>

    <!-- Next -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-2xl px-6 py-4 border border-slate-100 dark:border-slate-800 shadow-sm">
      <p class="text-xs uppercase tracking-widest font-semibold text-slate-400 mb-1">Next Up</p>
      <p id="task-next" class="text-sm text-slate-600 dark:text-slate-300 truncate font-medium">—</p>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-2 gap-3">
      <a href="/time/tasks" class="flex items-center gap-2 bg-white dark:bg-[#1a1d24] rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-primary-300 hover:shadow-apple transition-all group">
        <svg class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary-500 transition-colors">Manage Tasks</span>
      </a>
      <a href="/time/ideas" class="flex items-center gap-2 bg-white dark:bg-[#1a1d24] rounded-2xl px-4 py-3 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-300 hover:shadow-apple transition-all group">
        <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span class="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-500 transition-colors">Capture Idea</span>
      </a>
    </div>
  </div>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
