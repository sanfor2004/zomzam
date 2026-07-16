'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, rows = 4, className = '', containerClassName = '', id, ...props },
  ref,
) {
  const reactId = useId();
  const textareaId = id ?? reactId;

  return (
    <div className={cn('w-full', containerClassName)}>
      {label && (
        <label htmlFor={textareaId} className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
          {label}
        </label>
      )}

      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={!!error || undefined}
        className={cn(
          'w-full p-3.5 bg-slate-900/30 border text-sm text-white outline-none transition-colors placeholder-slate-500 resize-none rounded-xl',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-red-500/60 focus:border-red-500' : 'border-slate-850 focus:border-primary-500',
          className,
        )}
        {...props}
      />

      {error ? (
        <p className="mt-1.5 text-[11px] font-semibold text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
