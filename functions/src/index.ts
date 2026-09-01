import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_BASE_URL,
  getAccessToken,
  getPhpPerUsd,
  phpToUsd,
  createOrder,
  captureOrder,
  sendPayout,
} from "./paypal";

export { syncAdminLookup } from "./adminLookupSync";

initializeApp();
const db = getFirestore();

const SECRETS = [PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BASE_URL];

type Purpose = "chat_payment" | "plan_subscription";

interface CreateOrderData {
  purpose: Purpose;
  chatId?: string;
  messageId?: string;
  planId?: string;
}

interface CaptureOrderData {
  purpose: Purpose;
  chatId?: string;
  messageId?: string;
  planId?: string;
  orderId: string;
}

/**
 * Creates a PayPal Checkout order. The client never supplies an amount —
 * every purpose looks up the authoritative amount itself from Firestore, so
 * a tampered client can't request a lower charge than it owes.
 */
export const paypalCreateOrder = onCall(
  { secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const data = request.data as CreateOrderData;

    if (data.purpose === "chat_payment") {
      return createChatPaymentOrder(request.auth.uid, data);
    }
    if (data.purpose === "plan_subscription") {
      return createPlanSubscriptionOrder(request.auth.uid, data);
    }

    throw new HttpsError(
      "invalid-argument",
      `Unsupported purpose: ${data.purpose}`
    );
  }
);

async function createChatPaymentOrder(uid: string, data: CreateOrderData) {
  if (!data.chatId || !data.messageId) {
    throw new HttpsError(
      "invalid-argument",
      "chatId and messageId are required."
    );
  }

  const messageRef = db
    .collection("chat")
    .doc(data.chatId)
    .collection("messages")
    .doc(data.messageId);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) {
    throw new HttpsError("not-found", "Payment message not found.");
  }
  const message = messageSnap.data()!;

  if (message.type !== "payment") {
    throw new HttpsError(
      "invalid-argument",
      "Message is not a payment request."
    );
  }
  if (message.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      `Payment is already "${message.status}".`
    );
  }
  if (message.senderId === uid) {
    throw new HttpsError(
      "permission-denied",
      "The requester cannot pay their own request."
    );
  }

  const phpAmount = Number(message.amount);
  if (!phpAmount || phpAmount <= 0) {
    throw new HttpsError(
      "failed-precondition",
      "Payment message has no valid amount."
    );
  }

  const { rate } = await getPhpPerUsd();
  const usdAmount = phpToUsd(phpAmount, rate);
  const baseUrl = PAYPAL_BASE_URL.value();
  const accessToken = await getAccessToken();

  const order = await createOrder({
    accessToken,
    baseUrl,
    usdAmount,
    description: `Rent2Reuse ${message.paymentType === "initial" ? "initial" : "full"} payment`,
    customId: `chat_payment:${data.chatId}:${data.messageId}`,
  });

  await messageRef.update({ paypalOrderId: order.id });

  return { orderId: order.id, approvalUrl: order.approvalUrl };
}

async function createPlanSubscriptionOrder(uid: string, data: CreateOrderData) {
  if (!data.planId) {
    throw new HttpsError("invalid-argument", "planId is required.");
  }

  const planRef = db.collection("plans").doc(data.planId);
  const planSnap = await planRef.get();
  if (!planSnap.exists) {
    throw new HttpsError("not-found", "Plan not found.");
  }
  const plan = planSnap.data()!;

  const phpAmount = Number(plan.price);
  if (!phpAmount || phpAmount <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "This plan does not require PayPal checkout."
    );
  }

  const { rate } = await getPhpPerUsd();
  const usdAmount = phpToUsd(phpAmount, rate);
  const baseUrl = PAYPAL_BASE_URL.value();
  const accessToken = await getAccessToken();

  const order = await createOrder({
    accessToken,
    baseUrl,
    usdAmount,
    description: `${plan.planType || "Rent2Reuse"} Plan Subscription`,
    customId: `plan_subscription:${uid}:${data.planId}`,
  });

  return { orderId: order.id, approvalUrl: order.approvalUrl };
}

/**
 * Captures a previously created order. Verifies the capture actually
 * completed and the captured amount matches the message's expected amount,
 * then writes the authoritative "paid" state via the Admin SDK — the client
 * never writes status/paidAt/transactionId itself (see firestore.rules).
 *
 * For chat_payment, also attempts an immediate payout to the item owner's
 * PayPal email. A payout failure does NOT roll back the renter's successful
 * payment — it's surfaced via payoutStatus so the in-chat "Mark as Received"
 * fallback can recover (see PaymentMessage.tsx).
 */
export const paypalCaptureOrder = onCall(
  { secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required.");
    }
    const data = request.data as CaptureOrderData;

    if (data.purpose === "chat_payment") {
      return captureChatPayment(request.auth.uid, data);
    }
    if (data.purpose === "plan_subscription") {
      return capturePlanSubscription(data);
    }

    throw new HttpsError(
      "invalid-argument",
      `Unsupported purpose: ${data.purpose}`
    );
  }
);

