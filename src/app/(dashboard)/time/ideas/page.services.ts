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
