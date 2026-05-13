<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();

$pageTitle       = 'Dream Planning - Time Management';
$pageDescription = 'Set and track your weekly, monthly, and yearly goals.';
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
  <div class="w-9 h-9 rounded-xl bg-purple-500 flex items-center justify-center shadow-sm">
    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-slate-900 dark:text-white">Dream Planning</h1>
    <p class="text-xs text-slate-400">Build your vision across Week · Month · Year</p>
  </div>
</div>

<div class="grid grid-cols-1 md:grid-cols-3 gap-5">

  <?php
  $columns = [
    [
      'week',  
      'This Week',  
      '<svg class="w-4 h-4 mr-1.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      'bg-blue-500',   
      'border-blue-200 dark:border-blue-800/40',   
      'bg-blue-50 dark:bg-blue-900/10',   
      'text-blue-600 dark:text-blue-400',   
      'focus:border-blue-400'
    ],
    [
      'month', 
      'This Month', 
      '<svg class="w-4 h-4 mr-1.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>',
      'bg-purple-500',  
      'border-purple-200 dark:border-purple-800/40',
      'bg-purple-50 dark:bg-purple-900/10',
      'text-purple-600 dark:text-purple-400',
      'focus:border-purple-400'
    ],
    [
      'year',  
      'This Year',  
      '<svg class="w-4 h-4 mr-1.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
      'bg-amber-500',   
      'border-amber-200 dark:border-amber-800/40',  
      'bg-amber-50 dark:bg-amber-900/10',  
      'text-amber-600 dark:text-amber-400',  
      'focus:border-amber-400'
    ],
  ];
  foreach ($columns as [$type, $label, $icon, $btnColor, $borderClass, $bgClass, $textClass, $focusClass]):
  ?>
  <div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800 flex flex-col min-h-[420px]">

    <!-- Column Header -->
    <div class="flex items-center gap-2 mb-5">
      <span class="<?= $btnColor ?> text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center"><?= $icon ?><?= $label ?></span>
      <span id="horizon-count-<?= $type ?>" class="ml-auto text-xs text-slate-400 font-medium">0 goals</span>
    </div>

    <!-- Goals List -->
    <div id="horizon-<?= $type ?>" class="flex-1 space-y-2 mb-5 overflow-y-auto pr-1 max-h-72">
      <p class="text-xs text-slate-400 text-center py-8">No goals yet. Set your first one!</p>
    </div>

    <!-- Add Input -->
    <div class="mt-auto space-y-2">
      <input id="horizon-input-<?= $type ?>" type="text" placeholder="Add a goal..."
        class="w-full px-4 py-2.5 text-sm <?= $bgClass ?> border <?= $borderClass ?> rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none <?= $focusClass ?> transition-all">
      <button id="btn-add-<?= $type ?>" class="w-full <?= $btnColor ?> text-white text-sm font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add <?= ucfirst($type) ?> Goal
      </button>
    </div>
  </div>
  <?php endforeach; ?>

</div>

<!-- Archived Goals Section -->
<div class="mt-8 bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
  <div class="flex items-center gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
    <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <svg class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
    </div>
    <h2 class="text-lg font-bold text-slate-800 dark:text-slate-200">Archived Goals</h2>
    <span id="archived-count" class="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-2.5 py-1 rounded-full">0</span>
  </div>
  
  <div id="horizon-archived" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
    <!-- Archived items will be appended here via JS -->
  </div>
</div>

<script>
// Update counts after rendering
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver(() => {
    ['week','month','year'].forEach(type => {
      const container = document.getElementById('horizon-' + type);
      const countEl   = document.getElementById('horizon-count-' + type);
      if (!container || !countEl) return;
      const count = container.querySelectorAll('[data-horizon-item]').length;
      countEl.textContent = count + ' goal' + (count !== 1 ? 's' : '');
    });
  });
  ['week','month','year'].forEach(type => {
    const el = document.getElementById('horizon-' + type);
    if (el) observer.observe(el, { childList: true, subtree: true });
  });
});
</script>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
