'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: NOTIFICATION TOASTER
// Bridges the SSE-driven `new-notification` window event (dispatched by
// StreamWaiterContext) to a live toast popup. Mount once inside the dashboard
// shell's <ToastProvider>. Renders nothing itself.
// ──────────────────────────────────────────────────────────

interface NotificationPayload {
  type?: string;
  data?: { from_username?: string; by_user?: string; message?: string; skill_tag?: string };
}

/** Maps a notification payload to a readable toast title + line. */
function describe(n: NotificationPayload): { title: string; description: string } {
  const d = n?.data || {};
  const who = d.from_username || d.by_user || 'Someone';
  switch (n?.type) {
    case 'new_help_request':
      return { title: who, description: d.skill_tag ? `needs help with ${d.skill_tag}` : 'posted a help request' };
    case 'answer_accepted':
      return { title: who, description: 'accepted your answer 🎉' };
    case 'new_follower':
      return { title: who, description: 'started following you' };
    case 'reposted':
      return { title: who, description: 'reposted your post' };
    default:
      return { title: who, description: d.message || 'sent you a notification' };
  }
}

export function NotificationToaster() {
  const { toast } = useToast();

  useEffect(() => {
    const onNotification = (e: Event) => {
      const n = (e as CustomEvent).detail;
      if (!n) return;
      const { title, description } = describe(n);
      toast({ title, description, variant: 'info' });
    };
    window.addEventListener('new-notification', onNotification);
    return () => window.removeEventListener('new-notification', onNotification);
  }, [toast]);

  return null;
}
