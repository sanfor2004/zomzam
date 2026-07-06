'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: CALENDAR
    Contains: month header + prev/next nav, weekday row, day grid
    ──────────────────────────────────────────────────────────
    A single-month date-picker grid. Controlled via `value`/
    `onChange`; navigates its own visible month internally. */

export interface CalendarProps {
  value?: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  /** Visible month when nothing is selected yet. Defaults to today. */
  defaultMonth?: Date;
  className?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildGrid(visibleMonth: Date) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const startOffset = new Date(year, month, 1).getDay(); // 0 (Sun) – 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: { date: Date; inMonth: boolean }[] = [];

  // Leading days from the previous month — the Date constructor normalizes
  // negative day values, so no separate prev-month math is needed.
  for (let i = startOffset; i > 0; i--) {
    cells.push({ date: new Date(year, month, 1 - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  // Trailing days to complete the final week.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
  }

  return cells;
}

export function Calendar({ value, onChange, minDate, maxDate, defaultMonth, className = '' }: CalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(value ?? defaultMonth ?? new Date()));

  const today = useMemo(() => startOfDay(new Date()), []);
  const cells = useMemo(() => buildGrid(visibleMonth), [visibleMonth]);

  const goToMonth = (offset: number) => {
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const isDisabled = (date: Date) =>
    (minDate != null && date < startOfDay(minDate)) || (maxDate != null && date > startOfDay(maxDate));

  return (
    <div className={cn('w-full max-w-xs p-4 rounded-2xl border border-slate-800/60 surface-card', className)}>
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: MONTH HEADER
          Contains: month/year label, previous/next nav buttons
          ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-white">{MONTH_LABEL.format(visibleMonth)}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: WEEKDAY ROW
          Contains: Su–Sa column labels
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="h-7 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
            {day}
          </span>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DAY GRID
          Contains: 6-week date grid, today marker, selected fill
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, inMonth }) => {
          const selected = value != null && isSameDay(date, value);
          const isToday = isSameDay(date, today);
          const disabled = isDisabled(date);

          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onChange(date)}
              className={cn(
                'h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-150',
                'disabled:opacity-30 disabled:pointer-events-none',
                !inMonth && 'text-slate-600',
                inMonth && !selected && 'text-slate-300 hover:bg-slate-800/60',
                isToday && !selected && 'border border-primary-500/50 text-primary-400',
                selected && 'bg-primary-500 hover:bg-primary-600 text-white shadow-md shadow-primary-500/20',
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
