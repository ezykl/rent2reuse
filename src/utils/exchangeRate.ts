// Client-side PHP<->USD estimate, for DISPLAY ONLY (e.g. "≈ $12.34 USD"
// under a price). The amount actually charged or paid out is always computed
// server-side from Firestore (functions/src/paypal.ts) — nothing here should
// ever be used to decide what a user is charged.
//
// This replaces two near-identical copies of the same polling logic that used
// to live in src/utils/paypalHelper.ts and src/components/PaypalPayment.tsx,
// each firing its own setInterval on import.

const FALLBACK_PHP_PER_USD = 56.5;
const REFRESH_MS = 30 * 60 * 1000;

let currentRate = FALLBACK_PHP_PER_USD;
let lastFetchedAt = 0;
let inFlight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=PHP"
    );
    const data = await res.json();
    if (data?.rates?.PHP) {
      currentRate = data.rates.PHP;
      lastFetchedAt = Date.now();
    }
  } catch (err) {
    if (__DEV__) {
      console.log("[exchangeRate] fetch failed, keeping last known rate:", err);
    }
  }
}

/** Kicks off a refresh if the cached rate is stale. Safe to call often — it only actually fetches once per REFRESH_MS. */
export function refreshExchangeRate(): void {
  if (Date.now() - lastFetchedAt < REFRESH_MS) return;
  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }
}

/** True if we've never successfully fetched a live rate and are showing the hardcoded fallback. */
export function isUsingFallbackRate(): boolean {
  return lastFetchedAt === 0;
}

export function estimateUsd(phpAmount: number): string {
  refreshExchangeRate();
  return (phpAmount / currentRate).toFixed(2);
}

export function estimatePhp(usdAmount: number | string): string {
  refreshExchangeRate();
  return (Number(usdAmount) * currentRate).toFixed(2);
}
