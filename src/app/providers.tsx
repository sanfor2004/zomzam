'use client';

import React from 'react';
import { TranslationProvider } from '@/context/TranslationContext';
import { ToastProvider } from '@/components/ui';
import { ErrorReporter } from '@/components/ErrorReporter';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TranslationProvider>
      <ToastProvider>
        <ErrorReporter />
        {children}
      </ToastProvider>
    </TranslationProvider>
  );
}
