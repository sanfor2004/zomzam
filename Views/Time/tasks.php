<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE)
  session_start();

$pageTitle = 'Task Board - Time Management';
$pageDescription = 'Organize your tasks by priority and time block.';
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

<!-- Page Header -->
<div class="flex items-center gap-3 mb-6">
  <div class="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm">
    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="12" y2="16" />
    </svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-slate-900 dark:text-white">
      <zlang key="task_board">Task Board</zlang>
    </h1>
    <p class="text-xs text-slate-400">Prioritize, time-block, and link to your dreams.</p>
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

  <!-- ── Task List ── -->
  <div class="lg:col-span-3 flex flex-col gap-6">
    <!-- Active Tasks -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <zlang key="task_active">Active Tasks</zlang>
        </h2>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-400"></span><span class="text-xs text-slate-400 hidden sm:inline">
            <zlang key="task_urgent">Urgent</zlang>
          </span>
          <span class="w-2 h-2 rounded-full bg-amber-400 ml-2"></span><span
            class="text-xs text-slate-400 hidden sm:inline">
            <zlang key="task_medium">Medium</zlang>
          </span>
          <span class="w-2 h-2 rounded-full bg-blue-400 ml-2"></span><span
            class="text-xs text-slate-400 hidden sm:inline">
            <zlang key="task_maybe">Maybe</zlang>
          </span>
          <span class="w-2 h-2 rounded-full bg-slate-300 ml-2"></span><span
            class="text-xs text-slate-400 hidden sm:inline">
            <zlang key="task_free">Free</zlang>
          </span>
        </div>
      </div>
      <div id="task-list" class="space-y-1 max-h-[500px] overflow-y-auto pr-1">
        <div class="text-center py-12 text-slate-400">
          <svg class="w-14 h-14 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.5">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
          <p class="text-sm font-medium">No tasks yet. Add your first one!</p>
        </div>
      </div>
    </div>

    <!-- Completed Tasks -->
    <div
      class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800 opacity-80">
      <div class="flex items-center justify-between mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center">
            <svg class="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <zlang key="task_completed">Completed</zlang>
          </h2>
        </div>
        <span id="completed-tasks-count"
          class="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-2.5 py-1 rounded-full">0</span>
      </div>
      <div id="task-list-completed" class="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        <!-- Completed tasks rendered via JS -->
      </div>
    </div>
  </div>

  <!-- ── Add Task Form ── -->
  <div class="lg:col-span-2 flex flex-col gap-4">
    <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <h2 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
        <zlang key="btn_add_task">Add New Task</zlang>
      </h2>
      <div class="space-y-3">
        <input id="task-title" type="text" placeholder="What needs to be done?"
          data-zlang-placeholder="task_placeholder"
          class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all">

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Priority</label>
            <div class="relative" id="priority-custom-select">
              <input type="hidden" id="task-priority" value="medium">
              <button type="button" id="priority-btn"
                class="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-500 transition-all">
                <div class="flex items-center gap-2" id="priority-selected">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span>Medium</span>
                </div>
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>

              <div id="priority-dropdown"
                class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 hidden overflow-hidden">
                <div
                  class="priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  data-value="urgent" data-label="Urgent" data-color="bg-red-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span><span
                    class="text-sm text-slate-700 dark:text-slate-300">Urgent</span>
                </div>
                <div
                  class="priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  data-value="medium" data-label="Medium" data-color="bg-amber-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span
                    class="text-sm text-slate-700 dark:text-slate-300">Medium</span>
                </div>
                <div
                  class="priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  data-value="maybe" data-label="Maybe" data-color="bg-blue-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span><span
                    class="text-sm text-slate-700 dark:text-slate-300">Maybe</span>
                </div>
                <div
                  class="priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  data-value="free" data-label="Free" data-color="bg-slate-300">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-300"></span><span
                    class="text-sm text-slate-700 dark:text-slate-300">Free</span>
                </div>
              </div>
            </div>

            <script>
              document.addEventListener('DOMContentLoaded', () => {
                const btn = document.getElementById('priority-btn');
                const dropdown = document.getElementById('priority-dropdown');
                const input = document.getElementById('task-priority');
                const selectedContainer = document.getElementById('priority-selected');

                btn.addEventListener('click', (e) => {
                  e.preventDefault();
                  dropdown.classList.toggle('hidden');
                });

                document.addEventListener('click', (e) => {
                  if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.add('hidden');
                  }
                });

                document.querySelectorAll('.priority-option').forEach(opt => {
                  opt.addEventListener('click', () => {
                    const val = opt.getAttribute('data-value');
                    const label = opt.getAttribute('data-label');
                    const color = opt.getAttribute('data-color');

                    input.value = val;
                    selectedContainer.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${color}"></span><span>${label}</span>`;
                    dropdown.classList.add('hidden');
                  });
                });
              });
            </script>
          </div>
          <div>
            <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Time Block</label>
            <select id="task-duration"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-500 transition-all">
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
          <label class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Link to Dream Goal <span
              class="font-normal text-slate-400">(optional)</span></label>
          <select id="task-horizon-select"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary-500 transition-all">
            <option value="">— No Dream Link —</option>
          </select>
        </div>

        <button id="btn-add-task"
          class="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-all hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <zlang key="btn_add_task">Add Task</zlang>
        </button>
      </div>
    </div>

    <!-- Start Session shortcut -->
    <a href="/time/execution"
      class="flex items-center gap-3 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl px-5 py-4 shadow-lg hover:shadow-xl transition-all group">
      <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="5,3 19,12 5,21" />
      </svg>
      <div>
        <p class="font-semibold text-sm">Start Pomodoro Session</p>
        <p class="text-xs text-primary-100">Jump to the timer →</p>
      </div>
    </a>
  </div>
