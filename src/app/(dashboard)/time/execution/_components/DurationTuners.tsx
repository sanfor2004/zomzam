import React from 'react';
import { NumberInput } from '@/components/ui';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: DURATION TUNERS (presentational)
    Contains: focus + break minute fields (free-typed or stepped)
    ──────────────────────────────────────────────────────────

    Focus writes through to the top task's board block (parent handler);
    break persists locally. Disabled while running — you don't retune a
    live segment. onChange emits the raw string (NumberInput contract). */

interface DurationTunersProps {
  focusMins: number;
  breakMins: number;
  disabled: boolean;
  onFocusChange: (raw: string) => void;
  onBreakChange: (raw: string) => void;
}

export function DurationTuners({ focusMins, breakMins, disabled, onFocusChange, onBreakChange }: DurationTunersProps) {
  return (
    <div className="flex items-start gap-4 pt-4 border-t border-slate-800/50 w-full text-xs">
      <div className="flex-1 flex flex-col gap-1.5">
        <span className="text-slate-400 font-medium">Focus duration (min)</span>
        <NumberInput
          value={focusMins}
          onChange={onFocusChange}
          min={5}
          max={120}
          disabled={disabled}
          ariaLabel="Focus duration in minutes"
        />
      </div>

      <div className="flex-1 flex flex-col gap-1.5">
        <span className="text-slate-400 font-medium">Break duration (min)</span>
        <NumberInput
          value={breakMins}
          onChange={onBreakChange}
          min={1}
          max={60}
          accent="emerald"
          disabled={disabled}
          ariaLabel="Break duration in minutes"
        />
      </div>
    </div>
  );
}
