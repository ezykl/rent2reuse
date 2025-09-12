import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  RefreshControl,
  Alert,
  Share,
  Platform,
} from "react-native";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Stack, router } from "expo-router";
import Header from "@/components/Header";
import { useLoader } from "@/context/LoaderContext";
import { auth, db } from "@/lib/firebaseConfig";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PlanSubscription from "@/components/PlanSubscription";
import PayPalPayment from "@/components/PaypalPayment";
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } from "@env";
import { User, Plan } from "@/types";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { Image } from "react-native";
import { icons, images } from "@/constant";
import { LogBox } from "react-native";
import * as Linking from "expo-linking";

LogBox.ignoreLogs(["Text strings must be rendered within a <Text> component"]);

interface PayPalResult {
  id: string;
  customTransactionId: string;
  purchase_units: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
      }>;
    };
  }>;
}

interface ReceiptData {
  transactionId: string;
  planType: string;
  amount: number;
  date: string;
  duration: string;
  paypalOrderId: string;
  status: string;
}

interface SubscriptionDetails {
  endDate: string;
  startDate: Timestamp;
  status: string;
  transactionId: string;
}

const PlansScreen: React.FC = () => {
  const { setIsLoading } = useLoader();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [subscriptionDetails, setSubscriptionDetails] =
    useState<SubscriptionDetails | null>(null);
  const receiptRef = useRef(null);

  // Fetch user profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          router.replace("/sign-in");
          return;
        }

        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setProfileData({
            firstname: userData.firstname || "",
            middlename: userData.middlename || "",
            lastname: userData.lastname || "",
            profileImage: userData.profileImage || "",
            createdAt: userData.createdAt || new Date().toISOString(),
            contactNumber: userData.contactNumber || "",
            location: {
              address: userData.location?.address || "",
              latitude: userData.location?.latitude || 0,
              longitude: userData.location?.longitude || 0,
              updatedAt:
                userData.location?.updatedAt || new Date().toISOString(),
            },
            currentPlan: userData.currentPlan
              ? {
                  planId: userData.currentPlan.planId || "",
                  planType: userData.currentPlan?.planType
                    ? userData.currentPlan.planType.charAt(0).toUpperCase() +
                      userData.currentPlan.planType.slice(1).toLowerCase()
                    : "Free",
                  rentLimit: userData.currentPlan.rentLimit || 0,
                  listLimit: userData.currentPlan.listLimit || 0,
                  rentUsed: userData.currentPlan.rentUsed || 0,
                  listUsed: userData.currentPlan.listUsed || 0,
                  status: userData.currentPlan.status || "inactive",
                  subscriptionId: userData.currentPlan.subscriptionId,
                }
              : undefined,
          });
        }
      } catch (error) {
        console.error("Error fetching profile data:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to load profile data",
        });
      }
    };

    // Fetch initial data
    fetchProfileData();

    // Set up real-time listener for profile updates
    const unsubscribe = onSnapshot(
      doc(db, "users", auth.currentUser?.uid || ""),
      (doc) => {
        if (doc.exists()) {
          const userData = doc.data() as User;
          setProfileData({
            firstname: userData.firstname || "",
            middlename: userData.middlename || "",
            lastname: userData.lastname || "",
            profileImage: userData.profileImage || "",
            createdAt: userData.createdAt || new Date().toISOString(),
            contactNumber: userData.contactNumber || "",
            location: {
              address: userData.location?.address || "",
              latitude: userData.location?.latitude || 0,
              longitude: userData.location?.longitude || 0,
              updatedAt:
                userData.location?.updatedAt || new Date().toISOString(),
            },
            currentPlan: userData.currentPlan
              ? {
                  planId: userData.currentPlan.planId || "",
                  planType: userData.currentPlan.planType || "Free",
                  rentLimit: userData.currentPlan.rentLimit || 0,
                  listLimit: userData.currentPlan.listLimit || 0,
                  rentUsed: userData.currentPlan.rentUsed || 0,
                  listUsed: userData.currentPlan.listUsed || 0,
                  status: userData.currentPlan.status || "inactive",
                  subscriptionId: userData.currentPlan.subscriptionId,
                }
              : undefined,
          });
        }
      },
      (error) => {
        console.error("Error in profile snapshot:", error);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // Fetch subscription details
  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      if (!profileData?.currentPlan?.subscriptionId) return;

      try {
        const subDoc = await getDoc(
          doc(db, "subscription", profileData.currentPlan.subscriptionId)
        );
        if (subDoc.exists()) {
          setSubscriptionDetails(subDoc.data() as SubscriptionDetails);
        }
      } catch (error) {
        console.error("Error fetching subscription details:", error);
      }
    };

    fetchSubscriptionDetails();
  }, [profileData?.currentPlan?.subscriptionId]);

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

  const handlePaymentSuccess = async (result: PayPalResult) => {
    try {
      if (!auth.currentUser?.uid || !selectedPlan) {
        throw new Error("Missing required data");
      }

      // Get current user data to check existing usage
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const currentPlanData = userSnap.data()?.currentPlan || {
        rentUsed: 0,
        listUsed: 0,
      };

      // Keep the higher value between current usage and 0
      const currentRentUsed = currentPlanData.rentUsed || 0;
      const currentListUsed = currentPlanData.listUsed || 0;

      // Calculate duration in milliseconds
      const durationMs = getDurationInMs(selectedPlan.duration);

      // Create subscription document
      const subscriptionRef = await addDoc(collection(db, "subscription"), {
        userId: auth.currentUser.uid,
        planId: selectedPlan.id,
        planType: selectedPlan.planType,
        startDate: new Date(),
        endDate: new Date(Date.now() + durationMs).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        status: "active",
        transactionId: result.customTransactionId,
        createdAt: serverTimestamp(),
      });

      // Create transaction document
      await addDoc(collection(db, "transactions"), {
        userId: auth.currentUser.uid,
        subscriptionId: subscriptionRef.id,
        transactionId: result.customTransactionId,
        planId: selectedPlan.id,
        amount: selectedPlan.price,
        currency: "PHP",
        paymentMethod: "paypal",
        paypalOrderId: result.id,
        paypalTransactionId:
          result.purchase_units?.[0]?.payments?.captures?.[0]?.id || null,
        status: "success",
        createdAt: serverTimestamp(),
        planDetails: {
          planType: selectedPlan.planType,
          duration: selectedPlan.duration,
          listLimit: selectedPlan.list,
          rentLimit: selectedPlan.rent,
        },
      });

      // Update user's current plan while preserving usage counts
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        currentPlan: {
          planId: selectedPlan.id,
          planType: selectedPlan.planType,
          rentLimit: selectedPlan.rent,
          listLimit: selectedPlan.list,
          rentUsed: currentRentUsed, // Preserve current usage
          listUsed: currentListUsed, // Preserve current usage
          status: "active",
          subscriptionId: subscriptionRef.id,
          updatedAt: serverTimestamp(),
        },
      });

      // Set receipt data and show receipt
      setReceiptData({
        transactionId: result.customTransactionId,
        planType: selectedPlan.planType,
        amount: selectedPlan.price,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        duration: selectedPlan.duration,
        paypalOrderId: result.id,
        status: "Success",
      });

      setShowReceipt(true);
      onRefresh();

      // REMOVED: setShowPaymentModal(false) - Modal stays open
      // REMOVED: Success toast - No automatic toast
    } catch (error) {
      console.error("Error processing payment:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody:
          error instanceof Error ? error.message : "Failed to process payment",
      });
    }
  };

  const handlePaymentError = (error: unknown) => {
    console.error("Payment error:", error);
    Toast.show({
      type: ALERT_TYPE.DANGER,
      title: "Error",
      textBody:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    Toast.show({
      type: ALERT_TYPE.WARNING,
      title: "Cancelled",
      textBody: "Payment was cancelled",
    });
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const saveReceiptAsImage = async () => {
    try {
      // Enhanced permission handling
      const permissionResult = await MediaLibrary.requestPermissionsAsync();

      if (permissionResult.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Storage permission is needed to save the receipt to your photo gallery.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Grant Permission",
              onPress: async () => {
                const secondResult =
                  await MediaLibrary.requestPermissionsAsync();
                if (secondResult.status === "granted") {
                  saveReceiptAsImage(); // Retry
                }
              },
            },
          ]
        );
        return;
      }

      // Validate ref
      if (!receiptRef.current) {
        Alert.alert(
          "Error",
          "Receipt not ready for capture. Please try again."
        );
        return;
      }

      // Show loading
      setIsLoading?.(true);

      // Capture the receipt
      const uri = await captureRef(receiptRef.current, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
      });

      // Validate captured file
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error("Failed to capture receipt image");
      }

      // Create asset and save to gallery
      const asset = await MediaLibrary.createAssetAsync(uri);

      // Create/get album
      const albumName = "rent2reuse/receipt";
      let album = await MediaLibrary.getAlbumAsync(albumName);

      if (!album) {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Receipt Saved",
        textBody: "Receipt has been saved to your photo gallery!",
      });
    } catch (error) {
      console.error("Error saving receipt:", error);
      Alert.alert(
        "Save Failed",
        "Could not save receipt to gallery. Please check permissions and try again."
      );
    } finally {
      setIsLoading?.(false);
    }
  };

  const shareReceipt = async () => {
    try {
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
      });

      await Share.share({
        url: uri,
        message: "Payment Receipt - Subscription Activated",
      });
    } catch (error) {
      console.error("Error sharing receipt:", error);
      Alert.alert("Error", "Failed to share receipt. Please try again.");
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setShowReceipt(false);
    setReceiptData(null);
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Refresh profile data
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setProfileData({
            firstname: userData.firstname || "",
            middlename: userData.middlename || "",
            lastname: userData.lastname || "",
            profileImage: userData.profileImage || "",
            createdAt: userData.createdAt || new Date().toISOString(),
            contactNumber: userData.contactNumber || "",
            location: {
              address: userData.location?.address || "",
              latitude: userData.location?.latitude || 0,
              longitude: userData.location?.longitude || 0,
              updatedAt:
                userData.location?.updatedAt || new Date().toISOString(),
            },
            currentPlan: userData.currentPlan
              ? {
                  planId: userData.currentPlan.planId || "",
                  planType: userData.currentPlan.planType || "Free",
                  rentLimit: userData.currentPlan.rentLimit || 0,
                  listLimit: userData.currentPlan.listLimit || 0,
                  rentUsed: userData.currentPlan.rentUsed || 0,
                  listUsed: userData.currentPlan.listUsed || 0,
                  status: userData.currentPlan.status || "inactive",
                  subscriptionId: userData.currentPlan.subscriptionId,
                }
              : undefined,
          });
        }
      }
    } catch (error) {
      console.error("Refresh error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to refresh data",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const formatFirebaseDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return "N/A";
    try {
      return format(timestamp.toDate(), "MMMM dd, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const debugReceiptCapture = async () => {
    try {
      console.log("Receipt ref current:", receiptRef.current);

      if (!receiptRef.current) {
        console.error("Receipt ref is null");
        return;
      }

      // Test capture without saving
      const uri = await captureRef(receiptRef.current, {
        format: "png",
        quality: 0.8,
        result: "tmpfile",
      });

      console.log("Test capture successful, URI:", uri);

      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log("File info:", fileInfo);
    } catch (error) {
      console.error("Debug capture error:", error);
    }
  };

  const ReceiptComponent = () => (
    <View className="bg-white m-4 rounded-2xl shadow-lg border- border-gray-100 ">
      {/* Header */}
      <View className="items-center mb-6 p-4  border-b-2 border-dashed  border-gray-200">
        <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-3">
          <Text className="text-green-600 text-2xl font-bold">✓</Text>
        </View>
        <Text className="text-xl font-pbold text-gray-800">
          Payment Receipt
        </Text>
        <Text className="text-green-600 font-pmedium text-base">
          Subscription Activated
        </Text>

        <View className="relative  w-full"></View>
      </View>
      <View className="px-4">
        {/* Receipt Details - Add conditional rendering */}
        {receiptData && (
          <View className="space-y-4">
            <View className="bg-gray-50 p-4 rounded-xl">
              <Text className="text-gray-600 text-sm font-pmedium mb-1">
                Transaction ID
              </Text>
              <Text className="text-gray-800 font-pbold">
                {receiptData.transactionId || "N/A"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2 px-4">
              <Text className="text-gray-600 font-pmedium">Plan Type</Text>
              <Text className="text-gray-800 font-pbold text-lg">
                {receiptData?.planType
                  ? receiptData.planType.charAt(0).toUpperCase() +
                    receiptData.planType.slice(1).toLowerCase()
                  : "N/A"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2 px-4">
              <Text className="text-gray-600 font-pmedium">Duration</Text>
              <Text className="text-gray-800 font-pbold capitalize">
                {receiptData?.duration || "N/A"}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2 px-4">
              <Text className="text-gray-600 font-pmedium">Amount</Text>
              <Text className="text-gray-800 font-pbold text-xl">
                ₱{receiptData?.amount ?? 0}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2 px-4">
              <Text className="text-gray-600 font-pmedium">Payment Method</Text>
              <Text className="text-blue-600  font-pbold">PayPal</Text>
            </View>

            <View className="flex-row justify-between items-center py-2 px-4">
              <Text className="text-gray-600 font-pmedium">Date & Time</Text>
              <Text className="text-gray-800 font-pmedium">
                {receiptData?.date}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2 px-4">
              <Text className="text-gray-600 font-pmedium">Status</Text>
              <View className="bg-green-100 px-3 py-1 rounded-full">
                <Text className="text-green-700 font-pbold text-sm">
                  {receiptData?.status}
                </Text>
              </View>
            </View>

            <View className="bg-gray-50 p-4 rounded-xl mt-2">
              <Text className="text-gray-600 text-sm font-pmedium mb-1">
                PayPal Order ID
              </Text>
              <Text className="text-gray-800 font-pmedium text-xs">
                {receiptData?.paypalOrderId}
              </Text>
            </View>
          </View>
        )}
        {/* Footer */}
        <View className="py-4  items-center">
          <Text className="text-gray-500 text-xs text-center">
            Thank you for your subscription!
          </Text>
          <Text className="text-gray-500 text-xs text-center">
            Your plan is now active and ready to use.
          </Text>
        </View>
        <TouchableOpacity
          onPress={saveReceiptAsImage}
          className="bg-white mb-4 py-4 rounded-xl items-center flex-1 border-2 border-gray-300 justify-center flex-row gap-2"
        >
          <Image
            source={icons.download}
            className="w-5 h-5"
            tintColor="#4b5563"
          />
          <Text className="text-gray-600 font-pmedium text-base">
            Save Receipt
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ProgressBar = ({
    used,
    limit,
    label,
  }: {
    used: number;
    limit: number;
    label: string;
  }) => {
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

    const getProgressColor = (percentage: number) => {
      if (percentage <= 20) return "#4BD07F";
      if (percentage <= 40) return "#7ED321";
      if (percentage <= 60) return "#F5A623";
      if (percentage <= 80) return "#FF8C00";
      return "#FF4444";
    };

    const progressColor = getProgressColor(percentage);

    return (
      <View className="mb-3">
        <View className="flex-row justify-between items-center mb-1">
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          <Text className="text-sm text-gray-500">
            {used}/{limit}
          </Text>
        </View>
        <View className="w-full h-2.5 bg-gray-100 rounded-full">
          <View
            className="h-2.5 rounded-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: progressColor,
            }}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      className="bg-white h-full "
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">Subscription </Text>
        <View className="w-8 h-8" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1 p-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={["#2563EB"]} // primary color
            tintColor="#2563EB" // iOS
            progressBackgroundColor="#ffffff"
          />
        }
      >
        {/* Current Plan Status */}
        {profileData?.currentPlan && (
          <View className="bg-white rounded-xl p-4 mb-6 border border-gray-100 shadow-sm">
            <View className="flex-row justify-between items-center mb-4">
              <View>
                <Text className="text-2xl font-pbold text-gray-800">
                  {profileData.currentPlan.planType
                    ? profileData.currentPlan.planType.charAt(0).toUpperCase() +
                      profileData.currentPlan.planType.slice(1)
                    : "Free"}
                </Text>
                {subscriptionDetails && (
                  <Text className="text-sm text-gray-500 mt-1">
                    Expires: {subscriptionDetails.endDate}
                  </Text>
                )}
              </View>
              <View
                className={`px-3 py-1.5 rounded-full ${
                  profileData.currentPlan.status === "active"
                    ? "bg-green-100"
                    : "bg-orange-100"
                }`}
              >
                <Text
                  className={`font-pbold text-sm ${
                    profileData.currentPlan.status === "active"
                      ? "text-green-700"
                      : "text-orange-700"
                  }`}
                >
                  {profileData.currentPlan.status
                    ? profileData.currentPlan.status.charAt(0).toUpperCase() +
                      profileData.currentPlan.status.slice(1)
                    : "Inactive"}
                </Text>
              </View>
            </View>

            <View className="space-y-2">
              {/* Usage Progress Bars */}
              <ProgressBar
                used={profileData.currentPlan.listUsed || 0}
                limit={profileData.currentPlan.listLimit || 0}
                label="Listings Usage"
              />
              <ProgressBar
                used={profileData.currentPlan.rentUsed || 0}
                limit={profileData.currentPlan.rentLimit || 0}
                label="Rentals Usage"
              />

              {/* Subscription Period */}
              {subscriptionDetails && (
                <View className="mt-4 pt-4 border-t border-gray-100">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-gray-600 text-sm">Started</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {formatFirebaseDate(subscriptionDetails.startDate)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Plans Section */}
        <PlanSubscription
          currentPlan={{
            planId: profileData?.currentPlan?.planId,
            planType: profileData?.currentPlan?.planType || "",
            rentLimit: profileData?.currentPlan?.rentLimit || 0,
            listLimit: profileData?.currentPlan?.listLimit || 0,
            rentUsed: profileData?.currentPlan?.rentUsed || 0,
            listUsed: profileData?.currentPlan?.listUsed || 0,
            status: profileData?.currentPlan?.status || "inactive",
            subscriptionId: profileData?.currentPlan?.subscriptionId,
            // Add this line - parse expiry date from subscription details
            expiryDate: subscriptionDetails?.endDate
              ? new Date(subscriptionDetails.endDate)
              : undefined,
            hasUsedFreeTrial:
              profileData?.currentPlan?.planType?.toLowerCase() === "free" ||
              false,
          }}
          onSelectPlan={handlePlanSelect}
        />
      </ScrollView>

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <Modal
          visible={showPaymentModal}
          animationType="slide"
          transparent={false}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            {!showReceipt && (
              <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                <TouchableOpacity onPress={closePaymentModal}>
                  <Text className="text-red-400 font-pmedium text-lg">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <Text className="font-pbold text-xl">
                  {` ${
                    selectedPlan.planType.charAt(0).toUpperCase() +
                    selectedPlan.planType.slice(1)
                  } Plan`}
                </Text>
                <View style={{ width: 50 }} />
              </View>
            )}

            {showReceipt ? (
              <ScrollView
                className="flex-1 bg-primary px-2"
                showsVerticalScrollIndicator={false}
                ref={receiptRef}
                collapsable={false}
                renderToHardwareTextureAndroid={true}
              >
                <View className="flex-row justify-between items-center p-4">
                  <TouchableOpacity
                    onPress={closePaymentModal}
                    className="border border-white rounded-full p-4 justify-center items-center"
                  >
                    <Image
                      source={icons.cross}
                      className="w-5 h-5"
                      tintColor="#ffffff"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={shareReceipt}
                    className="border border-white rounded-full p-4 justify-center items-center"
                  >
                    <Image
                      source={icons.share}
                      className="w-5 h-5"
                      tintColor="#ffffff"
                    />
                  </TouchableOpacity>
                </View>
                <ReceiptComponent />

                {/* Action Buttons */}
                <View className="px-4 pb-6 space-y-3">
                  <View className="flex-row  gap-2 py-4">
                    {/* <TouchableOpacity
                      onPress={shareReceipt}
                      className="bg-blue-600 py-4 rounded-xl items-center flex-1 justify-center flex-row gap-2"
                    >
                      <Image
                        source={icons.share}
                        className="w-6 h-6"
                        tintColor="#fff"
                      />
                      <Text className="text-white font-pbold text-base">
                        Share Receipt
                      </Text>
                    </TouchableOpacity> */}
                  </View>
                  {/* <TouchableOpacity
                    onPress={closePaymentModal}
                    className="bg-green-600 py-4 rounded-xl items-center"
                  >
                    <Text className="text-white font-pbold text-lg">Done</Text>
                  </TouchableOpacity> */}
                </View>
              </ScrollView>
            ) : (
              <PayPalPayment
                plan={selectedPlan}
                clientId={PAYPAL_CLIENT_ID}
                clientSecret={PAYPAL_CLIENT_SECRET}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                onPaymentCancel={handlePaymentCancel}
              />
            )}
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export default PlansScreen;
