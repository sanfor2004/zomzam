'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

type UserStatus = 'online' | 'away' | 'offline' | 'disconnected';

interface ViewedUserStatus {
  is_online: boolean;
  is_idle: boolean;
  last_seen: string | null;
  label: string;
  diff: number;
}

// ──────────────────────────────────────────────────────────
// Split into two contexts by update cadence so a consumer only re-renders for
// the slice it actually reads:
//   • Presence      — high-frequency idle/online + viewed-user status
//   • Notifications — SSE-driven notification feed + unread count
// A single provider owns all state and the stream/heartbeat effects; it just
// exposes two independently-memoized value objects. This keeps an incoming
// notification from re-rendering presence-only consumers (and vice versa).
// ──────────────────────────────────────────────────────────

interface PresenceContextType {
  currentUserStatus: UserStatus;
  viewedUserStatus: ViewedUserStatus | null;
  setViewingUserId: (id: number | null) => void;
  triggerStatusSync: () => Promise<void>;
}

interface NotificationsContextType {
  notificationsCount: number;
  setNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
  notifications: any[];
  loadNotifications: () => Promise<void>;
  markRead: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);
const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function StreamWaiterProvider({ children }: { children: React.ReactNode }) {
  const [currentUserStatus, setCurrentUserStatus] = useState<UserStatus>('disconnected');
  const [viewedUserStatus, setViewedUserStatus] = useState<ViewedUserStatus | null>(null);
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [isIdle, setIsIdleState] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Mirror the latest mutable values into refs so the exposed callbacks can stay
  // referentially stable (empty deps) while always reading current state — this
  // is what lets the memoized context values keep stable identity.
  const isIdleRef = useRef(isIdle);
  const viewingUserIdRef = useRef(viewingUserId);
  useEffect(() => { isIdleRef.current = isIdle; }, [isIdle]);
  useEffect(() => { viewingUserIdRef.current = viewingUserId; }, [viewingUserId]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idle: isIdleRef.current ? 1 : 0 }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNotificationsCount(data.data.notifications?.count || 0);
        setNotifications(data.data.notifications?.items || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  const markRead = useCallback(async () => {
    try {
      await fetch('/api/notifications?action=mark_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      // Optimistically clear unread badge and mark all items as read in local state
      setNotificationsCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {}
  }, []);

  const triggerStatusSync = useCallback(async () => {
    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idle: isIdleRef.current ? 1 : 0,
          viewing_user_id: viewingUserIdRef.current,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (viewingUserIdRef.current && json.data.user_status) {
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
  }, []);

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
  }, [isIdle, viewingUserId, triggerStatusSync]);

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
          } else if (order_name === 'new_message') {
            const customEvent = new CustomEvent('zz-new-message', { detail: params });
            window.dispatchEvent(customEvent);
          } else if (order_name === 'typing') {
            // Transient "peer is typing" ping — handled by MessagesContext, which
            // shows the three-dot bubble and auto-expires it.
            window.dispatchEvent(new CustomEvent('zz-typing', { detail: params }));
          } else if (order_name === 'new_post') {
            // Someone in the viewer's network posted — let the feed surface a
            // soft "check for new posts" pill instead of yanking the scroll.
            window.dispatchEvent(new CustomEvent('zz-new-post', { detail: params }));
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

  // Periodic heartbeat backup status pings every 25 seconds. triggerStatusSync
  // is stable, so the interval is created once rather than torn down/recreated
  // on every idle/viewing-user change.
  useEffect(() => {
    const timer = setInterval(() => {
      triggerStatusSync();
    }, 25000);

    return () => clearInterval(timer);
  }, [triggerStatusSync]);

  const presenceValue = useMemo<PresenceContextType>(
    () => ({ currentUserStatus, viewedUserStatus, setViewingUserId, triggerStatusSync }),
    [currentUserStatus, viewedUserStatus, triggerStatusSync],
  );

  const notificationsValue = useMemo<NotificationsContextType>(
    () => ({ notificationsCount, setNotificationsCount, notifications, loadNotifications, markRead }),
    [notificationsCount, notifications, loadNotifications, markRead],
  );

  return (
    <PresenceContext.Provider value={presenceValue}>
      <NotificationsContext.Provider value={notificationsValue}>
        {children}
      </NotificationsContext.Provider>
    </PresenceContext.Provider>
  );
}

/** Subscribe to high-frequency presence state (current + viewed user status). */
export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a StreamWaiterProvider');
  }
  return context;
}

/** Subscribe to the SSE-driven notification feed and unread count. */
export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a StreamWaiterProvider');
  }
  return context;
}

/**
 * @deprecated Combined accessor — subscribes to BOTH presence and notification
 * contexts, so it re-renders on either change. Prefer the granular `usePresence`
 * / `useNotifications` hooks so components only re-render for the slice they read.
 */
export function useStreamWaiter() {
  return { ...usePresence(), ...useNotifications() };
}
