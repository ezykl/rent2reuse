import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { icons, images } from "@/constant";
import Header from "@/components/Header";
import CustomAlert from "@/components/CustomAlert";
import { WebView } from "react-native-webview";
import type { WebViewErrorEvent } from "react-native-webview/lib/WebViewTypes";

interface PaymentMethod {
  id: string;
  name: string;
  image: any;
  isAvailable: boolean;
}

interface AlertButton {
  text: string;
  type?: "cancel" | "default";
  onPress: () => void;
}

interface AlertConfig {
  title: string;
  message: string;
  buttons: AlertButton[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "paypal", name: "PayPal", image: images.paypal, isAvailable: true },
  { id: "card", name: "Credit Card", image: images.visaMc, isAvailable: false },
  { id: "gcash", name: "GCash", image: images.gcash, isAvailable: false },
];

// Update the PayPal configuration section
const PAYPAL_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID as string,
  clientSecret: process.env.EXPO_PUBLIC_PAYPAL_CLIENT_SECRET as string,
  baseURL:
    process.env.EXPO_PUBLIC_PAYPAL_SANDBOX === "true"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com",
  scopes: "openid email https://uri.paypal.com/services/paypalattributes",
  returnUrl: "rent2reuse://oauth2/success",
  cancelUrl: "rent2reuse://oauth2/cancel",
};

// Add new types for OAuth response
interface PayPalUserInfo {
  user_id: string;
  email: string;
  verified_email: boolean;
  payer_id: string;
  name: string;
}

interface PayPalOAuthSuccess {
  access_token: string;
  token_type: string;
  app_id: string;
  expires_in: number;
  scope: string;
  nonce: string;
  message: string
}

interface PayPalOAuthResponse {
  type: "success" | "cancel";
  url: string;
}

