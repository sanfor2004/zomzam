'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'away' | 'offline';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** Used to derive initials when no image (or a broken image) is given. */
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  shape?: 'circle' | 'rounded';
  className?: string;
}

const SIZES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const STATUS_DOT: Record<AvatarStatus, string> = {
  online: 'bg-green-500',
  away: 'bg-amber-400',
  offline: 'bg-slate-500',
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Avatar({ src, alt = '', name, size = 'md', status, shape = 'circle', className = '' }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;

  return (
    <span className={cn('relative inline-flex shrink-0', SIZES[size], className)}>
      <span
        className={cn(
          'relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-800 border border-slate-800/60 font-black text-slate-300 select-none',
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        )}
      >
        {showImage ? (
          <Image
            src={src!}
            alt={alt}
            fill
            sizes="80px"
            onError={() => setErrored(true)}
            className="object-cover"
          />
        ) : name ? (
          <span>{getInitials(name)}</span>
        ) : (
          <User className="w-1/2 h-1/2 text-slate-500" />
        )}
      </span>

      {status && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-[#111318]',
            size === 'xs' || size === 'sm' ? 'w-2 h-2' : 'w-3 h-3',
            STATUS_DOT[status],
            status === 'online' && 'dot-pulse',
          )}
        />
      )}
    </span>
  );
}
