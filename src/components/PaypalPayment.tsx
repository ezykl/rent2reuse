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
  Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { icons, images } from "@/constant";
import * as FileSystem from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { TransactionData } from "../types/api";
import { User, Plan, PaymentTransaction, PayPalPaymentResult } from "@/types";
import { useLoader } from "@/context/LoaderContext";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db, auth as firebaseAuth } from "@/lib/firebaseConfig";
const { width, height } = Dimensions.get("window");

import { PAYPAL_BASE_URL } from "@env";

let currentRate = 56.5;

async function fetchExchangeRate() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?amount=1&from=USD&to=PHP"
    );
    const data = await res.json();

    if (data?.rates?.PHP) {
      currentRate = data.rates.PHP;
      console.log("Fetched exchange rate:", currentRate);
    } else {
      console.log("API response invalid, keeping fallback:", data);
    }
  } catch (err) {
    console.log("Error fetching rate, using fallback:", err);
  }
}

function getExchangeRate() {
  return currentRate;
}

// Refresh every 30 minutes
setInterval(fetchExchangeRate, 30 * 60 * 1000);
fetchExchangeRate();

const DatabaseHelper = {
  generateTransactionId: () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `TXN-${timestamp}-${random}`;
  },

  // Convert USD to PHP (you can update exchange rate dynamically)
  convertToPhp: (usdAmount: string | number) => {
    return (parseFloat(usdAmount.toString()) * getExchangeRate()).toFixed(2);
  },

  // Convert PHP to USD
  convertToUsd: (phpAmount: number) => {
    return (parseFloat(phpAmount.toString()) / getExchangeRate()).toFixed(2);
  },
};

// Replace the getGradientColors function with getPlanColor
const getPlanColor = (planType: string): string => {
  const colors = {
    free: "#CD7F32",
    basic: "#737373",
    premium: "#eda705",
    platinum: "#21AEE6",
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
            currency_code: "USD",
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

interface PayPalPaymentProps {
  plan: {
    id: string;
    planType: string;
    price: number;
    duration: string;
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
  useEffect(() => {
    if (!plan?.planType || !plan?.duration) {
      console.error("Missing required plan fields:", plan);
    }
  }, [plan]);

  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultType, setResultType] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [transactionId, setTransactionId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { isLoading, setIsLoading } = useLoader();

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

  const createPlanActivatedNotification = async () => {
    try {
      const currentUser = firebaseAuth.currentUser;
      const userNotificationsRef = collection(
        db,
        `users/${currentUser?.uid}/notifications`
      );
      await addDoc(userNotificationsRef, {
        type: "PLAN_ACTIVATED",
        title: "Plan Activated Successfully! 🎉",
        message: `Your ${plan.planType} plan is now active. You can now list up to ${plan.list} items and rent up to ${plan.rent} items.`,
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error creating welcome notification:", error);
    }
  };

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
      setIsLoading(true);
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

        await createPlanActivatedNotification();
        setTransactionDetails(transactionData);
        setResultType("success");
        setIsLoading(true);
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
      setIsLoading(false);
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

    return null;
  };

  const usdAmount = DatabaseHelper.convertToUsd(plan.price);

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
