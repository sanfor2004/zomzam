// ──────────────────────────────────────────────────────────
// Idea capture — client-side data services.
//
// Thin POST wrappers over /api/time. No React, no DOM — the page owns the
// contenteditable editor, mention pills, and list state; these own the call +
// request SHAPE so they're testable.
// ──────────────────────────────────────────────────────────

export interface Task {
  id: number;
  title: string;
  status: string;
  priority: string;
  duration_block: number;
  // Carried through so an in-editor edit doesn't clobber an existing plan link
  // (the /api/time update_task action rewrites horizon_id on every save).
  horizon_id?: number | null;
}

// The fields the in-editor pill editor can change: rename, re-prioritise, and
// set the focus timer (duration_block minutes) that feeds the Pomodoro page.
export interface TaskInfoInput {
  title: string;
  priority: string;
  duration_block: number;
  horizonId: number | null;
}

export interface Horizon {
  id: number;
  type: 'week' | 'month' | 'year';
  content: string;
  status: string;
}

export interface Idea {
  id: number;
  content: string;
  linked_task_id: number | null;
  linked_horizon_id: number | null;
  status: 'open' | 'done';
  created_at: string;
}

// The link ids the editor extracts from its mention pills.
export interface IdeaInput {
  content: string;
  linkedTaskId: number | null;
  linkedHorizonId: number | null;
}

async function timeAction(body: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Flattens the api's week/month/year horizon buckets for the mention engine.
export async function loadIdeasData(): Promise<{ ideas: Idea[]; tasks: Task[]; horizons: Horizon[] }> {
  const data = await timeAction({ action: 'load' });
  if (!data.success) return { ideas: [], tasks: [], horizons: [] };
  const h = data.horizons || {};
  return {
    ideas: data.ideas || [],
    tasks: data.tasks || [],
    horizons: [...(h.week || []), ...(h.month || []), ...(h.year || [])],
  };
}

// Quick-creates a task straight from an unmatched `@mention` in the editor,
// with sensible defaults (medium priority, a 25-minute focus block) the user
// can refine later by clicking the pill.
export async function quickAddTaskRequest(title: string): Promise<Task | null> {
  const data = await timeAction({
    action: 'add_task',
    title: title.trim(),
    priority: 'medium',
    duration_block: 25,
    horizon_id: null,
  });
  return data.success && data.task ? data.task : null;
}

// Saves the pill editor's changes (title / priority / focus timer). Passes the
// task's existing horizon_id back so the update doesn't null out a plan link.
export async function updateTaskInfoRequest(id: number, input: TaskInfoInput): Promise<Task | null> {
  const data = await timeAction({
    action: 'update_task',
    id,
    title: input.title.trim(),
    priority: input.priority,
    duration_block: input.duration_block,
    horizon_id: input.horizonId,
  });
  return data.success && data.task ? data.task : null;
}

export async function addIdeaRequest(input: IdeaInput): Promise<Idea | null> {
  const data = await timeAction({
    action: 'add_idea',
    content: input.content,
    linked_task_id: input.linkedTaskId,
    linked_horizon_id: input.linkedHorizonId,
  });
  return data.success && data.idea ? data.idea : null;
}

export async function updateIdeaRequest(id: number, input: IdeaInput): Promise<boolean> {
  const data = await timeAction({
    action: 'update_idea',
    id,
    content: input.content,
    linked_task_id: input.linkedTaskId,
    linked_horizon_id: input.linkedHorizonId,
  });
  return !!data.success;
}

export async function deleteIdeaRequest(id: number): Promise<boolean> {
  const data = await timeAction({ action: 'delete_idea', id });
  return !!data.success;
}

// Toggle an idea between 'open' and 'done'. Purely a vault-side status — a done
// idea is a resolved note, it does NOT complete any linked task.
export async function setIdeaDoneRequest(id: number, done: boolean): Promise<boolean> {
  const data = await timeAction({ action: 'set_idea_done', id, done });
  return !!data.success;
}
