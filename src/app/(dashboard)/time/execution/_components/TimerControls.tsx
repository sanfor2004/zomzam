import React from 'react';
import { RotateCcw, Play, Pause, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: TIMER CONTROLS (presentational)
    Contains: reset, start/pause (primary), skip-task buttons
    ──────────────────────────────────────────────────────────

    The primary button colour flips green→orange to signal running.
    Skip disables when there's nothing to skip to. All behaviour lives
    in the parent's handlers. */

interface TimerControlsProps {
  isRunning: boolean;
  canSkip: boolean;
  onReset: () => void;
  /** Toggles start ↔ pause depending on isRunning. */
  onToggle: () => void;
  onSkip: () => void;
}

export function TimerControls({ isRunning, canSkip, onReset, onToggle, onSkip }: TimerControlsProps) {
  return (
    <div className="flex items-center gap-4">
      <Button variant="unstyled"
        onClick={onReset}
        title="Reset"
        className="w-12 h-12 rounded-full border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-800/50 flex items-center justify-center transition-all shadow-sm active:scale-95"
      >
        <RotateCcw className="w-5 h-5" />
      </Button>

      <Button variant="unstyled"
        onClick={onToggle}
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
        onClick={onSkip}
        disabled={!canSkip}
        title="Skip to next task"
        className="w-12 h-12 rounded-full border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-800/50 flex items-center justify-center transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <SkipForward className="w-5 h-5" />
      </Button>
    </div>
  );
}
