import {
  View,
  Text,
  SafeAreaView,
  Image,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Modal,
  RefreshControl,
} from "react-native";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Stack, router, useRouter } from "expo-router";
import Header from "@/components/Header";
import { icons } from "@/constant";
import { useLoader } from "@/context/LoaderContext";
import { auth, db, storage } from "@/lib/firebaseConfig";
import { signOut, sendEmailVerification, getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import * as Location from "expo-location";
import { formatDistance, set } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useFocusEffect } from "@react-navigation/native";
import useProfileCompletion from "@/hooks/useProfileCompletion";
import { LocationModalContent } from "@/components/profile/LocationModalContent";
import { EmailVerificationContent } from "@/components/profile/EmailVerificationContent";
import { IDVerificationContent } from "@/components/profile/IDVerificationContent";
import { ContactContent } from "@/components/profile/ContactContent";
import { BirthdayContent } from "@/components/profile/BirthdayContent";
import { ProfileImageContent } from "@/components/profile/ProfileImageContent";
import PayPalPayment from "@/components/PaypalPayment";
import PlanSubscription from "@/components/PlanSubscription";

import { User, Plan, PaymentTransaction, PayPalPaymentResult } from "@/types";

const Profile: React.FC = () => {
  const { isLoading, setIsLoading } = useLoader();
  const insets = useSafeAreaInsets();
  const [verified, setVerified] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(null);
  const [isClaiming, setIsClaiming] = useState(false); // Add this line
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null); // Add subscriptionId state
  const [showProfileCompletion, setShowProfileCompletion] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(true); // Add this state near your other state declarations

  const {
    isComplete,
    completionPercentage,
    missingFields,
    details,
    refreshStatus,
  } = useProfileCompletion();

  const isProfileComplete = completionPercentage >= 100;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (keyboardVisible && activeModal) {
            Keyboard.dismiss();
            return true;
          }
          return false;
        }
      );

      return () => backHandler.remove();
    }
  }, [keyboardVisible, activeModal]);

  useEffect(() => {
    const checkAuth = async () => {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        router.replace("/sign-in");
        return;
      }

      try {
        await currentUser.reload();
        currentUser = auth.currentUser; // Refresh currentUser after reload

        if (currentUser?.uid) {
          setCurrentUserId(currentUser.uid);
          await ensureUserProfileExists(currentUser.uid);
        }
        setVerified(currentUser?.emailVerified || false);

        // Force refresh profile completion status
        await refreshStatus();
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };

    checkAuth();
  }, [refreshFlag]);

  // Add this useEffect after your state declarations
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setIsLoading(true);
        const currentUser = auth.currentUser;
        if (!currentUser) return; // 🚨 stop if not logged in

        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          console.log("Fetched user data:", userData);

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
                  planType: userData.currentPlan.planType
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
      setIsLoading(false);
    };

    const currentUser = auth.currentUser;
    if (!currentUser) return; // 🚨 don’t set up snapshot if logged out

    // Fetch once
    fetchProfileData();

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      doc(db, "users", currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
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

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const ensureUserProfileExists = async (uid: string) => {
    try {
      if (!uid) return;
      const profileRef = doc(db, "users", uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          location: "",

          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error("Error ensuring profile exists:", error);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      setProfileData(null);
      setCurrentUserId(null);

      await signOut(auth);
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Successfully signed out.",
      });
      router.replace("/(auth)/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to sign out. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSave = async (contact: string) => {
    try {
      setLoading(true);
      const userRef = doc(db, "users", auth.currentUser?.uid || "");
      await updateDoc(userRef, {
        contactNumber: contact,
        updatedAt: new Date().toISOString(),
      });
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Contact Updated",
        textBody: "Your contact number has been updated successfully",
      });
      await refreshStatus();
      setActiveModal(null);
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update contact number",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBirthDateSave = async (date: string) => {
    try {
      setLoading(true);
      const userRef = doc(db, "users", auth.currentUser!.uid);
      await updateDoc(userRef, {
        birthday: date,
        updatedAt: new Date().toISOString(),
      });
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Birth Date Updated",
        textBody: "Your birth of date has been updated successfully",
      });
      await refreshStatus();
      setActiveModal(null);
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update birth date",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfileImage = async (imageUri: string) => {
    try {
      setLoading(true);

      // Check if user is authenticated
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "User not authenticated. Please log in again.",
        });
        return;
      }

      // Wait for auth to be ready
      await currentUser.reload();

      console.log("Current user UID:", currentUser.uid);
      console.log("User is authenticated:", !!currentUser);
      console.log("User email:", currentUser.email);
      console.log("User email verified:", currentUser.emailVerified);
      console.log("Auth token exists:", !!(await currentUser.getIdToken()));
      console.log("Storage path will be:", `users/${currentUser.uid}/avatar`);

      const userId = currentUser.uid;

      // Convert image URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Create storage reference
      const storageRef = ref(storage, `users/${userId}/avatar`);

      console.log("Uploading to path:", storageRef.fullPath);

      // Upload image
      await uploadBytes(storageRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update user profile in Firestore
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        profileImage: downloadURL,
        updatedAt: new Date().toISOString(),
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Profile picture updated successfully",
      });

      await refreshStatus();
      setActiveModal(null);
    } catch (error) {
      console.error("Error updating profile image:", error);
      if (error instanceof Error) {
        console.error("Error details:", (error as any).code, error.message);
      }
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: `Failed to update profile picture: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    } finally {
      setLoading(false);
    }
  };

  //Save Location (Data From Modal)
  const handleLocationSave = async (location: {
    latitude: number;
    longitude: number;
    address: string;
    radius?: number;
  }) => {
    try {
      setLoading(true);
      const userRef = doc(db, "users", auth.currentUser!.uid);
      await updateDoc(userRef, {
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
          radius: location.radius,
          updatedAt: new Date().toISOString(),
        },
      });
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Location Updated",
        textBody: "Your location has been updated successfully",
      });
      await refreshStatus();
      setActiveModal(null);
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update location",
      });
    } finally {
      setLoading(false);
    }
  };

  type IDType = "philsys" | "drivers" | "student";

  const ID_TYPES = [
    { label: "PhilSys ID", value: "philsys" },
    { label: "Driver's License", value: "drivers" },
    { label: "Student ID", value: "student" },
  ];

  const handleIdVerifySave = async (idVerified: {
    idImage: string;
    idNumber: string;
    idType: IDType;
  }) => {
    try {
      setLoading(true);
      const userId = auth.currentUser!.uid;

      // Upload ID image to Storage
      const response = await fetch(idVerified.idImage);
      const blob = await response.blob();
      const storageRef = ref(storage, `users/${userId}/id-verification`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      const idTypeLabel =
        ID_TYPES.find((t) => t.value === idVerified.idType)?.label ||
        idVerified.idType;

      // Update Firestore with ID verification data
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        idVerified: {
          idImage: downloadURL,
          idNumber: idVerified.idNumber,
          idType: idTypeLabel,
          updatedAt: new Date().toISOString(),
        },
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "ID Verification Updated",
        textBody: "Your ID verification has been submitted successfully",
      });

      await refreshStatus();

      setActiveModal(null);
    } catch (error) {
      console.error("Error updating ID verification:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update ID verification",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFirestoreDate = (firestoreTimestamp: any) => {
    try {
      if (!firestoreTimestamp) return "recently";

      // Firestore Timestamps have a .toDate() method
      if (
        firestoreTimestamp.toDate &&
        typeof firestoreTimestamp.toDate === "function"
      ) {
        const date = firestoreTimestamp.toDate();
        return formatDistance(date, new Date(), { addSuffix: true });
      }

      // Fallback for string dates (shouldn't happen with proper Firestore usage)
      if (typeof firestoreTimestamp === "string") {
        const date = new Date(firestoreTimestamp);
        if (!isNaN(date.getTime())) {
          return formatDistance(date, new Date(), { addSuffix: true });
        }
      }

      return "recently";
    } catch (error) {
      console.error("Error formatting Firestore date:", error);
      return "recently";
    }
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshStatus();
      setRefreshFlag((prev) => prev + 1);
    } catch (error) {
      console.error("Refresh error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to refresh profile data",
      });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const getInitials = (name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "?";
  };

  const ProfileCompletionSection = () => {
    if (isComplete) return null;
    if (!showProfileCompletion) return null;

    // Keep your existing steps array
    const steps = [
      {
        id: "emailVerification",
        title: "Verify Email",
        description: "Verify your email address for account security",
        icon: icons.envelope,
        isCompleted: details?.isEmailVerified || false,
      },
      {
        id: "profileImage",
        title: "Add Profile Picture",
        description: "Add a profile picture to personalize your account",
        icon: icons.user,
        isCompleted: details?.hasProfileImage ? true : false,
      },
      {
        id: "contact",
        title: "Add Contact Number",
        description: "Add your phone number for better communication",
        icon: icons.call,
        isCompleted: details?.hasContact ? true : false,
      },
      {
        id: "birthday",
        title: "Add Birthday",
        description: "Add your birth date to complete your profile",
        icon: icons.calendar,
        isCompleted: details?.hasBirthday ? true : false,
      },
      {
        id: "location",
        title: "Set Location",
        description: "Add your location to find items near you",
        icon: icons.location,
        isCompleted: details?.hasLocation ? true : false,
      },
      {
        id: "idVerification",
        title: "Verify ID",
        description: "Verify your identity for enhanced security",
        icon: icons.identity,
        isCompleted: details?.hasIdVerification || false,
      },
    ];

    const currentStepIndex = steps.findIndex((step) => !step.isCompleted);
    const currentStep = steps[currentStepIndex];

    return (
      <View className="absolute inset-0 z-60 bg-white">
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
          <Text className="text-primary font-pbold">
            {completionPercentage}%
          </Text>

          <Text className="text-lg font-pbold">Complete Your Profile</Text>
          <TouchableOpacity onPress={() => setShowProfileCompletion(false)}>
            <Image source={icons.close} className="w-7 h-7" />
          </TouchableOpacity>
        </View>

        {/* Vertical Steps Layout */}
        <ScrollView className="flex-1  mt-2 align-center">
          {steps.map((step, index) => (
            <TouchableOpacity
              key={step.id}
              onPress={() =>
                index === currentStepIndex && setActiveModal(step.id)
              }
              activeOpacity={index === currentStepIndex ? 0.7 : 1}
              className={`mb-4 ${
                index === currentStepIndex ? "scale-100" : "scale-95"
              }`}
            >
              <View
                className={`flex-row items-center p-2 rounded-xl ${
                  index === currentStepIndex
                    ? "bg-green-50 border-2 border-primary"
                    : index < currentStepIndex
                    ? "bg-gray-50 border border-gray-100"
                    : "bg-gray-50/50 border border-gray-100"
                }`}
              >
                {/* Step Number/Check */}
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${
                    index === currentStepIndex
                      ? "bg-primary  "
                      : index < currentStepIndex
                      ? "bg-primary"
                      : "bg-gray-200"
                  }`}
                >
                  {step.isCompleted ? (
                    <Image
                      source={icons.check}
                      className="w-6 h-6"
                      style={{ tintColor: "white" }}
                    />
                  ) : (
                    <Text className="text-white font-pbold text-lg">
                      {index + 1}
                    </Text>
                  )}
                </View>

                {/* Content */}
                <View className="flex-1">
                  <Text
                    className={`text-lg font-pbold ${
                      index === currentStepIndex
                        ? "text-primary"
                        : index < currentStepIndex
                        ? "text-gray-800"
                        : "text-gray-400"
                    }`}
                  >
                    {step.title}
                  </Text>
                  <Text
                    className={`text-sm mt-1 ${
                      index === currentStepIndex
                        ? "text-primary/80"
                        : index < currentStepIndex
                        ? "text-gray-600"
                        : "text-gray-400"
                    }`}
                  >
                    {step.description}
                  </Text>
                </View>

                {/* Arrow for current step */}
                {index === currentStepIndex && (
                  <Image
                    source={icons.arrowRight}
                    className="w-6 h-6 ml-2"
                    style={{ tintColor: "#4BD07F" }}
                  />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const claimFreePlan = async () => {
    try {
      setIsClaiming(true);
      const userRef = doc(db, "users", auth.currentUser!.uid);
      const plansRef = collection(db, "plans");
      const q = query(plansRef, where("planType", "==", "free"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Free plan not found");
      }

      // Get the first matching plan
      const freePlan = querySnapshot.docs[0];
      const planData = freePlan.data();

      await updateDoc(userRef, {
        currentPlan: {
          planId: freePlan.id,
          planType: planData.planType.toLowerCase(),
          rentLimit: planData.rent,
          listLimit: planData.list,
          rentUsed: 0,
          listUsed: 0,
          status: "Active",
        },
        status: "Active",
        updatedAt: new Date().toISOString(),
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Free Plan Claimed",
        textBody: "You can now start renting and listing items!",
      });
    } catch (error) {
      console.error("Error claiming free plan:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to claim free plan. Please try again.",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  const ClaimFreePlanSection = () => {
    // Simplified condition with proper type checking
    if (!isComplete || profileData?.currentPlan != null) {
      console.log("ClaimFreePlanSection hidden due to:", {
        isComplete,
        hasCurrentPlan: profileData?.currentPlan != null,
      });
      return null;
    }

    return (
      <>
        {!isLoading && (
          <View className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Image
                    source={icons.bronzePlan}
                    className="w-[20] h-[20] mr-2"
                    resizeMode="contain"
                  />
                  <Text className="text-lg font-pbold text-orange-700">
                    Claim Your Free Plan!
                  </Text>
                </View>
                <Text className="text-sm font-pregular text-orange-400 mt-1">
                  You've completed your profile. Claim your free plan to start
                  renting and listing items!
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={claimFreePlan}
              disabled={isClaiming}
              className={`w-full ${
                isClaiming ? "bg-orange-300" : "bg-orange-400"
              } py-4 rounded-xl`}
            >
              <Text className="text-white text-center font-pbold text-lg">
                {isClaiming ? "Claiming..." : "Claim Free Plan"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case "location":
        return (
          <LocationModalContent onSave={handleLocationSave} loading={loading} />
        );
      case "emailVerification":
        return (
          <EmailVerificationContent
            onClose={async () => {
              if (auth.currentUser) {
                await auth.currentUser.reload();
              }

              // Force refresh the profile completion status
              await refreshStatus();

              // Update other states
              setRefreshFlag((prev) => prev + 1);
              setActiveModal(null);
            }}
            onVerified={async () => {
              // Force refresh the profile completion status
              await refreshStatus();

              // Force UI update
              setRefreshFlag((prev) => prev + 1);
            }}
          />
        );
      case "location":
        return (
          <LocationModalContent onSave={handleLocationSave} loading={loading} />
        );
      case "idVerification":
        return (
          <IDVerificationContent
            onSave={handleIdVerifySave}
            loading={loading}
          />
        );
      case "profileImage":
        return (
          <ProfileImageContent
            onSave={handleSaveProfileImage}
            loading={loading}
          />
        );
      case "contact":
        return <ContactContent onSave={handleContactSave} loading={loading} />;
      case "birthday":
        return <BirthdayContent onSave={handleBirthDateSave} />;
      default:
        return null;
    }
  };

  const ProfileMenuList = () => {
    return (
      <View className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6">
        {/* Quick Actions */}
        <View className="divide-y divide-red-100 px-6">
          {isProfileComplete && (
            <>
              <TouchableOpacity
                onPress={() => router.push("/payment-options")}
                className="flex-row items-center py-4"
                disabled={!isProfileComplete}
              >
                <Image
                  source={icons.card}
                  className="w-6 h-6 mr-3"
                  tintColor="#6B7280"
                />
                <Text className="flex-1 font-pmedium text-gray-800">
                  Payment Options
                </Text>
                <Image
                  source={icons.arrowRight}
                  className="w-5 h-5"
                  tintColor="#9CA3AF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/plans")}
                className="flex-row items-center py-4 border-t border-gray-200"
                disabled={!isProfileComplete}
              >
                <Image
                  source={icons.sparkle}
                  className="w-6 h-6 mr-3"
                  tintColor="#6B7280"
                />
                <Text className="flex-1 font-pmedium text-gray-800">
                  Subscription
                </Text>
                <Image
                  source={icons.arrowRight}
                  className="w-5 h-5"
                  tintColor="#9CA3AF"
                />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => router.push("/transactions")}
            className="flex-row items-center py-4 border-t border-gray-200"
          >
            <Image
              source={icons.receipt}
              className="w-6 h-6 mr-3"
              tintColor="#6B7280"
            />
            <Text className="flex-1 font-pmedium text-gray-800">
              Transactions
            </Text>
            <Image
              source={icons.arrowRight}
              className="w-5 h-5"
              tintColor="#9CA3AF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/create-ticket")}
            className="flex-row items-center py-4 border-t border-gray-200"
          >
            <Image
              source={icons.ticket}
              className="w-6 h-6 mr-3"
              tintColor="#6B7280"
              resizeMode="contain"
            />
            <Text className="flex-1 font-pmedium text-gray-800">
              Submit Ticket
            </Text>
            <Image
              source={icons.arrowRight}
              className="w-5 h-5"
              tintColor="#9CA3AF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/setting")}
            className="flex-row items-center py-4 border-t border-gray-200"
          >
            <Image
              source={icons.faq}
              className="w-6 h-6 mr-3"
              tintColor="#6B7280"
              resizeMode="contain"
            />
            <Text className="flex-1 font-pmedium text-gray-800">
              Help and Info
            </Text>
            <Image
              source={icons.arrowRight}
              className="w-5 h-5"
              tintColor="#9CA3AF"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      className="bg-white h-full px-4"
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
    >
      {!showProfileCompletion && <Header />}
      <KeyboardAvoidingView
        behavior={Platform.OS === "android" ? "height" : "padding"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={{
            paddingBottom: keyboardVisible ? 120 : 20,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={["#2563EB"]}
              tintColor="#2563EB"
              progressBackgroundColor="#ffffff"
            />
          }
        >
          {!isProfileComplete && !isLoading && (
            <TouchableOpacity
              className=" mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl"
              onPress={() => setShowFullDetails(!showFullDetails)}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center flex-1">
                  <Image source={icons.danger} className="w-5 h-5 mr-2" />
                  <Text className="text-yellow-800 font-pbold flex-1">
                    Complete Your Profile
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-yellow-800 font-pbold mr-2">
                    {completionPercentage}%
                  </Text>
                  <Image
                    source={
                      showFullDetails ? icons.arrowDown : icons.arrowRight
                    }
                    className="w-4 h-4"
                    tintColor="#92400E"
                  />
                </View>
              </View>

              {/* Progress Bar */}
              <View className="bg-yellow-200 rounded-full h-2 mb-3">
                <View
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${completionPercentage}%` }}
                />
              </View>

              {/* Expandable Content */}
              {showFullDetails && (
                <>
                  {/* Benefits List */}
                  <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                      <Image source={icons.verified} className="w-4 h-4 mr-2" />
                      <Text className="text-yellow-800 text-sm">
                        Get Verified Badge
                      </Text>
                    </View>
                    <View className="flex-row items-center mb-2">
                      <Image
                        source={icons.bronzePlan}
                        className="w-4 h-4 mr-2"
                      />
                      <Text className="text-yellow-800 text-sm">
                        Free Bronze Plan Access
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Image
                        source={icons.eye}
                        className="w-4 h-4 mr-2"
                        tintColor="#92400E"
                      />
                      <Text className="text-yellow-800 text-sm">
                        View Full Item Details
                      </Text>
                    </View>
                  </View>

                  {/* Complete Profile Button */}
                  <TouchableOpacity
                    onPress={() => setShowProfileCompletion(true)}
                    className="bg-yellow-600 py-3 rounded-lg"
                  >
                    <Text className="text-white text-center font-pbold">
                      Complete Profile Now
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          )}

          {currentUserId && (
            <View className="bg-white rounded-2xl mb-4">
              {/* Profile Header Section */}
              <View className="p-2 items-center">
                {/* Profile Image with Camera Icon */}
                <TouchableOpacity
                  onPress={() => setActiveModal("profileImage")}
                  className="relative"
                >
                  <View className="w-28 h-28 rounded-full overflow-hidden border-2 border-primary">
                    {profileData?.profileImage ? (
                      <Image
                        source={{ uri: profileData.profileImage }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-full h-full bg-primary justify-center items-center">
                        <Text className="font-pbold text-2xl text-white">
                          {getInitials(profileData?.firstname || "")}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow">
                    <Image
                      source={icons.pencil}
                      className="w-3 h-3"
                      tintColor="#4B5563"
                    />
                  </View>
                </TouchableOpacity>

                {/* Name and Badges */}
                <View className="mt-4 items-center">
                  <Text className="font-pbold text-xl text-gray-800">
                    {profileData?.firstname || ""}
                    {profileData?.middlename
                      ? ` ${getInitials(profileData.middlename)}. `
                      : " "}
                    {profileData?.lastname || ""}
                  </Text>

                  {/* Active Since */}
                  <Text className="text-gray-500 text-sm mt-1">
                    Created {formatFirestoreDate(profileData?.createdAt)}
                  </Text>

                  {/* Badges Row */}
                  <View className="flex-row mt-3 space-x-2">
                    {completionPercentage === 100 ? (
                      <View className="flex-row items-center bg-blue-50 px-2 py-1 rounded-full">
                        <Image
                          source={icons.verified}
                          className="w-4 h-4"
                          resizeMode="contain"
                        />
                        <Text className="text-xs font-pmedium text-blue-600 ml-1">
                          Verified
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center bg-gray-50 px-2 py-1 rounded-full">
                        <Image
                          source={icons.unverified}
                          className="w-4 h-4"
                          resizeMode="contain"
                        />
                        <Text className="text-xs font-pmedium text-gray-600 ml-1">
                          Incomplete
                        </Text>
                      </View>
                    )}

                    {completionPercentage === 100 &&
                      profileData?.currentPlan?.planType && (
                        <View className="flex-row items-center bg-purple-50 px-2 py-1 rounded-full">
                          <Image
                            source={
                              profileData.currentPlan.planType === "Free"
                                ? icons.bronzePlan
                                : profileData.currentPlan.planType === "Basic"
                                ? icons.silverPlan
                                : profileData.currentPlan.planType === "Premium"
                                ? icons.goldPlan
                                : profileData.currentPlan.planType === "Limited"
                                ? icons.platinumPlan
                                : icons.bronzePlan // fallback
                            }
                            className="w-4 h-4"
                            resizeMode="contain"
                          />
                          <Text className="text-xs font-pmedium text-orange-500 ml-1">
                            {profileData.currentPlan.planType
                              .charAt(0)
                              .toUpperCase() +
                              profileData.currentPlan.planType
                                .slice(1)
                                .toLowerCase()}
                          </Text>
                        </View>
                      )}
                  </View>
                </View>
              </View>

              {/* Plan Details if exists */}
              {/* {profileData?.currentPlan && (
                <View className="px-6 py-4 border-t border-gray-100">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="font-pmedium text-gray-600">
                      Rent Limit
                    </Text>
                    <Text className="font-pbold text-gray-800">
                      {profileData.currentPlan.rentUsed || 0}/
                      {profileData.currentPlan.rentLimit || 0}
                    </Text>
                  </View>
                  <View className="flex-row justify-between items-center">
                    <Text className="font-pmedium text-gray-600">
                      List Limit
                    </Text>
                    <Text className="font-pbold text-gray-800">
                      {profileData.currentPlan.listUsed || 0}/
                      {profileData.currentPlan.listLimit || 0}
                    </Text>
                  </View>
                </View>
              )} */}
            </View>
          )}

          <ClaimFreePlanSection />

          {/* Personal Information Section */}
          <View className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
            <View className="p-6 gap-y-4">
              <Text className=" font-pbold text-lg text-gray-800 ">
                Personal Information
              </Text>
              <View className="flex-row items-center border-t border-gray-200 pt-2">
                <Image
                  source={icons.envelope}
                  className="w-5 h-5 mr-3"
                  tintColor="#6B7280"
                />
                <View>
                  <Text className="text-gray-500 text-sm">Email</Text>
                  <Text className="text-gray-800 font-pmedium">
                    {auth.currentUser?.email || "Not set"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                className="flex-row justify-between items-center border-t border-gray-200 pt-2"
                onPress={() => setActiveModal("contact")}
              >
                <View className="flex-row justify-center items-center">
                  <Image
                    source={icons.call}
                    className="w-5 h-5 mr-3"
                    tintColor="#6B7280"
                  />
                  <View>
                    <Text className="text-gray-500 text-sm">Phone</Text>
                    <Text className="text-gray-800 font-pmedium">
                      {profileData?.contactNumber || "Not set"}
                    </Text>
                  </View>
                </View>
                <Image
                  source={icons.arrowRight}
                  className="w-5 h-5"
                  tintColor="#9CA3AF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-row justify-between items-center border-t border-gray-200 pt-2"
                onPress={() => setActiveModal("location")}
              >
                <View className="flex-row justify-start items-center w-min-[80%] w-[90%]  border border-white">
                  <Image
                    source={icons.location}
                    className="w-5 h-5 mr-3"
                    tintColor="#6B7280"
                  />
                  <View>
                    <Text className="text-gray-500 text-sm">Location</Text>
                    <Text className="text-gray-800 font-pmedium pr-4">
                      {profileData?.location?.address || "Not set"}
                    </Text>
                  </View>
                </View>
                <Image
                  source={icons.arrowRight}
                  className="w-5 h-5 "
                  tintColor="#9CA3AF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Menu List Section - Replace the existing buttons with this new menu list component */}
          <ProfileMenuList />

          {/* Logout Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLogout}
            className="bg-red-400 rounded-xl p-4 mb-6"
          >
            <View className="flex-row items-center justify-center">
              <Image
                source={icons.logout}
                className="w-[24px] h-[24px] mr-4"
                resizeMode="contain"
                tintColor={"#FFFFFF"}
              />
              <Text className="text-white font-pbold text-lg">Log Out</Text>
            </View>
          </TouchableOpacity>

          {/* Add this Modal component */}
          <Modal
            visible={!!activeModal}
            transparent
            animationType="slide"
            onRequestClose={() => {
              onRefresh();
              setActiveModal(null);
            }}
          >
            <View className="flex-1 bg-black/50">
              <View className="flex-1 m-4 bg-white rounded-3xl overflow-hidden">
                {/* Modal Header */}
                <View className="p-4 px-6 border-b border-gray-200 flex-row items-center justify-between">
                  <TouchableOpacity onPress={() => setActiveModal(null)}>
                    <Text className="text-red-400 font-pmedium text-lg">
                      Close
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-lg font-pbold">
                    {activeModal === "location" && "Set Your Location"}
                    {activeModal === "emailVerification" && "Verify Email"}
                    {activeModal === "idVerification" && "Verify ID"}
                    {activeModal === "birthday" && "Birth Date"}
                    {activeModal === "contact" && "Contact Number"}
                    {activeModal === "profileImage" && "Profile Picture"}
                  </Text>
                  <View style={{ width: 50 }} />
                </View>
                {/* Add a flex-1 wrapper for the content */}
                <View className="flex-1">{renderModalContent()}</View>
              </View>
            </View>
          </Modal>
        </ScrollView>

        {/* Profile Completion Section */}
        <ProfileCompletionSection />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Profile;
