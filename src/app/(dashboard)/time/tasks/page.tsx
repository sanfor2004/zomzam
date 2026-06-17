'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { LayoutDashboard, Clock, Plus, Check, Play, Edit2, Trash2, RotateCcw, X, AlertCircle, Database } from 'lucide-react';
import { Button, Select, Modal, Alert } from '@/components/ui';

interface Task {
  id: number;
  user_id: number;
  horizon_id: number | null;
  title: string;
  priority: 'urgent' | 'medium' | 'maybe' | 'free';
  duration_block: number;
  actual_duration: number | null;
  status: 'pending' | 'completed' | 'deleted';
  created_at: string;
  completed_at: string | null;
}

interface Horizon {
  id: number;
  user_id: number;
  type: 'week' | 'month' | 'year';
  content: string;
  status: 'active' | 'completed';
  created_at: string;
}

export default function TaskBoardPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Notion sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSyncNotion = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStats(null);
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncStats(data.stats);
        loadData();
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

  // Add Form State
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'urgent' | 'medium' | 'maybe' | 'free'>('medium');
  const [newDuration, setNewDuration] = useState(25);
  const [newHorizonId, setNewHorizonId] = useState<string>('');


  // Edit Modal State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<'urgent' | 'medium' | 'maybe' | 'free'>('medium');
  const [editDuration, setEditDuration] = useState(25);
  const [editHorizonId, setEditHorizonId] = useState<string>('');


  // Undo Buffer
  const [undoTask, setUndoTask] = useState<Task | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Load from API
  const loadData = async () => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load' }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        // Horizons are grouped by week/month/year in api, let's flatten them for linking dropdown
        const week = data.horizons?.week || [];
        const month = data.horizons?.month || [];
        const year = data.horizons?.year || [];
        setHorizons([...week, ...month, ...year]);
      }
    } catch (err) {
      console.error('Failed to load tasks data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_task',
          title: newTitle,
          priority: newPriority,
          duration_block: newDuration,
          horizon_id: newHorizonId ? parseInt(newHorizonId) : null,
        }),
      });
      const data = await res.json();
      if (data.success && data.task) {
        setTasks(prev => [...prev, data.task]);
        setNewTitle('');
        setNewPriority('medium');
        setNewDuration(25);
        setNewHorizonId('');
      }
    } catch (err) {
      console.error('Error adding task:', err);
    }
  };

  // Complete Task
  const handleCompleteTask = async (id: number) => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_task', id }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() } : t));
      }
    } catch (err) {
      console.error('Error completing task:', err);
    }
  };

  // Restore Task
  const handleRestoreTask = async (id: number) => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_task', id }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' as const, completed_at: null } : t));
      }
    } catch (err) {
      console.error('Error restoring task:', err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: number) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_task', id }),
      });
      const data = await res.json();
      if (data.success) {
        setUndoTask(taskToDelete);
        setShowUndoToast(true);
        setTasks(prev => prev.filter(t => t.id !== id));
        setTimeout(() => {
          setShowUndoToast(false);
        }, 6000);
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Restore Deleted Task (Undo)
  const handleUndoDelete = async () => {
    if (!undoTask) return;
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore_task', id: undoTask.id }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(prev => [...prev, { ...undoTask, status: 'pending' as const }]);
        setUndoTask(null);
        setShowUndoToast(false);
      }
    } catch (err) {
      console.error('Error restoring task:', err);
    }
  };

  // Open Edit Dialog
  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDuration(task.duration_block);
    setEditHorizonId(task.horizon_id ? task.horizon_id.toString() : '');
  };

  // Submit Edit
  const handleEditTask = async () => {
    if (!editingTask || !editTitle.trim()) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_task',
          id: editingTask.id,
          title: editTitle,
          priority: editPriority,
          duration_block: editDuration,
          horizon_id: editHorizonId ? parseInt(editHorizonId) : null,
        }),
      });
      const data = await res.json();
      if (data.success && data.task) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? data.task : t));
        setEditingTask(null);
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  // Priority Styles Helper
  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case 'urgent': return 'bg-red-500';
      case 'medium': return 'bg-amber-400';
      case 'maybe': return 'bg-blue-400';
      case 'free': return 'bg-slate-300';
      default: return 'bg-slate-400';
    }
  };

  // Filter & Sort Tasks
  const activeTasks = tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, medium: 1, maybe: 2, free: 3 };
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (diff !== 0) return diff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const completedTasks = tasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime());

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in">
      
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
            onClick={handleUndoDelete}
            className="text-xs font-black uppercase tracking-wider text-primary-500 hover:text-primary-400 transition-colors"
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
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">Task Board</h1>
            <p className="text-xs text-slate-400">Prioritize, time-block, and link to your dreams.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Button
            onClick={handleSyncNotion}
            loading={isSyncing}
            variant="secondary"
            className="text-xs border-purple-500/20 hover:bg-purple-500/5 text-purple-650"
          >
            <Database className="w-4 h-4 mr-2" />
            Sync Notion
          </Button>

          <Button
            onClick={() => router.push('/time/execution')}
            variant="primary"
            className="text-xs"
          >
            <Play className="w-4 h-4 fill-currentColor mr-2" />
            Start Focus Session
          </Button>
        </div>
      </div>

      {syncStats && (
        <Alert variant="success" animate>
          Notion synchronization complete! Synced: {syncStats.tasks} tasks, {syncStats.projects} projects, {syncStats.links} links.
        </Alert>
      )}

      {syncError && (
        <Alert variant="error" animate>{syncError}</Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Task List (Left Columns) */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* ──────────────────────────────────────────────────────────
              DEVELOPMENT NAVIGATOR: ACTIVE TASKS BOARD
              Contains: Priority Legend and List of Pending/Active Tasks
              ────────────────────────────────────────────────────────── */}
          <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-850">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
                Active Tasks
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Urgent
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Medium
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  Maybe
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  Free
                </div>
              </div>
            </div>

            {activeTasks.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">No pending tasks. Great job!</p>
                <p className="text-xs text-slate-500 mt-1">Create one using the form on the right.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {activeTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-4 bg-slate-900/30 border border-slate-850/50 rounded-2xl transition-all hover:shadow-apple-sm hover:border-slate-800 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0${getPriorityColor(task.priority)}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {task.title}
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold mt-0.5">
                          <Clock className="w-3 h-3" />
                          Block: {task.duration_block} mins
                          {task.horizon_id && (
                            <>
                              <span className="mx-1 text-slate-700">•</span>
                              <span className="text-purple-500 font-bold">Dream Link</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button variant="unstyled"
                        onClick={() => handleCompleteTask(task.id)}
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
                        onClick={() => handleDeleteTask(task.id)}
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
          <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple opacity-80">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-850">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                Completed Tasks
              </h2>
              <span className="text-xs bg-slate-900/60 text-slate-500 font-bold px-2.5 py-1 rounded-full">
                {completedTasks.length}
              </span>
            </div>

            {completedTasks.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-10 italic">No tasks completed yet today.</p>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3.5 bg-slate-900/10 border border-slate-850/20 rounded-xl"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-500 line-through truncate">
                        {task.title}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold mt-0.5">
                        Completed: {task.actual_duration || task.duration_block} mins
                      </span>
                    </div>
                    <Button variant="unstyled"
                      onClick={() => handleRestoreTask(task.id)}
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
          <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-5">
              Add New Task
            </h2>
            <form onSubmit={handleAddTask} className="space-y-4">
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Task Title</label>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-11 px-4 bg-slate-900/30 border border-slate-850 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Priority Selection */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Priority</label>
                  <Select
                    value={newPriority}
                    onChange={(val) => setNewPriority(val)}
                    options={[
                      {
                        value: 'urgent',
                        label: (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            <span className="capitalize text-white">Urgent</span>
                          </div>
                        ),
                      },
                      {
                        value: 'medium',
                        label: (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span className="capitalize text-white">Medium</span>
                          </div>
                        ),
                      },
                      {
                        value: 'maybe',
                        label: (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                            <span className="capitalize text-white">Maybe</span>
                          </div>
                        ),
                      },
                      {
                        value: 'free',
                        label: (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="capitalize text-white">Free</span>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>

                {/* Duration select */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Time Block</label>
                  <Select
                    value={newDuration}
                    onChange={(val) => setNewDuration(Number(val))}
                    options={[
                      { value: 15, label: '15 min' },
                      { value: 25, label: '25 min' },
                      { value: 30, label: '30 min' },
                      { value: 45, label: '45 min' },
                      { value: 60, label: '1 hour' },
                      { value: 90, label: '1.5 hours' },
                      { value: 120, label: '2 hours' },
                      { value: 180, label: '3 hours' },
                    ]}
                  />
                </div>
              </div>

              {/* Link Horizon */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">
                  Link to Dream Goal <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <Select
                  value={newHorizonId}
                  onChange={(val) => setNewHorizonId(val.toString())}
                  options={[
                    { value: '', label: '— No Dream Link —' },
                    ...horizons
                      .filter(h => h.status === 'active')
                      .map(h => ({
                        value: h.id.toString(),
                        label: `[${h.type.toUpperCase()}] ${h.content.substring(0, 30)}...`,
                      })),
                  ]}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-xs bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/50"
              >
                <Plus className="w-4 h-4 stroke-[3] mr-2" />
                Add Task
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
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Task Title</label>
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
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Priority</label>
              <Select
                value={editPriority}
                onChange={(val) => setEditPriority(val)}
                options={[
                  {
                    value: 'urgent',
                    label: (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="capitalize text-white">Urgent</span>
                      </div>
                    ),
                  },
                  {
                    value: 'medium',
                    label: (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="capitalize text-white">Medium</span>
                      </div>
                    ),
                  },
                  {
                    value: 'maybe',
                    label: (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="capitalize text-white">Maybe</span>
                      </div>
                    ),
                  },
                  {
                    value: 'free',
                    label: (
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="capitalize text-white">Free</span>
                      </div>
                    ),
                  },
                ]}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Duration</label>
              <Select
                value={editDuration}
                onChange={(val) => setEditDuration(Number(val))}
                options={[
                  { value: 15, label: '15 min' },
                  { value: 25, label: '25 min' },
                  { value: 30, label: '30 min' },
                  { value: 45, label: '45 min' },
                  { value: 60, label: '1 hour' },
                  { value: 90, label: '1.5 hours' },
                  { value: 120, label: '2 hours' },
                ]}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Link to Dream Goal</label>
            <Select
              value={editHorizonId}
              onChange={(val) => setEditHorizonId(val.toString())}
              options={[
                { value: '', label: '— No Dream Link —' },
                ...horizons
                  .filter(h => h.status === 'active')
                  .map(h => ({
                    value: h.id.toString(),
                    label: `[${h.type.toUpperCase()}] ${h.content.substring(0, 30)}...`,
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
