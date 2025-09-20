import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { icons, images } from "@/constant";
import { format } from "date-fns";
import {
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import {
  getPayPalAccessToken,
  createPayPalOrder,
  capturePayPalOrder,
} from "@/utils/paypalHelper";

interface PaymentMessageProps {
  item: {
    id: string;
    senderId: string;
    type: "payment";
    paymentType: "initial" | "full";
    amount: number;
    totalAmount: number;
    downpaymentPercentage?: number;
    status: "pending" | "paid" | "failed";
    createdAt: any;
    paypalOrderId?: string;
    transactionId?: string;
    paidAt?: any;
    confirmedByOwner?: boolean;
  };
  isCurrentUser: boolean;
  isOwner: boolean;
  chatId: string;
  currentUserId: string;
  itemDetails?: {
    name?: string;
    image?: string;
  };
}

// PayPal Configuration - You should move these to environment variables
const PAYPAL_CLIENT_ID = "YOUR_PAYPAL_CLIENT_ID";
const PAYPAL_CLIENT_SECRET = "YOUR_PAYPAL_CLIENT_SECRET";
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use production URL for live

const PaymentMessage: React.FC<PaymentMessageProps> = ({
  item,
  isCurrentUser,
  isOwner,
  chatId,
  currentUserId,
  itemDetails,
}) => {
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

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

  const handlePayment = async () => {
    if (isOwner) {
      Alert.alert("Info", "You cannot pay for your own item");
      return;
    }

    if (item.status === "paid") {
      Alert.alert("Info", "This payment has already been completed");
      return;
    }

    try {
      setLoading(true);

      // Get PayPal access token
      const token = await getPayPalAccessToken(
        PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET
      );
      setAccessToken(token);

      // Create PayPal order
      const order = await createPayPalOrder(token, item.amount, "USD", {
        description: getPaymentDescription(),
        customId: `CHAT_${chatId}_MSG_${item.id}`,
        invoiceId: `INV_${item.id}_${Date.now()}`,
      });

      const approvalUrl = order.links.find(
        (link: any) => link.rel === "approve"
      )?.href;

      if (!approvalUrl) {
        throw new Error("No approval URL found");
      }

      setOrderId(order.id);
      setPaymentUrl(approvalUrl);
      setShowWebView(true);
    } catch (error) {
      console.error("Payment error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Payment Error",
        textBody: "Failed to initialize payment. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url } = navState;
    console.log("WebView URL:", url);

    // Check if payment was successful
    if (url.includes("paymentId=success")) {
      setShowWebView(false);
      await capturePayment();
    }
    // Check if payment was cancelled
    else if (url.includes("paymentId=cancel")) {
      setShowWebView(false);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Payment Cancelled",
        textBody: "Payment was cancelled by user",
      });
    }
  };

  const capturePayment = async () => {
    try {
      if (!accessToken || !orderId) {
        throw new Error("Missing access token or order ID");
      }

      setLoading(true);

      // Capture the PayPal payment
      const captureResult = await capturePayPalOrder(accessToken, orderId);

      if (captureResult.status === "COMPLETED") {
        // Update the payment message in Firestore
        const messageRef = doc(db, "chat", chatId, "messages", item.id);
        await updateDoc(messageRef, {
          status: "paid",
          paypalOrderId: orderId,
          transactionId:
            captureResult.purchase_units[0]?.payments?.captures[0]?.id,
          paidAt: serverTimestamp(),
        });

        // Update chat last message
        const chatRef = doc(db, "chat", chatId);
        await updateDoc(chatRef, {
          lastMessage: `Payment completed: ${getPaymentTypeLabel()}`,
          lastMessageTime: serverTimestamp(),
        });

        // Add a system message about successful payment
        const messagesRef = collection(db, "chat", chatId, "messages");
        await addDoc(messagesRef, {
          type: "statusUpdate",
          text: `${getPaymentTypeLabel()} completed successfully`,
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          read: false,
          status: "paid",
        });

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Payment Successful",
          textBody: "Payment has been completed successfully",
        });
      }
    } catch (error) {
      console.error("Payment capture error:", error);

      // Update payment status to failed
      try {
        const messageRef = doc(db, "chat", chatId, "messages", item.id);
        await updateDoc(messageRef, {
          status: "failed",
          failedAt: serverTimestamp(),
        });
      } catch (updateError) {
        console.error("Failed to update payment status:", updateError);
      }

      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Payment Failed",
        textBody: "Payment could not be completed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerConfirm = async () => {
    if (!isOwner) return;

    Alert.alert(
      "Confirm Payment",
      "Confirm that you have received this payment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const messageRef = doc(db, "chat", chatId, "messages", item.id);
              await updateDoc(messageRef, {
                status: "paid",
                confirmedByOwner: true,
                confirmedAt: serverTimestamp(),
              });

              // Add system message
              const messagesRef = collection(db, "chat", chatId, "messages");
              await addDoc(messagesRef, {
                type: "statusUpdate",
                text: `${getPaymentTypeLabel()} confirmed by owner`,
                senderId: currentUserId,
                createdAt: serverTimestamp(),
                read: false,
                status: "confirmed",
              });

              Toast.show({
                type: ALERT_TYPE.SUCCESS,
                title: "Payment Confirmed",
                textBody: "Payment has been confirmed",
              });
            } catch (error) {
              console.error("Error confirming payment:", error);
              Toast.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: "Failed to confirm payment",
              });
            }
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (item.status) {
      case "paid":
        return "#10B981"; // green
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
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  return (
    <>
      <View className="flex-row justify-center mb-3">
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
          </View>

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

          {/* Action Button */}
          {item.status === "pending" && (
            <TouchableOpacity
              onPress={isOwner ? undefined : handlePayment}
              disabled={loading || isOwner}
              className={`rounded-xl py-3 px-4 ${
                isOwner
                  ? "bg-gray-100"
                  : loading
                  ? "bg-blue-300"
                  : "bg-blue-500"
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
                <Text
                  className={`text-center font-pmedium ${
                    isOwner ? "text-gray-500" : "text-white"
                  }`}
                >
                  {isOwner ? "Waiting for payment" : "Pay Now"}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Owner Confirm Button (only if paid and owner) */}
          {item.status === "paid" && isOwner && !item.confirmedByOwner && (
            <TouchableOpacity
              onPress={handleOwnerConfirm}
              className="rounded-xl py-3 px-4 bg-green-500 mt-2"
            >
              <Text className="text-white font-pmedium text-center">
                Confirm Payment Received
              </Text>
            </TouchableOpacity>
          )}

          {/* Timestamp */}
          <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <Text className="text-xs text-gray-400">
              {item.createdAt
                ? format(item.createdAt.toDate(), "MMM d, h:mm a")
                : ""}
            </Text>
            {item.paidAt && (
              <Text className="text-xs text-green-600">
                Paid {format(item.paidAt.toDate(), "MMM d, h:mm a")}
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
      </View>

      {/* PayPal WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="bg-white border-b border-gray-200 px-4 py-3 pt-12">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-psemibold">Complete Payment</Text>
              <TouchableOpacity
                onPress={() => setShowWebView(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Image source={icons.close} className="w-4 h-4" />
              </TouchableOpacity>
            </View>
          </View>

          <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#0070f3" />
                <Text className="mt-4 text-gray-600">Loading PayPal...</Text>
              </View>
            )}
            className="flex-1"
          />
        </View>
      </Modal>
    </>
  );
};

export default PaymentMessage;
