'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';

type UserStatus = 'online' | 'away' | 'offline' | 'disconnected';
type LiveMode = 'active' | 'afk';

// ──────────────────────────────────────────────────────────
// Unified live-sync client — exactly TWO channels, used mutually exclusively:
//   • ACTIVE  → one SSE connection to /api/stream ("sync" events). No client
//               heartbeat runs; the open stream itself keeps presence fresh
//               server-side.
//   • AFK     → SSE closed; POST /api/heartbeat every 5s returns the identical
//               grouped payload, so delivery continues while away.
// Idle detection (60s without input, or tab hidden) flips ACTIVE → AFK; any
// activity flips back instantly with one `init` catch-up beat.
//
// The server derives presence from the channel in use (stream ⇒ active,
// heartbeat ⇒ idle) — no idle flag is ever sent from here.
//
// Split into two contexts by update cadence so a consumer only re-renders for
// the slice it actually reads:
//   • Presence      — the viewer's own high-frequency idle/online status
//   • Notifications — live notification feed + unread count
// ──────────────────────────────────────────────────────────

interface PresenceContextType {
  currentUserStatus: UserStatus;
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

/** No input for this long (or a hidden tab) ⇒ AFK mode. */
const IDLE_TIMEOUT_MS = 60000;
/** Heartbeat cadence while AFK. */
const AFK_BEAT_MS = 5000;

export function StreamWaiterProvider({ children }: { children: React.ReactNode }) {
  const [currentUserStatus, setCurrentUserStatus] = useState<UserStatus>('disconnected');
  const [mode, setMode] = useState<LiveMode>('active');
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  // ── Unified payload applier ─────────────────────────────────
  // BOTH channels (SSE `sync` event and heartbeat response `data`) resolve to
  // this one function, so switching modes changes transport only, never behavior.
  const applySync = useCallback((data: any) => {
    if (!data || typeof data !== 'object') return;

    // Messages section → the same CustomEvents MessagesContext already consumes.
    if (Array.isArray(data.messages)) {
      for (const m of data.messages) {
        if (!m || typeof m.kind !== 'string') continue;
        if (m.kind === 'new_message') {
          window.dispatchEvent(new CustomEvent('zz-new-message', { detail: m.params }));
        } else if (m.kind === 'typing') {
          window.dispatchEvent(new CustomEvent('zz-typing', { detail: m.params }));
        } else if (m.kind === 'message_read') {
          window.dispatchEvent(new CustomEvent('zz-message-read', { detail: m.params }));
        } else if (m.kind === 'message_deleted') {
          window.dispatchEvent(new CustomEvent('zz-message-deleted', { detail: m.params }));
        }
      }
    }

    // Notifications section — replace same-id rows in place (the server reuses a
    // notification's id when it coalesces actors into an existing roster), and
    // only bump the unread badge when the row wasn't already counted as unread.
    if (Array.isArray(data.notifications) && data.notifications.length > 0) {
      setNotifications((list) => {
        let newList = [...list];
        let newUnreadCountBump = 0;
        for (const params of data.notifications) {
          if (!params || params.id == null) continue;
          window.dispatchEvent(new CustomEvent('new-notification', { detail: params }));
          const prior = newList.find((x) => x.id === params.id);
          const alreadyUnread = prior && !prior.is_read;
          if (!alreadyUnread) {
            newUnreadCountBump++;
          }
          newList = [
            { ...params, is_read: 0 },
            ...newList.filter((x) => x.id !== params.id),
          ];
        }
        if (newUnreadCountBump > 0) {
          setNotificationsCount((c) => c + newUnreadCountBump);
        }
        return newList;
      });
    }

    // New posts from people the viewer is connected to → soft feed refresh pill.
    if (Array.isArray(data.posts)) {
      for (const params of data.posts) {
        window.dispatchEvent(new CustomEvent('zz-new-post', { detail: params }));
      }
    }

    // Connect requests / accepts.
    if (Array.isArray(data.social)) {
      for (const params of data.social) {
        window.dispatchEvent(new CustomEvent('zz-social-update', { detail: params }));
      }
    }

    // Throttled friends-presence snapshot → chat dock dots (MessagesContext).
    if (Array.isArray(data.contacts_presence)) {
      window.dispatchEvent(new CustomEvent('zz-contacts-presence', { detail: data.contacts_presence }));
    }

    // Full notification list, returned only for `init` catch-up beats.
    if (data.notifications_bootstrap) {
      setNotificationsCount(data.notifications_bootstrap.count || 0);
      setNotifications(data.notifications_bootstrap.items || []);
    }
  }, []);

  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Unmount cleanup: abort any in-flight heartbeat fetch
  useEffect(() => {
    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, []);

  // One-shot heartbeat: used for the mount bootstrap, manual re-syncs, and the
  // AFK→active catch-up. `init` additionally returns the full notification list.
  const syncNow = useCallback(async (init: boolean) => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const res = await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init }),
        signal: controller.signal,
      });
      const json = await res.json();
      
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
        if (json.success && json.data) applySync(json.data);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
      }
      console.error('Live sync failed:', err);
    }
  }, [applySync]);

  const loadNotifications = useCallback(() => syncNow(true), [syncNow]);
  const triggerStatusSync = useCallback(() => syncNow(false), [syncNow]);

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

  // ── Idle / AFK detection ────────────────────────────────────
  // 60s without input, or a hidden tab, flips to AFK; any activity (or the tab
  // becoming visible again) flips straight back to ACTIVE.
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;

    const goAfk = () => {
      setMode('afk');
      setCurrentUserStatus('away');
    };

    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(goAfk, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      setMode('active');
      armIdleTimer();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(idleTimer);
        goAfk();
      } else {
        onActivity();
      }
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);

    armIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ── Mount bootstrap ─────────────────────────────────────────
  // One `init` beat fetches the notification list (and drains anything queued
  // while the client was gone); the SSE stream takes over from there.
  useEffect(() => {
    syncNow(true);
  }, [syncNow]);

  // ── Channel 1: SSE (ACTIVE mode only) ───────────────────────
  useEffect(() => {
    if (mode !== 'active') return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    let active = true;

    const connect = () => {
      if (!active) return;
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        reconnectAttempts = 0;
        setCurrentUserStatus('online');
      };

      eventSource.addEventListener('sync', (event) => {
        try {
          applySync(JSON.parse((event as MessageEvent).data));
        } catch {}
      });

      eventSource.onerror = () => {
        if (!active) return;
        eventSource?.close();
        setCurrentUserStatus('disconnected');

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
  }, [mode, applySync]);

  // ── Channel 2: heartbeat poll (AFK mode only) ───────────────
  // Same payload as the stream, every 5s. On leaving AFK this interval is torn
  // down and the ACTIVE effect above runs an `init` catch-up + reopens SSE.
  useEffect(() => {
    if (mode !== 'afk') return;

    const timer = setInterval(() => syncNow(false), AFK_BEAT_MS);

    return () => {
      clearInterval(timer);
      // Catch-up on resume: anything queued between the last beat and the SSE
      // reopening is drained here, so the switchover is lossless.
      syncNow(true);
    };
  }, [mode, syncNow]);

  const presenceValue = useMemo<PresenceContextType>(
    () => ({ currentUserStatus, triggerStatusSync }),
    [currentUserStatus, triggerStatusSync],
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

/** Subscribe to the viewer's own high-frequency presence state. */
export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within a StreamWaiterProvider');
  }
  return context;
}

/** Subscribe to the live notification feed and unread count. */
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
