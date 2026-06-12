'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'danger';
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
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const borderClasses = variant === 'danger'
    ? 'border-red-200 dark:border-red-900/40'
    : 'border-slate-100 dark:border-slate-800/60';

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={`w-full max-w-md bg-white dark:bg-[#1A1D24] rounded-3xl p-8 shadow-2xl border ${borderClasses} animate-in scale-100 opacity-100 transition-all duration-300 ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-xs text-slate-400 mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="text-sm text-slate-600 dark:text-slate-350 leading-relaxed mb-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-50 dark:border-slate-850">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
