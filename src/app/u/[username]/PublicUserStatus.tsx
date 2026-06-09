'use client';

import React, { useEffect } from 'react';
import { StreamWaiterProvider, useStreamWaiter } from '@/context/StreamWaiterContext';

interface PublicUserStatusProps {
  userId: number;
  initialStatus: {
    is_online: boolean;
    is_idle?: boolean;
    last_seen?: string | null;
    label: string;
    diff?: number;
  };
}

function StatusIndicator({ userId, initialStatus }: PublicUserStatusProps) {
  const { viewedUserStatus, setViewingUserId } = useStreamWaiter();

  useEffect(() => {
    // Set the user we are viewing in the context to fetch and stream updates
    setViewingUserId(userId);
    return () => {
      setViewingUserId(null);
    };
  }, [userId, setViewingUserId]);

  // Use the real-time status from the context/SSE stream if available, otherwise fallback to the initial server-fetched status
  const status = viewedUserStatus || initialStatus;

  const getStatusClasses = () => {
    if (status.is_online) {
      if (status.is_idle) {
        return 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400';
      }
      return 'bg-green-500/10 border-green-500/20 text-green-500 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-400';
    }
    return 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500';
  };

  const getDotClasses = () => {
    if (status.is_online) {
      if (status.is_idle) {
        return 'bg-amber-400 dark:bg-amber-400 animate-pulse';
      }
      return 'bg-green-500 dark:bg-green-400 animate-pulse';
    }
    return 'bg-slate-400 dark:bg-slate-600';
  };

  return (
    <span
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${getStatusClasses()}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${getDotClasses()}`}
      />
      {status.is_online
        ? status.is_idle
          ? 'AWAY'
          : 'ONLINE'
        : status.label === 'OFFLINE' || !status.label
        ? 'OFFLINE'
        : `Seen ${status.label}`}
    </span>
  );
}

export default function PublicUserStatus(props: PublicUserStatusProps) {
  return (
    <StreamWaiterProvider>
      <StatusIndicator {...props} />
    </StreamWaiterProvider>
  );
}
