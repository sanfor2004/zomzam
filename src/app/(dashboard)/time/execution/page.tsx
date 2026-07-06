'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Clock, RotateCcw, Play, Pause, SkipForward, Check, Shuffle, Plus, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Button, Input, ProLock } from '@/components/ui';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { cn } from '@/lib/utils';
import { priorityEdge, horizonEdge } from '../types';
import { addIdeaRequest } from '../ideas/page.services';

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
  const [sessionsToday, setSessionsToday] = useState(0);
  const [ideasCount, setIdeasCount] = useState(0);
  // Active dream goals — carry `type` too so the dream-progress bar can colour
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

  // Timer State
  const [duration, setDuration] = useState(15 * 60); // default 15 min focus
  const [breakDuration, setBreakDuration] = useState(5 * 60); // default 5 min break
  const [remaining, setRemaining] = useState(15 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [currentTaskStartTime, setCurrentTaskStartTime] = useState<number | null>(null);

  // Refs for background-drift correction
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const remainingAtStartRef = useRef<number>(15 * 60);

  // ── Mirror refs ── kept in sync so that setInterval callbacks always
  // read the *current* value without stale-closure issues after navigation.
  const isBreakRef        = useRef(false);
  const sessionsRef       = useRef(0);
  const taskStartRef      = useRef<number | null>(null);
  const durationRef       = useRef(15 * 60);
  const breakDurationRef  = useRef(5 * 60);

  useEffect(() => { isBreakRef.current = isBreak; },               [isBreak]);
  useEffect(() => { sessionsRef.current = sessionsToday; },         [sessionsToday]);
  useEffect(() => { taskStartRef.current = currentTaskStartTime; }, [currentTaskStartTime]);
  useEffect(() => { durationRef.current = duration; },              [duration]);
  useEffect(() => { breakDurationRef.current = breakDuration; },    [breakDuration]);

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
        // Normalize in_progress → treat as pending for display purposes
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

    // Load pomodoro state from localStorage
    const saved = localStorage.getItem('zomzam_pomodoro');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const savedDuration      = data.duration      || 15 * 60;
        const savedBreakDuration = data.breakDuration || 5 * 60;
        const savedIsBreak       = !!data.isBreak;
        const savedSessions      = data.sessions      || 0;
        const savedStartTime     = data.currentTaskStartTime || null;

        // ── Sync mirror refs immediately (before React commits the state
        //    updates below) so that any interval we start right here reads
        //    the correct values, not the stale initial-state defaults.
        isBreakRef.current       = savedIsBreak;
        sessionsRef.current      = savedSessions;
        taskStartRef.current     = savedStartTime;
        durationRef.current      = savedDuration;
        breakDurationRef.current = savedBreakDuration;

        setDuration(savedDuration);
        setBreakDuration(savedBreakDuration);
        setIsBreak(savedIsBreak);
        setSessionsToday(savedSessions);
        setCurrentTaskStartTime(savedStartTime);

        let rem = data.remaining;
        if (data.isRunning && data.lastUpdate) {
          const elapsed = Math.floor((Date.now() - data.lastUpdate) / 1000);
          rem = Math.max(0, rem - elapsed);
        }

        if (rem <= 0) {
          setRemaining(savedIsBreak ? savedBreakDuration : savedDuration);
          setIsRunning(false);
        } else {
          setRemaining(rem);
          if (data.isRunning) {
            // Set up refs that tick() needs before starting the interval.
            remainingAtStartRef.current = rem;
            startTimeRef.current       = Date.now();
            // Start the interval directly here — setIsRunning(true) alone
            // would NOT restart it because the useEffect([isRunning]) only
            // fires after the render, by which time the interval is missing.
            if (!timerIntervalRef.current) {
              timerIntervalRef.current = setInterval(tick, 1000);
            }
            setIsRunning(true);
          }
        }
      } catch (e) {
        console.error('Error parsing saved Pomodoro state:', e);
      }
    }

    // Cleanup interval on unmount (navigation away)
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save Pomodoro state to localStorage — reads from refs so it is safe
  // to call from inside a setInterval callback (no stale-closure issue).
  const saveState = (updatedRemaining: number, updatedIsRunning: boolean, updatedIsBreak: boolean, updatedSessions: number, updatedStartTime: number | null) => {
    const pending = tasks.filter(t => t.status === 'pending');
    const taskName = pending.length > 0 ? pending[0].title : (updatedIsBreak ? 'Break' : 'Focusing');

    const data = {
      remaining: updatedRemaining,
      isRunning: updatedIsRunning,
      isBreak: updatedIsBreak,
      duration: durationRef.current,
      breakDuration: breakDurationRef.current,
      lastUpdate: Date.now(),
      sessions: updatedSessions,
      taskName,
      currentTaskStartTime: updatedStartTime,
    };
    localStorage.setItem('zomzam_pomodoro', JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('pomodoroUpdate'));
  };

  // Setup segment when adjusting inputs or loading new top task
  const setupFocusTime = (totalMins: number) => {
    if (isRunning) return;
    const secs = totalMins * 60;
    setDuration(secs);
    setRemaining(secs);
    setIsBreak(false);
    
    // Save state
    const data = {
      remaining: secs,
      isRunning: false,
      isBreak: false,
      duration: secs,
      breakDuration,
      lastUpdate: Date.now(),
      sessions: sessionsToday,
      taskName: tasks.filter(t => t.status === 'pending')[0]?.title || 'Focusing',
      currentTaskStartTime: null,
    };
    localStorage.setItem('zomzam_pomodoro', JSON.stringify(data));
  };

  // Adjust Focus minutes
  const adjustFocus = (amount: number) => {
    if (isRunning) return;
    const currentMins = Math.floor(duration / 60);
    let newMins = currentMins;
    if (amount > 0) {
      newMins = Math.floor(currentMins / 5) * 5 + 5;
    } else {
      newMins = Math.ceil(currentMins / 5) * 5 - 5;
    }
    newMins = Math.max(5, Math.min(120, newMins));
    setupFocusTime(newMins);
  };

  // Adjust Break minutes
  const adjustBreak = (amount: number) => {
    if (isRunning) return;
    const currentMins = Math.floor(breakDuration / 60);
    let newMins = currentMins;
    if (amount > 0) {
      newMins = Math.floor(currentMins / 5) * 5 + 5;
    } else {
      newMins = Math.ceil(currentMins / 5) * 5 - 5;
    }
    newMins = Math.max(1, Math.min(60, newMins));
    setBreakDuration(newMins * 60);
    // Save to localStorage
    const saved = localStorage.getItem('zomzam_pomodoro');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        data.breakDuration = newMins * 60;
        localStorage.setItem('zomzam_pomodoro', JSON.stringify(data));
      } catch {}
    }
  };

  // Auto-load task duration block if top task changes and timer not running
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const topTask = pendingTasks[0] || null;
  // The dream the current focus task is pushing toward, if any.
  const topDream = topTask?.horizon_id ? horizons.find(h => h.id === topTask.horizon_id) : null;

  // Live dream progress — completed ÷ total tasks sharing the horizon, derived
  // purely from the already-loaded task set. Ticks up when a linked task
  // completes (handleDoneTask flips its status). Hidden when nothing is linked
  // (no divide-by-zero). See spec-11 §3.3.
  const dreamProgress = useMemo(() => {
    if (!topTask?.horizon_id) return null;
    const linked = tasks.filter(t => t.horizon_id === topTask.horizon_id);
    if (linked.length === 0) return null;
    const done = linked.filter(t => t.status === 'completed').length;
    return { done, total: linked.length, pct: Math.round((done / linked.length) * 100) };
  }, [tasks, topTask?.horizon_id]);

  // This week's focused time — sum of actual_duration for tasks completed in the
  // last 7 days (rolling, local time). A real, blurred-adjacent number for the
  // Pro money strip; not billing-grade. See spec-11 §3.4.
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

  // Calm one-liner for the header, computed from state (voice guide §4).
  const dayLine = pendingTasks.length === 0
    ? "Nothing queued. Add something when you're ready."
    : `${pendingTasks.length} ${pendingTasks.length === 1 ? 'task' : 'tasks'}. First one's ${pendingTasks[0].duration_block} minutes.`;

  // "Later" queue = everything past now + next.
  const laterCount = Math.max(0, pendingTasks.length - 2);

  useEffect(() => {
    if (topTask && !isRunning && !isBreak) {
      setupFocusTime(topTask.duration_block);
    }
  }, [topTask, isRunning, isBreak]);

  // Audio feedback ring
  const playRingSound = () => {
    try {
      const audio = new Audio('/Assets/Audio/timer-ring.mp3');
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play ring sound:', e);
    }
  };

  // Tick Action — reads all volatile values from refs, NOT from the closure,
  // so it remains correct even when captured by an old setInterval call.
  const tick = () => {
    if (startTimeRef.current === null) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const nextRemaining = Math.max(0, remainingAtStartRef.current - elapsed);

    setRemaining(nextRemaining);
    saveState(nextRemaining, true, isBreakRef.current, sessionsRef.current, taskStartRef.current);

    if (nextRemaining <= 0) {
      handleTimerEnd();
    }
  };

  // ── Safety-net: auto-start the interval on mount when localStorage says
  // the timer was already running. This handles the page-navigation case where
  // the component unmounts (killing the interval) then remounts.
  useEffect(() => {
    if (isRunning && !timerIntervalRef.current) {
      startTimeRef.current = Date.now();
      remainingAtStartRef.current = remaining;
      timerIntervalRef.current = setInterval(tick, 1000);
    }
    if (!isRunning && timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning]);

  // Start Timer
  const startTimer = async () => {
    if (isRunning) return;

    let startTime = currentTaskStartTime;
    if (!startTime && !isBreak) {
      startTime = Date.now();
      setCurrentTaskStartTime(startTime);
    }

    setIsRunning(true);
    startTimeRef.current = Date.now();
    remainingAtStartRef.current = remaining;

    timerIntervalRef.current = setInterval(tick, 1000);
    saveState(remaining, true, isBreak, sessionsToday, startTime);

    // Mark the top pending task as in_progress in the DB
    if (!isBreak && topTask) {
      try {
        await fetch('/api/time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_task_status', id: topTask.id, status: 'in_progress' }),
        });
      } catch {}
    }
  };

  // Pause Timer
  const pauseTimer = () => {
    if (!isRunning) return;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRunning(false);
    startTimeRef.current = null;
    saveState(remaining, false, isBreak, sessionsToday, currentTaskStartTime);
  };

  // Reset Timer
  const resetTimer = () => {
    pauseTimer();
    const defaultVal = isBreak ? breakDuration : duration;
    setRemaining(defaultVal);
    saveState(defaultVal, false, isBreak, sessionsToday, currentTaskStartTime);
  };

  // Skip Break
  const skipBreak = () => {
    if (!isBreak) return;
    setIsBreak(false);
    setRemaining(duration);
    setIsRunning(false);
    setCurrentTaskStartTime(null);
    saveState(duration, false, false, sessionsToday, null);
  };

  // Triggered on timer expiration — reads from refs to avoid stale closures.
  const handleTimerEnd = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRunning(false);
    startTimeRef.current = null;
    playRingSound();

    if (!isBreakRef.current) {
      // Completed work segment
      const newSessions = sessionsRef.current + 1;
      sessionsRef.current = newSessions; // update ref immediately
      setSessionsToday(newSessions);
      isBreakRef.current = true;         // update ref immediately
      setIsBreak(true);
      setRemaining(breakDurationRef.current);
      setCurrentTaskStartTime(null);

      // Trigger premium feedback
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#EE5712', '#ff9874', '#ffffff'],
      });

      saveState(breakDurationRef.current, false, true, newSessions, null);
    } else {
      // Completed break segment
      isBreakRef.current = false;        // update ref immediately
      setIsBreak(false);
      setRemaining(durationRef.current);
      saveState(durationRef.current, false, false, sessionsRef.current, null);
    }
  };

  // Skip Task: Rotate the first pending task to the end of the queue
  const skipTask = async () => {
    if (pendingTasks.length < 2) return;
    pauseTimer();

    const first = pendingTasks[0];
    const rest = pendingTasks.slice(1);
    const updated = [...rest, first];

    // Merge back with non-pending tasks
    const otherTasks = tasks.filter(t => t.status !== 'pending');
    setTasks([...updated, ...otherTasks]);

    setCurrentTaskStartTime(null);
    setupFocusTime(updated[0].duration_block);

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
    pauseTimer();

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
        setCurrentTaskStartTime(null);
        
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
    pauseTimer();

    const first = pendingTasks[0];
    const second = pendingTasks[1];
    const rest = pendingTasks.slice(2);
    const updated = [second, first, ...rest];

    const otherTasks = tasks.filter(t => t.status !== 'pending');
    setTasks([...updated, ...otherTasks]);

    setCurrentTaskStartTime(null);
    setupFocusTime(second.duration_block);
  };

  // Clean interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Format remaining seconds into MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remain = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remain.toString().padStart(2, '0')}`;
  };

  // Calculate SVG Ring Dash Offset
  const totalDuration = isBreak ? breakDuration : duration;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalDuration > 0 
    ? circumference - (remaining / totalDuration) * circumference 
    : circumference;

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle, sessions-completed-today pill
          ────────────────────────────────────────────────────────── */}
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
        
        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: TIMER COLUMN (left)
            Contains: SVG countdown ring, play/pause/reset controls,
            focus/break duration adjusters
            ────────────────────────────────────────────────────────── */}
        <div data-entrance="card" className="lg:col-span-2 surface-raised border border-slate-800/60 rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden">

          {/* Visual SVG Ring */}
          <div className="relative w-64 h-64 mb-8">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-slate-800/40"
              />
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="text-primary-500 transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold tracking-wide text-primary-500">
                {isBreak ? 'On a break' : 'Focusing'}
              </span>
              <span className="text-5xl font-black tabular-nums text-white mt-1.5 tracking-tight">
                {formatTime(remaining)}
              </span>
            </div>
          </div>

          {/* Controls Box */}
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex items-center gap-4">
              <Button variant="unstyled"
                onClick={resetTimer}
                title="Reset"
                className="w-12 h-12 rounded-full border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-800/50 flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>

              <Button variant="unstyled"
                onClick={isRunning ? pauseTimer : startTimer}
                title={isRunning ? 'Pause' : 'Start focus'}
                aria-label={isRunning ? 'Pause' : 'Start focus'}
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4',
                  isRunning
                    ? 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/30 ring-2 ring-primary-400/40 focus-visible:ring-primary-500/40'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 focus-visible:ring-emerald-500/40',
                )}
              >
                {isRunning ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8" fill="currentColor" />}
              </Button>

              <Button variant="unstyled"
                onClick={skipTask}
                disabled={pendingTasks.length < 2}
                title="Skip to next task"
                className="w-12 h-12 rounded-full border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-800/50 flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            {isBreak && (
              <>
                <Button variant="unstyled"
                  onClick={skipBreak}
                  className="px-5 py-2 text-xs font-semibold bg-primary-950/20 text-primary-500 hover:bg-primary-900/30 rounded-full border border-primary-900/30 transition-colors"
                >
                  Skip break
                </Button>

                {/* ──────────────────────────────────────────────────────────
                    DEVELOPMENT NAVIGATOR: BREAK-TIME IDEA CAPTURE (F2)
                    Contains: one-line thought capture → Idea Capture, saved flash
                    ────────────────────────────────────────────────────────── */}
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
                      placeholder="Capture it before it's gone…"
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
                    <p className="mt-1.5 text-[11px] font-semibold text-emerald-500">Saved — it&apos;s in your ideas.</p>
                  )}
                </div>
              </>
            )}

            {/* Adjuster Inputs */}
            <div className="flex items-center gap-4 pt-4 border-t border-slate-800/50 w-full text-xs">
              
              {/* Focus adjuster */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">Focus duration</span>
                <div className="flex items-center border border-slate-850 rounded-xl bg-slate-900/30 overflow-hidden h-10">
                  <Button variant="unstyled"
                    onClick={() => adjustFocus(-5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-r border-slate-850"
                  >
                    -
                  </Button>
                  <span className="flex-1 text-center font-bold text-slate-200">
                    {Math.floor(duration / 60)}m
                  </span>
                  <Button variant="unstyled"
                    onClick={() => adjustFocus(5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-l border-slate-850"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Break adjuster */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">Break duration</span>
                <div className="flex items-center border border-slate-850 rounded-xl bg-slate-900/30 overflow-hidden h-10">
                  <Button variant="unstyled"
                    onClick={() => adjustBreak(-5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-r border-slate-850"
                  >
                    -
                  </Button>
                  <span className="flex-1 text-center font-bold text-slate-200">
                    {Math.floor(breakDuration / 60)}m
                  </span>
                  <Button variant="unstyled"
                    onClick={() => adjustBreak(5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-l border-slate-850"
                  >
                    +
                  </Button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            DEVELOPMENT NAVIGATOR: THE DAY — NOW / NEXT / LATER (right)
            Contains: Now card (focus task, priority, live dream bar, Done/Switch),
            Next row, Later collapsed count → task board
            ────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-4">

          {/* NOW — the current focus task; the left-column ring is its Start/Pause.
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

                  {/* Live dream progress — quiet counterpart to the session confetti */}
                  {topDream && dreamProgress && (
                    <div className="pl-[18px] pt-2">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs text-slate-400 truncate">toward — {topDream.content}</span>
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

          {/* NEXT — the task after this one */}
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

          {/* LATER — the rest of the queue, collapsed; the full board is a tap away */}
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
        blurred={<span>$•••</span>}
      />

    </div>
  );
}
