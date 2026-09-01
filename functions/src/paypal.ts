import { defineSecret } from "firebase-functions/params";

// PayPal credentials live only here, as Cloud Functions secrets — never in the
// client bundle. Set with:
//   firebase functions:secrets:set PAYPAL_CLIENT_ID
//   firebase functions:secrets:set PAYPAL_CLIENT_SECRET
//   firebase functions:secrets:set PAYPAL_BASE_URL
export const PAYPAL_CLIENT_ID = defineSecret("PAYPAL_CLIENT_ID");
export const PAYPAL_CLIENT_SECRET = defineSecret("PAYPAL_CLIENT_SECRET");
export const PAYPAL_BASE_URL = defineSecret("PAYPAL_BASE_URL");

// ---------------------------------------------------------------------------
// OAuth2 access token, cached per warm function instance to avoid a token
// round-trip on every call.
// ---------------------------------------------------------------------------
let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = PAYPAL_CLIENT_ID.value();
  const clientSecret = PAYPAL_CLIENT_SECRET.value();
  const baseUrl = PAYPAL_BASE_URL.value();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_US",
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(
      data.error_description || "Failed to get PayPal access token"
    );
  }

  // expires_in is seconds; refresh a little early to be safe.
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

// ---------------------------------------------------------------------------
// PHP <-> USD exchange rate, cached across warm invocations with a silent
// fallback if the FX API is unreachable (matches the client's prior fallback
// of 56.5, kept here as the single source of truth now that this runs
// server-side).
// ---------------------------------------------------------------------------
const FALLBACK_PHP_PER_USD = 56.5;
const FX_TTL_MS = 30 * 60 * 1000;
let fxCache: { rate: number; fetchedAt: number } = {
  rate: FALLBACK_PHP_PER_USD,
  fetchedAt: 0,
};

export async function getPhpPerUsd(): Promise<{
  rate: number;
  isFallback: boolean;
}> {
  const isStale = Date.now() - fxCache.fetchedAt > FX_TTL_MS;
  if (!isStale) {
    return { rate: fxCache.rate, isFallback: fxCache.fetchedAt === 0 };
  }
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=PHP"
    );
    const data: any = await res.json();
    if (data?.rates?.PHP) {
      fxCache = { rate: data.rates.PHP, fetchedAt: Date.now() };
      return { rate: fxCache.rate, isFallback: false };
    }
  } catch {
    // Network/API failure — fall through and reuse whatever is cached below.
  }
  return { rate: fxCache.rate, isFallback: fxCache.fetchedAt === 0 };
}

export function phpToUsd(phpAmount: number, phpPerUsd: number): string {
  return (phpAmount / phpPerUsd).toFixed(2);
}

// ---------------------------------------------------------------------------
// Checkout Orders v2 — used both for the renter-pays-platform chat flow and
// the subscription-plan flow (see index.ts).
// ---------------------------------------------------------------------------
export async function createOrder(opts: {
  accessToken: string;
  baseUrl: string;
  usdAmount: string;
  description: string;
  customId: string;
}): Promise<{ id: string; approvalUrl: string | null; raw: unknown }> {
  const response = await fetch(`${opts.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: opts.customId,
          description: opts.description,
          amount: { currency_code: "USD", value: opts.usdAmount },
        },
      ],
      // The client's in-app WebView has no real redirect target, so it
      // detects completion by watching for these URLs in navigation state
      // (see handleWebViewNavigationStateChange in PaypalPayment.tsx /
      // handlePayNow in PaymentMessage.tsx) rather than following a real
      // return_url.
      application_context: {
        return_url:
          "https://www.paypal.com/checkoutnow/error?paymentId=success",
        cancel_url: "https://www.paypal.com/checkoutnow/error?paymentId=cancel",
        user_action: "PAY_NOW",
      },
    }),
  });
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to create PayPal order");
  }
  const approvalLink = (data.links || []).find(
    (l: { rel: string; href: string }) => l.rel === "approve"
  );
  return { id: data.id, approvalUrl: approvalLink?.href ?? null, raw: data };
}

export async function captureOrder(opts: {
  accessToken: string;
  baseUrl: string;
  orderId: string;
}): Promise<{
  status: string;
  capturedUsd: string | null;
  transactionId: string | null;
  raw: unknown;
}> {
  const response = await fetch(
    `${opts.baseUrl}/v2/checkout/orders/${opts.orderId}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.accessToken}`,
      },
    }
  );
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to capture PayPal order");
  }
  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: data.status,
    capturedUsd: capture?.amount?.value ?? null,
    transactionId: capture?.id ?? null,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// Payouts v1 — platform disburses to an item owner's PayPal email. This is
// the piece that lets us pay individual owners without giving every owner
// their own PayPal Invoicing/merchant credential.
// ---------------------------------------------------------------------------
export async function sendPayout(opts: {
  accessToken: string;
  baseUrl: string;
  recipientEmail: string;
  usdAmount: string;
  note: string;
  senderItemId: string;
}): Promise<{ batchId: string | undefined; raw: unknown }> {
  const response = await fetch(`${opts.baseUrl}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: opts.senderItemId,
        email_subject: "Payment from Rent2Reuse",
        email_message: opts.note,
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: opts.usdAmount, currency: "USD" },
          receiver: opts.recipientEmail,
          note: opts.note,
          sender_item_id: opts.senderItemId,
        },
      ],
    }),
  });
  const data: any = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to send PayPal payout");
  }
  return { batchId: data.batch_header?.payout_batch_id, raw: data };
}
