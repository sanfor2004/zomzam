'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { LayoutDashboard, Clock, Plus, Check, Play, Edit2, Trash2, RotateCcw, AlertCircle, Database, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Button, Select, Modal, Input, SectionHeader, Skeleton, ProLock } from '@/components/ui';
import { cn } from '@/lib/utils';
import { gsap } from '@/lib/gsap';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { useTasks } from './useTasks';
import { parseQuickTask, type Task, type Priority } from './page.services';
import { priorityEdge } from '../types';

// Priority + duration option lists — shared by the add form and the edit modal
// (was duplicated inline in both). The priority dot uses priorityEdge so the
// dropdown swatch matches the row's left-edge accent everywhere.
const PRIORITY_OPTIONS = (['urgent', 'medium', 'maybe', 'free'] as Priority[]).map((p) => ({
  value: p,
  label: (
    <div className="flex items-center gap-2">
      <span className={cn('w-2.5 h-2.5 rounded-full', priorityEdge(p))} />
      <span className="capitalize text-white">{p}</span>
    </div>
  ),
}));

const DURATION_OPTIONS = [15, 25, 30, 45, 60, 90, 120, 180].map((m) => ({
  value: m,
  label: m < 60 ? `${m} min` : `${m / 60} hour${m === 60 ? '' : 's'}`,
}));

