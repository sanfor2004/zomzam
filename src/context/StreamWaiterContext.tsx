'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type UserStatus = 'online' | 'away' | 'offline' | 'disconnected';

interface ViewedUserStatus {
  is_online: boolean;
  is_idle: boolean;
  last_seen: string | null;
  label: string;
  diff: number;
}

interface StreamWaiterContextType {
  currentUserStatus: UserStatus;
  viewedUserStatus: ViewedUserStatus | null;
  setViewingUserId: (id: number | null) => void;
  triggerStatusSync: () => Promise<void>;
  notificationsCount: number;
  setNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
  notifications: any[];
  loadNotifications: () => Promise<void>;
  markRead: () => Promise<void>;
}

const StreamWaiterContext = createContext<StreamWaiterContextType | undefined>(undefined);

export function StreamWaiterProvider({ children }: { children: React.ReactNode }) {
  const [currentUserStatus, setCurrentUserStatus] = useState<UserStatus>('disconnected');
  const [viewedUserStatus, setViewedUserStatus] = useState<ViewedUserStatus | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [isIdle, setIsIdleState] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idle: isIdle ? 1 : 0 }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNotificationsCount(data.data.notifications?.count || 0);
        setNotifications(data.data.notifications?.items || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const markRead = async () => {
    try {
      await fetch('/api/notifications?action=mark_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      // Optimistically clear unread badge and mark all items as read in local state
      setNotificationsCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  };

  const triggerStatusSync = async () => {
    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idle: isIdle ? 1 : 0,
          viewing_user_id: viewingUserId,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (viewingUserId && json.data.user_status) {
          setViewedUserStatus(json.data.user_status);
        }
        if (json.data.notifications) {
          setNotificationsCount(json.data.notifications.count || 0);
          setNotifications(json.data.notifications.items || []);
        }
      }
    } catch (e) {
      console.error('Status Sync Failed:', e);
    }
  };

  // Setup idle/active tracking
  useEffect(() => {
    let idleTimer: NodeJS.Timeout;
    const idleTimeout = 60000; // 1 minute

    const setAwayStatus = () => {
      setIsIdleState(true);
      setCurrentUserStatus('away');
    };

    const resetIdleTimer = () => {
      setIsIdleState(false);
      setCurrentUserStatus('online');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(setAwayStatus, idleTimeout);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer));

    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
    };
  }, []);

  // Update status whenever idle status or viewed user changes
  useEffect(() => {
    triggerStatusSync();
  }, [isIdle, viewingUserId]);

  // Establish SSE EventSource stream connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    let active = true;

    const connect = () => {
      if (!active) return;
      const url = `/api/stream?viewing_user_id=${viewingUserId || ''}`;
      eventSource = new EventSource(url);

      eventSource.addEventListener('order', (event) => {
        try {
          const order = JSON.parse(event.data);
          const { order_name, params } = order;

          if (order_name === 'connection_established') {
            reconnectAttempts = 0;
          } else if (order_name === 'update_viewed_user_status') {
            setViewedUserStatus(params);
          } else if (order_name === 'new_notification') {
            // Trigger local toast notification and reload
            const customEvent = new CustomEvent('new-notification', { detail: params });
            window.dispatchEvent(customEvent);
            setNotificationsCount((c) => c + 1);
            setNotifications((n) => [params, ...n]);
          } else if (order_name === 'social_update') {
            const customEvent = new CustomEvent('zz-social-update', { detail: params });
            window.dispatchEvent(customEvent);
          }
        } catch {}
      });

      eventSource.onerror = () => {
        if (!active) return;
        eventSource?.close();
        
        // Reconnection logic
        if (reconnectAttempts < 15) {
          reconnectAttempts++;
          const delay = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttempts));
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      active = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [viewingUserId]);

  // Periodic heartbeat backup status pings every 25 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      triggerStatusSync();
    }, 25000);

    return () => clearInterval(timer);
  }, [isIdle, viewingUserId]);

  return (
    <StreamWaiterContext.Provider
      value={{
        currentUserStatus,
        viewedUserStatus,
        setViewingUserId,
        triggerStatusSync,
        notificationsCount,
        setNotificationsCount,
        notifications,
        loadNotifications,
        markRead,
      }}
    >
      {children}
    </StreamWaiterContext.Provider>
  );
}

export function useStreamWaiter() {
  const context = useContext(StreamWaiterContext);
  if (!context) {
    throw new Error('useStreamWaiter must be used within a StreamWaiterProvider');
  }
  return context;
}
