<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Time Management - zomzam.com';
$pageDescription = 'Manage your time with Pomodoro, task prioritization, and horizon planning.';
$additionalJS    = ['/Assets/Js/time_app.js?v=' . filemtime($_SERVER['DOCUMENT_ROOT'] . '/Assets/Js/time_app.js')];

ob_start();
?>

<!-- Timer Notification Toast -->
<div id="timer-notification" class="hidden"></div>

<!-- ═══════════════════════════════════════════════════════════
     SECTION 1 — EXECUTION: Pomodoro Timer + Task Stack
═══════════════════════════════════════════════════════════ -->
<section id="execution" class="mb-8 scroll-mt-24">
  <div class="flex items-center gap-3 mb-5">
    <div class="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    </div>
    <h2 class="text-lg font-bold text-slate-900 dark:text-white">Execution</h2>
    <span class="text-xs text-slate-400 font-medium ml-auto">Sessions today: <span id="pom-sessions" class="text-primary-500 font-bold">0</span></span>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">

    <!-- Timer Ring -->
    <div class="lg:col-span-2 bg-white dark:bg-[#1a1d24] rounded-3xl p-8 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col items-center">
      <div id="timer-ring-container" class="relative w-52 h-52 mb-6">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 200 200">
          <!-- Track -->
          <circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="6" class="text-slate-100 dark:text-slate-800"/>
          <!-- Progress -->
          <circle id="timer-ring" cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width="6"
            stroke-linecap="round"
            stroke-dasharray="<?= round(2 * M_PI * 88) ?>"
            stroke-dashoffset="<?= round(2 * M_PI * 88) ?>"
            class="text-primary-500 transition-all duration-1000 ease-linear"/>
        </svg>
        <!-- Time Display -->
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span id="timer-label" class="text-xs font-semibold uppercase tracking-widest text-primary-500">Focus Time</span>
          <span id="timer-display" class="text-5xl font-bold tabular-nums text-slate-900 dark:text-white mt-1">25:00</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-4 mb-5">
        <button id="btn-reset" class="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
        </button>
        <button id="btn-play-pause" class="w-16 h-16 rounded-full bg-white dark:bg-white text-primary-500 shadow-lg hover:shadow-xl transition-all flex items-center justify-center border-2 border-primary-100 dark:border-primary-400 hover:scale-105">
          <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
        <button id="btn-skip" class="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
        </button>
      </div>

      <!-- Duration Setting -->
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <label class="text-xs">Focus</label>
        <input id="pom-work-input" type="number" value="25" min="1" max="120" class="w-14 text-center border border-slate-200 dark:border-slate-700 rounded-lg py-1 text-sm font-medium bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:border-primary-500">
        <label class="text-xs">min</label>
      </div>
    </div>

    <!-- Task Stack -->
    <div class="lg:col-span-3 bg-white dark:bg-[#1a1d24] rounded-3xl p-8 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col justify-center">
      <!-- Previous -->
      <div class="mb-6 pl-1">
        <p class="text-xs uppercase tracking-widest font-semibold text-slate-300 dark:text-slate-600 mb-1">Previous</p>
        <p id="task-previous" class="text-sm text-slate-400 dark:text-slate-500 line-through truncate">—</p>
      </div>

      <!-- Current Task -->
      <div class="bg-gradient-to-r from-primary-50 to-amber-50 dark:from-primary-900/20 dark:to-amber-900/10 rounded-2xl p-5 border border-primary-100 dark:border-primary-800/30 mb-6">
        <div class="flex items-center gap-2 mb-2">
          <span id="task-current-badge" class="bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 text-xs font-bold px-2 py-0.5 rounded-full">NOW</span>
          <span id="task-current-dur" class="text-xs text-slate-400 ml-auto"></span>
        </div>
        <p id="task-current" class="text-xl font-bold text-slate-900 dark:text-white leading-snug">No tasks yet — add one below!</p>
      </div>

      <!-- Next -->
      <div class="pl-1">
        <p class="text-xs uppercase tracking-widest font-semibold text-slate-300 dark:text-slate-600 mb-1">Next</p>
        <p id="task-next" class="text-sm text-slate-500 dark:text-slate-400 truncate">—</p>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════
     SECTION 2 — TASK CATEGORIZATION
