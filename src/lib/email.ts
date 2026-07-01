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
// TRANSACTIONAL EMAIL (SMTP — e.g. Hostinger)
// A small sender shared by every outbound email (password resets today;
// anything transactional tomorrow). Delivers via SMTP with nodemailer, so the
// app can send through your own Hostinger mailbox (mail authenticated as your
// domain → decent inbox delivery). Env-gated: it no-ops with a warning until
// the SMTP_* vars are set, so local/unconfigured environments still run.
//
// Serverless note: the transporter is cached at module scope so a warm Vercel
// container reuses one connection pool instead of doing a fresh TLS handshake
// per send. Hostinger caps sends (hundreds/day) — fine for auth email.
//
// Setup (.env + Vercel project env), from hPanel → Emails (create the mailbox):
//   SMTP_HOST=smtp.hostinger.com
//   SMTP_PORT=465                                # 465 = SSL, 587 = STARTTLS
//   SMTP_USER=no-reply@yourdomain.com            # the full mailbox address
//   SMTP_PASS=••••••••                           # that mailbox's password
//   EMAIL_FROM=Zomzam <no-reply@yourdomain.com>  # optional; defaults to SMTP_USER
// ──────────────────────────────────────────────────────────

import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  /** Override the sender. Defaults to EMAIL_FROM, then SMTP_USER. */
  from?: string;
  /** Optional Reply-To address. */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** True when SMTP isn't configured — nothing was sent. */
  skipped?: boolean;
  error?: string;
}

// Cached across invocations on a warm container so we don't rebuild the pool
// (and re-handshake TLS) on every send.
let transporter: Transporter | null = null;

/** Build (once) the SMTP transport, or null when SMTP isn't configured. */
function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  if (!transporter) {
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // implicit TLS on 465; STARTTLS on 587
      auth: { user, pass },
    });
  }
  return transporter;
}

/**
 * Send one transactional email over SMTP. Never throws — returns a result the
 * caller can branch on. No-ops (skipped:true) when SMTP isn't configured so
 * local/unconfigured environments don't error on password-reset requests.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const transport = getTransport();
  if (!transport) {
    console.warn('[email] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS) — skipping send:', input.subject);
    return { ok: false, skipped: true };
  }

  const from = input.from || process.env.EMAIL_FROM || process.env.SMTP_USER!;
  const to = Array.isArray(input.to) ? input.to : [input.to];

  try {
    await transport.sendMail({
      from,
      to,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    return { ok: true };
  } catch (err: any) {
    console.error('[email] SMTP send failed:', err);
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
