'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Clock, Check, Shuffle, Plus, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button, Input, ProLock } from '@/components/ui';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { usePomodoroTimer } from '@/hooks/usePomodoroTimer';
import { cn } from '@/lib/utils';
import { priorityEdge, horizonEdge } from '../types';
import { addIdeaRequest } from '../ideas/page.services';
import { TimerRing } from './_components/TimerRing';
import { TimerControls } from './_components/TimerControls';
import { DurationTuners } from './_components/DurationTuners';

interface Task {
  id: number;
  user_id: number;
  horizon_id: number | null;
  title: string;
  priority: 'urgent' | 'medium' | 'maybe' | 'free';
  duration_block: number;
  actual_duration: number | null;
  status: 'pending' | 'in_progress' | 'completed' | 'deleted';
  created_at: string;
  completed_at: string | null;
}

export default function PomodoroPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, []);

  // Tasks & Server Sync
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ideasCount, setIdeasCount] = useState(0);
  // Active dream goals â€” carry `type` too so the dream-progress bar can colour
  // itself by horizon (horizonEdge = data, per the colour=meaning rule).
  const [horizons, setHorizons] = useState<{ id: number; content: string; type: string }[]>([]);

  // Break-time idea capture (F2): draft, in-flight guard, and a 1.5s "saved" flash.
  const [ideaDraft, setIdeaDraft] = useState('');
  const [savingIdea, setSavingIdea] = useState(false);
  const [ideaSaved, setIdeaSaved] = useState(false);

  // Capture a mid-focus thought straight into Idea Capture without leaving the break.
  const handleBreakCapture = async () => {
    const content = ideaDraft.trim();
    if (!content || savingIdea) return;
    setSavingIdea(true);
    try {
      const idea = await addIdeaRequest({ content, linkedTaskId: null, linkedHorizonId: null });
      if (idea) {
        setIdeaDraft('');
        setIdeaSaved(true);
        setTimeout(() => setIdeaSaved(false), 1500);
      }
    } catch (err) {
      console.error('Error capturing break idea:', err);
    } finally {
      setSavingIdea(false);
    }
  };

  // Timer engine â€” countdown, drift correction, localStorage persistence,
  // focus/break segments, and the daily session count all live in the hook.
  const timer = usePomodoroTimer();
  const {
    duration, breakDuration, remaining, isRunning, isBreak,
    sessionsToday, currentTaskStartTime,
  } = timer;

  // The task id we last auto-loaded the ring for. Guards the auto-load effect
  // so pausing (isRunning â†’ false) never re-runs setupFocusTime and wipes the
  // remaining time â€” it's a Pause button, not a Reset button.
  const lastSetupTaskId = useRef<number | null>(null);
  // Debounces the focus-duration â†’ task-board DB write while the user types.
  const focusSyncTimer  = useRef<NodeJS.Timeout | null>(null);

  // Load state from server
  const loadData = async () => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load' }),
      });
      const data = await res.json();
      if (data.success) {
        // Normalize in_progress â†’ treat as pending for display purposes
        const normalized = (data.tasks || []).map((t: Task) => ({
          ...t,
          status: t.status === 'in_progress' ? 'pending' : t.status,
        }));
        setTasks(normalized);

        const h = data.horizons || {};
        setHorizons([...(h.week || []), ...(h.month || []), ...(h.year || [])]);
        setIdeasCount((data.ideas || []).length);
      }
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push the freely-typed focus minutes back to the top task's board block so
  // the Pomodoro ring and the task board never drift. Optimistic locally,
  // debounced to the server so typing "45" isn't three separate writes.
  const syncTopTaskDuration = (mins: number) => {
    if (!topTask) return;
    setTasks(prev => prev.map(t => (t.id === topTask.id ? { ...t, duration_block: mins } : t)));
    if (focusSyncTimer.current) clearTimeout(focusSyncTimer.current);
    focusSyncTimer.current = setTimeout(() => {
      fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_task',
          id: topTask.id,
          title: topTask.title,
          priority: topTask.priority,
          duration_block: mins,
          horizon_id: topTask.horizon_id,
        }),
      }).catch(() => {});
    }, 600);
  };

  // Focus minutes â€” freely typed (5â€“120), no 5-minute snap. Retunes the ring
  // and syncs the board. The lastSetupTaskId guard keeps the auto-load effect
  // from clobbering the value we just set for the same task.
  const handleFocusChange = (raw: string) => {
    if (isRunning) return;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const mins = Math.max(5, Math.min(120, parsed));
    if (topTask) lastSetupTaskId.current = topTask.id;
    timer.setupFocusTime(mins);
    syncTopTaskDuration(mins);
  };

  // Break minutes â€” freely typed (1â€“60). No board counterpart, so it just
  // retunes the break segment (the hook persists it).
  const handleBreakChange = (raw: string) => {
    if (isRunning) return;
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    timer.setBreakMinutes(Math.max(1, Math.min(60, parsed)));
  };

  // Auto-load task duration block if top task changes and timer not running
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const topTask = pendingTasks[0] || null;
  // The dream the current focus task is pushing toward, if any.
  const topDream = topTask?.horizon_id ? horizons.find(h => h.id === topTask.horizon_id) : null;

  // Live dream progress â€” completed Ã· total tasks sharing the horizon, derived
  // purely from the already-loaded task set. Ticks up when a linked task
  // completes (handleDoneTask flips its status). Hidden when nothing is linked
  // (no divide-by-zero). See spec-11 Â§3.3.
  const dreamProgress = useMemo(() => {
    if (!topTask?.horizon_id) return null;
    const linked = tasks.filter(t => t.horizon_id === topTask.horizon_id);
    if (linked.length === 0) return null;
    const done = linked.filter(t => t.status === 'completed').length;
    return { done, total: linked.length, pct: Math.round((done / linked.length) * 100) };
  }, [tasks, topTask?.horizon_id]);

  // This week's focused time â€” sum of actual_duration for tasks completed in the
  // last 7 days (rolling, local time). A real, blurred-adjacent number for the
  // Pro money strip; not billing-grade. See spec-11 Â§3.4.
  const weekFocusMins = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return tasks
      .filter(t => t.status === 'completed' && t.completed_at && new Date(t.completed_at).getTime() >= weekAgo)
      .reduce((sum, t) => sum + (t.actual_duration || 0), 0);
  }, [tasks]);

  const fmtFocus = (mins: number) => {
    if (mins <= 0) return 'no focused time yet';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return `${h}h ${m}m focused`;
    if (h) return `${h}h focused`;
    return `${m}m focused`;
  };

  // Calm one-liner for the header, computed from state (voice guide Â§4).
  const dayLine = pendingTasks.length === 0
    ? "Nothing queued. Add something when you're ready."
    : `${pendingTasks.length} ${pendingTasks.length === 1 ? 'task' : 'tasks'}. First one's ${pendingTasks[0].duration_block} minutes.`;

  // "Later" queue = everything past now + next.
  const laterCount = Math.max(0, pendingTasks.length - 2);

  useEffect(() => {
    // Only (re)load the ring when the *top task itself* changes, not on every
    // isRunning/isBreak flip. Two things must NOT be clobbered:
    //   â€¢ a paused/running FOCUS on this task â€” currentTaskStartTime is set, so
    //     the persisted remaining survives navigate-away-and-return.
    //   â€¢ a break in progress â€” guarded by !isBreak.
    if (
      topTask && !isRunning && !isBreak &&
      currentTaskStartTime === null &&
      lastSetupTaskId.current !== topTask.id
    ) {
      lastSetupTaskId.current = topTask.id;
      timer.setupFocusTime(topTask.duration_block);
    }
  }, [topTask, isRunning, isBreak, currentTaskStartTime]);

  // Start the countdown, then flip the top task to in_progress on the board.
  // The timer engine owns the clock; this wrapper adds the task side effect.
  const handleStart = () => {
    timer.start();
    if (!isBreak && topTask) {
      fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_task_status', id: topTask.id, status: 'in_progress' }),
      }).catch(() => {});
    }
  };

  // Skip Task: Rotate the first pending task to the end of the queue
  const skipTask = async () => {
    if (pendingTasks.length < 2) return;
    timer.pause();

    const first = pendingTasks[0];
    const rest = pendingTasks.slice(1);
    const updated = [...rest, first];

    // Merge back with non-pending tasks
    const otherTasks = tasks.filter(t => t.status !== 'pending');
    setTasks([...updated, ...otherTasks]);

    timer.resetSegmentStart();
    timer.setupFocusTime(updated[0].duration_block);

    // Reset the skipped task back to pending in the DB
    try {
      await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_task_status', id: first.id, status: 'pending' }),
      });
    } catch {}
  };

  // Done Task: Calls backend API and clears local state
  const handleDoneTask = async () => {
    if (!topTask) return;
    timer.pause();

    const startTime = currentTaskStartTime || Date.now();
    const actualSecs = Math.floor((Date.now() - startTime) / 1000);
    const actualMins = Math.round(actualSecs / 60) || 1;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_task',
          id: topTask.id,
          actual_duration: actualMins,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setTasks(prev => prev.map(t => t.id === topTask.id ? { ...t, status: 'completed' as const, actual_duration: actualMins } : t));
        timer.resetSegmentStart();
        
        // Show session complete confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 }
        });
      }
    } catch (e) {
      console.error('Failed to complete task:', e);
    }
  };

  // Swap top two pending tasks
  const swapTask = () => {
    if (pendingTasks.length < 2) return;
    timer.pause();

    const first = pendingTasks[0];
    const second = pendingTasks[1];
    const rest = pendingTasks.slice(2);
    const updated = [second, first, ...rest];

    const otherTasks = tasks.filter(t => t.status !== 'pending');
    setTasks([...updated, ...otherTasks]);

    timer.resetSegmentStart();
    timer.setupFocusTime(second.duration_block);
  };

  // Clean the focus-sync debounce on unmount (the timer interval is the hook's).
  useEffect(() => {
    return () => {
      if (focusSyncTimer.current) clearTimeout(focusSyncTimer.current);
    };
  }, []);

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle, sessions-completed-today pill
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Today</h1>
            <p className="text-xs text-slate-400">{dayLine}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 surface-card border border-slate-800/60 rounded-2xl px-4 py-2.5 shadow-apple-sm self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          <span className="text-xs font-semibold text-slate-300">
            <span className="text-primary-500 font-bold">{sessionsToday}</span> focused today
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            DEVELOPMENT NAVIGATOR: TIMER COLUMN (left)
            Contains: SVG countdown ring, play/pause/reset controls,
            focus/break duration adjusters
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div data-entrance="card" className="lg:col-span-2 surface-raised border border-slate-800/60 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden">

          <TimerRing remaining={remaining} total={isBreak ? breakDuration : duration} isBreak={isBreak} />

          {/* Controls Box */}
          <div className="flex flex-col items-center gap-6 w-full">
            <TimerControls
              isRunning={isRunning}
              canSkip={pendingTasks.length >= 2}
              onReset={timer.reset}
              onToggle={isRunning ? timer.pause : handleStart}
              onSkip={skipTask}
            />

            {isBreak && (
              <>
                <Button variant="unstyled"
                  onClick={timer.skipBreak}
                  className="px-5 py-2 text-xs font-semibold bg-primary-950/20 text-primary-500 hover:bg-primary-900/30 rounded-full border border-primary-900/30 transition-colors"
                >
                  Skip break
                </Button>

                {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                    DEVELOPMENT NAVIGATOR: BREAK-TIME IDEA CAPTURE (F2)
                    Contains: one-line thought capture â†’ Idea Capture, saved flash
                    â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                <div className="w-full mt-1 rounded-2xl p-4 bg-emerald-500/[0.06] border border-emerald-500/15">
                  <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-emerald-500">
                    <Lightbulb className="w-3.5 h-3.5" /> Caught a thought?
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      size="sm"
                      value={ideaDraft}
                      onChange={(e) => setIdeaDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBreakCapture(); }}
                      placeholder="Capture it before it's goneâ€¦"
                      containerClassName="flex-1"
                    />
                    <Button
                      onClick={handleBreakCapture}
                      loading={savingIdea}
                      disabled={!ideaDraft.trim()}
                      size="sm"
                      title="Capture idea"
                      className="flex-shrink-0 bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-500/50"
                    >
                      {ideaSaved ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>
                  {ideaSaved && (
                    <p className="mt-1.5 text-[11px] font-semibold text-emerald-500">Saved â€” it&apos;s in your ideas.</p>
                  )}
                </div>
              </>
            )}

            <DurationTuners
              focusMins={Math.floor(duration / 60)}
              breakMins={Math.floor(breakDuration / 60)}
              disabled={isRunning}
              onFocusChange={handleFocusChange}
              onBreakChange={handleBreakChange}
            />
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            DEVELOPMENT NAVIGATOR: THE DAY â€” NOW / NEXT / LATER (right)
            Contains: Now card (focus task, priority, live dream bar, Done/Switch),
            Next row, Later collapsed count â†’ task board
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* NOW â€” the current focus task; the left-column ring is its Start/Pause.
              surface-featured = the special hero card (faint orange corner glow). */}
          <div data-entrance="card" className="flex-1 surface-featured border border-slate-800/60 rounded-3xl p-8 shadow-apple-lg flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-[11px] font-bold tracking-wide text-slate-500">Now</span>
                {topTask && (
                  <span className="text-xs font-semibold text-slate-400">{topTask.duration_block}m planned</span>
                )}
              </div>

              {topTask ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className={cn('mt-2 w-2 h-2 rounded-full shrink-0', priorityEdge(topTask.priority))} />
                    <h2 className="text-2xl font-black text-white tracking-tight leading-tight">
                      {topTask.title}
                    </h2>
                  </div>
                  <span className="block pl-[18px] text-xs font-medium text-slate-400">
                    {topTask.priority} priority
                  </span>

                  {/* Live dream progress â€” quiet counterpart to the session confetti */}
                  {topDream && dreamProgress && (
                    <div className="pl-[18px] pt-2">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs text-slate-400 truncate">toward â€” {topDream.content}</span>
                        <span className="text-xs font-semibold text-slate-400 tabular-nums shrink-0">
                          {dreamProgress.done}/{dreamProgress.total}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-850 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
                            horizonEdge(topDream.type),
                          )}
                          style={{ width: `${dreamProgress.pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-base text-slate-400 font-medium">
                    Nothing queued. Add something when you&apos;re ready.
                  </p>
                  <Button
                    onClick={() => router.push('/time/tasks')}
                    variant="primary"
                    size="sm"
                    className="mt-4"
                  >
                    Add a task
                  </Button>
                </div>
              )}
            </div>

            {topTask && (
              <div className="mt-8 space-y-3">
                <Button
                  onClick={handleDoneTask}
                  variant="primary"
                  className="w-full h-12 text-sm"
                >
                  <Check className="w-4 h-4 stroke-[3] mr-2" />
                  Done
                </Button>

                <Button
                  onClick={swapTask}
                  disabled={pendingTasks.length < 2}
                  variant="outline"
                  className="w-full h-11 text-sm"
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  Switch task
                </Button>
              </div>
            )}
          </div>

          {/* NEXT â€” the task after this one */}
          <div className="surface-base border border-slate-800/60 rounded-2xl px-6 py-4 flex items-center gap-3">
            <span className="text-[11px] font-bold tracking-wide text-slate-500 w-11 shrink-0">Next</span>
            {pendingTasks[1] ? (
              <>
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', priorityEdge(pendingTasks[1].priority))} />
                <p className="text-sm font-semibold text-slate-300 truncate flex-1">{pendingTasks[1].title}</p>
                <span className="text-xs text-slate-500 shrink-0 tabular-nums">{pendingTasks[1].duration_block}m</span>
              </>
            ) : (
              <p className="text-sm text-slate-500">Nothing after this.</p>
            )}
          </div>

          {/* LATER â€” the rest of the queue, collapsed; the full board is a tap away */}
          <Button
            variant="unstyled"
            onClick={() => router.push('/time/tasks')}
            className="card-lift surface-base border border-slate-800/60 rounded-2xl px-6 py-4 flex items-center gap-3 text-left hover:border-primary-500/30 group"
          >
            <span className="text-[11px] font-bold tracking-wide text-slate-500 w-11 shrink-0">Later</span>
            <p className="text-sm font-semibold text-slate-400 flex-1 truncate">
              {laterCount > 0 ? `${laterCount} more ${laterCount === 1 ? 'task' : 'tasks'}` : 'Queue is clear'}
              {ideasCount > 0 && <span className="text-slate-500"> · {ideasCount} {ideasCount === 1 ? 'idea' : 'ideas'}</span>}
            </p>
            <span className="text-xs text-slate-500 group-hover:text-primary-400 transition-colors shrink-0">Open board</span>
          </Button>

        </div>

      </div>

   
      <ProLock
        variant="strip"
        label="See what your time earns"
        sublabel={`This week €” ${fmtFocus(weekFocusMins)}`}
        blurred={<span>$â€¢â€¢â€¢</span>}
      />

    </div>
  );
}
