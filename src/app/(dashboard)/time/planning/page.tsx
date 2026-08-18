'use client';
import { Button, Progress, Input, SectionHeader } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Target, Calendar, Award, Plus, Trash2, Archive, Check, MoveRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { cn } from '@/lib/utils';
import { horizonEdge } from '../types';
import { addTaskRequest } from '../tasks/page.services';

interface Horizon {
  id: number;
  user_id: number;
  type: 'week' | 'month' | 'year';
  content: string;
  status: 'active' | 'completed';
  created_at: string;
}

// Only the task fields the dream-momentum readout needs. `load` already returns
// these on every task; the page previously discarded them.
interface Task {
  id: number;
  horizon_id: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'deleted';
  duration_block: number;
  actual_duration: number | null;
}

export default function DreamPlanningPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // State
  const [horizons, setHorizons] = useState<{
    week: Horizon[];
    month: Horizon[];
    year: Horizon[];
  }>({ week: [], month: [], year: [] });
  const [archived, setArchived] = useState<Horizon[]>([]);
  // Linked tasks — read from the same `load` call, powers each goal's momentum bar.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [isLoading]);

  // Drag over states
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  // The dream currently being dragged — powers the live "will land here" preview.
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Inline "add a task to this goal" — which goal's field is open + its draft.
  const [addingTaskFor, setAddingTaskFor] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState('');

  // Momentum snapshot for one goal, derived from its linked (non-deleted) tasks.
  const momentumFor = (horizonId: number) => {
    const linked = tasks.filter((task) => task.horizon_id === horizonId);
    const done = linked.filter((task) => task.status === 'completed');
    const focusedMins = done.reduce((sum, task) => sum + (task.actual_duration ?? task.duration_block), 0);
    return { total: linked.length, done: done.length, focusedMins };
  };

  // Quick-create a task pre-linked to a goal — the mirror of the @-mention
  // create in Idea Capture. Reuses the shared addTaskRequest service (same call
  // Task Board uses) instead of a hand-rolled fetch. Same defaults (medium
  // priority, 25-min block).
  const handleAddTaskToGoal = async (horizonId: number) => {
    const title = taskDraft.trim();
    if (!title) return;
    try {
      const newTask = await addTaskRequest({ title, priority: 'medium', duration: 25, horizonId: String(horizonId) });
      if (newTask) {
        setTasks((prev) => [...prev, newTask]); // momentum ticks immediately
        setTaskDraft('');
        setAddingTaskFor(null);
      }
    } catch (err) {
      console.error('Error adding task to goal:', err);
    }
  };

  // Inputs
  const [inputs, setInputs] = useState({
    week: '',
    month: '',
    year: '',
  });

  const loadData = async () => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load' }),
      });
      const data = await res.json();
      if (data.success) {
        const horizonsObj = data.horizons || { week: [], month: [], year: [] };
        
        // Filter active vs completed (archived)
        const activeWeek = (horizonsObj.week || []).filter((h: Horizon) => h.status === 'active');
        const activeMonth = (horizonsObj.month || []).filter((h: Horizon) => h.status === 'active');
        const activeYear = (horizonsObj.year || []).filter((h: Horizon) => h.status === 'active');
        
        const archivedWeek = (horizonsObj.week || []).filter((h: Horizon) => h.status === 'completed');
        const archivedMonth = (horizonsObj.month || []).filter((h: Horizon) => h.status === 'completed');
        const archivedYear = (horizonsObj.year || []).filter((h: Horizon) => h.status === 'completed');

        setHorizons({
          week: activeWeek,
          month: activeMonth,
          year: activeYear,
        });
        setArchived([...archivedWeek, ...archivedMonth, ...archivedYear]);
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to load horizons:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add Goal
  const handleAddGoal = async (type: 'week' | 'month' | 'year') => {
    const content = inputs[type].trim();
    if (!content) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_horizon', type, content }),
      });
      const data = await res.json();
      if (data.success && data.horizon) {
        setHorizons(prev => ({
          ...prev,
          [type]: [...prev[type], data.horizon],
        }));
        setInputs(prev => ({ ...prev, [type]: '' }));
      }
    } catch (err) {
      console.error('Error adding horizon:', err);
    }
  };

  // Complete Goal (Archive)
  const handleCompleteGoal = async (id: number, type: 'week' | 'month' | 'year') => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_horizon', id }),
      });
      const data = await res.json();
      if (data.success) {
        const completedGoal = horizons[type].find(h => h.id === id);
        if (completedGoal) {
          // Remove from active list
          setHorizons(prev => ({
            ...prev,
            [type]: prev[type].filter(h => h.id !== id),
          }));
          // Add to archived
          setArchived(prev => [{ ...completedGoal, status: 'completed' }, ...prev]);
          
          // Celebrate with slight confetti
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.8 },
            colors: ['#8B5CF6', '#a78bfa', '#ffffff']
          });
        }
      }
    } catch (err) {
      console.error('Error completing goal:', err);
    }
  };

  // Delete Horizon
  const handleDeleteHorizon = async (id: number, type: 'week' | 'month' | 'year', isArchived = false) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_horizon', id }),
      });
      const data = await res.json();
      if (data.success) {
        if (isArchived) {
          setArchived(prev => prev.filter(h => h.id !== id));
        } else {
          setHorizons(prev => ({
            ...prev,
            [type]: prev[type].filter(h => h.id !== id),
          }));
        }
      }
    } catch (err) {
      console.error('Error deleting horizon:', err);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', id.toString());
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  // Set the active column once, on ENTER — not on every dragover move. This is
  // what makes the ghost appear when you cross into a column and then hold still
  // while you move around inside it (no per-move re-render / re-animation).
  const handleDragEnter = (e: React.DragEvent, colType: string) => {
    e.preventDefault();
    setDragOverColumn((current) => (current === colType ? current : colType));
  };

  // dragover must preventDefault so the column stays a valid drop target, but it
  // must NOT touch state — doing so on every mouse-move is the flicker source.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Only clear when the pointer truly leaves the column. dragleave also fires
  // when crossing into a *child* element (relatedTarget still inside the column),
  // so ignore those — otherwise the ghost unmounts/remounts on every move.
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragOverColumn(null);
    }
  };

  // Fires whether or not a drop happened — clears the drag/preview state so a
  // cancelled drag (dropped outside any column) doesn't leave a ghost behind.
  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetType: 'week' | 'month' | 'year') => {
    e.preventDefault();
    setDragOverColumn(null);
    const idStr = e.dataTransfer.getData('text/plain');
    if (!idStr) return;
    const id = parseInt(idStr);

    // Find current type of the dragged goal
    let sourceType: 'week' | 'month' | 'year' | null = null;
    let draggedItem: Horizon | null = null;

    (['week', 'month', 'year'] as const).forEach(type => {
      const found = horizons[type].find(h => h.id === id);
      if (found) {
        sourceType = type;
        draggedItem = found;
      }
    });

    if (!sourceType || !draggedItem || sourceType === targetType) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move_horizon', id, type: targetType }),
      });
      const data = await res.json();
      if (data.success) {
        // Move in local state
        setHorizons(prev => {
          const sourceList = prev[sourceType!].filter(h => h.id !== id);
          const targetList = [...prev[targetType], { ...draggedItem!, type: targetType }];
          return {
            ...prev,
            [sourceType!]: sourceList,
            [targetType]: targetList,
          };
        });
      }
    } catch (err) {
      console.error('Error moving goal:', err);
    }
  };

  // Live-drag preview: which column currently holds the dragged dream + its
  // content, so a *different* column can render an animated "will land here"
  // ghost while hovering — no drop required to see the result.
  const draggingDream = draggingId == null
    ? null
    : (['week', 'month', 'year'] as const).flatMap((tp) => horizons[tp]).find((h) => h.id === draggingId) ?? null;
  const draggingType = draggingDream?.type ?? null;

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle
          ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Dream planning</h1>
          <p className="text-xs text-slate-400">Your vision across the week, the month, the year.</p>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: HORIZON COLUMNS (WEEK / MONTH / YEAR)
          Contains: Per-horizon goal columns (header, goals list, add input)
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-6">

        {/* Column Generator */}
        {(['week', 'month', 'year'] as const).map((type) => {
          const colLabel = type === 'week' ? 'This week' : type === 'month' ? 'This month' : 'This year';
          const colColor = horizonEdge(type); // primary-700 / primary-800 / primary-900 (deep brand ramp)
          const whisperColor = type === 'week' ? 'whisper-week' : type === 'month' ? 'whisper-month' : 'whisper-year';
          const ringColor = type === 'week' ? 'ring-primary-700/50' : type === 'month' ? 'ring-primary-800/50' : 'ring-primary-900/50';
          const isOver = dragOverColumn === type;
          const items = horizons[type] || [];

          return (
            <div
              key={type}
              data-entrance="card"
              onDragEnter={(e) => handleDragEnter(e, type)}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, type)}
              className={cn(
                'surface-raised rounded-3xl p-6 border border-slate-800/60 flex flex-col min-h-[460px] transition-all duration-300',
                whisperColor,
                isOver && `ring-4 ${ringColor} scale-[1.01]`,
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-5">
                {/* Badge is a translucent chip of the column's own surface — it
                    passively picks up each column's warm whisper instead of a
                    cool slate fill that floats. Column identity stays in the edge
                    accent + whisper, not a loud coloured pill. */}
                <span className="text-slate-200 text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 bg-white/[0.06] border border-white/[0.08]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {colLabel}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  {items.length} {items.length === 1 ? 'goal' : 'goals'}
                </span>
              </div>

              {/* Goals List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto mb-6 pr-1 max-h-80">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-16">
                    No goals here yet. Add one below.
                  </p>
                ) : (
                  items.map((h) => {
                    const m = momentumFor(h.id);
                    const isAdding = addingTaskFor === h.id;
                    return (
                    <div
                      key={h.id}
                      className={cn(
                        'group relative pl-4 pr-3.5 py-2.5 rounded-xl surface-sunken border border-slate-800/60 transition-all duration-200 hover:border-slate-700',
                        draggingId === h.id && 'opacity-40 scale-[0.98]'
                      )}
                    >
                      {/* Left-edge accent = horizon type (week/month/year) */}
                      <span className={cn('absolute left-0 inset-y-2 w-1 rounded-full edge-accent', horizonEdge(type))} />
                      {/* Drag handle row — draggable lives here (not the card) so the
                          inline task input below stays focusable/selectable. */}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, h.id)}
                        onDragEnd={handleDragEnd}
                        className="flex items-start gap-2.5 cursor-grab active:cursor-grabbing"
                      >
                        <Button variant="unstyled"
                          onClick={() => handleCompleteGoal(h.id, type)}
                          title="Complete Goal"
                          className="mt-0.5 w-4 h-4 rounded border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-colors flex-shrink-0"
                        >
                          <Check className="w-2.5 h-2.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>

                        <p className="flex-1 text-sm text-slate-200 leading-tight">
                          {h.content}
                        </p>

                        <Button variant="unstyled"
                          onClick={() => handleDeleteHorizon(h.id, type)}
                          title="Delete Goal"
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity flex-shrink-0 p-0.5 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {/* Momentum readout + inline add-task, aligned under the goal text */}
                      <div className="pl-[26px] mt-2 space-y-2">
                        {m.total > 0 ? (
                          <div className="space-y-1">
                            <Progress value={m.done} max={m.total} variant="primary" size="sm" />
                            <p className="text-[10px] font-semibold text-slate-400">
                              {m.done}/{m.total} tasks · <span className="text-primary-500 font-bold">{m.focusedMins}m</span> focused
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] font-medium text-slate-600 italic">No tasks linked yet</p>
                        )}

                        {m.total - m.done > 0 && (
                          <Button
                            onClick={() => router.push(`/time/execution?horizon=${h.id}`)}
                            variant="soft"
                            size="sm"
                            fullWidth
                            leftIcon={<Target className="w-3.5 h-3.5" />}
                            className="mt-1 whitespace-nowrap"
                          >
                            Focus this dream
                          </Button>
                        )}

                        {isAdding ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              size="sm"
                              autoFocus
                              value={taskDraft}
                              onChange={(e) => setTaskDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTaskToGoal(h.id);
                                if (e.key === 'Escape') { setAddingTaskFor(null); setTaskDraft(''); }
                              }}
                              placeholder="Task title…"
                              containerClassName="flex-1"
                            />
                            <Button variant="unstyled"
                              onClick={() => handleAddTaskToGoal(h.id)}
                              title="Add task"
                              className="w-9 h-9 flex-shrink-0 rounded-lg bg-primary-500/15 text-primary-400 hover:bg-primary-500/25 flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-4 h-4 stroke-[3]" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="unstyled"
                            onClick={() => { setAddingTaskFor(h.id); setTaskDraft(''); }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add task
                          </Button>
                        )}
                      </div>
                    </div>
                    );
                  })
                )}

                {/* Live insertion ghost — appears the moment a dream is dragged
                    over a *different* column, previewing where it will land with
                    a smooth expand. It's replaced by the real card on drop. */}
                {dragOverColumn === type && draggingType && draggingType !== type && draggingDream && (
                  <div className="relative pl-4 pr-3.5 py-2.5 rounded-xl border border-dashed border-primary-500/50 bg-primary-500/[0.06] animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-200">
                    <span className={cn('absolute left-0 inset-y-2 w-1 rounded-full', horizonEdge(type))} />
                    <p className="text-sm text-slate-200 leading-tight line-clamp-2">{draggingDream.content}</p>
                    <p className="text-[10px] font-semibold text-primary-400 mt-1.5">Release to move here</p>
                  </div>
                )}
              </div>

              {/* Add Input */}
              <div className="mt-auto space-y-2">
                <input
                  type="text"
                  placeholder={`Add a ${type} goal…`}
                  value={inputs[type]}
                  onChange={(e) => setInputs(prev => ({ ...prev, [type]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGoal(type)}
                  className="w-full px-4 h-10 text-xs bg-slate-900/30 border border-slate-850 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 transition-all"
                />
                <Button variant="unstyled"
                  onClick={() => handleAddGoal(type)}
                  className={cn('w-full text-white text-xs font-semibold h-10 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1', colColor)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add goal
                </Button>
              </div>

            </div>
          );
        })}

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ARCHIVED GOALS
          Contains: Completed / archived goals list
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="surface-base border border-slate-800/60 rounded-3xl p-6">
        <div className="mb-6 pb-4 border-b border-slate-850">
          <SectionHeader
            icon={<Archive />}
            accent="neutral"
            title="Archived goals"
            count={archived.length}
          />
        </div>

        {archived.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-10">No completed goals yet.</p>
        ) : (
          <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-4">
            {archived.map((h) => (
              <div
                key={h.id}
                className="group flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-900/10 border border-slate-850/20"
              >
                <div className="mt-0.5 w-4 h-4 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through text-slate-500 truncate leading-tight">
                    {h.content}
                  </p>
                  <span className="inline-block text-[10px] font-semibold capitalize text-slate-400 mt-1.5">
                    {h.type} goal
                  </span>
                </div>
                <Button variant="unstyled"
                  onClick={() => handleDeleteHorizon(h.id, h.type, true)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-0.5 rounded flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
