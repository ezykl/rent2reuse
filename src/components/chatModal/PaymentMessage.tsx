import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
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
  createPayPalOrder, // CHANGE: from createPayPalInvoice
  getPayPalOrderApprovalUrl, // ADD: new function
  capturePayPalOrder, // ADD: new function
  getPayPalOrderStatus, // CHANGE: from getPayPalInvoiceStatus
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  DatabaseHelper,
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
    status: "pending" | "pending_approval" | "paid" | "failed"; // REMOVE "sent"
    createdAt: any;
    recipientPayPalEmail?: string;
    paypalOrderId?: string; // ADD: replace paypalInvoiceId
    paypalApprovalUrl?: string; // ADD: new field
    paypalCaptureId?: string; // ADD: new field
    transactionId?: string;
    paidAt?: any;
    sentAt?: any;
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

const PaymentMessage: React.FC<PaymentMessageProps> = ({
  item,
  isCurrentUser,
  isOwner,
  chatId,
  currentUserId,
  itemDetails,
}) => {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Add this useEffect to auto-check payment status periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Only auto-check if status is pending_approval and user is the owner
    if (item.status === "pending_approval" && isCurrentUser) {
      interval = setInterval(async () => {
        try {
          if (item.paypalOrderId) {
            const token = await getPayPalAccessToken(
              PAYPAL_CLIENT_ID,
              PAYPAL_CLIENT_SECRET
            );
            const orderStatus = await getPayPalOrderStatus(
              token,
              item.paypalOrderId
            );

            if (orderStatus.status === "APPROVED") {
              // Auto-capture the payment
              const captureResult = await capturePayPalOrder(
                token,
                item.paypalOrderId
              );

              if (captureResult.status === "COMPLETED") {
                const messageRef = doc(db, "chat", chatId, "messages", item.id);
                await updateDoc(messageRef, {
                  status: "paid",
                  paidAt: serverTimestamp(),
                  paypalCaptureId: captureResult.id,
                });
              }
            }
          }
        } catch (error) {
          console.error("Auto-check payment error:", error);
        }
      }, 30000); // Check every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [item.status, item.paypalOrderId, isCurrentUser]);

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

  // Send PayPal Invoice
  const handleSendInvoice = async () => {
    if (!item.recipientPayPalEmail) {
      Alert.alert("Error", "Owner PayPal email not found");
      return;
    }

    try {
      setLoading(true);

      // Get PayPal access token
      const token = await getPayPalAccessToken(
        PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET
      );

      // Create PayPal order (not invoice)
      const order = await createPayPalOrder(
        token,
        item.amount,
        item.recipientPayPalEmail, // Owner's email as payee
        {
          itemName: getPaymentTypeLabel(),
          itemDescription: getPaymentDescription(),
          customId: `CHAT_${chatId}_MSG_${item.id}`,
          note: `Payment request from Rent2Reuse for ${
            itemDetails?.name || "rental item"
          }`,
        }
      );

      if (order.status === "CREATED") {
        // Get approval URL
        const approvalUrl = getPayPalOrderApprovalUrl(order);

        if (approvalUrl) {
          // Update the message with order ID and approval URL
          const messageRef = doc(db, "chat", chatId, "messages", item.id);
          await updateDoc(messageRef, {
            status: "pending_approval",
            paypalOrderId: order.id,
            paypalApprovalUrl: approvalUrl,
            sentAt: serverTimestamp(),
          });

          // Update chat last message
          const chatRef = doc(db, "chat", chatId);
          await updateDoc(chatRef, {
            lastMessage: `Payment order created: ${getPaymentTypeLabel()}`,
            lastMessageTime: serverTimestamp(),
          });

          // Add a system message
          const messagesRef = collection(db, "chat", chatId, "messages");
          await addDoc(messagesRef, {
            type: "statusUpdate",
            text: `Payment order created for ${getPaymentTypeLabel()}`,
            senderId: currentUserId,
            createdAt: serverTimestamp(),
            read: false,
            status: "pending_approval",
          });

          // Open PayPal checkout
          await Linking.openURL(approvalUrl);

          Toast.show({
            type: ALERT_TYPE.SUCCESS,
            title: "Payment Order Created",
            textBody: "Redirecting to PayPal for payment...",
          });
        }
      }
    } catch (error) {
      console.error("Order creation error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to create payment order. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check payment status from PayPal
  const handleCheckPaymentStatus = async () => {
    if (!item.paypalOrderId) {
      Alert.alert("Error", "No order ID found");
      return;
    }

    try {
      setCheckingStatus(true);

      const token = await getPayPalAccessToken(
        PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET
      );

      const orderStatus = await getPayPalOrderStatus(token, item.paypalOrderId);

      if (orderStatus.status === "APPROVED") {
        const captureResult = await capturePayPalOrder(
          token,
          item.paypalOrderId
        );

        if (captureResult.status === "COMPLETED") {
          const messageRef = doc(db, "chat", chatId, "messages", item.id);
          await updateDoc(messageRef, {
            status: "paid",
            paidAt: serverTimestamp(),
            paypalCaptureId: captureResult.id,
          });

          Toast.show({
            type: ALERT_TYPE.SUCCESS,
            title: "Payment Completed",
            textBody: "Payment has been captured successfully!",
          });
        }
      } else {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Payment Pending",
          textBody: `Payment status: ${orderStatus.status}`,
        });
      }
    } catch (error) {
      console.error("Status check error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to check payment status",
      });
    } finally {
      setCheckingStatus(false);
    }
  };
  const getStatusColor = () => {
    switch (item.status) {
      case "paid":
        return "#10B981"; // green
      case "pending_approval":
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
      case "pending_approval":
        return "Awaiting Payment";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };
  return (
    <View className={`flex-1 mb-3 ${isOwner ? "pl-24" : "pr-24"}`}>
      <View className="bg-white rounded-2xl p-4 border border-gray-200 flex-1">
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
            ≈ ${DatabaseHelper.convertToUsd(item.amount)} USD
          </Text>
        </View>

        {/* Recipient Email */}
        {item.recipientPayPalEmail && (
          <View className="mb-3 p-2 bg-blue-50 rounded-lg">
            <Text className="text-xs text-gray-600">PayPal Recipient:</Text>
            <Text className="font-pmedium text-gray-900 text-sm">
              {item.recipientPayPalEmail}
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

        {/* Action Buttons */}
        {item.status === "pending" && isCurrentUser && (
          <TouchableOpacity
            onPress={handleSendInvoice}
            disabled={loading}
            className={`rounded-xl py-3 px-4 ${
              loading ? "bg-blue-300" : "bg-blue-500"
            }`}
          >
            {loading ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-pmedium ml-2">
                  Creating Payment Order...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-pmedium text-center">
                Create Payment Request
              </Text>
            )}
          </TouchableOpacity>
        )}

        {item.status === "pending" && !isOwner && (
          <TouchableOpacity
            onPress={async () => {
              if (item.paypalApprovalUrl) {
                await Linking.openURL(item.paypalApprovalUrl);
              } else {
                Alert.alert("Error", "Payment link not available");
              }
            }}
            className="rounded-xl py-3 px-4 bg-blue-500"
          >
            <Text className="text-white font-pmedium text-center">
              Pay with PayPal
            </Text>
          </TouchableOpacity>
        )}

        {item.status === "pending_approval" && isCurrentUser && (
          <TouchableOpacity
            onPress={handleCheckPaymentStatus}
            disabled={checkingStatus}
            className={`rounded-xl py-3 px-4 ${
              checkingStatus ? "bg-green-300" : "bg-green-500"
            }`}
          >
            <Text className="text-white font-pmedium text-center">
              Check Payment Status
            </Text>
          </TouchableOpacity>
        )}

        {item.status === "paid" && (
          <View className="rounded-xl py-3 px-4 bg-green-100">
            <Text className="text-green-700 font-pmedium text-center">
              Payment Completed ✓
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <Text className="text-xs text-gray-400">
            {item.createdAt
              ? format(item.createdAt.toDate(), "MMM d, h:mm a")
              : ""}
          </Text>
          {item.sentAt && (
            <Text className="text-xs text-blue-600">
              Sent {format(item.sentAt.toDate(), "MMM d, h:mm a")}
            </Text>
          )}
          {item.paidAt && (
            <Text className="text-xs text-green-600">
              Paid {format(item.paidAt.toDate(), "MMM d, h:mm a")}
            </Text>
          )}
        </View>

        {/* Transaction/Order ID */}
        {(item.transactionId || item.paypalOrderId || item.paypalCaptureId) && (
          <Text className="text-xs text-gray-400 mt-1">
            ID:{" "}
            {item.transactionId || item.paypalCaptureId || item.paypalOrderId}
          </Text>
        )}
      </View>
    </View>
  );
};

export default PaymentMessage;
