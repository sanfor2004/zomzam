import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export function DeleteConfirmation() {
  const [open, setOpen] = useState(true);
  // Portaled to document.body: the card harness wraps the mount point in a
  // `transform`, which creates a new containing block for this component's
  // `fixed inset-0` overlay and clips it against the card instead of the
  // viewport. Escaping to body keeps the fixed positioning anchored correctly.
  return createPortal(
    <Modal
      isOpen={open}
      onClose={() => setOpen(false)}
      variant="danger"
      title="Delete this lead?"
      description="This action cannot be undone."
      footer={
        <>
          <Button variant="outline" fullWidth onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" fullWidth onClick={() => setOpen(false)}>Delete</Button>
        </>
      }
    >
      Marwa Hassan and all associated activity will be permanently removed from the pipeline.
    </Modal>,
    document.body
  );
}
