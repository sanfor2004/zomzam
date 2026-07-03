'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui';

/** Presence snapshot as produced by `getOnlineStatus()` (src/lib/models/user.ts). */
interface PresenceStatus {
  is_online: boolean;
  is_idle?: boolean;
  last_seen?: string | null;
  label: string;
  diff?: number;
}

interface PublicUserStatusProps {
  userId: number;
  initialStatus: PresenceStatus;
}

const MAX_RECONNECT_ATTEMPTS = 15;
const LABEL_TICK_MS = 30_000;

/**
 * Anchors the viewed user's last activity to the client clock. The server
 * `diff` (seconds ago) is preferred over parsing `last_seen` because it is
 * immune to clock skew between server and viewer.
 */
function anchorOf(status: PresenceStatus): number | null {
  if (typeof status.diff === 'number') return Date.now() - status.diff * 1000;
  const parsed = status.last_seen ? Date.parse(status.last_seen) : NaN;
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Formats seconds-since-last-seen into the same vocabulary the server uses
 * (see getOnlineStatus), so the label stays consistent across SSR and ticks.
 */
function formatElapsed(seconds: number): string {
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Anonymous presence watcher for public profiles.
 *
 * Deliberately lighter than StreamWaiterProvider: it only consumes
 * `viewed_user_status` frames and never runs idle detection or heartbeats,
 * so the viewer's own presence is never mutated. On top of the raw stream it:
 * - anchors `last_seen` to the client clock (via the server `diff`) so the
 *   offline label can keep ticking even though the stream dedupes frames;
 * - closes the stream while the tab is hidden and reconnects on return
 *   (a hidden anonymous tab must not hold a server connection);
 * - resets the reconnect backoff on tab focus and network `online`, so a
 *   dropped connection is never permanently dead.
 */
function usePublicPresence(viewedUserId: number, initialStatus: PresenceStatus) {
  const [status, setStatus] = useState<PresenceStatus>(initialStatus);
  // Client-clock timestamp (ms) of the viewed user's last activity. Only read
  // by render after the first tick (`now !== null`), so the server/client
  // initializer difference can never cause a hydration mismatch.
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(() => anchorOf(initialStatus));

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectAttempts = 0;
    let active = true;

    const disconnect = () => {
      clearTimeout(reconnectTimer);
      eventSource?.close();
      eventSource = null;
    };

    const connect = () => {
      if (!active || eventSource || document.hidden) return;
      eventSource = new EventSource(`/api/stream?viewing_user_id=${viewedUserId}`);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
      };

      eventSource.addEventListener('sync', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (data?.viewed_user_status) {
            setStatus(data.viewed_user_status);
            setLastSeenAt(anchorOf(data.viewed_user_status));
          }
        } catch {}
      });

      eventSource.onerror = () => {
        if (!active) return;
        disconnect();
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        reconnectAttempts++;
        const delay = Math.min(30000, 2000 * Math.pow(1.5, reconnectAttempts));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    // A fresh connection always receives an immediate status frame (the
    // stream's per-connection dedupe starts empty), so reconnecting on
    // visibility/online is also what re-syncs a stale badge.
    const resume = () => {
      if (!active || document.hidden) return;
      reconnectAttempts = 0;
      connect();
    };

    const onVisibilityChange = () => {
      if (document.hidden) disconnect();
      else resume();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', resume);
    connect();

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', resume);
      disconnect();
    };
  }, [viewedUserId]);

  // Keep the offline label alive: recompute elapsed time on a slow tick so
  // "Seen 5m ago" doesn't freeze when no new frames arrive.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (status.is_online || lastSeenAt === null) return;
    const tick = () => setNow(Date.now());
    // First tick lands in a timer callback (not the effect body) so it can't
    // trigger a cascading render during commit.
    const firstTick = setTimeout(tick, 0);
    const timer = setInterval(tick, LABEL_TICK_MS);
    return () => {
      clearTimeout(firstTick);
      clearInterval(timer);
    };
  }, [status.is_online, lastSeenAt]);

  const liveLabel =
    !status.is_online && lastSeenAt !== null && now !== null
      ? formatElapsed(Math.max(0, Math.floor((now - lastSeenAt) / 1000)))
      : null;

  return { status, liveLabel, lastSeenAt };
}

export default function PublicUserStatus({ userId, initialStatus }: PublicUserStatusProps) {
  const { status, liveLabel, lastSeenAt } = usePublicPresence(userId, initialStatus);

  const variant = status.is_online ? (status.is_idle ? 'warning' : 'success') : 'neutral';

  const text = status.is_online
    ? status.is_idle
      ? 'Away'
      : 'Online'
    : liveLabel
    ? `Seen ${liveLabel}`
    : status.label === 'OFFLINE' || status.label === 'UNKNOWN' || !status.label
    ? 'Offline'
    : `Seen ${status.label}`;

  // Gated on liveLabel (i.e. post-first-tick) so the SSR markup never carries
  // a server-clock-derived attribute that could mismatch on hydration.
  const exactLastSeen =
    liveLabel && lastSeenAt !== null
      ? `Last seen ${new Date(lastSeenAt).toLocaleString()}`
      : undefined;

  return (
    <span role="status" aria-live="polite" aria-label={`Presence: ${text}`} title={exactLastSeen}>
      <Badge variant={variant} pulse={status.is_online}>
        {text}
      </Badge>
    </span>
  );
}
