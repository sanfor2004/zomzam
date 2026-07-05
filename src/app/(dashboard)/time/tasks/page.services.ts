// ──────────────────────────────────────────────────────────
// Task board — client-side data services.
//
// Thin POST wrappers over /api/time (+ /api/notion sync). No React. The page/
// useTasks own loading + list STATE; these own the call + request SHAPE.
// ──────────────────────────────────────────────────────────

export type Priority = 'urgent' | 'medium' | 'maybe' | 'free';

export interface Task {
  id: number;
  user_id: number;
  horizon_id: number | null;
  title: string;
  priority: Priority;
  duration_block: number;
  actual_duration: number | null;
  status: 'pending' | 'completed' | 'deleted';
  created_at: string;
  completed_at: string | null;
}

export interface Horizon {
  id: number;
  user_id: number;
  type: 'week' | 'month' | 'year';
  content: string;
  status: 'active' | 'completed';
  created_at: string;
}

// Form payload shared by add + update (horizonId '' = no link).
export interface TaskInput {
  title: string;
  priority: Priority;
  duration: number;
  horizonId: string;
}

const PRIORITY_WORDS: Priority[] = ['urgent', 'medium', 'maybe', 'free'];

// Parses a one-line quick-add ("email client urgent 45m") into task fields:
// a standalone priority word (last one by position wins) + a duration token
// (`45m` / `45 min` / `2h`, clamped to 5–120). Whatever's left is the title;
// if stripping tokens empties it, the raw string is kept so we never create a
// titleless task.
// ponytail: 2-token regex parse; extend only if users actually type dates/projects.
export function parseQuickTask(raw: string): { title: string; priority: Priority; duration: number } {
  const input = raw.trim();
  let priority: Priority = 'medium';
  let duration = 25;
  let rest = ` ${input} `; // pad so \b boundaries are uniform at the ends

  // Duration: last "<n>m|min|h" match wins; h → ×60, then clamp 5–120.
  const durRe = /\b(\d{1,3})\s*(mins?|m|hrs?|h)\b/gi;
  let dm: RegExpExecArray | null;
  let lastDur: { text: string; mins: number } | null = null;
  while ((dm = durRe.exec(rest)) !== null) {
    const n = parseInt(dm[1], 10);
    const mins = dm[2].toLowerCase().startsWith('h') ? n * 60 : n;
    lastDur = { text: dm[0], mins };
  }
  if (lastDur) {
    duration = Math.min(120, Math.max(5, lastDur.mins));
    rest = rest.replace(lastDur.text, ' ');
  }

  // Priority: the standalone priority word occurring last in the input wins.
  let bestIdx = -1;
  for (const word of PRIORITY_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    let pm: RegExpExecArray | null;
    while ((pm = re.exec(rest)) !== null) {
      if (pm.index > bestIdx) { bestIdx = pm.index; priority = word; }
    }
  }
  for (const word of PRIORITY_WORDS) {
    rest = rest.replace(new RegExp(`\\b${word}\\b`, 'gi'), ' ');
  }

  const title = rest.replace(/\s+/g, ' ').trim();
  return { title: title || input, priority, duration };
}

async function timeAction(body: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Flattens the api's week/month/year horizon buckets into one list for the
// linking dropdown. Returns empties on an unsuccessful payload.
export async function loadTasks(): Promise<{ tasks: Task[]; horizons: Horizon[] }> {
  const data = await timeAction({ action: 'load' });
  if (!data.success) return { tasks: [], horizons: [] };
  const h = data.horizons || {};
  return {
    tasks: data.tasks || [],
    horizons: [...(h.week || []), ...(h.month || []), ...(h.year || [])],
  };
}

export async function addTaskRequest(input: TaskInput): Promise<Task | null> {
  const data = await timeAction({
    action: 'add_task',
    title: input.title,
    priority: input.priority,
    duration_block: input.duration,
    horizon_id: input.horizonId ? parseInt(input.horizonId) : null,
  });
  return data.success && data.task ? data.task : null;
}

export async function updateTaskRequest(id: number, input: TaskInput): Promise<Task | null> {
  const data = await timeAction({
    action: 'update_task',
    id,
    title: input.title,
    priority: input.priority,
    duration_block: input.duration,
    horizon_id: input.horizonId ? parseInt(input.horizonId) : null,
  });
  return data.success && data.task ? data.task : null;
}

export async function completeTaskRequest(id: number): Promise<boolean> {
  const data = await timeAction({ action: 'complete_task', id });
  return !!data.success;
}

export async function restoreTaskRequest(id: number): Promise<boolean> {
  const data = await timeAction({ action: 'restore_task', id });
  return !!data.success;
}

export async function deleteTaskRequest(id: number): Promise<boolean> {
  const data = await timeAction({ action: 'delete_task', id });
  return !!data.success;
}

export interface NotionSyncResult {
  success: boolean;
  stats?: { tasks: number; projects: number; links: number };
  error?: string;
}

export async function syncNotionRequest(): Promise<NotionSyncResult> {
  const res = await fetch('/api/notion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync' }),
  });
  return res.json();
}