// Function to get access token - using same pattern as your working code
const getOAuthToken = async () => {
  try {
    const auth = btoa(
      `${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`
    );
    const response = await fetch(`${PAYPAL_CONFIG.baseURL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description);
    return data.access_token;
  } catch (error) {
    console.error("OAuth token error:", error);
    throw error;
  }
};

// Create PayPal Identity Token (different from payment token)
const createPayPalIdentityOrder = async (accessToken: string) => {
  try {
    // Create a minimal order for identity verification
    const orderData = {
      intent: "AUTHORIZE", // Use AUTHORIZE instead of CAPTURE for identity
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: "1.00", // Minimal amount for identity verification
          },
          description: "PayPal Account Verification",
        },
      ],
      application_context: {
        return_url: "rent2reuse://paypal-oauth-success",
        cancel_url: "rent2reuse://paypal-oauth-cancel",
        user_action: "CONTINUE", // Changed from PAY_NOW to CONTINUE
        brand_name: "Rent2Reuse",
        landing_page: "LOGIN", // Force login page
        shipping_preference: "NO_SHIPPING",
      },
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            user_action: "CONTINUE",
          },
        },
      },
    };

    const response = await fetch(
      `${PAYPAL_CONFIG.baseURL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(orderData),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return data;
    } else {
      throw new Error(data.message || "Failed to create PayPal identity order");
    }
  } catch (error) {
    console.error("Error creating PayPal identity order:", error);
    throw error;
  }
};

// Get order details to extract payer info
const getPayPalOrderDetails = async (accessToken: string, orderId: string) => {
  try {
    const response = await fetch(
      `${PAYPAL_CONFIG.baseURL}/v2/checkout/orders/${orderId}`,
      {
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
      throw new Error(data.message || "Failed to get order details");
    }
  } catch (error) {
    console.error("Error getting PayPal order details:", error);
    throw error;
  }
};

const PaymentOptions = () => {
  const insets = useSafeAreaInsets();
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [currentPaypalEmail, setCurrentPaypalEmail] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    title: "",
    message: "",
    buttons: [],
  });
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser?.uid) return;

      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentPaypalEmail(userData.paypalEmail || null);
          setUserEmail(userData.email || "");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, []);

  const startPayPalAuth = async () => {
    try {
      setIsLoading(true);
      console.log("Starting PayPal OAuth...");

      // Get access token using same method as your working payment
      const token = await getOAuthToken();
      setAccessToken(token);
      console.log("Access token obtained");

      // Create identity verification order
      const order = await createPayPalIdentityOrder(token);
      console.log("Identity order created:", order.id);

      // Find approval URL
      interface PayPalOrderLink {
        href: string;
        rel: string;
        method: string;
      }

      const approvalUrl = order.links.find(
        (link: PayPalOrderLink) => link.rel === "approve"
      )?.href;

      if (!approvalUrl) {
        throw new Error("No approval URL found");
      }

      console.log("Opening PayPal auth URL:", approvalUrl);
      setOrderId(order.id);
      setWebViewUrl(approvalUrl);
      setShowWebView(true);
    } catch (error) {
      console.error("PayPal auth error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody:
          error instanceof Error
            ? error.message
            : "Failed to start PayPal authentication",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update the WebView navigation handler with proper typing
  const handleWebViewNavigationStateChange = async (newNavState: {
    url: string;
    loading: boolean;
    title: string;
    canGoBack: boolean;
    canGoForward: boolean;
  }) => {
    const { url } = newNavState;
    console.log("WebView URL:", url);

    try {
      // Handle success case
      if (url.includes(PAYPAL_CONFIG.returnUrl)) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get("code");
        const scope = urlObj.searchParams.get("scope");

        if (code) {
          setShowWebView(false);
          const response = await exchangeCodeForToken(code);

          if (response) {
            const { access_token } = response;
            const userInfo = await getUserInfo(access_token);

            if (userInfo.verified_email) {
              await handleSavePaypalEmail(userInfo.email);
            } else {
              Toast.show({
                type: ALERT_TYPE.WARNING,
                title: "Unverified Email",
                textBody: "Please verify your PayPal email address first",
              });
            }
          }
        }
      }
      // Handle cancel case
      else if (url.includes(PAYPAL_CONFIG.cancelUrl)) {
        setShowWebView(false);
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Cancelled",
          textBody: "PayPal account linking was cancelled",
        });
      }
    } catch (error) {
      console.error("PayPal OAuth error:", error);
      setShowWebView(false);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to connect PayPal account",
      });
    }
  };

  // Update the token exchange function with proper typing
  const exchangeCodeForToken = async (
    code: string
  ): Promise<PayPalOAuthSuccess | null> => {
    try {
      setIsLoading(true);
      const auth = btoa(
        `${PAYPAL_CONFIG.clientId}:${PAYPAL_CONFIG.clientSecret}`
      );

      const response = await fetch(`${PAYPAL_CONFIG.baseURL}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${auth}`,
        },
        body: `grant_type=authorization_code&code=${code}&redirect_uri=${PAYPAL_CONFIG.returnUrl}`,
      });

      const data: PayPalOAuthSuccess = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to exchange code for token");
      }

      return data;
    } catch (error) {
      console.error("Token exchange error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to connect PayPal account",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    if (!method.isAvailable) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Not Available",
        textBody: `${method.name} is not available yet.`,
      });
      return;
    }

    if (method.id === "paypal") {
      if (currentPaypalEmail) {
        setAlertConfig({
          title: "PayPal Account",
          message: `Current PayPal email: ${currentPaypalEmail}\nWould you like to update it?`,
          buttons: [
            {
              text: "Cancel",
              type: "cancel",
              onPress: () => setShowAlert(false),
            },
            {
              text: "Update via OAuth",
              onPress: () => {
                setShowAlert(false);
                startPayPalAuth();
              },
            },
            {
              text: "Manual Entry",
              onPress: () => {
                setShowAlert(false);
                setShowPayPalModal(true);
              },
            },
          ],
        });
      } else {
        setAlertConfig({
          title: "Connect PayPal",
          message: "How would you like to connect your PayPal account?",
          buttons: [
            {
              text: "Cancel",
              type: "cancel",
              onPress: () => setShowAlert(false),
            },
            {
              text: "OAuth Login",
              onPress: () => {
                setShowAlert(false);
                startPayPalAuth();
              },
            },
            {
              text: "Manual Entry",
              onPress: () => {
                setShowAlert(false);
                setShowPayPalModal(true);
              },
            },
          ],
        });
      }
      setShowAlert(true);
    }
  };

  const handleSavePaypalEmail = async (email: string) => {
    if (!auth.currentUser?.uid) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "You must be logged in to save payment options",
      });
      return;
    }

    const emailToSave = email || paypalEmail;
    if (!emailToSave.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Invalid Email",
        textBody: "Please enter a valid PayPal email address",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("Saving PayPal email:", emailToSave);

      const userRef = doc(db, "users", auth.currentUser.uid);

      await updateDoc(userRef, {
        paypalEmail: emailToSave,
        updatedAt: new Date().toISOString(),
      });

      setCurrentPaypalEmail(emailToSave);
      setShowPayPalModal(false);
      setPaypalEmail(""); // Clear the input

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "PayPal email updated successfully",
      });
    } catch (error) {
      console.error("Error saving PayPal email:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update PayPal email",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWebViewError = (syntheticEvent: WebViewErrorEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error("WebView error:", nativeEvent);

    Toast.show({
      type: ALERT_TYPE.DANGER,
      title: "Connection Error",
      textBody: "Failed to load PayPal authentication page",
    });
    setShowWebView(false);
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">
          Payment Options
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="text-base text-gray-600 mb-4">
          Choose your preferred payment method for receiving payments.
        </Text>

        {PAYMENT_METHODS.map((method) => (
          <TouchableOpacity
            key={method.id}
            className={`bg-white rounded-2xl p-4 border-2 mb-3 ${
              !method.isAvailable
                ? "opacity-50 border-gray-200"
                : method.id === "paypal" && currentPaypalEmail
                ? "border-green-500"
                : "border-gray-200"
            }`}
            onPress={() => handleMethodSelect(method)}
            disabled={!method.isAvailable || isLoading}
          >
            <View className="flex-row items-center">
              <View
                className={`w-5 h-5 rounded-full border-2 mr-4 items-center justify-center ${
                  !method.isAvailable ? "border-gray-300" : "border-green-500"
                }`}
              >
                {method.id === "paypal" && currentPaypalEmail && (
                  <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                )}
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <View>
                  <Text
                    className={`font-medium ${
                      !method.isAvailable ? "text-gray-500" : "text-gray-900"
                    }`}
                  >
                    {method.name}
                  </Text>
                  {method.id === "paypal" && currentPaypalEmail && (
                    <Text className="text-sm text-gray-500">
                      {currentPaypalEmail}
                    </Text>
                  )}
                  {isLoading && method.id === "paypal" && (
                    <Text className="text-sm text-blue-500">Connecting...</Text>
                  )}
                </View>
                <Image
                  source={method.image}
                  className="h-[30px]"
                  style={{
                    width:
                      method.id === "paypal"
                        ? 25
                        : method.id === "card"
                        ? 90
                        : 30,
                  }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View className="bg-blue-50 rounded-xl p-4 mt-2">
          <View className="flex-row items-start">
            <Image
              source={icons.about}
              className="w-5 h-5 mr-2 mt-0.5"
              tintColor="#1D4ED8"
            />
            <Text className="text-blue-900 flex-1">
              Currently, only PayPal is supported for receiving payments. More
              payment options will be available soon.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* PayPal Email Modal - Manual Entry */}
      <Modal visible={showPayPalModal} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-pbold text-gray-900">
                Add PayPal Email
              </Text>
              <TouchableOpacity
                onPress={() => setShowPayPalModal(false)}
                className="p-2"
              >
                <Image source={icons.close} className="w-5 h-5" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-600 mb-4">
              Enter your PayPal email address manually, or use OAuth login for
              automatic setup.
            </Text>

            <TextInput
              value={paypalEmail}
              onChangeText={setPaypalEmail}
              placeholder="Enter your PayPal email"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => handleSavePaypalEmail(paypalEmail)}
                disabled={isLoading || !paypalEmail.trim()}
                className="flex-1 bg-primary py-4 rounded-xl"
              >
                <Text className="text-white text-center font-pbold">
                  {isLoading ? "Saving..." : "Save Email"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowPayPalModal(false);
                  startPayPalAuth();
                }}
                disabled={isLoading}
                className="flex-1 bg-blue-600 py-4 rounded-xl"
              >
                <Text className="text-white text-center font-pbold">
                  OAuth Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PayPal WebView Modal - Using same style as your working payment flow */}
      <Modal
        visible={showWebView}
        animationType="none"
        presentationStyle="fullScreen"
        statusBarTranslucent
      >
        <View className="flex-1 bg-gray-50 mt-8">
          {/* Header - same style as your working implementation */}
          <View className="bg-white border-b border-gray-200 px-6 py-4">
            <View className="flex-row items-center justify-end">
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                onPress={() => setShowWebView(false)}
              >
                <Text className="text-gray-600 font-bold">✕</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-center mt-4">
              <Text className="text-lg font-psemibold text-gray-900">
                Connect PayPal Account
              </Text>
            </View>
          </View>

          {webViewUrl ? (
            <WebView
              source={{ uri: webViewUrl }}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              onError={handleWebViewError}
              startInLoadingState={true}
              renderLoading={() => (
                <View className="flex-1 justify-center items-center bg-gray-50 px-10">
                  <View className="bg-white rounded-2xl p-8 items-center border border-gray-200">
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text className="text-lg font-semibold text-gray-900 mt-4 mb-2">
                      Loading PayPal...
                    </Text>
                    <Text className="text-sm text-gray-600 text-center mb-4">
                      Connecting to your PayPal account
                    </Text>
                    <View className="items-start space-y-1">
                      <Text className="text-xs text-gray-500">
                        • Establishing secure connection
                      </Text>
                      <Text className="text-xs text-gray-500">
                        • Verifying account details
                      </Text>
                      <Text className="text-xs text-gray-500">
                        • Loading PayPal interface
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
            />
          ) : (
            <View className="flex-1 justify-center items-center">
              <Text className="text-gray-600">
                Preparing PayPal connection...
              </Text>
            </View>
          )}
        </View>
      </Modal>

      <CustomAlert
        visible={showAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setShowAlert(false)}
      />
    </SafeAreaView>
  );
};

export default PaymentOptions;
