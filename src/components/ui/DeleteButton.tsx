'use client';

import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export interface DeleteButtonProps {
  /**
   * Runs on the confirming (second) click. A spinner shows while it resolves.
   * Throw or reject to abort — the button collapses back to its idle state.
   */
  onConfirm: () => void | Promise<void>;
  /** Native title/hover hint in the idle state. Also the default aria-label. */
  tooltip?: string;
  /** Accessible label for the icon-only trigger (falls back to `tooltip`). */
  ariaLabel?: string;
  /** Label revealed after the first click, asking for confirmation. */
  confirmText?: string;
  /** Merged onto the button (positioning, sizing overrides). */
  className?: string;
  /** Icon size utility — defaults to the compact `w-3 h-3` header look. */
  iconClassName?: string;
}

/**
 * A destructive trigger that confirms **inline**: the first click expands it into
 * a "Confirm?" state, the second click runs the action, and clicking away (blur)
 * cancels. Lighter than a modal {@link ConfirmDialog} — ideal for dense rows like
 * a post or comment header where a popup would be overkill.
 */
export function DeleteButton({
  onConfirm,
  tooltip = 'Delete',
  ariaLabel,
  confirmText = 'Confirm?',
  className,
  iconClassName = 'w-3 h-3',
}: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleClick = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    try {
      await onConfirm();
      setConfirming(false); // on success the row is usually removed; collapse if it survives
    } catch {
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button
      variant="unstyled"
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      disabled={deleting}
      aria-label={ariaLabel ?? tooltip}
      title={confirming ? 'Click again to confirm' : tooltip}
      className={cn(
        'flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-lg transition-colors disabled:opacity-40',
        confirming ? 'text-rose-400 bg-rose-500/10' : 'text-slate-600 hover:text-rose-400 hover:bg-rose-500/10',
        className,
      )}
    >
      {deleting ? <Loader2 className={cn(iconClassName, 'animate-spin')} /> : <Trash2 className={iconClassName} />}
      {confirming && <span>{confirmText}</span>}
    </Button>
  );
}
