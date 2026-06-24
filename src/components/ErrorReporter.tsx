'use client';

import { useEffect } from 'react';

// ──────────────────────────────────────────────────────────
// CLIENT ERROR REPORTER
// Listens for uncaught errors and unhandled promise rejections anywhere in the
// app and posts them to /api/report-error (which emails them). Mounted once,
// globally, in providers.tsx so it covers every route — including pre-auth.
// Renders nothing.
// ──────────────────────────────────────────────────────────

// Local de-dupe so a tight error loop can't hammer the endpoint: same message
// reported at most once per minute, client-side, before the server throttle.
const seen = new Map<string, number>();
const DEDUPE_MS = 60 * 1000;

function send(message: string, stack: string | null) {
  if (!message) return;
  const now = Date.now();
  const last = seen.get(message);
  if (last && now - last < DEDUPE_MS) return;
  seen.set(message, now);

  try {
    const payload = JSON.stringify({
      message,
      stack: stack || '',
      context: typeof document !== 'undefined' ? document.title : '',
      url: typeof location !== 'undefined' ? location.href : '',
    });
    // keepalive lets the POST survive a navigation/unload triggered by the error.
    fetch('/api/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* reporting must never itself throw */
  }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      send(e.message || 'Uncaught error', e.error?.stack || `at ${e.filename}:${e.lineno}:${e.colno}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      send(`Unhandled rejection: ${message}`, reason instanceof Error ? reason.stack || null : null);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
