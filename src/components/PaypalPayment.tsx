// PayPal API service functions
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use sandbox URL

// Database helper functions (prepare for integration)
const DatabaseHelper = {
  // Save transaction to database
  saveTransaction: async (transactionData: TransactionData) => {
    try {
      // Replace with your actual database API endpoint
      const response = await fetch("YOUR_API_ENDPOINT/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionData),
      });
      return await response.json();
    } catch (error) {
      console.error("Database save error:", error);
      throw error;
    }
  },

  // Generate transaction ID
  generateTransactionId: () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `TXN-${timestamp}-${random}`;
  },

  // Convert USD to PHP (you can update exchange rate dynamically)
  convertToPhp: (usdAmount: string | number, exchangeRate = 56.5) => {
    return (parseFloat(usdAmount.toString()) * exchangeRate).toFixed(2);
  },

  // Convert PHP to USD
  convertToUsd: (phpAmount: number, exchangeRate = 56.5) => {
    return (parseFloat(phpAmount.toString()) / exchangeRate).toFixed(2);
  },
};

// Replace the getGradientColors function with getPlanColor
const getPlanColor = (planType: string): string => {
  const colors = {
    free: "#CD7F32", // Bronze
    basic: "#737373", // Silver
    premium: "#eda705", // Gold
    platinum: "#21AEE6", // Platinum/Violet
  };

  const normalizedType = planType?.toLowerCase() || "free";
  return colors[normalizedType as keyof typeof colors] || colors.free;
};

// Function to get access token
export const getPayPalAccessToken = async (
  clientId: string,
  clientSecret: string
) => {
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
    console.error("Error getting PayPal access token:", error);
    throw error;
  }
};

// Function to create payment order
export const createPayPalOrder = async (
  accessToken: string,
  phpAmount: number, // This is now PHP amount
  currency = "USD",
  orderDetails?: {
    description?: string;
    customId?: string;
    invoiceId?: string;
  }
) => {
  try {
    // Convert PHP to USD for PayPal
    const usdAmount = DatabaseHelper.convertToUsd(phpAmount);

    const orderData = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD", // Always USD for PayPal
            value: usdAmount,
          },
          description: orderDetails?.description || "Plan Subscription Payment",
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
    console.error("Error creating PayPal order:", error);
    throw error;
  }
};

// Function to capture payment after approval
export const capturePayPalOrder = async (
  accessToken: string,
  orderId: string
) => {
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
    console.error("Error capturing PayPal payment:", error);
    throw error;
  }
};

// Enhanced PayPal Payment Component
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Image,
  Dimensions,
  ScrollView,
  Alert, // Add this import
} from "react-native";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { icons, images } from "@/constant";
import * as FileSystem from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { TransactionData } from "../types/api";
import { User, Plan, PaymentTransaction, PayPalPaymentResult } from "@/types";

const { width, height } = Dimensions.get("window");

interface PayPalPaymentProps {
  plan: {
    id: string;
    planType: string; // Required
    price: number;
    duration: string; // Required
    list: number;
    rent: number;
  };
  clientId: string;
  clientSecret: string;
  onPaymentSuccess: (result: any) => void;
  onPaymentError: (error: any) => void;
  onPaymentCancel: () => void;
}

