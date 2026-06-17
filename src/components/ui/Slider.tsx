'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: React.ReactNode;
  /** Custom formatter for the value badge (e.g. `(v) => \`${v}%\``). */
  formatValue?: (value: number) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  formatValue,
  disabled = false,
  className = '',
}: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('w-full', className)}>
      {(label || formatValue) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>}
          <span className="text-xs font-black text-primary-500">{formatValue ? formatValue(value) : value}</span>
        </div>
      )}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          background: `linear-gradient(to right, var(--color-primary-500) ${percent}%, var(--color-slate-850) ${percent}%)`,
        }}
        className={cn(
          'w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
          '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2',
          '[&::-webkit-slider-thumb]:border-primary-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/30',
          '[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-90',
          '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-500',
        )}
      />
    </div>
  );
}
