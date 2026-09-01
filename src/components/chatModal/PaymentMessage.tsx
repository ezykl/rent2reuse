import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { icons, images } from "@/constant";
import { format, isToday, isYesterday } from "date-fns";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import {
  createChatPaymentOrder,
  captureChatPaymentOrder,
} from "@/utils/paypalClient";
import { estimateUsd } from "@/utils/exchangeRate";

interface PaymentMessageProps {
  item: {
    id: string;
    senderId: string;
    type: "payment";
    paymentType: "initial" | "full";
    amount: number;
    totalAmount: number;
    downpaymentPercentage?: number;
    status: "pending" | "sent" | "paid" | "failed";
    createdAt: any;
    ownerPayPalEmail?: string;
    paypalOrderId?: string;
    transactionId?: string;
    paidAt?: any;
    payoutStatus?: "success" | "failed";
    confirmedByOwner?: boolean;
  };
  // The message sender is always the item owner requesting payment (see
  // sendPaymentMessage in chat/[id].tsx) — so isCurrentUser doubles as the
  // owner/renter distinction: the renter is whoever is NOT the sender.
  isCurrentUser: boolean;
  chatId: string;
  itemDetails?: {
    name?: string;
    image?: string;
  };
}

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
  if (isToday(date)) return format(date, "MMM d, h:mm a");
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`;
  return format(date, "MMM d, h:mm a");
};

const PaymentMessage: React.FC<PaymentMessageProps> = ({
  item,
  isCurrentUser,
  chatId,
  itemDetails,
}) => {
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

  const isOwner = isCurrentUser; // the sender of a payment request is always the owner

  const getPaymentTypeLabel = () => {
    if (item.paymentType === "initial") {
      const percentage = item.downpaymentPercentage || 0;
      return `Initial Payment (${percentage}%)`;
    }
    return "Full Payment";
  };

  const getPaymentDescription = () => {
    const itemName = itemDetails?.name || "Item";
    if (item.paymentType === "initial") {
      return `Initial payment for renting ${itemName}`;
    }
    return `Full payment for renting ${itemName}`;
  };

  // Renter taps "Pay Now" — creates a PayPal Checkout order server-side (the
  // server looks up the authoritative amount itself) and opens the approval
  // WebView. The client never sees a PayPal secret and never writes the
  // resulting "paid" status itself — see functions/src/index.ts.
  const handlePayNow = async () => {
    try {
      setLoading(true);
      const order = await createChatPaymentOrder(chatId, item.id);
      if (!order.approvalUrl) {
        throw new Error("PayPal did not return an approval URL");
      }
      setPendingOrderId(order.orderId);
      setPaymentUrl(order.approvalUrl);
      setShowWebView(true);
    } catch (error) {
      if (__DEV__) console.error("Error creating PayPal order:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to start PayPal checkout. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async (orderId: string) => {
    try {
      setLoading(true);
      await captureChatPaymentOrder(chatId, item.id, orderId);
      // No client-side Firestore write here — the message re-renders once
      // the server's Admin-SDK write lands via the chat screen's onSnapshot.
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Payment Sent",
        textBody: "Your payment was completed successfully.",
      });
    } catch (error) {
      if (__DEV__) console.error("Error capturing PayPal order:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "We couldn't confirm your PayPal payment. Please try again.",
      });
    } finally {
      setLoading(false);
      setPendingOrderId(null);
    }
  };

  const handleWebViewNavigationStateChange = (navState: { url: string }) => {
    const { url } = navState;
    if (url.includes("paymentId=success")) {
      setShowWebView(false);
      if (pendingOrderId) void handleCapture(pendingOrderId);
    } else if (url.includes("paymentId=cancel")) {
      setShowWebView(false);
      setPendingOrderId(null);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Payment Cancelled",
        textBody: "You cancelled the PayPal checkout.",
      });
    }
  };

  // Manual fallback: if the automated payout to the owner ever fails or
  // lags, the owner can self-report having received the money outside the
  // app (e.g. checked their own PayPal account) until real reconciliation
  // tooling exists. This is a client write on purpose — it's a self-reported
  // safety net, not a trust-sensitive payment field (see firestore.rules).
  const handleMarkAsReceived = async () => {
    try {
      setConfirmingReceipt(true);
      const messageRef = doc(db, "chat", chatId, "messages", item.id);
      await updateDoc(messageRef, {
        confirmedByOwner: true,
        confirmedAt: serverTimestamp(),
      });
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Marked as Received",
        textBody: "Thanks for confirming.",
      });
    } catch (error) {
      if (__DEV__) console.error("Error marking payment as received:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update. Please try again.",
      });
    } finally {
      setConfirmingReceipt(false);
    }
  };

  const getStatusColor = () => {
    switch (item.status) {
      case "paid":
        return "#10B981"; // green
      case "sent":
        return "#3B82F6"; // blue
      case "failed":
        return "#EF4444"; // red
      default:
        return "#F59E0B"; // orange
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case "paid":
        return "Paid";
      case "sent":
        return "Processing";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  const payoutNeedsAttention =
    item.status === "paid" &&
    item.payoutStatus === "failed" &&
    !item.confirmedByOwner;

  return (
    <View
      className={`flex-1 mb-3 ${isCurrentUser ? "items-end" : "items-start"}`}
    >
      <View className="bg-white rounded-2xl p-4 border border-gray-200 max-w-[85%] min-w-[280px]">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Image
              source={images.paypal}
              className="w-6 h-6 mr-2"
              resizeMode="contain"
            />
            <Text className="font-psemibold text-gray-900">
              {getPaymentTypeLabel()}
            </Text>
          </View>
          <View
            className="px-2 py-1 rounded-full"
            style={{ backgroundColor: `${getStatusColor()}20` }}
          >
            <Text
              className="text-xs font-pmedium"
              style={{ color: getStatusColor() }}
            >
              {getStatusText()}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View className="mb-3">
          <Text className="text-2xl font-pbold text-gray-900">
            ₱{item.amount.toFixed(2)}
          </Text>
          <Text className="text-sm text-gray-500">
            of ₱{item.totalAmount.toFixed(2)} total
          </Text>
          <Text className="text-xs text-gray-400">
            ≈ ${estimateUsd(item.amount)} USD
          </Text>
        </View>

        {/* Payout destination, shown for transparency to both parties */}
        {item.ownerPayPalEmail && (
          <View className="mb-3 p-2 bg-blue-50 rounded-lg">
            <Text className="text-xs text-gray-600">
              Payment will be sent to:
            </Text>
            <Text className="font-pmedium text-gray-900 text-sm">
              {item.ownerPayPalEmail}
            </Text>
          </View>
        )}

        {/* Item Details */}
        {itemDetails && (
          <View className="flex-row items-center mb-3 p-2 bg-gray-50 rounded-lg">
            {itemDetails.image && (
              <Image
                source={{ uri: itemDetails.image }}
                className="w-10 h-10 rounded-lg mr-3"
              />
            )}
            <View className="flex-1">
              <Text className="font-pmedium text-gray-900">
                {itemDetails.name}
              </Text>
              <Text className="text-sm text-gray-500">
                {getPaymentDescription()}
              </Text>
            </View>
          </View>
        )}

        {/* Action area */}
        {item.status === "pending" && !isOwner && (
          <TouchableOpacity
            onPress={handlePayNow}
            disabled={loading}
            className={`rounded-xl py-3 px-4 ${
              loading ? "bg-blue-300" : "bg-blue-500"
            }`}
          >
            {loading ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-pmedium ml-2">
                  Processing...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-pmedium text-center">
                Pay Now
              </Text>
            )}
          </TouchableOpacity>
        )}

        {item.status === "pending" && isOwner && (
          <View className="rounded-xl py-3 px-4 bg-orange-50">
            <Text className="text-orange-700 font-pmedium text-center">
              Waiting for renter to pay
            </Text>
          </View>
        )}

        {item.status === "paid" && (
          <View>
            <View className="rounded-xl py-3 px-4 bg-green-100">
              <Text className="text-green-700 font-pmedium text-center">
                Payment Completed ✓
              </Text>
            </View>

            {item.payoutStatus === "success" && (
              <Text className="text-xs text-green-600 text-center mt-2">
                Sent to the owner's PayPal account
              </Text>
            )}

            {payoutNeedsAttention && isOwner && (
              <View className="mt-2">
                <Text className="text-xs text-red-500 text-center mb-2">
                  Automatic payout to your PayPal account failed. If you've
                  already received the money another way, you can confirm it
                  below.
                </Text>
                <TouchableOpacity
                  onPress={handleMarkAsReceived}
                  disabled={confirmingReceipt}
                  className={`rounded-xl py-2 px-4 ${
                    confirmingReceipt ? "bg-gray-300" : "bg-gray-800"
                  }`}
                >
                  {confirmingReceipt ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-pmedium text-center text-sm">
                      Mark as Received
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {payoutNeedsAttention && !isOwner && (
              <Text className="text-xs text-gray-500 text-center mt-2">
                Your payment succeeded — the payout to the owner is being
                retried.
              </Text>
            )}

            {item.confirmedByOwner && (
              <Text className="text-xs text-green-600 text-center mt-2">
                Owner confirmed receipt
              </Text>
            )}
          </View>
        )}

        {item.status === "failed" && (
          <View className="rounded-xl py-3 px-4 bg-red-100">
            <Text className="text-red-700 font-pmedium text-center">
              Payment Failed
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <Text className="text-xs text-gray-400">
            {formatTimestamp(item.createdAt)}
          </Text>
          {item.paidAt && (
            <Text className="text-xs text-green-600">
              Paid {formatTimestamp(item.paidAt)}
            </Text>
          )}
        </View>

        {/* Transaction ID */}
        {item.transactionId && (
          <Text className="text-xs text-gray-400 mt-1">
            ID: {item.transactionId}
          </Text>
        )}
      </View>

      {/* PayPal approval WebView */}
      <Modal
        visible={showWebView}
        animationType="none"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <View className="flex-1 bg-gray-50 mt-8">
          <View className="bg-white border-b border-gray-200 px-6 py-4">
            <View className="flex-row items-center justify-end">
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                onPress={() => {
                  setShowWebView(false);
                  setPendingOrderId(null);
                }}
              >
                <Text className="text-gray-600 font-bold">✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            startInLoadingState
            renderLoading={() => (
              <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="text-gray-600 mt-4">Loading PayPal...</Text>
              </View>
            )}
            className="flex-1"
            onError={(syntheticEvent) => {
              if (__DEV__)
                console.warn("WebView error:", syntheticEvent.nativeEvent);
            }}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>
      </Modal>
    </View>
  );
};

export default PaymentMessage;
