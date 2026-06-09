'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { useStreamWaiter } from '@/context/StreamWaiterContext';
import { Clock, RotateCcw, Play, Pause, SkipForward, Check, Shuffle, Plus, Lightbulb } from 'lucide-react';
import confetti from 'canvas-confetti';

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

  // Tasks & Server Sync
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessionsToday, setSessionsToday] = useState(0);

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
    <div className="max-w-6xl mx-auto space-y-8 animate-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Pomodoro Focus</h1>
            <p className="text-xs text-slate-400">Stay in the zone. One task at a time.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-2xl px-4 py-2.5 shadow-apple-sm self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Sessions Completed Today: <span className="text-primary-500 font-bold ml-1">{sessionsToday}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Timer Section (Left Column) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-8 shadow-apple flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 -mt-24 -ml-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl pointer-events-none"></div>
          
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
                className="text-slate-100 dark:text-slate-800/40"
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
              <span className="text-[10px] font-black uppercase tracking-widest text-primary-500">
                {isBreak ? 'Break Time' : 'Focus Session'}
              </span>
              <span className="text-5xl font-black tabular-nums text-slate-900 dark:text-white mt-1.5 tracking-tight">
                {formatTime(remaining)}
              </span>
            </div>
          </div>

          {/* Controls Box */}
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={resetTimer}
                title="Reset Session"
                className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-center transition-all shadow-sm active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={isRunning ? pauseTimer : startTimer}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                  isRunning 
                    ? 'bg-slate-900 hover:bg-slate-850 dark:bg-slate-850 dark:hover:bg-slate-800 shadow-slate-900/10' 
                    : 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/20'
                }`}
              >
                {isRunning ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8 ml-1.5" fill="currentColor" />}
              </button>

              <button
                onClick={skipTask}
                disabled={pendingTasks.length < 2}
                title="Skip Task"
                className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/40 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>

            {isBreak && (
              <button
                onClick={skipBreak}
                className="px-5 py-2 text-xs font-black uppercase tracking-widest bg-primary-50 dark:bg-primary-950/20 text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-full border border-primary-100 dark:border-primary-900/30 transition-colors"
              >
                Skip Break
              </button>
            )}

            {/* Adjuster Inputs */}
            <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/50 w-full text-xs">
              
              {/* Focus adjuster */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">Focus duration</span>
                <div className="flex items-center border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-900/30 overflow-hidden h-10">
                  <button
                    onClick={() => adjustFocus(-5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-100 dark:border-slate-850"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-slate-700 dark:text-slate-200">
                    {Math.floor(duration / 60)}m
                  </span>
                  <button
                    onClick={() => adjustFocus(5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-l border-slate-100 dark:border-slate-850"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Break adjuster */}
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-slate-400 font-medium">Break duration</span>
                <div className="flex items-center border border-slate-100 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-slate-900/30 overflow-hidden h-10">
                  <button
                    onClick={() => adjustBreak(-5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-r border-slate-100 dark:border-slate-850"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-slate-700 dark:text-slate-200">
                    {Math.floor(breakDuration / 60)}m
                  </span>
                  <button
                    onClick={() => adjustBreak(5)}
                    className="flex-shrink-0 w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-l border-slate-100 dark:border-slate-850"
                  >
                    +
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Task Stack Section (Right Column) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Previous Card */}
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-2xl px-6 py-4 shadow-apple-sm opacity-50">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Previously completed</span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {tasks.filter(t => t.status === 'completed')[0]?.title || 'No completed tasks recently'}
            </p>
          </div>

          {/* Current Focus Task Card */}
          <div className="flex-1 bg-gradient-to-br from-primary-500/5 via-white to-amber-500/5 dark:from-primary-500/10 dark:via-[#13161C] dark:to-amber-500/5 border border-primary-500/20 dark:border-slate-800/60 rounded-3xl p-8 shadow-apple hover:shadow-apple-lg transition-all duration-300 flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white bg-primary-500 rounded-full">
                  Focus Target
                </span>
                {topTask && (
                  <span className="text-xs font-semibold text-slate-400">
                    Planned duration: {topTask.duration_block}m
                  </span>
                )}
              </div>

              {topTask ? (
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                    {topTask.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      topTask.priority === 'urgent' ? 'bg-red-500' :
                      topTask.priority === 'medium' ? 'bg-amber-400' :
                      topTask.priority === 'maybe' ? 'bg-blue-400' : 'bg-slate-350'
                    }`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {topTask.priority} priority
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-base text-slate-500 dark:text-slate-400 italic font-medium">
                    No active tasks in your queue.
                  </p>
                  <button
                    onClick={() => router.push('/time/tasks')}
                    className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-600 transition-colors shadow-sm"
                  >
                    Add Task
                  </button>
                </div>
              )}
            </div>

            {topTask && (
              <div className="mt-8 space-y-3">
                <button
                  onClick={handleDoneTask}
                  className="w-full h-12 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-xl shadow-md shadow-primary-500/10 hover:shadow-lg hover:shadow-primary-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm tracking-wider uppercase"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  Done It
                </button>

                <button
                  onClick={swapTask}
                  disabled={pendingTasks.length < 2}
                  className="w-full h-11 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/30 text-slate-500 hover:text-primary-500 hover:border-primary-500 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shuffle className="w-4 h-4" />
                  Switch task
                </button>
              </div>
            )}
          </div>

          {/* Next Up Card */}
          <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-2xl px-6 py-4 shadow-apple-sm">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Next up in queue</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5 truncate">
              {pendingTasks[1]?.title || '—'}
            </p>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/time/tasks')}
              className="flex items-center gap-3 bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-2xl p-4 shadow-apple-sm hover:border-amber-400/40 hover:shadow-apple transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Manage Tasks</span>
                <span className="block text-[10px] text-slate-400 truncate">Go to task board</span>
              </div>
            </button>

            <button
              onClick={() => router.push('/time/ideas')}
              className="flex items-center gap-3 bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-2xl p-4 shadow-apple-sm hover:border-emerald-400/40 hover:shadow-apple transition-all group"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div className="text-left min-w-0">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Capture Idea</span>
                <span className="block text-[10px] text-slate-400 truncate">Go to idea capture</span>
              </div>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
