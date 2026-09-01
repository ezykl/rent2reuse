// Thin client wrapper around the paypalCreateOrder/paypalCaptureOrder Cloud
// Functions (functions/src/index.ts). The client never holds PayPal
// credentials or computes/trusts a payment amount — it only ever passes an
// identifier (chatId/messageId) and lets the server look up and verify the
// amount itself.
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebaseConfig";

export type PaypalPurpose = "chat_payment" | "plan_subscription";

interface CreateOrderResult {
  orderId: string;
  approvalUrl: string | null;
}

interface CaptureOrderResult {
  status: "paid";
  transactionId: string | null;
  orderId?: string;
}

const createOrderCallable = httpsCallable<
  {
    purpose: PaypalPurpose;
    chatId?: string;
    messageId?: string;
    planId?: string;
  },
  CreateOrderResult
>(functions, "paypalCreateOrder");

const captureOrderCallable = httpsCallable<
  {
    purpose: PaypalPurpose;
    chatId?: string;
    messageId?: string;
    planId?: string;
    orderId: string;
  },
  CaptureOrderResult
>(functions, "paypalCaptureOrder");

export async function createChatPaymentOrder(
  chatId: string,
  messageId: string
): Promise<CreateOrderResult> {
  const { data } = await createOrderCallable({
    purpose: "chat_payment",
    chatId,
    messageId,
  });
  return data;
}

export async function captureChatPaymentOrder(
  chatId: string,
  messageId: string,
  orderId: string
): Promise<CaptureOrderResult> {
  const { data } = await captureOrderCallable({
    purpose: "chat_payment",
    chatId,
    messageId,
    orderId,
  });
  return data;
}

export async function createPlanSubscriptionOrder(
  planId: string
): Promise<CreateOrderResult> {
  const { data } = await createOrderCallable({
    purpose: "plan_subscription",
    planId,
  });
  return data;
}

export async function capturePlanSubscriptionOrder(
  planId: string,
  orderId: string
): Promise<CaptureOrderResult> {
  const { data } = await captureOrderCallable({
    purpose: "plan_subscription",
    planId,
    orderId,
  });
  return data;
}
