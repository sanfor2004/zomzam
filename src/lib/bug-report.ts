// ──────────────────────────────────────────────────────────
// BUG REPORTER — email-on-error
// ──────────────────────────────────────────────────────────
// Sends an email whenever an unexpected error (a real bug, not an expected
// HttpError/validation 4xx) surfaces — on the server (every API route via the
// withError/withAuth boundary) and on the client (uncaught errors + unhandled
// promise rejections, posted to /api/report-error).
//
// Design constraints:
//   • Zero new dependencies — delivers via the Resend HTTP API over native fetch
//     (no nodemailer/SMTP, which is unreliable on Vercel's serverless runtime).
//   • Fully env-gated — if RESEND_API_KEY + BUG_REPORT_TO are unset it no-ops
//     (and just relies on console.error), so the app runs fine unconfigured.
//   • Never throws — the reporter sits inside error-handling paths; it must not
//     turn a handled 500 into an unhandled crash.
//   • Throttled — one email per identical fault per 10 min, so a recurring error
//     (e.g. a downed DB hit on every request) can't flood the inbox.
//
// Setup: add to .env (and the Vercel project env):
//   RESEND_API_KEY=re_xxx                 # https://resend.com/api-keys
//   BUG_REPORT_TO=you@example.com         # comma-separated for multiple
//   BUG_REPORT_FROM=Zomzam Bugs <bugs@yourdomain.com>   # optional; sender must
//     be a Resend-verified domain. Defaults to onboarding@resend.dev (Resend test
//     mode only delivers that to the account owner's own verified address).

import { rateLimit } from './rate-limit';

export interface BugReportInput {
  /** Where the error originated. */
  source: 'api' | 'client';
  /** Error message (first line). */
  message: string;
  /** Stack trace, if available. */
  stack?: string | null;
  /** Logical location — API route path, or client route/URL. */
  context?: string | null;
  /** Full request/page URL. */
  url?: string | null;
  /** HTTP method (API only). */
  method?: string | null;
  /** Browser user-agent, when known. */
  userAgent?: string | null;
  /** The authenticated user at the time, if any. */
  user?: { id?: number; username?: string; email?: string } | null;
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Zomzam Bugs <onboarding@resend.dev>';

// One email per identical fault per window — see module header.
const THROTTLE_MAX = 1;
const THROTTLE_WINDOW_MS = 10 * 60 * 1000;

/** A stable-enough identity for a fault so repeats collapse to one email. */
function fingerprint(input: BugReportInput): string {
  const firstFrame = (input.stack || '').split('\n').map((l) => l.trim()).find((l) => l.startsWith('at ')) || '';
  return [input.source, input.context || '', input.message.slice(0, 120), firstFrame.slice(0, 160)].join('|');
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(input: BugReportInput): string {
  const when = new Date().toISOString();
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
  const row = (label: string, value: unknown) =>
    value
      ? `<tr><td style="padding:4px 12px 4px 0;color:#94a3b8;font:12px monospace;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="padding:4px 0;color:#e2e8f0;font:12px monospace;word-break:break-all">${esc(value)}</td></tr>`
      : '';

  const userStr = input.user ? `#${input.user.id ?? '?'} @${input.user.username ?? '?'} <${input.user.email ?? '?'}>` : 'anonymous';

  return `<div style="background:#0b0d12;padding:24px;font-family:system-ui,sans-serif">
    <div style="max-width:680px;margin:0 auto;background:#1A1D24;border:1px solid #1e293b;border-radius:16px;overflow:hidden">
      <div style="background:#EE5712;padding:14px 20px;color:#fff;font-weight:800;font-size:14px">🐛 Zomzam — ${esc(input.source)} error</div>
      <div style="padding:20px">
        <p style="margin:0 0 14px;color:#f8fafc;font-size:15px;font-weight:700">${esc(input.message)}</p>
        <table style="border-collapse:collapse;width:100%;margin-bottom:16px">
          ${row('Environment', env)}
          ${row('When', when)}
          ${row('Location', input.context)}
          ${row('URL', input.url)}
          ${row('Method', input.method)}
          ${row('User', userStr)}
          ${row('User-Agent', input.userAgent)}
        </table>
        ${input.stack ? `<pre style="background:#0b0d12;border:1px solid #1e293b;border-radius:10px;padding:14px;color:#cbd5e1;font:11px/1.5 monospace;white-space:pre-wrap;word-break:break-word;overflow-x:auto">${esc(input.stack)}</pre>` : ''}
      </div>
    </div>
  </div>`;
}

/**
 * Send a bug report email. Safe to await inside an error handler: it never
 * throws and silently no-ops when unconfigured. On Vercel's serverless runtime
 * callers should `await` this (the function may freeze right after the response,
 * killing a fire-and-forget request) — the extra latency only affects responses
 * that are already failures.
 */
export async function reportBug(input: BugReportInput): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.BUG_REPORT_TO;
    if (!apiKey || !to) return; // not configured → console.error trail only

    if (!rateLimit(`bug:${fingerprint(input)}`, THROTTLE_MAX, THROTTLE_WINDOW_MS)) return;

    const from = process.env.BUG_REPORT_FROM || DEFAULT_FROM;
    const subject = `🐛 [Zomzam] ${input.source} error: ${input.message.slice(0, 100)}`;

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject,
        html: buildHtml(input),
      }),
    });

    if (!res.ok) {
      console.error('[bug-report] Resend rejected the send:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    // The reporter lives inside error paths — swallow everything.
    console.error('[bug-report] failed to send:', err);
  }
}
