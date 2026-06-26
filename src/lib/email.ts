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
