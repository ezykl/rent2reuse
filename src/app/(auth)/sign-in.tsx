import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Modal,
  Alert,
  Dimensions,
} from "react-native";
import React, { useState } from "react";
import { images } from "../../constant";
import InputField from "../../components/InputField";
import LargeButton from "../../components/LargeButton";
import { Link, router } from "expo-router";
import { useLoader } from "@/context/LoaderContext";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { auth, db } from "@/lib/firebaseConfig";
import {
  signInWithEmailAndPassword,
  User,
  UserCredential,
} from "@firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  checkActiveSession,
  createUserSession,
  terminateUserSessions,
} from "@/lib/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePushNotifications } from "@/utils/userPushNotifications";
import { manageUserToken } from "@/utils/tokenManagement";
import { useAuth } from "@/context/AuthContext";

// Type definitions
interface FormData {
  email: string;
  password: string;
}

interface ValidationErrors {
  email: string;
  password: string;
}

interface SessionCheckResult {
  hasActiveSession: boolean;
  sessions: any[];
}

interface UserData {
  role: string;
  accountStatus: "Active" | "Suspended";
  // Add other user data properties as needed
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SignIn = () => {
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [form, setForm] = useState<FormData>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({
    email: "",
    password: "",
  });
  const [activeSessionFound, setActiveSessionFound] = useState<boolean>(false);
  const [pendingAuth, setPendingAuth] = useState<User | null>(null);
  const [suspendedModalVisible, setSuspendedModalVisible] =
    useState<boolean>(false);
  const { expoPushToken } = usePushNotifications();
  const { setSignupMode } = useAuth();

  // Email validation function
  const validateEmail = (email: string): string => {
    if (!email.trim()) {
      return "Email is required";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return "Please enter a valid email address";
    }

    return "";
  };

  // Password validation function
  const validatePassword = (password: string): string => {
    if (!password) {
      return "Password is required";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters long";
    }

    return "";
  };

  // Handle email change with real-time validation
  const handleEmailChange = (email: string) => {
    setForm((prev) => ({ ...prev, email }));

    // Real-time validation
    const emailError = validateEmail(email);
    setErrors((prev) => ({ ...prev, email: emailError }));
  };

  // Handle password change with real-time validation
  const handlePasswordChange = (password: string) => {
    setForm((prev) => ({ ...prev, password }));

    // Real-time validation
    const passwordError = validatePassword(password);
    setErrors((prev) => ({ ...prev, password: passwordError }));
  };

  // Validate all fields
  const validateAllFields = (): boolean => {
    const emailError = validateEmail(form.email);
    const passwordError = validatePassword(form.password);

    setErrors({
      email: emailError,
      password: passwordError,
    });

    return !emailError && !passwordError;
  };

  // Check user account status
  const checkAccountStatus = async (uid: string): Promise<boolean> => {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        setSignupMode(true);
        console.log("User document does not exist");
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Account Not Found",
          textBody: "Your account setup is incomplete.",
        });
        await auth.signOut();
        return false;
      }

      const userData = userDoc.data() as UserData;
      console.log("User data:", userData);

      // Check if user has valid role
      if (!userData.role || userData.role.trim().toLowerCase() !== "user") {
        console.log("Invalid user role:", userData.role);
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Unauthorized Access",
          textBody: "This account doesn't have user access.",
        });
        return false;
      }

      // If accountStatus is not explicitly set, assume Active for backward compatibility
      if (!userData.accountStatus || userData.accountStatus === "Active") {
        console.log("Account is active or status not set - allowing login");
        return true;
      }

      // Handle any other unexpected status
      console.log("Unknown account status:", userData.accountStatus);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Account Status Unknown",
        textBody: "Unable to verify account status. Please contact support.",
      });
      return false;
    } catch (error) {
      // console.error("Error checking account status:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Verification Failed",
        textBody: "Unable to verify account status. Please try again.",
      });
      return false;
    }
  };

  const handleSessionConflict = async (proceed: boolean): Promise<void> => {
    if (!pendingAuth) return;

    setActiveSessionFound(false);

    if (proceed) {
      try {
        setIsLoading(true);

        // Verify the active sessions first
        const { hasActiveSession, sessions }: SessionCheckResult =
          await checkActiveSession(pendingAuth.uid);

        if (hasActiveSession && sessions.length > 0) {
          console.log(`Found ${sessions.length} active sessions to terminate`);

          // First terminate all existing sessions
          const terminateResult = await terminateUserSessions(pendingAuth.uid);
          console.log("Termination result:", terminateResult);

          // Wait a moment to ensure termination propagates
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Verify all sessions are actually terminated
          const checkAfterTerminate: SessionCheckResult =
            await checkActiveSession(pendingAuth.uid);
          if (checkAfterTerminate.hasActiveSession) {
            console.log(
              "⚠️ Warning: Some sessions still active after termination attempt"
            );
          } else {
            console.log("✅ All sessions successfully terminated");
          }
        }

        // Create a new session for the current device
        const sessionResult = await createUserSession(pendingAuth.uid);
        console.log("Session creation result:", sessionResult);

        if (sessionResult.error) {
          throw new Error(sessionResult.error);
        }

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Success",
          textBody:
            "Logged in successfully! Previous sessions were terminated.",
        });

        router.replace("/home");
      } catch (error) {
        // console.error("Error handling session conflict:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Login Failed",
          textBody: "Something went wrong during login.",
        });
      } finally {
        setPendingAuth(null);
        setIsLoading(false);
      }
    } else {
      // User chose not to proceed
      setPendingAuth(null);
      Toast.show({
        type: ALERT_TYPE.INFO,
        title: "Login Cancelled",
        textBody: "Login was cancelled. Previous session remains active.",
      });
    }
  };

  const completeSignIn = async (
    userCredential: UserCredential
  ): Promise<void> => {
    try {
      // Check if user has an active session
      const { hasActiveSession, sessions }: SessionCheckResult =
        await checkActiveSession(userCredential.user.uid);

      if (hasActiveSession) {
        // Store the user credential and show the conflict modal
        setPendingAuth(userCredential.user);
        setActiveSessionFound(true);
      } else {
        // No active sessions, create a new one
        await createUserSession(userCredential.user.uid);

        // Register the push token for this user
        await manageUserToken(userCredential.user.uid, expoPushToken?.data);

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Success",
          textBody: "Logged in successfully!",
        });

        router.replace("/home");
      }
    } catch (error) {
      console.error("Error completing sign in:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Login Failed",
        textBody: "Something went wrong during login.",
      });
    }
  };

  // Update the submit function with validation and account status check
  const submit = async (): Promise<void> => {
    Keyboard.dismiss();

    // Validate all fields before submission
    if (!validateAllFields()) {
      const errorMessages = [];
      if (errors.email) errorMessages.push(errors.email);
      if (errors.password) errorMessages.push(errors.password);

      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Please Check Your Input",
        textBody: errorMessages.join("\n"),
      });
      return;
    }

    const trimmedEmail = form.email.trim().toLowerCase();
    setForm((prevForm) => ({ ...prevForm, email: trimmedEmail }));

    try {
      setIsSubmitting(true);
      setIsLoading(true);

      // First, authenticate with Firebase Auth
      const userCredential: UserCredential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        form.password
      );

      // Check account status and role
      console.log("Checking account status for user:", userCredential.user.uid);
      const isAccountValid = await checkAccountStatus(userCredential.user.uid);
      console.log("Account valid result:", isAccountValid);

      if (!isAccountValid) {
        console.log("Account is not valid - signing out and stopping login");
        // Sign out the user if account is not valid (suspended, invalid role, etc.)
        await auth.signOut();
        // Stop execution here - don't proceed with login
        return;
      }

      console.log("Account is valid - proceeding with session management");
      // Account is valid, proceed with session management
      if (isAccountValid) {
        await completeSignIn(userCredential);
      }
    } catch (error: any) {
      // console.log(error);
      const errorCode = error.code;
      switch (errorCode) {
        case "auth/wrong-password":
        case "auth/invalid-credential":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Invalid Credentials",
            textBody: "Check your email and password again.",
          });
          break;
        case "auth/invalid-email":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Invalid Email",
            textBody: "Please enter a valid email address.",
          });
          break;
        case "auth/user-disabled":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Account Disabled",
            textBody: "This account has been disabled.",
          });
          break;
        case "auth/user-not-found":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Account Not Found",
            textBody: "No account found with this email.",
          });
          await auth.signOut();
          break;
        default:
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Login Failed",
            textBody: "Something went wrong during login.",
          });
      }
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            minHeight: SCREEN_HEIGHT,
            paddingBottom: 20,
          }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              className="flex-1 px-4 mt-8"
              style={{ paddingTop: insets.top }}
            >
              {/* Logo section */}
              <View>
                <Image
                  source={images.logo}
                  className="w-full h-[35px]"
                  resizeMode="contain"
                />
              </View>

              {/* Content wrapper */}
              <View className=" justify-center mt-8">
                <Text className="text-3xl text-secondary-400 font-psemibold">
                  Log In
                </Text>

                {/* Email Input Field with Error */}
                <View className="mt-4">
                  <InputField
                    title="Email"
                    value={form.email}
                    placeholder="Enter Email"
                    handleChangeText={handleEmailChange}
                    otherStyles=""
                    keyboardType="email-address"
                  />
                  {errors.email ? (
                    <Text className="text-red-500 text-sm mt-1 ml-2">
                      {errors.email}
                    </Text>
                  ) : null}
                </View>

                {/* Password Input Field with Error */}
                <View className="mt-7">
                  <InputField
                    title="Password"
                    value={form.password}
                    placeholder="Enter Password"
                    handleChangeText={handlePasswordChange}
                    otherStyles=""
                  />
                  {errors.password ? (
                    <Text className="text-red-500 text-sm mt-1 ml-2">
                      {errors.password}
                    </Text>
                  ) : null}
                </View>

                <View className="w-full pt-5 px-2 flex flex-row justify-end">
                  <TouchableOpacity
                    onPress={() => router.push("/forgot-password")}
                  >
                    <Text className=" text-lg text-secondary-400 font-pmedium">
                      Forgot Password
                    </Text>
                  </TouchableOpacity>
                </View>

                <LargeButton
                  title="Log In"
                  handlePress={submit}
                  containerStyles="w-full mt-7"
                  textStyles={"text-white"}
                  isLoading={isSubmitting}
                />

                {/* Footer Links */}
                <View className="flex justify-center pt-5 flex-row gap-2">
                  <Text className="text-lg text-secondary-400 font-pregular">
                    Don't have an account?
                  </Text>
                  <Link
                    href="/sign-up"
                    className="text-lg font-psemibold text-primary"
                  >
                    Create Account
                  </Link>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Active Session Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={activeSessionFound}
        onRequestClose={() => handleSessionConflict(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white rounded-lg p-6 m-4 w-5/6 shadow-lg">
            <Text className="text-xl font-psemibold text-secondary-400 mb-3">
              Account Already Logged In
            </Text>
            <Text className="text-base text-secondary-300 mb-5">
              This account is already logged in on another device. Do you want
              to sign in here and log out from other devices?
            </Text>

            <View className="flex-row justify-end gap-4">
              <TouchableOpacity
                onPress={() => handleSessionConflict(false)}
                className="py-2 px-4"
              >
                <Text className="text-gray-500 font-pmedium">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSessionConflict(true)}
                className="bg-primary py-2 px-4 rounded-md"
              >
                <Text className="text-white font-pmedium">Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SignIn;
