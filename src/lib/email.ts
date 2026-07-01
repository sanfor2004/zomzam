// ──────────────────────────────────────────────────────────
// EMAIL CANONICALIZATION (account-identity key)
// Two strings can address the SAME inbox: case differences, Gmail's
// dot-insensitivity, and "+tag" sub-addressing. Matching accounts on the raw
// string lets the same person create two accounts (e.g. register with
// "2004.sanfor@gmail.com", then "Continue with Google" returns "2004sanfor@…"
// → a duplicate). We store the as-entered `email` for display/contact, but key
// identity (lookups + uniqueness + OAuth linking) on this canonical form.
// ──────────────────────────────────────────────────────────

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

// ──────────────────────────────────────────────────────────
// TRANSACTIONAL EMAIL (Resend HTTP API)
// A tiny, zero-dependency sender shared by every outbound email (password
// resets today; anything transactional tomorrow). Mirrors bug-report.ts:
// delivers via the Resend HTTP API over native fetch (no nodemailer/SMTP,
// which is flaky on serverless), and is env-gated so the app runs fine
// unconfigured — it simply no-ops with a warning until RESEND_API_KEY is set.
//
// Setup (.env + Vercel project env):
//   RESEND_API_KEY=re_xxx                          # https://resend.com/api-keys
//   EMAIL_FROM=Zomzam <no-reply@yourdomain.com>    # optional; sender must be a
//     Resend-verified domain. Defaults to onboarding@resend.dev (Resend test
//     mode only delivers that to the account owner's own verified address).
// ──────────────────────────────────────────────────────────

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Zomzam <onboarding@resend.dev>';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Override the sender. Defaults to EMAIL_FROM, then onboarding@resend.dev. */
  from?: string;
  /** Optional Reply-To address. */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** True when no RESEND_API_KEY is configured — nothing was sent. */
  skipped?: boolean;
  error?: string;
}

/**
 * Send one transactional email via Resend. Never throws — returns a result the
 * caller can branch on. No-ops (skipped:true) when RESEND_API_KEY is unset so
 * local/unconfigured environments don't error on password-reset requests.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping send:', input.subject);
    return { ok: false, skipped: true };
  }

  const from = input.from || process.env.EMAIL_FROM || DEFAULT_FROM;
  const to = Array.isArray(input.to) ? input.to : [input.to];

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[email] Resend rejected the send:', res.status, detail);
      return { ok: false, error: `${res.status} ${detail}` };
    }

    return { ok: true };
  } catch (err: any) {
    console.error('[email] send failed:', err);
    return { ok: false, error: String(err?.message || err) };
  }
}

/**
 * Reduce an address to the inbox it actually reaches:
 *  • always trim + lowercase (mailbox routing is case-insensitive in practice),
 *  • drop a "+tag" suffix from the local part (sub-addressing → same inbox),
 *  • for Gmail only, also strip dots from the local part and fold
 *    googlemail.com → gmail.com (Gmail ignores both).
 * Dots are kept for non-Gmail domains because there they ARE significant.
 * Returns the input lowercased/trimmed if it isn't a parseable address.
 */
export function canonicalEmail(raw: string): string {
  const email = (raw || '').trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  // Sub-addressing: everything from the first '+' is a tag, not the inbox.
  const plus = local.indexOf('+');
  if (plus !== -1) local = local.slice(0, plus);

  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }

  return `${local}@${domain}`;
}
