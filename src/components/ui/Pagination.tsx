'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
}

function getPageRange(page: number, totalPages: number, siblingCount: number): (number | 'ellipsis')[] {
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) return Array.from({ length: totalPages }, (_, i) => i + 1);

  const left = Math.max(page - siblingCount, 2);
  const right = Math.min(page + siblingCount, totalPages - 1);
  const range: (number | 'ellipsis')[] = [1];
  if (left > 2) range.push('ellipsis');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages - 1) range.push('ellipsis');
  range.push(totalPages);
  return range;
}

export function Pagination({ page, totalPages, onChange, siblingCount = 1, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageRange(page, totalPages, siblingCount);
  const baseBtn = 'w-9 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1.5', className)}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
        className={cn(baseBtn, 'text-slate-400 hover:text-white hover:bg-slate-800/50')}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-slate-600">
            <MoreHorizontal className="w-4 h-4" />
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page || undefined}
            onClick={() => onChange(p)}
            className={cn(
              baseBtn,
              p === page ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50',
            )}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
        className={cn(baseBtn, 'text-slate-400 hover:text-white hover:bg-slate-800/50')}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
