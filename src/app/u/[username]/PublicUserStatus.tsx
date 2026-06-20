'use client';

import React, { useEffect } from 'react';
import { StreamWaiterProvider, usePresence } from '@/context/StreamWaiterContext';
import { Badge } from '@/components/ui';

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
  const { viewedUserStatus, setViewingUserId } = usePresence();

  useEffect(() => {
    // Set the user we are viewing in the context to fetch and stream updates
    setViewingUserId(userId);
    return () => {
      setViewingUserId(null);
    };
  }, [userId, setViewingUserId]);

  // Use the real-time status from the context/SSE stream if available, otherwise fallback to the initial server-fetched status
  const status = viewedUserStatus || initialStatus;

  const getVariant = () => {
    if (status.is_online) {
      if (status.is_idle) return 'warning';
      return 'success';
    }
    return 'neutral';
  };

  return (
    <Badge variant={getVariant()} pulse={status.is_online}>
      {status.is_online
        ? status.is_idle
          ? 'AWAY'
          : 'ONLINE'
        : status.label === 'OFFLINE' || !status.label
        ? 'OFFLINE'
        : `Seen ${status.label}`}
    </Badge>
  );
}

export default function PublicUserStatus(props: PublicUserStatusProps) {
  return (
    <StreamWaiterProvider>
      <StatusIndicator {...props} />
    </StreamWaiterProvider>
  );
}
