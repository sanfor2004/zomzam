'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui';
import { describeNotification } from '@/lib/notifications';

// ──────────────────────────────────────────────────────────
// DEVELOPMENT NAVIGATOR: NOTIFICATION TOASTER
// Bridges the SSE-driven `new-notification` window event (dispatched by
// StreamWaiterContext) to a live toast popup. Mount once inside the dashboard
// shell's <ToastProvider>. Wording comes from the SAME describeNotification
// helper the navbar dropdown uses, so a toast reads identically to its row
// (incl. actor batching: "alice and 2 others reposted your post").
// Renders nothing itself.
// ──────────────────────────────────────────────────────────

export function NotificationToaster() {
  const { toast } = useToast();

  useEffect(() => {
    const onNotification = (e: Event) => {
      const n = (e as CustomEvent).detail;
      if (!n) return;
      const view = describeNotification(n);
      toast({ title: `${view.emoji} New activity`, description: view.text, variant: 'info' });
    };
    window.addEventListener('new-notification', onNotification);
    return () => window.removeEventListener('new-notification', onNotification);
  }, [toast]);

  return null;
}
