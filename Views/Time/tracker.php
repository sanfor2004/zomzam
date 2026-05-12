<?php
require_once __DIR__ . '/../../config.php';
if (session_status() === PHP_SESSION_NONE) session_start();
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Location: /');
    exit;
}

$userId = $_SESSION['user_id'];
$pdo = getConnection();

// Fetch today's completed tasks
$stmt = $pdo->prepare("
    SELECT * FROM time_tasks 
    WHERE user_id = ? 
    AND status = 'completed' 
    AND DATE(completed_at) = CURDATE()
    ORDER BY completed_at DESC
");
$stmt->execute([$userId]);
$completedToday = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Calculate metrics
$totalTasks = count($completedToday);
$totalPlanned = 0;
$totalActual = 0;
foreach ($completedToday as $task) {
    $totalPlanned += (int)$task['duration_block'];
    $totalActual += (int)($task['actual_duration'] ?? $task['duration_block']);
}

$hours = floor($totalActual / 60);
$minutes = $totalActual % 60;
$timeString = $hours > 0 ? "{$hours}h {$minutes}m" : "{$minutes}m";

$totalSaved = max(0, $totalPlanned - $totalActual);
$savedHours = floor($totalSaved / 60);
$savedMinutes = $totalSaved % 60;
$savedString = $savedHours > 0 ? "{$savedHours}h {$savedMinutes}m" : "{$savedMinutes}m";

// Helpers for UI
function priorityStyles($prio) {
    switch($prio) {
        case 'urgent': return ['bg' => 'bg-red-500/10 text-red-500 border-red-500/20', 'dot' => 'bg-red-500'];
        case 'medium': return ['bg' => 'bg-amber-500/10 text-amber-500 border-amber-500/20', 'dot' => 'bg-amber-500'];
        case 'maybe':  return ['bg' => 'bg-blue-500/10 text-blue-500 border-blue-500/20', 'dot' => 'bg-blue-500'];
        case 'free':   return ['bg' => 'bg-slate-500/10 text-slate-500 border-slate-500/20', 'dot' => 'bg-slate-500'];
        default:       return ['bg' => 'bg-slate-500/10 text-slate-500 border-slate-500/20', 'dot' => 'bg-slate-500'];
    }
}

$pageTitle       = 'Daily Tracker - Time Management';
$pageDescription = 'Track your daily focus hours and completed tasks.';

ob_start();
?>

<!-- Page Header -->
<div class="flex items-center gap-3 mb-6">
  <div class="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shadow-sm">
    <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
  </div>
  <div>
    <h1 class="text-xl font-bold text-slate-900 dark:text-white">Daily Tracker</h1>
    <p class="text-xs text-slate-400">Your focus and accomplishments for today.</p>
  </div>
  <div class="ml-auto text-sm font-semibold text-slate-500 dark:text-slate-400">
    <?php echo date('l, F j'); ?>
  </div>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
    <!-- Metric: Hours Focused -->
    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-3xl p-6 border border-blue-100 dark:border-blue-800/30 shadow-apple flex flex-col justify-between">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
                <p class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Total Focus Time</p>
                <p class="text-sm text-slate-500 dark:text-slate-400">Time spent on tasks today</p>
            </div>
        </div>
        <div class="mt-auto">
            <span class="text-4xl font-black text-slate-900 dark:text-white"><?php echo $timeString; ?></span>
        </div>
    </div>

    <!-- Metric: Tasks Completed -->
    <div class="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-3xl p-6 border border-emerald-100 dark:border-emerald-800/30 shadow-apple flex flex-col justify-between">
        <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
                <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Tasks Done</p>
                <p class="text-sm text-slate-500 dark:text-slate-400">Completed items today</p>
            </div>
        </div>
        <div class="flex items-end justify-between mt-auto">
            <div>
                <span class="text-4xl font-black text-slate-900 dark:text-white"><?php echo $totalTasks; ?></span>
                <span class="text-sm font-medium text-slate-400 ml-2">tasks</span>
            </div>
            <?php if ($totalSaved > 0): ?>
            <div class="text-right">
                <p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">Time Saved</p>
                <span class="text-xl font-black text-emerald-500"><?php echo $savedString; ?></span>
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<!-- Activity Feed -->
<div class="bg-white dark:bg-[#1a1d24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800">
    <div class="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </div>
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">What you did today</h2>
    </div>

    <?php if ($totalTasks === 0): ?>
        <div class="text-center py-12">
            <div class="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 class="text-base font-semibold text-slate-700 dark:text-slate-300">No tasks completed yet</h3>
            <p class="text-sm text-slate-500 mt-1 max-w-sm mx-auto">Start a Pomodoro session or mark a task as done on the task board to see your daily progress here.</p>
            <a href="/time/execution" class="inline-flex items-center justify-center px-4 py-2 mt-4 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">Start Focusing</a>
        </div>
    <?php else: ?>
        <div class="space-y-4">
            <?php foreach ($completedToday as $task): 
                $styles = priorityStyles($task['priority']);
                $completedAt = new DateTime($task['completed_at']);
                $actual = (int)($task['actual_duration'] ?? $task['duration_block']);
                $planned = (int)$task['duration_block'];
                $saved = $planned - $actual;
            ?>
            <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 transition-all hover:shadow-sm group">
                <div class="w-14 h-14 rounded-full <?php echo $styles['bg']; ?> border border-current opacity-80 flex flex-col items-center justify-center flex-shrink-0">
                    <span class="text-[9px] font-bold leading-none opacity-60">ACTUAL</span>
                    <span class="text-lg font-black leading-none mt-1"><?php echo $actual; ?></span>
                    <span class="text-[9px] font-bold leading-none opacity-60">MIN</span>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-base font-medium text-slate-800 dark:text-slate-200 line-through opacity-60 truncate"><?php echo htmlspecialchars($task['title']); ?></p>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-md <?php echo $styles['bg']; ?> border text-[10px] font-bold uppercase tracking-wider">
                            <span class="w-1.5 h-1.5 rounded-full <?php echo $styles['dot']; ?>"></span>
                            <?php echo htmlspecialchars($task['priority']); ?>
                        </span>
                        <span class="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <?php echo $completedAt->format('g:i A'); ?>
                        </span>
                        <?php if ($saved > 0): ?>
                        <span class="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            Saved <?php echo $saved; ?>m
                        </span>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="text-right hidden sm:block">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Planned</p>
                    <p class="text-sm font-bold text-slate-500"><?php echo $planned; ?>m</p>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
require_once __DIR__ . '/../app_layout.php';
?>
