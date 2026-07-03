'use client';

import React, { useEffect, useState } from 'react';
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

interface ViewedUserStatus {
  is_online: boolean;
  is_idle: boolean;
  last_seen: string | null;
  label: string;
  diff: number;
}

function usePublicPresence(viewedUserId: number, initialStatus: any) {
  const [status, setStatus] = useState<ViewedUserStatus>(initialStatus);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    let active = true;

    const connect = () => {
      if (!active) return;
      const url = `/api/stream?viewing_user_id=${viewedUserId}`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.addEventListener('sync', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (data && data.viewed_user_status) {
            setStatus(data.viewed_user_status);
          }
        } catch {}
      });

      eventSource.onerror = () => {
        if (!active) return;
        eventSource?.close();

        if (reconnectAttempts < 15) {
          reconnectAttempts++;
          const delay = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttempts));
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [viewedUserId]);

  return status;
}

export default function PublicUserStatus({ userId, initialStatus }: PublicUserStatusProps) {
  const status = usePublicPresence(userId, initialStatus);

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
