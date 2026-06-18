import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ToastProvider, useToast } from '@/components/ui/Toast';

// Toast's viewport is `fixed bottom-6 right-6` — same containing-block issue
// as Modal's `fixed inset-0` (see Modal.tsx). Portaling to document.body
// keeps it anchored to the real viewport instead of the card harness's
// transformed mount point.
function AutoToasts() {
  const { toast } = useToast();
  useEffect(() => {
    toast({ title: 'Lead saved', description: 'Marwa Hassan was added to the pipeline.', variant: 'success' });
    const t = setTimeout(() => {
      toast({ title: 'Sync failed', description: 'Notion API token looks invalid.', variant: 'error' });
    }, 60);
    return () => clearTimeout(t);
  }, [toast]);
  return null;
}

export function Stack() {
  return createPortal(
    <ToastProvider>
      <AutoToasts />
    </ToastProvider>,
    document.body
  );
}
