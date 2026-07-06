'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'danger';
  /** Show the top-right close (X) button. Default: true. */
  showClose?: boolean;
  /** Card max-width. 'md' (default) keeps confirm/danger dialogs compact;
   *  'xl' suits richer content like the post composer. */
  size?: 'md' | 'xl';
  /** On phones, let the card span the full width and size to its content
   *  (height capped with internal scroll) over a visible backdrop — so tapping
   *  anywhere around the card dismisses it; reverts to a centered card at sm+. */
  fullWidthMobile?: boolean;
  /** Entrance motion. 'rise' fades the backdrop's blur in and lifts + scales the
   *  card (the composer's soft open); 'default' is the standard fade-in. */
  entrance?: 'default' | 'rise';
  /** Card surface. 'solid' (default) is the opaque dialog panel; 'glass' matches
   *  the feed cards / composer (bg-white/[0.04] backdrop-blur) so the composer
   *  modal reads as the same material as the cards behind it. */
  surface?: 'solid' | 'glass';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className = '',
  variant = 'default',
  showClose = true,
  size = 'md',
  fullWidthMobile = false,
  entrance = 'default',
  surface = 'solid',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  // Portals need the DOM — gate on mount so SSR/first render stays clean.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key click
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const borderClasses = variant === 'danger'
    ? 'border-red-200 dark:border-red-900/40'
    : 'border-slate-100 dark:border-slate-800/60';

  const showHeader = title || description || showClose;

  // Mobile-first width/padding/radius so cn() never has to win a Tailwind
  // conflict (this cn is clsx-style — it doesn't dedupe). Full-width-on-mobile
  // spans the padded overlay, then becomes a centered card at sm+.
  const widthClass = fullWidthMobile
    ? (size === 'xl' ? 'max-w-none sm:max-w-xl' : 'max-w-none sm:max-w-md')
    : (size === 'xl' ? 'max-w-xl' : 'max-w-md');
  // Full-width-on-mobile sizes to its content but caps at the viewport (minus
  // the overlay padding) with internal scroll, keeping the backdrop tappable
  // around it; on desktop the card sizes to its content with no scroll cap.
  // overflow-x-hidden on the mobile scroll container is required: with only
  // overflow-y-auto set, the CSS spec computes overflow-x up to `auto` too, so
  // any element brushing the edge would raise a spurious horizontal scrollbar.
  const shellClass = fullWidthMobile
    ? 'rounded-3xl p-5 sm:p-8 max-sm:max-h-[calc(100dvh-2rem)] max-sm:overflow-y-auto max-sm:overflow-x-hidden'
    : 'rounded-3xl p-8';
  const surfaceClass = surface === 'glass'
    ? 'bg-white/[0.04] backdrop-blur-xl border border-white/[0.07]'
    : cn('surface-card border', borderClasses);

  const overlay = (
    <div
      onClick={handleBackdropClick}
      className={cn(
        'fixed inset-0 bg-black/60 z-[100] flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        'p-4',
        entrance === 'rise' ? 'backdrop-blur-lg composer-backdrop-enter' : 'backdrop-blur-sm',
      )}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full shadow-2xl scale-100 opacity-100 transition-all duration-300',
          surfaceClass,
          widthClass,
          shellClass,
          entrance === 'rise' ? 'composer-modal-enter' : 'animate-in',
          className,
        )}
      >
        {/* Header */}
        {showHeader && (
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-black text-white tracking-tight leading-snug">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-slate-400 mt-1">{description}</p>
              )}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors focus:outline-none"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="text-sm text-slate-350 leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-850">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Portal to <body> so a transformed ancestor (e.g. .card-lift) can't trap the
  // fixed overlay inside its containing block.
  return createPortal(overlay, document.body);
}
