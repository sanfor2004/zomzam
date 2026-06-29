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
