'use client';

import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: usePomodoroTimer (focus engine)
    Owns: countdown state, drift-corrected tick loop, localStorage
    persistence, focus/break segment transitions, session count.
    ──────────────────────────────────────────────────────────

    Pure timer engine — deliberately knows nothing about the task
    board or the server. The execution page composes it with task
    orchestration (start → mark in_progress, done/skip/swap → pause +
    setupFocusTime). Segment-end feedback (ring sound + confetti) is
    intrinsic to the timer, so it lives here; task-completion confetti
    stays on the page. See time/execution/page.tsx.

    Drift correction: the tick reads elapsed wall-clock from a start
    ref rather than decrementing a counter, so a throttled background
    tab or a navigation-away/return can't desync the countdown. Mirror
    refs let the setInterval callback read current values without
    stale-closure bugs after remount. */

const STORAGE_KEY = 'zomzam_pomodoro';

export interface PomodoroTimer {
  duration: number;
  breakDuration: number;
  remaining: number;
  isRunning: boolean;
  isBreak: boolean;
  sessionsToday: number;
  currentTaskStartTime: number | null;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skipBreak: () => void;
  /** Retune the focus segment (minutes) and reset the ring. No-op while running. */
  setupFocusTime: (mins: number) => void;
  /** Retune the break segment (minutes) and persist. */
  setBreakMinutes: (mins: number) => void;
  /** Clear the active focus-segment start marker (used on task skip/swap/done). */
  resetSegmentStart: () => void;
  /** True once localStorage restore is complete — gate auto-load effects on this. */
  restored: boolean;
}

export function usePomodoroTimer(): PomodoroTimer {
  const [duration, setDuration] = useState(15 * 60); // default 15 min focus
  const [breakDuration, setBreakDuration] = useState(5 * 60); // default 5 min break
  const [remaining, setRemaining] = useState(15 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [currentTaskStartTime, setCurrentTaskStartTime] = useState<number | null>(null);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [restored, setRestored] = useState(false);

  // Refs for background-drift correction
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const remainingAtStartRef = useRef<number>(15 * 60);

  // ── Mirror refs ── kept in sync so that setInterval callbacks always
  // read the *current* value without stale-closure issues after navigation.
  const isBreakRef       = useRef(false);
  const sessionsRef      = useRef(0);
  const taskStartRef     = useRef<number | null>(null);
  const durationRef      = useRef(15 * 60);
  const breakDurationRef = useRef(5 * 60);

  useEffect(() => { isBreakRef.current = isBreak; },               [isBreak]);
  useEffect(() => { sessionsRef.current = sessionsToday; },        [sessionsToday]);
  useEffect(() => { taskStartRef.current = currentTaskStartTime; }, [currentTaskStartTime]);
  useEffect(() => { durationRef.current = duration; },             [duration]);
  useEffect(() => { breakDurationRef.current = breakDuration; },   [breakDuration]);

  // Persist to localStorage — reads from refs so it is safe to call from
  // inside a setInterval callback (no stale-closure issue).
  const saveState = (updatedRemaining: number, updatedIsRunning: boolean, updatedIsBreak: boolean, updatedSessions: number, updatedStartTime: number | null) => {
    const data = {
      remaining: updatedRemaining,
      isRunning: updatedIsRunning,
      isBreak: updatedIsBreak,
      duration: durationRef.current,
      breakDuration: breakDurationRef.current,
      lastUpdate: Date.now(),
      sessions: updatedSessions,
      currentTaskStartTime: updatedStartTime,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  // Retune the focus segment. Guarded: you don't reconfigure a live countdown.
  const setupFocusTime = (totalMins: number) => {
    if (isRunning) return;
    const secs = totalMins * 60;
    setDuration(secs);
    setRemaining(secs);
    setIsBreak(false);
    saveState(secs, false, false, sessionsToday, null);
  };

  const setBreakMinutes = (mins: number) => {
    if (isRunning) return;
    const secs = mins * 60;
    setBreakDuration(secs);
    if (isBreak) setRemaining(secs); // reflect immediately if a break is showing
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        data.breakDuration = secs;
        if (isBreak) data.remaining = secs;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }
  };

  const resetSegmentStart = () => setCurrentTaskStartTime(null);

  // Audio feedback ring
  const playRingSound = () => {
    try {
      const audio = new Audio('/Assets/Audio/timer-ring.mp3');
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play ring sound:', e);
    }
  };

  // Tick — reads all volatile values from refs, NOT from the closure, so it
  // stays correct even when captured by an old setInterval call.
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
      // Completed work segment → roll into a break, count the session.
      const newSessions = sessionsRef.current + 1;
      sessionsRef.current = newSessions; // update ref immediately
      setSessionsToday(newSessions);
      isBreakRef.current = true;         // update ref immediately
      setIsBreak(true);
      setRemaining(breakDurationRef.current);
      setCurrentTaskStartTime(null);

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#EE5712', '#ff9874', '#ffffff'],
      });

      saveState(breakDurationRef.current, false, true, newSessions, null);
    } else {
      // Completed break segment → back to focus.
      isBreakRef.current = false;        // update ref immediately
      setIsBreak(false);
      setRemaining(durationRef.current);
      saveState(durationRef.current, false, false, sessionsRef.current, null);
    }
  };

  // Restore timer state from localStorage on mount. Handles the
  // navigate-away-and-return case where the interval was torn down: if it
  // says the timer was running, resume the interval right here (setIsRunning
  // alone wouldn't restart it — the [isRunning] effect fires too late).
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const savedDuration      = data.duration      || 15 * 60;
        const savedBreakDuration = data.breakDuration || 5 * 60;
        const savedIsBreak       = !!data.isBreak;
        const savedSessions      = data.sessions      || 0;
        const savedStartTime     = data.currentTaskStartTime || null;

        // Sync mirror refs immediately (before React commits the state updates
        // below) so any interval we start right here reads the correct values.
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
            remainingAtStartRef.current = rem;
            startTimeRef.current       = Date.now();
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
    // Even if there was nothing saved, mark restore as complete so that the
    // page's auto-load effects know it's safe to run setupFocusTime.
    setRestored(true);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety-net: (re)sync the interval to the running flag. Covers the
  // navigation remount case where the interval was cleared on unmount.
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

  const start = () => {
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
  };

  const pause = () => {
    if (!isRunning) return;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRunning(false);
    startTimeRef.current = null;
    saveState(remaining, false, isBreak, sessionsToday, currentTaskStartTime);
  };

  const reset = () => {
    pause();
    const defaultVal = isBreak ? breakDuration : duration;
    setRemaining(defaultVal);
    saveState(defaultVal, false, isBreak, sessionsToday, currentTaskStartTime);
  };

  const skipBreak = () => {
    if (!isBreak) return;
    setIsBreak(false);
    setRemaining(duration);
    setIsRunning(false);
    setCurrentTaskStartTime(null);
    saveState(duration, false, false, sessionsToday, null);
  };

  return {
    duration,
    breakDuration,
    remaining,
    isRunning,
    isBreak,
    sessionsToday,
    currentTaskStartTime,
    start,
    pause,
    reset,
    skipBreak,
    setupFocusTime,
    setBreakMinutes,
    resetSegmentStart,
    restored,
  };
}