═══════════════════════════════════════════════════════════ -->
<section id="tasks" class="mb-8 scroll-mt-24">
  <div class="flex items-center gap-3 mb-5">
    <div class="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>
    </div>
    <h2 class="text-lg font-bold text-slate-900 dark:text-white">Task Board</h2>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
    <!-- Task List -->
    <div class="lg:col-span-3 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider">Active Tasks</h3>
      <div id="task-list" class="max-h-80 overflow-y-auto pr-1">
        <div class="text-center py-8 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
          <p class="text-sm">No tasks yet.</p>
        </div>
      </div>
    </div>

    <!-- Add Task Form -->
    <div class="lg:col-span-2 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider">Add Task</h3>
      <div class="space-y-3">
        <input id="task-title" type="text" placeholder="What needs to be done?" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all">

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Priority</label>
            <select id="task-priority" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-500 transition-all">
              <option value="urgent">🔴 Urgent</option>
              <option value="medium" selected>🟡 Medium</option>
              <option value="maybe">🔵 Maybe</option>
              <option value="free">⚪ Free</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Time Block</label>
            <select id="task-duration" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-500 transition-all">
              <option value="15">15 min</option>
              <option value="25" selected>25 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
              <option value="240">4 hours</option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">🎯 Link to Dream (optional)</label>
          <select id="task-horizon-select" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-500 transition-all">
            <option value="">— No Dream Link —</option>
          </select>
        </div>

        <button id="btn-add-task" class="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-all hover:shadow-lg active:scale-[0.98]">
          + Add Task
        </button>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════
     SECTION 3 — MULTI-HORIZON PLANNING
═══════════════════════════════════════════════════════════ -->
<section id="planning" class="mb-8 scroll-mt-24">
  <div class="flex items-center gap-3 mb-5">
    <div class="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>
    </div>
    <h2 class="text-lg font-bold text-slate-900 dark:text-white">Dream Planning</h2>
    <span class="text-xs text-slate-400 ml-2">Week · Month · Year</span>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
    <?php foreach ([
      ['week',  '📅 This Week',  'bg-blue-500',   'blue'],
      ['month', '🗓️ This Month', 'bg-purple-500',  'purple'],
      ['year',  '🌟 This Year',  'bg-amber-500',   'amber'],
    ] as [$type, $label, $color, $accent]): ?>
    <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col">
      <div class="flex items-center gap-2 mb-4">
        <span class="<?= $color ?> text-white text-xs font-bold px-3 py-1 rounded-full"><?= $label ?></span>
      </div>
      <div id="horizon-<?= $type ?>" class="flex-1 mb-4 max-h-60 overflow-y-auto pr-1">
        <p class="text-xs text-slate-400 text-center py-4">Nothing planned yet.</p>
      </div>
      <div class="flex gap-2 mt-auto">
        <input id="horizon-input-<?= $type ?>" type="text" placeholder="Add a goal..." class="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-<?= $accent ?>-400 transition-all">
        <button id="btn-add-<?= $type ?>" class="px-3 py-2 <?= $color ?> text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════════
     SECTION 4 — IDEA CAPTURE
═══════════════════════════════════════════════════════════ -->
<section id="ideas" class="mb-8 scroll-mt-24">
  <div class="flex items-center gap-3 mb-5">
    <div class="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
      <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
    </div>
    <h2 class="text-lg font-bold text-slate-900 dark:text-white">Idea Capture</h2>
    <span class="text-xs text-slate-400 ml-2">Use @task:ID or @plan:ID to tag</span>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
    <!-- Input Area -->
    <div class="lg:col-span-3 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <div class="idea-wrapper relative min-h-[200px]">
        <textarea
          id="idea-textarea"
          placeholder="Write your idea here... Use @task:1 to link a task, @plan:1 to link a dream goal. Press Ctrl+Enter to save."
          class="w-full h-48 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 resize-none focus:outline-none leading-relaxed"
        ></textarea>
        <!-- Flying Pen -->
        <div id="flying-pen" class="absolute top-0 left-0 pointer-events-none opacity-0 transition-all duration-75 will-change-transform z-10">
          <div class="bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
        </div>
      </div>
      <div class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <span class="text-xs text-slate-400">Ctrl+Enter to save instantly</span>
        <button id="btn-submit-idea" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all hover:shadow-md active:scale-[0.98] flex items-center gap-2">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
          Capture Idea
        </button>
      </div>
    </div>

    <!-- Ideas List -->
    <div class="lg:col-span-2 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider">Idea Vault</h3>
      <div id="ideas-list" class="max-h-72 overflow-y-auto pr-1 space-y-1">
        <p class="text-xs text-slate-400 text-center py-6">Your idea vault is empty. Start writing!</p>
      </div>
    </div>
  </div>
</section>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