</div>

<!-- Edit Task Modal -->
<div id="modal-edit-task"
  class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
  <div
    class="bg-white dark:bg-[#1a1d24] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
    <div class="p-8">
      <div class="flex items-center justify-between mb-8">
        <h3 class="text-xl font-black text-slate-900 dark:text-white">Edit Task</h3>
        <button onclick="closeModal('modal-edit-task')"
          class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
          <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="space-y-6">
        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Task Title</label>
          <input id="edit-task-title" type="text"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-lg font-bold focus:outline-none focus:border-primary-500 transition-all">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Priority</label>
            <div class="relative">
              <input type="hidden" id="edit-task-priority">
              <button type="button" id="edit-priority-btn"
                class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none">
                <div class="flex items-center gap-2" id="edit-priority-selected">
                  <span>Select...</span>
                </div>
                <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <div id="edit-priority-dropdown"
                class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#1a1d24] border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 hidden overflow-hidden">
                <div
                  class="edit-priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  data-value="urgent" data-label="Urgent" data-color="bg-red-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span><span class="text-sm">Urgent</span>
                </div>
                <div
                  class="edit-priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  data-value="medium" data-label="Medium" data-color="bg-amber-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span><span class="text-sm">Medium</span>
                </div>
                <div
                  class="edit-priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  data-value="maybe" data-label="Maybe" data-color="bg-blue-400">
                  <span class="w-2.5 h-2.5 rounded-full bg-blue-400"></span><span class="text-sm">Maybe</span>
                </div>
                <div
                  class="edit-priority-option flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  data-value="free" data-label="Free" data-color="bg-slate-300">
                  <span class="w-2.5 h-2.5 rounded-full bg-slate-300"></span><span class="text-sm">Free</span>
                </div>
              </div>
            </div>
          </div>
          <div>
            <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Duration</label>
            <select id="edit-task-duration"
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none">
              <option value="15">15 min</option>
              <option value="25">25 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Link to Dream
            Goal</label>
          <select id="edit-task-horizon"
            class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none">
            <!-- JS will populate -->
          </select>
        </div>

        <button onclick="TimeApp.updateTask({
          title: document.getElementById('edit-task-title').value,
          priority: document.getElementById('edit-task-priority').value,
          duration_block: document.getElementById('edit-task-duration').value,
          horizon_id: document.getElementById('edit-task-horizon').value
        })"
          class="w-full py-4 bg-primary-500 hover:bg-primary-600 text-white font-black rounded-2xl shadow-lg shadow-primary-500/20 transition-all active:scale-95">Update
          Task</button>
      </div>
    </div>
  </div>
</div>

<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Edit Priority Dropdown
    const btn = document.getElementById('edit-priority-btn');
    const dropdown = document.getElementById('edit-priority-dropdown');
    const input = document.getElementById('edit-task-priority');
    const selected = document.getElementById('edit-priority-selected');

    btn?.addEventListener('click', () => dropdown.classList.toggle('hidden'));

    document.querySelectorAll('.edit-priority-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const val = opt.dataset.value;
        const label = opt.dataset.label;
        const color = opt.dataset.color;
        input.value = val;
        selected.innerHTML = `<span class="w-2.5 h-2.5 rounded-full ${color}"></span><span>${label}</span>`;
        dropdown.classList.add('hidden');
      });
    });
  });
</script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>