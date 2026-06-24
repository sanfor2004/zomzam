'use client';

import { useEffect } from 'react';

// ──────────────────────────────────────────────────────────
// GLOBAL ERROR BOUNDARY
// Next.js renders this when the root layout/tree throws during render — the one
// class of client crash window.onerror (and so ErrorReporter) can't see. It
// emails the crash via /api/report-error, then shows a recoverable fallback.
// Must render its own <html>/<body> (it replaces the root layout).
// ──────────────────────────────────────────────────────────
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch('/api/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Render crash: ${error.message}`,
          stack: error.stack || '',
          context: error.digest ? `digest ${error.digest}` : 'global-error',
          url: typeof location !== 'undefined' ? location.href : '',
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never throw from the error boundary */
    }
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0b0d12', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Something broke on our end</h1>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px' }}>
              The team has been notified automatically. You can try again.
            </p>
            <button
              onClick={() => reset()}
              style={{
                background: '#EE5712', color: '#fff', border: 'none', borderRadius: 12,
                padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
