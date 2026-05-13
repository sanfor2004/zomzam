<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Idea Capture - Time Management';
$pageDescription = 'Capture your ideas instantly and link them to tasks or goals.';
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
  <div class="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.75 1.23 1.51 1.41 2.5Z"/></svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-slate-900 dark:text-white">Idea Capture</h1>
    <p class="text-xs text-slate-400">Your brain dump zone — write freely, tag later.</p>
  </div>
  <div class="ml-auto text-xs text-slate-400 bg-white dark:bg-[#1a1d24] border border-slate-100 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-sm">
    Tag: <code class="text-emerald-500">@task:ID</code> · <code class="text-purple-500">@plan:ID</code>
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

  <!-- ── Write Area ── -->
  <div class="lg:col-span-3 flex flex-col gap-4">

    <!-- Textarea Card -->
    <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
      <div class="idea-wrapper relative">
        <div 
          id="idea-editor" 
          contenteditable="true"
          class="w-full min-h-[200px] bg-transparent text-sm text-slate-800 dark:text-slate-200 focus:outline-none leading-relaxed"
          data-placeholder="Start writing your idea... Type @ to link a task or dream goal.&#10;Press Ctrl+Enter to save instantly."
        ></div>

        <!-- Mentions Dropdown -->
        <div id="mention-dropdown" class="hidden absolute z-50 w-64 max-h-64 overflow-y-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-apple-lg p-2 origin-top-left transform scale-95 opacity-0 transition-all">
          <div class="px-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400">
            Link to...
          </div>
          <div id="mention-list" class="space-y-0.5">
            <!-- Results injected here -->
          </div>
        </div>

        <!-- Tag Hover Tooltip -->
        <div id="tag-tooltip" class="hidden absolute z-50 w-72 bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-slate-800/90 dark:to-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-apple-lg p-4 pointer-events-none transform -translate-y-2 opacity-0 transition-all">
          <div id="tag-tooltip-content">
            <!-- Content injected here -->
          </div>
        </div>
      </div>

      <style>
        #idea-editor:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8; /* slate-400 */
          pointer-events: none;
          white-space: pre-wrap;
        }
        .dark #idea-editor:empty:before {
          color: #475569; /* slate-600 */
        }
      </style>

      <div class="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span>Ctrl+Enter to save</span>
          <span id="idea-char-count" class="font-mono">0 chars</span>
        </div>
        <button id="btn-submit-idea" class="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all hover:shadow-md active:scale-[0.98] flex items-center gap-2">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
          Capture Idea
        </button>
      </div>
    </div>

    <!-- Tag Help -->
    <div class="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30">
      <p class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">How to tag your ideas</p>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white dark:bg-[#1a1d24] rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/20">
          <code class="text-emerald-500 text-xs font-bold">@task:1</code>
          <p class="text-xs text-slate-500 mt-0.5">Links to Task ID 1</p>
        </div>
        <div class="bg-white dark:bg-[#1a1d24] rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/20">
          <code class="text-purple-500 text-xs font-bold">@plan:2</code>
          <p class="text-xs text-slate-500 mt-0.5">Links to Plan/Goal ID 2</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Idea Vault ── -->
  <div class="lg:col-span-2 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Idea Vault</h2>
      <span id="ideas-count" class="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full">0 ideas</span>
    </div>
    <div id="ideas-list" class="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[560px]">
      <div class="text-center py-12 text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <p class="text-sm font-medium">Your vault is empty.</p>
        <p class="text-xs mt-1">Write your first idea!</p>
      </div>
    </div>
  </div>
</div>

<script>
// Placeholder logic handles empty editor
</script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
