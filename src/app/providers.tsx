'use client';

import React from 'react';
import { TranslationProvider } from '@/context/TranslationContext';
import { ToastProvider } from '@/components/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TranslationProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </TranslationProvider>
  );
}
