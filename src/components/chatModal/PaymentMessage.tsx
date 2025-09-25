import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
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
  createPayPalInvoice,
  sendPayPalInvoice,
  getPayPalInvoiceStatus,
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
    status: "pending" | "sent" | "paid" | "failed";
    createdAt: any;
    recipientPayPalEmail?: string;
    paypalInvoiceId?: string;
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
      Alert.alert("Error", "Recipient PayPal email not found");
      return;
    }

    try {
      setLoading(true);

      // Get PayPal access token
      const token = await getPayPalAccessToken(
        PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET
      );

      // Create PayPal invoice
      const invoice = await createPayPalInvoice(
        token,
        item.recipientPayPalEmail,
        item.amount,
        {
          itemName: getPaymentTypeLabel(),
          itemDescription: getPaymentDescription(),
          customId: `CHAT_${chatId}_MSG_${item.id}`,
          note: `Payment request from Rent2Reuse for ${
            itemDetails?.name || "rental item"
          }`,
        }
      );

      // Send the invoice
      await sendPayPalInvoice(
        token,
        invoice.id,
        `Payment Request: ${getPaymentTypeLabel()}`,
        `Hi! You have a payment request for ${getPaymentTypeLabel()} of ₱${item.amount.toFixed(
          2
        )} for ${
          itemDetails?.name || "your rental"
        }. Please complete this payment at your convenience.`
      );

      // Update the message in Firestore
      const messageRef = doc(db, "chat", chatId, "messages", item.id);
      await updateDoc(messageRef, {
        status: "sent",
        paypalInvoiceId: invoice.id,
        sentAt: serverTimestamp(),
      });

      // Update chat last message
      const chatRef = doc(db, "chat", chatId);
      await updateDoc(chatRef, {
        lastMessage: `PayPal invoice sent: ${getPaymentTypeLabel()}`,
        lastMessageTime: serverTimestamp(),
      });

      // Add a system message about invoice sent
      const messagesRef = collection(db, "chat", chatId, "messages");
      await addDoc(messagesRef, {
        type: "statusUpdate",
        text: `PayPal invoice sent to ${item.recipientPayPalEmail}`,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "sent",
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Invoice Sent",
        textBody: `PayPal invoice sent to ${item.recipientPayPalEmail}`,
      });
    } catch (error) {
      console.error("Invoice sending error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to send PayPal invoice. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check payment status from PayPal
  const handleCheckPaymentStatus = async () => {
    if (!item.paypalInvoiceId) {
      Alert.alert("Error", "No invoice ID found");
      return;
    }

    try {
      setCheckingStatus(true);

      const token = await getPayPalAccessToken(
        PAYPAL_CLIENT_ID,
        PAYPAL_CLIENT_SECRET
      );

      const invoiceStatus = await getPayPalInvoiceStatus(
        token,
        item.paypalInvoiceId
      );

      // Update message status based on PayPal response
      let newStatus = item.status;
      if (
        invoiceStatus.status === "PAID" ||
        invoiceStatus.status === "MARKED_AS_PAID"
      ) {
        newStatus = "paid";

        // Update the message
        const messageRef = doc(db, "chat", chatId, "messages", item.id);
        await updateDoc(messageRef, {
          status: "paid",
          paidAt: serverTimestamp(),
          transactionId: invoiceStatus.id,
        });

        // Add status message
        const messagesRef = collection(db, "chat", chatId, "messages");
        await addDoc(messagesRef, {
          type: "statusUpdate",
          text: `${getPaymentTypeLabel()} completed via PayPal`,
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          read: false,
          status: "paid",
        });

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Payment Received",
          textBody: "Payment has been completed!",
        });
      } else {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Payment Pending",
          textBody: `Payment status: ${invoiceStatus.status}`,
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
        return "Invoice Sent";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  };

  return (
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
                  Sending Invoice...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-pmedium text-center">
                Send PayPal Invoice
              </Text>
            )}
          </TouchableOpacity>
        )}

        {item.status === "sent" && isCurrentUser && (
          <TouchableOpacity
            onPress={handleCheckPaymentStatus}
            disabled={checkingStatus}
            className={`rounded-xl py-3 px-4 ${
              checkingStatus ? "bg-green-300" : "bg-green-500"
            }`}
          >
            {checkingStatus ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-pmedium ml-2">
                  Checking Status...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-pmedium text-center">
                Check Payment Status
              </Text>
            )}
          </TouchableOpacity>
        )}

        {item.status === "sent" && !isCurrentUser && (
          <View className="rounded-xl py-3 px-4 bg-blue-100">
            <Text className="text-blue-700 font-pmedium text-center">
              Invoice sent to your PayPal email
            </Text>
          </View>
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

        {/* Transaction/Invoice ID */}
        {(item.transactionId || item.paypalInvoiceId) && (
          <Text className="text-xs text-gray-400 mt-1">
            ID: {item.transactionId || item.paypalInvoiceId}
          </Text>
        )}
      </View>
    </View>
  );
};

export default PaymentMessage;
