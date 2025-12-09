import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
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
import { db, auth } from "@/lib/firebaseConfig";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { PAYPAL_BASE_URL } from "@env";

interface PaymentMessageProps {
  item: {
    id: string;
    senderId: string;
    type: "payment";
    paymentType: "initial" | "full";
    amount: number;
    totalAmount: number;
    downpaymentPercentage?: number;
    status: "pending" | "pending_approval" | "paid" | "failed" | "cancelled";
    createdAt: any;
    recipientPayPalEmail?: string;
    paypalOrderId?: string;
    paypalApprovalUrl?: string;
    paypalCaptureId?: string;
    transactionId?: string;
    paidAt?: any;
    sentAt?: any;
    confirmedByOwner?: boolean;
    paymentId?: string;
    paypalCheckoutUrl?: string;
    usdAmount?: string;
  };
  isCurrentUser: boolean;
  isOwner: boolean;
  chatId: string;
  currentUserId: string;
  itemDetails?: {
    name?: string;
    image?: string;
  };
  clientId: string;
  clientSecret: string;
  onCancelPayment?: (messageId: string) => void;
}

// Exchange rate helper
let currentRate = 56.5;

async function fetchExchangeRate() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=PHP"
    );
    const data = await res.json();
    if (data?.rates?.PHP) {
      currentRate = data.rates.PHP;
    }
  } catch (err) {
    console.log("Error fetching rate, using fallback:", err);
  }
}

fetchExchangeRate();
setInterval(fetchExchangeRate, 30 * 60 * 1000);

const DatabaseHelper = {
  convertToUsd: (phpAmount: number) => {
    return (parseFloat(phpAmount.toString()) / currentRate).toFixed(2);
  },
  convertToPhp: (usdAmount: string | number) => {
    return (parseFloat(usdAmount.toString()) * currentRate).toFixed(2);
  },
  generateTransactionId: () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `TXN-${timestamp}-${random}`;
  },
};

// PayPal API Functions
const getPayPalAccessToken = async (clientId: string, clientSecret: string) => {
  try {
    const auth = btoa(`${clientId}:${clientSecret}`);
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();
    if (response.ok) {
      return data.access_token;
    } else {
      throw new Error(data.error_description || "Failed to get access token");
    }
  } catch (error) {
    console.log("Error getting PayPal access token:", error);
    throw error;
  }
};

const createPayPalOrder = async (
  accessToken: string,
  phpAmount: number,
  description: string
) => {
  try {
    const usdAmount = DatabaseHelper.convertToUsd(phpAmount);
    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: usdAmount,
          },
          description: description,
        },
      ],
      application_context: {
        return_url:
          "https://www.paypal.com/checkoutnow/error?paymentId=success",
        cancel_url: "https://www.paypal.com/checkoutnow/error?paymentId=cancel",
        user_action: "PAY_NOW",
      },
    };

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message || "Failed to create PayPal order");
    }
  } catch (error) {
    console.log("Error creating PayPal order:", error);
    throw error;
  }
};

const capturePayPalOrder = async (accessToken: string, orderId: string) => {
  try {
    const response = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = await response.json();
    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message || "Failed to capture PayPal payment");
    }
  } catch (error) {
    console.log("Error capturing PayPal payment:", error);
    throw error;
  }
};

