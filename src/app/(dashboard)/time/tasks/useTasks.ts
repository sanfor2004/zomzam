'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadTasks, addTaskRequest, updateTaskRequest, completeTaskRequest,
  restoreTaskRequest, deleteTaskRequest, syncNotionRequest,
  type Task, type Horizon, type TaskInput, type NotionSyncResult,
} from './page.services';

// ──────────────────────────────────────────────────────────
// Task board data + CRUD orchestration.
//
// Owns the task/horizon lists, loading, the delete→undo buffer, and the Notion
// sync status. Each mutation applies its optimistic state update on success.
// The page keeps the add/edit FORM state (bound to inputs) and the completion
// flash (DOM); mutations that gate a follow-up UI action return a boolean.
// ──────────────────────────────────────────────────────────
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Delete undo buffer.
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Notion sync status. DORMANT: the Task Board gates Notion behind ProLock →
  // /pricing (spec-11 §7), so this has no live caller until billing lands and a
  // real isPro check re-enables it. Kept, not deleted, as the documented upgrade
  // path — the sync logic is correct and reusable the moment Pro exists.
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<NotionSyncResult['stats'] | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { tasks, horizons } = await loadTasks();
      setTasks(tasks);
      setHorizons(horizons);
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addTask = async (input: TaskInput): Promise<boolean> => {
    try {
      const task = await addTaskRequest(input);
      if (task) { setTasks((prev) => [...prev, task]); return true; }
    } catch (err) { console.error('Error adding task:', err); }
    return false;
  };

  const updateTask = async (id: number, input: TaskInput): Promise<boolean> => {
    try {
      const task = await updateTaskRequest(id, input);
      if (task) { setTasks((prev) => prev.map((t) => (t.id === id ? task : t))); return true; }
    } catch (err) { console.error('Error updating task:', err); }
    return false;
  };

  const completeTask = async (id: number): Promise<boolean> => {
    try {
      const ok = await completeTaskRequest(id);
      if (ok) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() } : t)));
      return ok;
    } catch (err) { console.error('Error completing task:', err); return false; }
  };

  const restoreTask = async (id: number) => {
    try {
      const ok = await restoreTaskRequest(id);
      if (ok) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'pending' as const, completed_at: null } : t)));
    } catch (err) { console.error('Error restoring task:', err); }
  };

  const deleteTask = async (id: number) => {
    const taskToDelete = tasks.find((t) => t.id === id);
    if (!taskToDelete) return;
    try {
      const ok = await deleteTaskRequest(id);
      if (ok) {
        setUndoTask(taskToDelete);
        setShowUndoToast(true);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setTimeout(() => setShowUndoToast(false), 6000);
      }
    } catch (err) { console.error('Error deleting task:', err); }
  };

  const undoDelete = async () => {
    if (!undoTask) return;
    try {
      const ok = await restoreTaskRequest(undoTask.id);
      if (ok) {
        setTasks((prev) => [...prev, { ...undoTask, status: 'pending' as const }]);
        setUndoTask(null);
        setShowUndoToast(false);
      }
    } catch (err) { console.error('Error restoring task:', err); }
  };

  const syncNotion = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStats(null);
    try {
      const data = await syncNotionRequest();
      if (data.success) {
        setSyncStats(data.stats ?? null);
        refresh();
        setTimeout(() => setSyncStats(null), 5000);
      } else {
        setSyncError(data.error || 'Sync failed');
        setTimeout(() => setSyncError(null), 5000);
      }
    } catch (err) {
      console.error(err);
      setSyncError('Failed to sync tasks');
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Derived, sorted lists (urgent→free then oldest-first; completed newest-first).
  const activeTasks = tasks
    .filter((t) => t.status === 'pending')
    .sort((a, b) => {
      const order = { urgent: 0, medium: 1, maybe: 2, free: 3 };
      const diff = order[a.priority] - order[b.priority];
      if (diff !== 0) return diff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const completedTasks = tasks
    .filter((t) => t.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime());

  return {
    tasks, horizons, isLoading, activeTasks, completedTasks,
    undoTask, showUndoToast, isSyncing, syncStats, syncError,
    addTask, updateTask, completeTask, restoreTask, deleteTask, undoDelete, syncNotion,
  };
}
