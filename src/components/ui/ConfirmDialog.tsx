'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  isOpen: boolean;
  /** Called when the user cancels (backdrop, Escape, or the cancel button). */
  onClose: () => void;
  /** Called when the user confirms. May be async — pass `loading` while it runs. */
  onConfirm: () => void | Promise<void>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' → rose confirm button + warning icon; 'default' → primary. */
  variant?: 'danger' | 'default';
  /** Spinner on the confirm button; blocks both actions and dismissal. */
  loading?: boolean;
  /** Override the header icon (defaults to a warning triangle for the danger variant). */
  icon?: React.ReactNode;
}

/**
 * A focused yes/no confirmation built on {@link Modal}. Use it for destructive
 * or otherwise irreversible actions instead of hand-rolling a two-tap toggle.
 * While `loading` is true, the dialog refuses to dismiss so the in-flight
 * action can't be orphaned by a stray backdrop click or Escape press.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  icon,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';
  const accent = isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-primary-500/10 text-primary-500';
  const headerIcon = icon ?? (isDanger ? <AlertTriangle className="w-6 h-6" /> : null);

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      variant={isDanger ? 'danger' : 'default'}
      showClose={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading} fullWidth>
            {cancelLabel}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-4 pt-2">
        {headerIcon && (
          <span className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center ${accent}`}>
            {headerIcon}
          </span>
        )}
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white tracking-tight leading-snug">{title}</h3>
          {description && <p className="text-sm text-slate-400 leading-relaxed">{description}</p>}
        </div>
      </div>
    </Modal>
  );
}
