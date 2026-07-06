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

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// One clock digit as a vertical 0–9 strip that slides to its value — a real
// odometer roll. The strip only translates, so a paused timer sits still and
// reduced-motion users get an instant snap (see .odometer-strip in globals.css).
function OdometerDigit({ value }: { value: number }) {
  return (
    <span className="odometer-digit">
      <span className="odometer-strip" style={{ transform: `translateY(-${value * 10}%)` }}>
        {DIGITS.map((n) => (
          <span key={n} className="odometer-cell">{n}</span>
        ))}
      </span>
    </span>
  );
}

export function TimerRing({ remaining, total, isBreak }: TimerRingProps) {
  const dashoffset = total > 0
    ? CIRCUMFERENCE - (remaining / total) * CIRCUMFERENCE
    : CIRCUMFERENCE;

  return (
    <div className="relative w-full max-w-64 aspect-square mb-8">
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
        {/* Odometer clock — each digit rolls to its value; the colon is static. */}
        <div className="odometer text-5xl font-black tabular-nums text-white mt-1.5 tracking-tight leading-none">
          {formatTime(remaining).split('').map((ch, i) =>
            ch === ':'
              ? <span key={`sep-${i}`} className="px-0.5">:</span>
              : <OdometerDigit key={`d-${i}`} value={Number(ch)} />
          )}
        </div>
      </div>
    </div>
  );
}
