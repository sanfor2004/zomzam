import React from 'react';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: TIMER RING (presentational)
    Contains: SVG countdown ring + centred MM:SS label + segment tag
    ──────────────────────────────────────────────────────────

    Pure display — `remaining` / `total` seconds drive the arc, `isBreak`
    swaps the label. No state, no timer logic (that's usePomodoroTimer). */

interface TimerRingProps {
  /** Seconds left in the current segment. */
  remaining: number;
  /** Full length of the current segment, in seconds. */
  total: number;
  isBreak: boolean;
}

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const formatTime = (secs: number) => {
  const mins = Math.floor(secs / 60);
  const remain = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remain.toString().padStart(2, '0')}`;
};

export function TimerRing({ remaining, total, isBreak }: TimerRingProps) {
  const dashoffset = total > 0
    ? CIRCUMFERENCE - (remaining / total) * CIRCUMFERENCE
    : CIRCUMFERENCE;

  return (
    <div className="relative w-64 h-64 mb-8">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-800/40"
        />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashoffset}
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
  );
}