const PaymentMessage: React.FC<PaymentMessageProps> = ({
  item,
  isCurrentUser,
  isOwner,
  chatId,
  currentUserId,
  itemDetails,
  clientId,
  clientSecret,
}) => {
  const [loading, setLoading] = useState(false);
  const [showPayPalWebView, setShowPayPalWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState("");

  const getPaymentTypeLabel = () => {
    if (item.paymentType === "initial") {
      const percentage = item.downpaymentPercentage || 0;
      return `Payment`;
    }
    return "Security Deposit Refund";
  };

  const getPaymentDescription = () => {
    const itemName = itemDetails?.name || "Item";
    if (item.paymentType === "initial") {
      return `Full payment for renting ${itemName}`;
    }
    return `Full payment for renting ${itemName}`;
  };

  const handleSendInvoice = async () => {
    if (!item.recipientPayPalEmail) {
      Alert.alert("Error", "Owner PayPal email not found");
      return;
    }

    try {
      setLoading(true);
      const messageRef = doc(db, "chat", chatId, "messages", item.id);
      await updateDoc(messageRef, {
        status: "pending_approval",
        sentAt: serverTimestamp(),
      });

      const chatRef = doc(db, "chat", chatId);
      await updateDoc(chatRef, {
        lastMessage: `Payment request created: ${getPaymentTypeLabel()}`,
        lastMessageTime: serverTimestamp(),
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Payment Request Created",
        textBody: "Payment request is now available for the renter",
      });
    } catch (error) {
      console.log("Payment request creation error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to create payment request. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      const newTransactionId = DatabaseHelper.generateTransactionId();
      setTransactionId(newTransactionId);

      // Get access token
      const token = await getPayPalAccessToken(clientId, clientSecret);
      setAccessToken(token);

      // Create order
      const order = await createPayPalOrder(
        token,
        item.amount,
        getPaymentDescription()
      );

      const approvalUrl = order.links.find(
        (link: any) => link.rel === "approve"
      )?.href;

      if (!approvalUrl) throw new Error("No approval URL found");

      setOrderId(order.id);
      setPaymentUrl(approvalUrl);
      setShowPayPalWebView(true);
    } catch (error) {
      console.log("Payment error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to initiate payment. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Save rental payment transaction to Firestore
  const saveRentalTransaction = async (
    captureResult: any,
    txnId: string,
    orderIdVal: string
  ) => {
    try {
      if (!auth.currentUser || !item.recipientPayPalEmail) {
        throw new Error("Missing user or recipient email");
      }

      const transactionsRef = collection(db, "transactions");
      await addDoc(transactionsRef, {
        userId: auth.currentUser.uid,
        recipientId:
          item.senderId === auth.currentUser.uid ? undefined : item.senderId,
        type: "rental_payment",
        paymentType: item.paymentType,
        amount: item.amount,
        currency: "PHP",
        paymentMethod: "PayPal",
        status: "completed",
        transactionId: txnId,
        paypalOrderId: orderIdVal,
        paypalCaptureId: captureResult.id,
        recipientPayPalEmail: item.recipientPayPalEmail,
        itemName: itemDetails?.name || "Item",
        itemId: item.id,
        chatId: chatId,
        createdAt: serverTimestamp(),
        paidAt: serverTimestamp(),
      });

      console.log("Transaction saved successfully");
    } catch (error) {
      console.log("Error saving transaction:", error);
    }
  };

  const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url } = navState;
    console.log("WebView URL:", url);

    if (url.includes("paymentId=success")) {
      setShowPayPalWebView(false);
      await capturePayment();
    } else if (url.includes("paymentId=cancel")) {
      setShowPayPalWebView(false);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Cancelled",
        textBody: "Payment was cancelled",
      });
    }
  };

  const capturePayment = async () => {
    try {
      if (!accessToken || !orderId) {
        throw new Error("Missing access token or order ID");
      }

      setLoading(true);
      const captureResult = await capturePayPalOrder(accessToken, orderId);

      if (captureResult.status === "COMPLETED") {
        // ✅ SAVE TRANSACTION TO FIRESTORE
        await saveRentalTransaction(captureResult, transactionId, orderId);
        const messageRef = doc(db, "chat", chatId, "messages", item.id);
        await updateDoc(messageRef, {
          status: "paid",
          paidAt: serverTimestamp(),
          transactionId: transactionId,
          paypalOrderId: orderId,
        });

        // ✅ UPDATE CHAT STATUS BASED ON PAYMENT TYPE
        const chatRef = doc(db, "chat", chatId);

        if (item.paymentType === "initial") {
          // ✅ If there's an initial payment, mark as initial_payment_paid
          // This allows renter to submit conditional assessment before pickup
          await updateDoc(chatRef, {
            status: "initial_payment_paid", // ✅ NEW STATUS
            initialPaymentStatus: "completed",
            lastMessage: "Initial payment confirmed",
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Full payment - move to pickedup
          await updateDoc(chatRef, {
            status: "pickedup",
            fullPaymentStatus: "completed",
            lastMessage: "Full payment confirmed",
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Payment Successful",
          textBody: "Payment completed successfully!",
        });
      }
    } catch (error) {
      console.log("Payment capture error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Payment failed. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const closeWebView = () => {
    setShowPayPalWebView(false);
  };

  const getStatusColor = () => {
    switch (item.status) {
      case "paid":
        return "#10B981";
      case "pending":
        return "#F59E0B";
      case "pending_approval":
        return "#3B82F6";
      case "cancelled":
      case "failed":
        return "#EF4444";
      default:
        return "#F59E0B";
    }
  };

  const getStatusText = () => {
    switch (item.status) {
      case "paid":
        return "Paid";
      case "pending":
        return "Pending";
      case "pending_approval":
        return "Available to Pay";
      case "cancelled":
        return "Cancelled";
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

          <Text className="text-xs text-gray-400">
            ≈ ${DatabaseHelper.convertToUsd(item.amount)} USD
          </Text>

          {/* Payment Breakdown */}
          <View className="mt-3 p-2 bg-gray-50 rounded-lg">
            <Text className="text-xs font-psemibold text-gray-700 mb-2">
              Breakdown:
            </Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs text-gray-600">Payment Amount:</Text>
              <Text className="text-xs font-pmedium text-gray-900">
                ₱{item.totalAmount.toFixed(2)}
              </Text>
            </View>
            {item.totalAmount < item.amount && (
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-600">Security Deposit:</Text>
                <Text className="text-xs font-pmedium text-gray-900">
                  ₱{(item.amount - item.totalAmount).toFixed(2)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between border-t border-gray-200 mt-2 pt-2">
              <Text className="text-xs font-psemibold text-gray-700">
                Total:
              </Text>
              <Text className="text-xs font-psemibold text-gray-900">
                ₱{item.amount.toFixed(2)}
              </Text>
            </View>
          </View>
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

        {/* Owner Actions - Pending Status */}
        {item.status === "pending" && isOwner && (
          <View className="flex-col space-y-2">
            {/* <TouchableOpacity
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
                    Creating Payment Request...
                  </Text>
                </View>
              ) : (
                <Text className="text-white font-pmedium text-center">
                  Create Payment Request
                </Text>
              )}
            </TouchableOpacity> */}
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Cancel Payment Request",
                  "Are you sure you want to cancel this payment request?",
                  [
                    { text: "No", style: "cancel" },
                    {
                      text: "Yes, Cancel",
                      style: "destructive",
                      onPress: async () => {
                        const messageRef = doc(
                          db,
                          "chat",
                          chatId,
                          "messages",
                          item.id
                        );
                        await updateDoc(messageRef, {
                          status: "cancelled",
                          cancelledAt: serverTimestamp(),
                        });
                        Toast.show({
                          type: ALERT_TYPE.SUCCESS,
                          title: "Request Cancelled",
                          textBody: "Payment request has been cancelled",
                        });
                      },
                    },
                  ]
                );
              }}
              className="rounded-xl py-2 px-4 bg-red-100 border border-red-300"
            >
              <Text className="text-red-700 font-pmedium text-center">
                Cancel Request
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Renter Actions - Pending Approval Status */}
        {item.status === "pending" && !isOwner && (
          <View className="flex-col space-y-2">
            <TouchableOpacity
              onPress={handlePayment}
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
                  Pay with PayPal
                </Text>
              )}
            </TouchableOpacity>

            {/* <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Cancel Payment",
                  "Are you sure you want to cancel this payment?",
                  [
                    { text: "No", style: "cancel" },
                    {
                      text: "Yes, Cancel",
                      style: "destructive",
                      onPress: async () => {
                        const messageRef = doc(
                          db,
                          "chat",
                          chatId,
                          "messages",
                          item.id
                        );
                        await updateDoc(messageRef, {
                          status: "cancelled",
                          cancelledAt: serverTimestamp(),
                        });
                        Toast.show({
                          type: ALERT_TYPE.SUCCESS,
                          title: "Payment Cancelled",
                          textBody: "Payment has been cancelled",
                        });
                      },
                    },
                  ]
                );
              }}
              className="rounded-xl py-2 px-4 bg-red-100 border border-red-300"
            >
              <Text className="text-red-700 font-pmedium text-center">
                Cancel Payment
              </Text>
            </TouchableOpacity> */}
          </View>
        )}

        {/* Cancelled Status */}
        {item.status === "cancelled" && (
          <View className="rounded-xl py-3 px-4 bg-gray-100">
            <Text className="text-gray-700 font-pmedium text-center">
              Payment Request Cancelled
            </Text>
          </View>
        )}

        {/* Paid Status */}
        {item.status === "paid" && (
          <View className="rounded-xl py-3 px-4 bg-green-100">
            <Text className="text-green-700 font-pmedium text-center">
              Payment Completed ✓
            </Text>
          </View>
        )}

        {/* PayPal WebView Modal */}
        <Modal visible={showPayPalWebView} animationType="slide">
          <SafeAreaView style={{ flex: 1 }}>
            <View className="flex-row justify-between items-center p-4 bg-white border-b border-gray-200">
              <View>
                <Text className="font-psemibold text-lg">Complete Payment</Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Paying to: {item.recipientPayPalEmail}
                </Text>
              </View>
              <TouchableOpacity onPress={closeWebView}>
                <Text className="text-blue-500 font-pmedium">Cancel</Text>
              </TouchableOpacity>
            </View>

            <WebView
              source={{ uri: paymentUrl }}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              startInLoadingState={true}
              renderLoading={() => (
                <View className="flex-1 justify-center items-center bg-gray-50">
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text className="text-gray-600 mt-4">Loading PayPal...</Text>
                </View>
              )}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </SafeAreaView>
        </Modal>

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

        {/* Transaction ID */}
        {(item.transactionId || item.paypalOrderId || item.paypalCaptureId) && (
          <Text className="text-xs text-gray-400 mt-1">
            ID:{" "}
            {item.transactionId || item.paypalCaptureId || item.paypalOrderId}
          </Text>
        )}

        {/* Cancel Button for Owner (only if pending) */}
        {item.status === "pending" && !isCurrentUser && isOwner && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Cancel Payment Request",
                "Are you sure you want to cancel this payment request?",
                [
                  { text: "No", style: "cancel" },
                  {
                    text: "Yes, Cancel",
                    style: "destructive",
                    onPress: async () => {
                      const messageRef = doc(
                        db,
                        "chat",
                        chatId,
                        "messages",
                        item.id
                      );
                      await updateDoc(messageRef, {
                        status: "cancelled",
                        cancelledAt: serverTimestamp(),
                      });
                      Toast.show({
                        type: ALERT_TYPE.SUCCESS,
                        title: "Request Cancelled",
                        textBody: "Payment request has been cancelled",
                      });
                    },
                  },
                ]
              );
            }}
            className="bg-red-100 rounded-lg py-2 mt-3"
          >
            <View className="flex-row items-center justify-center">
              <Image
                source={icons.close}
                className="w-4 h-4 mr-2"
                tintColor="#DC2626"
              />
              <Text className="text-red-600 font-psemibold text-sm">
                Cancel Request
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default PaymentMessage;