const PayPalPayment: React.FC<PayPalPaymentProps> = ({
  plan,
  clientId,
  clientSecret,
  onPaymentSuccess,
  onPaymentError,
  onPaymentCancel,
}) => {
  // Validate required fields
  useEffect(() => {
    if (!plan?.planType || !plan?.duration) {
      console.error("Missing required plan fields:", plan);
    }
  }, [plan]);

  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultType, setResultType] = useState(""); // 'success' or 'cancel' or 'error'
  const [paymentUrl, setPaymentUrl] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [isSaving, setIsSaving] = useState(false); // <-- Added state for saving

  interface TransactionDetails {
    transactionId: string;
    paypalOrderId: string;
    planId: string;
    planType: string;
    amount: number;
    currency: string;
    phpAmount: string;
    status: string;
    paypalTransactionId?: string;
    timestamp: string;
    planDetails: {
      duration: string;
      listLimit: number;
      rentLimit: number;
    };
  }

  const [transactionDetails, setTransactionDetails] =
    useState<TransactionData | null>(null);

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  const getDurationInMs = (duration: string | undefined): number => {
    if (!duration) {
      console.warn("Duration is undefined");
      return 0;
    }

    const DURATION_MAP = {
      monthly: 2592000000, // 30 days
      quarterly: 7776000000, // 90 days
      "semi-annual": 15552000000, // 180 days
      annual: 31536000000, // 365 days
    } as const;

    try {
      const normalizedDuration = duration.toLowerCase().trim();
      return DURATION_MAP[normalizedDuration as keyof typeof DURATION_MAP] || 0;
    } catch (error) {
      console.error(
        "Error parsing duration:",
        error,
        "Duration value:",
        duration
      );
      return 0;
    }
  };

  useEffect(() => {
    if (showResultModal) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
    }
  }, [showResultModal]);

  const orderDetails = {
    description: `${plan.planType} Plan Subscription`,
    customId: `PLAN_${plan.id}_${Date.now()}`,
    invoiceId: `INV_${Date.now()}`,
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      const newTransactionId = DatabaseHelper.generateTransactionId();
      setTransactionId(newTransactionId);

      // Get access token
      const token = await getPayPalAccessToken(clientId, clientSecret);
      setAccessToken(token);

      // Create order with plan details
      const order = await createPayPalOrder(token, plan.price, "USD", {
        description: orderDetails.description,
        customId: orderDetails.customId,
        invoiceId: orderDetails.invoiceId,
      });

      interface PayPalOrderLink {
        href: string;
        rel: string;
        method: string;
      }

      const approvalUrl = order.links.find(
        (link: PayPalOrderLink) => link.rel === "approve"
      )?.href;
      if (!approvalUrl) throw new Error("No approval URL found");

      setOrderId(order.id);
      setPaymentUrl(approvalUrl);
      setShowWebView(true);
    } catch (error) {
      console.error("Payment error:", error);
      onPaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  interface WebViewNavigationState {
    url: string;
    loading?: boolean;
    title?: string;
    canGoBack?: boolean;
    canGoForward?: boolean;
  }

  const handleWebViewNavigationStateChange = async (
    navState: WebViewNavigationState
  ): Promise<void> => {
    const { url } = navState;
    console.log("WebView URL:", url);

    // Check if user completed payment (success)
    if (url.includes("paymentId=success")) {
      console.log("Payment success detected!");
      setShowWebView(false);
      await capturePayment();
    }
    // Check if user cancelled payment
    else if (url.includes("paymentId=cancel")) {
      console.log("Payment cancel detected!");
      setShowWebView(false);
      setResultType("cancel");
      setShowResultModal(true);
      if (onPaymentCancel) {
        onPaymentCancel();
      }
    }
    // Alternative: Check for PayPal success patterns
    else if (
      url.includes("paypal.com") &&
      (url.includes("success") || url.includes("approved"))
    ) {
      console.log("PayPal success pattern detected!");
      setShowWebView(false);
      await capturePayment();
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
        const transactionData: TransactionData = {
          transactionId,
          paypalOrderId: orderId,
          planId: plan.id,
          planType: plan.planType,
          amount: plan.price,
          currency: "PHP" as const,
          phpAmount: DatabaseHelper.convertToPhp(plan.price),
          status: "completed",
          paypalTransactionId:
            captureResult.purchase_units[0]?.payments?.captures[0]?.id,
          timestamp: new Date().toISOString(),
          planDetails: {
            duration: plan.duration,
            listLimit: plan.list,
            rentLimit: plan.rent,
          },
        };

        setTransactionDetails(transactionData);
        setResultType("success");
        setShowResultModal(true);
        onPaymentSuccess({
          ...captureResult,
          customTransactionId: transactionId,
          planDetails: plan,
        });
      }
    } catch (error) {
      console.error("Payment capture error:", error);
      onPaymentError(error);
    } finally {
      setLoading(false);
    }
  };

  const closeWebView = () => {
    setShowWebView(false);
    setResultType("cancel");
    setShowResultModal(true);
    if (onPaymentCancel) {
      onPaymentCancel();
    }
  };

  const closeResultModal = () => {
    setShowResultModal(false);
    setTransactionDetails(null);
  };

  const ResultModal = () => {
    const receiptRef = useRef<View>(null);

    const saveReceipt = async () => {
      try {
        // Request permissions first
        const permissions =
          await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert(
            "Permission Required",
            "Storage permission is needed to save receipt"
          );
          return;
        }

        // Capture receipt view as image
        const uri = await captureRef(receiptRef, {
          format: "png",
          quality: 1,
        });

        // Save to downloads directory
        const filename = `receipt-${transactionId}.png`;
        const downloadPath = `${FileSystem.documentDirectory}receipts/`;

        await FileSystem.makeDirectoryAsync(downloadPath, {
          intermediates: true,
        });
        await FileSystem.copyAsync({
          from: uri,
          to: `${downloadPath}${filename}`,
        });

        Alert.alert("Success", "Receipt saved successfully!");
      } catch (error) {
        console.error("Error saving receipt:", error);
        Alert.alert("Error", "Failed to save receipt");
      }
    };

    return (
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          /* Don't close on back press */
        }}
      >
        {/* Modal Content */}
        <View className="flex-1 bg-black/60 justify-center items-center p-2">
          <Animated.View
            ref={receiptRef}
            className="bg-white rounded-3xl w-full max-w-[90%] max-h-[80%] shadow-lg"
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            }}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              className="p-2"
              contentContainerStyle={{
                alignItems: "center",
                paddingBottom: 20,
              }}
            >
              {/* Status Icon */}
              <Image
                source={images.logo} // Make sure you have the logo in your images constant
                style={{ width: 120, height: 40 }}
                resizeMode="contain"
                className="mb-5"
              />

              <View
                className={`w-20 h-20 rounded-full justify-center items-center mb-5 ${
                  resultType === "success"
                    ? "bg-green-500"
                    : resultType === "cancel"
                    ? "bg-orange-500"
                    : "bg-red-500"
                }`}
              >
                <Text className="text-white text-4xl font-bold">
                  {resultType === "success"
                    ? "✓"
                    : resultType === "cancel"
                    ? "!"
                    : "✕"}
                </Text>
              </View>

              {/* Amount Container */}
              <View className="w-full bg-gray-50 p-5 rounded-2xl mb-5 items-center">
                <Text className="text-gray-600 text-sm mb-2">Amount Paid</Text>
                <View className="items-center">
                  <Text className="text-gray-900 text-2xl font-bold">
                    ₱{plan.price.toFixed(2)} PHP
                  </Text>
                  <Text className="text-gray-600 text-base ">
                    ≈ ${DatabaseHelper.convertToUsd(plan.price)} USD
                  </Text>
                </View>
              </View>

              {/* Transaction Details */}
              {resultType === "success" && transactionDetails && (
                <View className="w-full bg-gray-50 p-5 rounded-2xl mb-5">
                  <Text className="text-gray-900 text-lg font-bold text-center mb-4">
                    Transaction Details
                  </Text>

                  <View className="flex-row justify-between py-2 border-b border-gray-200">
                    <Text className="text-gray-600 flex-1">
                      Transaction ID:
                    </Text>
                    <Text className="text-gray-900 font-semibold flex-1 text-right">
                      {transactionId}
                    </Text>
                  </View>

                  <View className="flex-row justify-between py-2 border-b border-gray-200">
                    <Text className="text-gray-600 flex-1">
                      PayPal Order ID:
                    </Text>
                    <Text className="text-gray-900 font-semibold flex-1 text-right">
                      {orderId}
                    </Text>
                  </View>
                  {transactionDetails.paypalTransactionId && (
                    <View className="flex-row justify-between py-2 border-b border-gray-200">
                      <Text className="text-gray-600 flex-1">
                        PayPal Transaction ID:
                      </Text>
                      <Text className="text-gray-900 font-semibold flex-1 text-right">
                        {transactionDetails.paypalTransactionId}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between py-2 border-b border-gray-200">
                    <Text className="text-gray-600 flex-1">Exchange Rate:</Text>
                    <Text className="text-gray-900 font-semibold flex-1 text-right">
                      1 USD = ₱
                      {plan.price / parseFloat(DatabaseHelper.convertToPhp(1))}
                      {"\n"}
                      PHP
                    </Text>
                  </View>
                  <View className="flex-row justify-between py-2">
                    <Text className="text-gray-600 flex-1">Status:</Text>
                    <Text className="text-gray-900 font-semibold flex-1 text-right">
                      Completed
                    </Text>
                  </View>
                </View>
              )}
              {/* Error Details */}
              {resultType === "error" && transactionDetails?.error && (
                <View className="bg-red-50 p-4 rounded-lg mb-4">
                  <Text className="text-red-600 text-sm">
                    {transactionDetails.error}
                  </Text>
                </View>
              )}
              {/* Cancel Message */}
              {resultType === "cancel" && (
                <Text className="text-gray-600 text-center font-medium text-base">
                  You cancelled the payment process. No charges were made.
                </Text>
              )}
              {/* Action Buttons */}
              <View className="flex-row justify-around w-full mt-2.5">
                <TouchableOpacity
                  onPress={saveReceipt}
                  className="bg-blue-500 py-4 px-8 rounded-full min-w-[120px] items-center"
                >
                  {isSaving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <View className="flex-row items-center">
                      <Image
                        source={icons.download}
                        className="w-4 h-4 mr-2"
                        tintColor="white"
                      />
                      <Text className="text-white text-base font-bold">
                        Save
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={closeResultModal}
                  className="bg-green-500 py-4 px-8 rounded-full min-w-[120px] items-center"
                >
                  <Text className="text-white text-base font-bold">Done</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  // Convert plan price from PHP to USD
  const usdAmount = DatabaseHelper.convertToUsd(plan.price);

  // Update how you get gradient colors

  // Update how you display plan type
  const getDisplayPlanType = (planType: string | undefined): string => {
    if (!planType) return "Plan";
    return planType.charAt(0).toUpperCase() + planType.slice(1).toLowerCase();
  };

  const displayPlanType = getDisplayPlanType(plan?.planType);

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pb-6">
          <Text className="text-2xl font-pbold text-gray-900 mb-2 mt-6">
            Payment Details
          </Text>
          <Text className="text-gray-600 font-pregular">
            Choose your preferred payment method
          </Text>
        </View>

        {/* Plan Card */}
        <View className="mx-6 mb-6">
          <View
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              backgroundColor: getPlanColor(plan.planType),
              shadowColor: "#8b5cf6",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {/* Card Brand */}
            <Text
              className="text-2xl font-pbold mb-2"
              style={{ color: "white" }}
            >
              {displayPlanType}
            </Text>

            {/* Plan Number/ID Style */}
            <Text className="text-3xl font-pbold" style={{ color: "white" }}>
              ₱{plan.price}
              <Text className="text-lg opacity-80">/{plan.duration}</Text>
            </Text>

            {/* Validity & Features */}
            <View className="flex-row justify-between items-end">
              <View>
                <Text className="text-white/70 text-xs uppercase tracking-wide mb-1">
                  <Text className="text-white font-semibold">
                    {plan?.duration
                      ? new Date(
                          Date.now() + getDurationInMs(plan.duration)
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "N/A"}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Plan Details */}
        <View className="mx-6 mb-4">
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-900 font-psemibold text-lg">
                Plan Features
              </Text>
              <Text className="text-gray-500 text-xl">••••</Text>
            </View>
            <View className="mt-3 space-y-2">
              <Text className="text-gray-700 font-pregular text-base">
                List up to {plan.list} items concurrently
              </Text>
              <Text className="text-gray-700 font-pregular text-base">
                Rent up to {plan.rent} items concurrently
              </Text>
            </View>
          </View>
        </View>

        {/* Order Summary Card */}
        <View className="mx-6 mb-4">
          <View className="bg-white rounded-2xl p-6 border border-gray-100">
            <Text className="text-lg font-psemibold text-gray-900 mb-2">
              Order Summary
            </Text>

            <View className="space-y-3">
              <View className="flex-row justify-between">
                <Text className="text-gray-600 font-pregular">Subtotal</Text>
                <Text className="font-pmedium text-gray-900">
                  ₱{plan.price}.00
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600 font-pregular">
                  Processing Fee
                </Text>
                <Text className="font-pmedium text-gray-900">₱0.00</Text>
              </View>
              <View className="border-t border-gray-200 pt-3">
                <View className="flex-row justify-between">
                  <Text className="text-lg font-psemibold text-gray-900">
                    Total
                  </Text>
                  <Text className="text-lg font-pbold text-gray-900">
                    ₱{plan.price}.00
                  </Text>
                </View>
                <Text className="text-right font-pregular text-sm text-gray-500 mt-1">
                  ≈ ${usdAmount} USD
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View className="mx-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Choose a payment method
          </Text>
          <Text className="text-gray-600 text-sm mb-4">
            Please select a payment method most convenient to you.
          </Text>

          {/* PayPal Option */}
          <TouchableOpacity
            className={`bg-white rounded-2xl p-4 border-2 mb-3 ${
              loading ? "opacity-50" : "border-green-500"
            }`}
            onPress={handlePayment}
            disabled={loading}
          >
            <View className="flex-row items-center">
              <View className="w-5 h-5 rounded-full border-2 border-green-500 mr-4 items-center justify-center">
                <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <Text className="font-medium text-gray-900">PayPal</Text>
                <Image
                  source={images.paypal}
                  className="w-[25] h-[30] mr-2"
                  resizeMode="contain"
                />
              </View>
            </View>
          </TouchableOpacity>

          {/* Other Payment Options (Disabled) */}
          <TouchableOpacity className="bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-3 opacity-60">
            <View className="flex-row items-center">
              <View className="w-5 h-5 rounded-full border-2 border-gray-300 mr-4" />
              <View className="flex-1 flex-row items-center justify-between">
                <Text className="font-medium text-gray-500">Credit Card</Text>
                <Image
                  source={images.visaMc}
                  className="w-[90] h-[30] mr-2"
                  resizeMode="contain"
                />
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity className="bg-gray-50 rounded-2xl p-4 border border-gray-200 mb-6 opacity-60">
            <View className="flex-row items-center">
              <View className="w-5 h-5 rounded-full border-2 border-gray-300 mr-4" />
              <View className="flex-1 flex-row items-center justify-between">
                <Text className="font-medium text-gray-500">GCash</Text>
                <Image
                  source={images.gcash}
                  className="w-[30] h-[30] mr-2"
                  resizeMode="contain"
                />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Fixed Bottom Payment Button */}
      <View className="bg-white border-t border-gray-200 px-6 py-4">
        <TouchableOpacity
          className={`rounded-2xl overflow-hidden ${
            loading ? "opacity-70" : ""
          }`}
          onPress={handlePayment}
          disabled={loading || plan.price === 0}
          style={{
            backgroundColor: plan.price === 0 ? "#CCCCCC" : "#4BD07F", // Gray if free, green otherwise
            shadowColor: "#8b5cf6",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <View className="py-4 px-6 items-center">
            {loading ? (
              <View className="flex-row items-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold text-base ml-3">
                  Processing...
                </Text>
              </View>
            ) : (
              <Text className="text-white font-psemibold text-base">
                Confirm and continue
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Enhanced PayPal WebView Modal */}
      <Modal
        visible={showWebView}
        animationType="none"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <View className="flex-1 bg-gray-50 mt-8">
          {/* Header */}
          <View className="bg-white border-b border-gray-200 px-6 py-4">
            <View className="flex-row items-center justify-end">
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                onPress={closeWebView}
              >
                <Text className="text-gray-600 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            {/* Progress Steps */}
            <View className="flex-row items-center justify-center mt-4 space-x-2">
              <View className="flex-1 flex-row items-center justify-center">
                <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center mr-2">
                  <Text className="text-white text-xs font-bold">✓</Text>
                </View>
                <Text className="text-sm font-medium text-blue-600">
                  Select Plan
                </Text>
              </View>
              <View className="flex-1 flex-row items-center justify-center">
                <View className="w-6 h-6 rounded-full bg-blue-500 items-center justify-center mr-2">
                  <Text className="text-white text-xs font-bold">2</Text>
                </View>
                <Text className="text-sm font-medium text-blue-600">
                  Payment
                </Text>
              </View>
              <View className="flex-1 flex-row items-center justify-center">
                <View className="w-6 h-6 rounded-full bg-gray-300 items-center justify-center mr-2">
                  <Text className="text-gray-600 text-xs font-bold">3</Text>
                </View>
                <Text className="text-sm text-gray-500">Review</Text>
              </View>
            </View>
          </View>

          <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={handleWebViewNavigationStateChange}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="flex-1 justify-center items-center bg-gray-50 px-10">
                <View className="bg-white rounded-2xl p-8 items-center border border-gray-200">
                  <ActivityIndicator size="large" color="#8b5cf6" />
                  <Text className="text-lg font-semibold text-gray-900 mt-4 mb-2">
                    Loading PayPal...
                  </Text>
                  <Text className="text-sm text-gray-600 text-center mb-4">
                    Transaction ID: {transactionId}
                  </Text>
                  <View className="items-start space-y-1">
                    <Text className="text-xs text-gray-500">
                      • Establishing secure connection
                    </Text>
                    <Text className="text-xs text-gray-500">
                      • Verifying payment details
                    </Text>
                    <Text className="text-xs text-gray-500">
                      • Loading PayPal interface
                    </Text>
                  </View>
                </View>
              </View>
            )}
            className="flex-1"
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn("WebView error: ", nativeEvent);
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Result Modal */}
      <ResultModal />
    </View>
  );
};

export default PayPalPayment;
