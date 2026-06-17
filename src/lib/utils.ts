/** EGP-relative exchange rates. 1 unit of each currency in EGP. */
export const EXCHANGE_RATES_TO_EGP: Record<string, number> = {
  EGP: 1.0,
  USD: 48.5,
  EUR: 52.0,
  GBP: 61.0,
};

/**
 * Safely merges and filters CSS class names for dynamic rendering.
 * Pure JavaScript implementation similar to clsx.
 */
export function cn(...inputs: any[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) {
          classes.push(key);
        }
      }
    }
  }

  return classes.filter(Boolean).join(' ');
}
