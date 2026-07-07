// ──────────────────────────────────────────────────────────
// FX — single source of truth for currency conversion (server + client safe).
//
// Everything pivots through EGP: a rate is "how many EGP is 1 unit of X worth".
// EGP itself is always 1. Cross-pairs (e.g. USD→EUR) therefore work correctly
// via the pivot, which the legacy EGP-only helper in MoneyContext got wrong.
//
// Rates are cached per-user in `money_fx_rates` and refreshed on demand from a
// free API (no key). Historical transaction values are SNAPSHOT at write time
// (money_transactions.home_amount) so a later rate change never rewrites the past.
// ──────────────────────────────────────────────────────────
import { EXCHANGE_RATES_TO_EGP } from './utils';

export type Currency = 'EGP' | 'USD' | 'EUR' | 'GBP';
export const CURRENCIES: Currency[] = ['EGP', 'USD', 'EUR', 'GBP'];

/** EGP per 1 unit of each currency. EGP is the pivot, always 1. */
export type Rates = Record<Currency, number>;

/** Hardcoded offline fallback — keeps conversion working with no network/DB. */
export const FALLBACK_RATES: Rates = {
  EGP: 1,
  USD: EXCHANGE_RATES_TO_EGP.USD,
  EUR: EXCHANGE_RATES_TO_EGP.EUR,
  GBP: EXCHANGE_RATES_TO_EGP.GBP,
};

/** Coerce a partial/loose rate map (e.g. from the DB) into a complete `Rates`,
 *  filling any missing currency from the fallback and forcing EGP = 1. */
export function normalizeRates(partial: Partial<Record<string, number>>): Rates {
  return {
    EGP: 1,
    USD: Number(partial.USD) > 0 ? Number(partial.USD) : FALLBACK_RATES.USD,
    EUR: Number(partial.EUR) > 0 ? Number(partial.EUR) : FALLBACK_RATES.EUR,
    GBP: Number(partial.GBP) > 0 ? Number(partial.GBP) : FALLBACK_RATES.GBP,
  };
}

/** Convert `amount` from one currency to another, pivoting through EGP.
 *  `amount * rates[from] / rates[to]` — correct for every pair, including
 *  cross-pairs that don't touch EGP. */
export function convert(amount: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return amount;
  const fromRate = rates[from] || FALLBACK_RATES[from];
  const toRate = rates[to] || FALLBACK_RATES[to];
  return (amount * fromRate) / toRate;
}

/** Snapshot `amount` (in `from` currency) into the home currency at today's
 *  rate. `fx_rate` = 1 unit of `from` in home-currency units. Stored on the
 *  transaction so its home value is frozen against future rate changes. */
export function snapshotHomeAmount(
  amount: number,
  from: Currency,
  home: Currency,
  rates: Rates,
): { home_amount: number; fx_rate: number } {
  const fromRate = rates[from] || FALLBACK_RATES[from];
  const homeRate = rates[home] || FALLBACK_RATES[home];
  const fx_rate = fromRate / homeRate;              // 1 `from` = fx_rate `home`
  return { home_amount: amount * fx_rate, fx_rate };
}

/** Fetch live rates from a free, keyless API that supports EGP
 *  (open.er-api.com — ExchangeRate-API's open endpoint; frankfurter.app is
 *  ECB-only and has no EGP). Base = EGP, so response `rates[X]` = X per 1 EGP;
 *  we invert to get EGP-per-X. NEVER throws — any failure returns the fallback
 *  so a page load can't break on a flaky FX provider. Server-only (network). */
export async function fetchLiveRates(): Promise<{ rates: Rates; source: 'api' | 'fallback' }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EGP', {
      signal: controller.signal,
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return { rates: FALLBACK_RATES, source: 'fallback' };
    const data = await res.json();
    const perEgp = data?.rates;
    if (data?.result !== 'success' || !perEgp) return { rates: FALLBACK_RATES, source: 'fallback' };
    const inv = (x: number | undefined) => (Number(x) > 0 ? 1 / Number(x) : 0);
    return {
      rates: normalizeRates({ USD: inv(perEgp.USD), EUR: inv(perEgp.EUR), GBP: inv(perEgp.GBP) }),
      source: 'api',
    };
  } catch {
    return { rates: FALLBACK_RATES, source: 'fallback' };
  } finally {
    clearTimeout(timer);
  }
}