export default function TaskBoardPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Data + CRUD (load, add, complete, restore, delete, undo, edit). Notion sync
  // is Pro-gated (ProLock) — the hook still owns the sync logic for when billing
  // lands, but this page no longer wires it to a free control.
  const {
    horizons, isLoading, activeTasks, completedTasks,
    undoTask, showUndoToast,
    addTask, updateTask, completeTask, restoreTask, deleteTask, undoDelete,
  } = useTasks();

  const pageRef  = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [isLoading]);

  // One smart input drives the whole add flow. Collapsed: type a task (optionally
  // with `urgent`/`45m` tokens) and submit — parseQuickTask fills priority + time.
  // Open "Add details" to override those and set a dream link.
  const [quickInput, setQuickInput] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDuration, setNewDuration] = useState(25);
  const [newHorizonId, setNewHorizonId] = useState<string>('');

  // Opening details pre-fills the selects from whatever tokens were typed, so the
  // panel starts where the quick text left off (then the user corrects them).
  const toggleDetails = () => {
    setDetailsOpen((open) => {
      if (!open) {
        const { priority, duration } = parseQuickTask(quickInput);
        setNewPriority(priority);
        setNewDuration(duration);
      }
      return !open;
    });
  };

  // Edit Modal State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDuration, setEditDuration] = useState(25);
  const [editHorizonId, setEditHorizonId] = useState<string>('');

  // Single submit for both paths. Title always comes from the smart input (tokens
  // stripped); priority/time/dream come from the details panel when it's open,
  // otherwise from the parsed tokens. Resets everything on success.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseQuickTask(quickInput);
    const title = parsed.title || quickInput.trim();
    if (!title) return;
    const ok = await addTask({
      title,
      priority: detailsOpen ? newPriority : parsed.priority,
      duration: detailsOpen ? newDuration : parsed.duration,
      horizonId: detailsOpen ? newHorizonId : '',
    });
    if (ok) {
      setQuickInput('');
      setNewPriority('medium');
      setNewDuration(25);
      setNewHorizonId('');
      setDetailsOpen(false);
    }
  };

  // ──────────────────────────────────────────────────────────
  // DEVELOPMENT NAVIGATOR: TASK COMPLETION FLASH (GSAP)
  // Row does a brief scale flash: 1 → 1.08 → 1 on completion.
  // ──────────────────────────────────────────────────────────
  const flashTaskCompletion = (taskId: number) => {
    const row = tasksRef.current?.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
    if (!row) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        row,
        { scale: 1 },
        { scale: 1.08, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1, onComplete: () => gsap.set(row, { scale: 1 }) }
      );
    });
  };

  // Complete → optimistic update (hook) then the flash on success.
  const handleComplete = async (id: number) => {
    if (await completeTask(id)) flashTaskCompletion(id);
  };

  // Open Edit Dialog
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDuration(task.duration_block);
    setEditHorizonId(task.horizon_id ? task.horizon_id.toString() : '');
  };

  // Submit Edit — closes the modal on success.
  const handleEditTask = async () => {
    if (!editingTask || !editTitle.trim()) return;
    const ok = await updateTask(editingTask.id, { title: editTitle, priority: editPriority, duration: editDuration, horizonId: editHorizonId });
    if (ok) setEditingTask(null);
  };

  // Priority → left-edge accent is centralised in ../types (priorityEdge) so the
  // colour map lives in one place and merges via cn() — no more colorless dots.

  // Priority legend — reused in the Active Tasks header actions slot.
  const priorityLegend = (
    <div className="flex flex-wrap items-center gap-2.5">
      {(['urgent', 'medium', 'maybe', 'free'] as Priority[]).map((p) => (
        <span key={p} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 capitalize">
          <span className={cn('w-2 h-2 rounded-full', priorityEdge(p))} />
          {p}
        </span>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: UNDO TOAST
          Contains: Floating "task deleted — undo" toast (rendered transiently)
          ────────────────────────────────────────────────────────── */}
      {showUndoToast && undoTask && (
        <div className="fixed bottom-6 right-6 bg-slate-800/90 backdrop-blur-xl border border-slate-200/20 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span>Task &quot;{undoTask.title}&quot; deleted.</span>
          </div>
          <Button variant="unstyled"
            onClick={undoDelete}
            className="text-xs font-bold text-primary-500 hover:text-primary-400 transition-colors"
          >
            Undo
          </Button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER SECTION
          Contains: Title, Description, and Actions (Sync Notion / Start Session)
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Task board</h1>
            <p className="text-xs text-slate-400">Prioritise, time-block, and link work to your dreams.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          {/* Notion sync is a Pro feature — gated visually via ProLock (spec-11 §7).
              The Database icon rides behind the pill as the faint "what's locked" ghost. */}
          <ProLock variant="inline" label="Sync Notion">
            <Database className="w-4 h-4" />
          </ProLock>

          <Button
            onClick={() => router.push('/time/execution')}
            variant="primary"
            className="text-xs"
          >
            <Play className="w-4 h-4 fill-currentColor mr-2" />
            Start focus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Task List (Left Columns) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: ACTIVE TASKS BOARD
              Contains: Priority Legend and List of Pending/Active Tasks
              ────────────────────────────────────────────────────────── */}
          <div className="surface-raised border border-slate-800/60 rounded-3xl p-6">
            <div className="mb-6 pb-4 border-b border-slate-850">
              <SectionHeader
                icon={<LayoutDashboard />}
                accent="primary"
                title="Active tasks"
                count={activeTasks.length}
                countLabel="open"
                actions={priorityLegend}
              />
            </div>

            {activeTasks.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">Nothing queued.</p>
                <p className="text-xs text-slate-500 mt-1">Add a task with the form on the right.</p>
              </div>
            ) : (
              <div ref={tasksRef} className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    data-entrance="list-item"
                    data-task-id={String(task.id)}
                    className="group relative flex items-center justify-between gap-2 pl-4 pr-3 py-2.5 surface-sunken border border-slate-850/50 rounded-xl transition-all hover:border-slate-800"
                  >
                    {/* Left-edge accent = priority (paired with the meta label below) */}
                    <span className={cn('absolute left-0 inset-y-2 w-1 rounded-full edge-accent', priorityEdge(task.priority))} />
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {task.title}
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mt-0.5">
                          <span className="capitalize font-semibold text-slate-500">{task.priority}</span>
                          <span className="text-slate-700">·</span>
                          <Clock className="w-3 h-3" />
                          {task.duration_block}m
                          {task.horizon_id && (
                            <>
                              <span className="text-slate-700">·</span>
                              <span className="text-purple-400 font-semibold">linked to a dream</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button variant="unstyled"
                        onClick={() => handleComplete(task.id)}
                        title="Mark Complete"
                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-colors"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </Button>
                      <Button variant="unstyled"
                        onClick={() => openEditModal(task)}
                        title="Edit Task"
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="unstyled"
                        onClick={() => deleteTask(task.id)}
                        title="Delete Task"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: COMPLETED TASKS CARD
              Contains: List of Completed Tasks with restore triggers
              ────────────────────────────────────────────────────────── */}
          <div className="surface-base border border-slate-800/60 rounded-3xl p-6 opacity-90">
            <div className="mb-6 pb-4 border-b border-slate-850">
              <SectionHeader
                icon={<CheckCircle2 />}
                accent="neutral"
                title="Completed"
                count={completedTasks.length}
              />
            </div>

            {completedTasks.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-10 italic">No tasks completed yet today.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group relative flex items-center justify-between gap-2 pl-4 pr-3 py-2.5 surface-sunken border border-slate-850/20 rounded-xl"
                  >
                    <span className={cn('absolute left-0 inset-y-2 w-1 rounded-full edge-accent opacity-50', priorityEdge(task.priority))} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-500 line-through truncate">
                        {task.title}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold mt-0.5">
                        Completed: {task.actual_duration || task.duration_block} mins
                      </span>
                    </div>
                    <Button variant="unstyled"
                      onClick={() => restoreTask(task.id)}
                      title="Restore Task"
                      className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-500/10 rounded-xl transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: ADD TASK FORM
            Contains: Form inputs to configure and add new task records
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="surface-base border border-slate-800/60 rounded-3xl p-6">
            <form onSubmit={handleSubmit}>

              {/* ──────────────────────────────────────────────────────────
                  DEVELOPMENT NAVIGATOR: SMART TASK INPUT
                  Contains: one natural-language input (Enter to add) + inline hint
                  ────────────────────────────────────────────────────────── */}
              <SectionHeader icon={<Plus />} accent="primary" title="Add a task" />

              <div className="mt-5">
                <Input
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  placeholder="What needs to be done?"
                  leftIcon={<Plus className="w-4 h-4" />}
                  autoComplete="off"
                />
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Tip: add a word like <span className="font-mono text-slate-400">urgent</span> and a time like{' '}
                  <span className="font-mono text-slate-400">45m</span> to set them inline — or open details below.
                </p>
              </div>

              {/* ──────────────────────────────────────────────────────────
                  DEVELOPMENT NAVIGATOR: DETAILS DISCLOSURE
                  Contains: toggle + collapsible priority / time / dream fields
                  ────────────────────────────────────────────────────────── */}
              <button
                type="button"
                onClick={toggleDetails}
                aria-expanded={detailsOpen}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', detailsOpen && 'rotate-180')} />
                {detailsOpen ? 'Hide details' : 'Add details'}
              </button>

              {detailsOpen && (
                <div className="mt-4 pt-4 border-t border-slate-850 space-y-5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 mb-2 block">Priority</label>
                      <Select value={newPriority} onChange={(val) => setNewPriority(val)} options={PRIORITY_OPTIONS} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400 mb-2 block">Time block</label>
                      <Select value={newDuration} onChange={(val) => setNewDuration(Number(val))} options={DURATION_OPTIONS} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-2 block">
                      Link to a dream <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <Select
                      value={newHorizonId}
                      onChange={(val) => setNewHorizonId(val.toString())}
                      options={[
                        { value: '', label: '— No dream link —' },
                        ...horizons
                          .filter(h => h.status === 'active')
                          .map(h => ({
                            value: h.id.toString(),
                            label: `[${h.type.toUpperCase()}] ${h.content.substring(0, 30)}…`,
                          })),
                      ]}
                    />
                  </div>
                </div>
              )}

              <Button type="submit" variant="primary" className="w-full h-12 text-sm mt-6">
                <Plus className="w-4 h-4 stroke-[3] mr-2" />
                Add task
              </Button>
            </form>
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: EDIT TASK MODAL
          Contains: Dialog overlay to edit task metadata
          ────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        title="Edit Task"
        className="max-w-lg"
      >
        <div className="space-y-6">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-2 block">Task title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-12 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm font-bold focus:outline-none focus:border-primary-500 transition-all text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Edit Priority Dropdown */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-2 block">Priority</label>
              <Select value={editPriority} onChange={(val) => setEditPriority(val)} options={PRIORITY_OPTIONS} />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 mb-2 block">Duration</label>
              <Select value={editDuration} onChange={(val) => setEditDuration(Number(val))} options={DURATION_OPTIONS} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 mb-2 block">Link to a dream</label>
            <Select
              value={editHorizonId}
              onChange={(val) => setEditHorizonId(val.toString())}
              options={[
                { value: '', label: '— No Dream Link —' },
                ...horizons
                  .filter(h => h.status === 'active')
                  .map(h => ({
                    value: h.id.toString(),
                    label: `[${h.type.toUpperCase()}] ${h.content.substring(0, 30)}…`,
                  })),
              ]}
            />
          </div>

          <Button
            onClick={handleEditTask}
            variant="primary"
            className="w-full h-12 text-sm"
          >
            Update Task
          </Button>
        </div>
      </Modal>

    </div>
  );
}