async function captureChatPayment(uid: string, data: CaptureOrderData) {
  if (!data.chatId || !data.messageId || !data.orderId) {
    throw new HttpsError(
      "invalid-argument",
      "chatId, messageId and orderId are required."
    );
  }

  const messageRef = db
    .collection("chat")
    .doc(data.chatId)
    .collection("messages")
    .doc(data.messageId);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) {
    throw new HttpsError("not-found", "Payment message not found.");
  }
  const message = messageSnap.data()!;

  if (message.paypalOrderId !== data.orderId) {
    throw new HttpsError(
      "failed-precondition",
      "Order does not match this payment request."
    );
  }
  if (message.status === "paid") {
    // Already captured (e.g. a retried client call after a dropped response) —
    // return the existing result idempotently instead of double-capturing.
    return { status: "paid", transactionId: message.transactionId ?? null };
  }
  if (message.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      `Payment is "${message.status}", cannot capture.`
    );
  }

  const baseUrl = PAYPAL_BASE_URL.value();
  const accessToken = await getAccessToken();
  const capture = await captureOrder({
    accessToken,
    baseUrl,
    orderId: data.orderId,
  });

  if (capture.status !== "COMPLETED") {
    throw new HttpsError(
      "aborted",
      `PayPal capture did not complete (status: ${capture.status}).`
    );
  }

  const { rate } = await getPhpPerUsd();
  const expectedUsd = Number(phpToUsd(Number(message.amount), rate));
  const capturedUsd = Number(capture.capturedUsd);
  // Allow a small tolerance for FX-rate drift between order-create and capture.
  if (Math.abs(capturedUsd - expectedUsd) > Math.max(0.5, expectedUsd * 0.05)) {
    throw new HttpsError(
      "aborted",
      `Captured amount ($${capturedUsd}) does not match the expected amount (~$${expectedUsd}).`
    );
  }

  await messageRef.update({
    status: "paid",
    paidAt: FieldValue.serverTimestamp(),
    transactionId: capture.transactionId,
  });

  const chatRef = messageRef.parent.parent!;
  await chatRef.update({
    lastMessage: "Payment completed",
    lastMessageTime: FieldValue.serverTimestamp(),
  });

  await messageRef.parent.add({
    type: "statusUpdate",
    text: `Payment of ₱${message.amount} completed via PayPal`,
    senderId: uid,
    createdAt: FieldValue.serverTimestamp(),
    read: false,
    status: "paid",
  });

  try {
    if (!message.ownerPayPalEmail) {
      throw new Error("Owner has not set up a PayPal email.");
    }
    const payout = await sendPayout({
      accessToken,
      baseUrl,
      recipientEmail: message.ownerPayPalEmail,
      usdAmount: capture.capturedUsd ?? phpToUsd(Number(message.amount), rate),
      note: `Rent2Reuse payout for chat ${data.chatId}`,
      senderItemId: `chat_payout:${data.chatId}:${data.messageId}`,
    });
    await messageRef.update({
      payoutStatus: "success",
      payoutBatchId: payout.batchId ?? null,
    });
  } catch (payoutError) {
    const message2 =
      payoutError instanceof Error ? payoutError.message : String(payoutError);
    await messageRef.update({
      payoutStatus: "failed",
      payoutError: message2,
    });
  }

  return { status: "paid", transactionId: capture.transactionId };
}

/**
 * Captures a plan-subscription order and verifies the amount against the
 * authoritative `plans/{planId}` price. Unlike chat payments, the
 * subscription/transaction/currentPlan Firestore writes stay client-side
 * (see plans.tsx handlePaymentSuccess) — this call's job is only to keep the
 * PayPal secret and the capture verification off the client.
 */
async function capturePlanSubscription(data: CaptureOrderData) {
  if (!data.planId || !data.orderId) {
    throw new HttpsError(
      "invalid-argument",
      "planId and orderId are required."
    );
  }

  const planSnap = await db.collection("plans").doc(data.planId).get();
  if (!planSnap.exists) {
    throw new HttpsError("not-found", "Plan not found.");
  }
  const plan = planSnap.data()!;

  const baseUrl = PAYPAL_BASE_URL.value();
  const accessToken = await getAccessToken();
  const capture = await captureOrder({
    accessToken,
    baseUrl,
    orderId: data.orderId,
  });

  if (capture.status !== "COMPLETED") {
    throw new HttpsError(
      "aborted",
      `PayPal capture did not complete (status: ${capture.status}).`
    );
  }

  const { rate } = await getPhpPerUsd();
  const expectedUsd = Number(phpToUsd(Number(plan.price), rate));
  const capturedUsd = Number(capture.capturedUsd);
  if (Math.abs(capturedUsd - expectedUsd) > Math.max(0.5, expectedUsd * 0.05)) {
    throw new HttpsError(
      "aborted",
      `Captured amount ($${capturedUsd}) does not match the expected amount (~$${expectedUsd}).`
    );
  }

  return {
    status: "paid" as const,
    transactionId: capture.transactionId,
    orderId: data.orderId,
  };
}
