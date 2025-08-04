import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { images, icons } from "../../constant";
import { useSafeAreaInsets } from "react-native-safe-area-context";

declare global {
  var passwordResetStartTime: number | null;
}
import LargeButton from "../../components/LargeButton";
import { router } from "expo-router";
import { useLoader } from "@/context/LoaderContext";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { auth } from "@/lib/firebaseConfig";
import { sendPasswordResetEmail } from "firebase/auth";

const ForgotPassword = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setIsLoading } = useLoader();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isTouched, setIsTouched] = useState(false);
  const insets = useSafeAreaInsets();

  // Timer states
  const [isDisabled, setIsDisabled] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Check if there's an existing timer on component mount
  useEffect(() => {
    const checkExistingTimer = () => {
      const savedStartTime = global.passwordResetStartTime;
      if (savedStartTime) {
        const elapsed = Date.now() - savedStartTime;
        const remaining = Math.max(0, 60000 - elapsed); // 60 seconds in ms

        if (remaining > 0) {
          setIsDisabled(true);
          setRemainingTime(Math.ceil(remaining / 1000));
          startTimer(remaining);
        } else {
          // Timer has expired, clean up
          global.passwordResetStartTime = null;
        }
      }
    };

    checkExistingTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startTimer = (duration = 60000) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const startTime = Date.now();
    startTimeRef.current = startTime;
    global.passwordResetStartTime = startTime;

    const updateTimer = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);

      if (remaining > 0) {
        setRemainingTime(Math.ceil(remaining / 1000));
        timerRef.current = setTimeout(updateTimer, 1000);
      } else {
        // Timer finished
        setIsDisabled(false);
        setRemainingTime(0);
        global.passwordResetStartTime = null;
        timerRef.current = null;
      }
    };

    updateTimer();
  };

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

  // Handle email change with real-time validation
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (isTouched) {
      setEmailError(validateEmail(text));
    }
  };

  const handleResetPassword = async () => {
    // Hide Keyboard
    Keyboard.dismiss();

    // Check if button is disabled
    if (isDisabled) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Please Wait",
        textBody: `Please wait ${remainingTime} seconds before trying again.`,
      });
      return;
    }

    // Final validation before submission
    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Invalid Email",
        textBody: validationError,
      });
      return;
    }

    // Set loading states
    setIsSubmitting(true);
    setIsLoading(true);

    try {
      // Send password reset email
      await sendPasswordResetEmail(auth, email.trim());

      // Start the 1-minute timer
      setIsDisabled(true);
      startTimer();

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Email Sent",
        textBody: "Check your email for password reset instructions.",
      });

      // Navigate back to login after short delay
      setTimeout(() => {
        router.back();
      }, 1000);
    } catch (error) {
      // Handle specific Firebase errors
      const errorCode =
        error instanceof Error ? (error as { code?: string }).code : "unknown";
      switch (errorCode) {
        case "auth/user-not-found":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "User Not Found",
            textBody: "No account exists with this email address.",
          });
          break;
        case "auth/invalid-email":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Invalid Email",
            textBody: "Please enter a valid email address.",
          });
          break;
        case "auth/too-many-requests":
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Too Many Attempts",
            textBody: "Too many requests. Please try again later.",
          });
          break;
        default:
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Failed",
            textBody: "Password reset failed. Please try again.",
          });
      }
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isButtonDisabled = isSubmitting || !!emailError || !email || isDisabled;

  // Add screen height constant
  const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
              {/* Move logo section to fixed position */}
              <View>
                <Image
                  source={images.logo}
                  className="w-full h-[35px]"
                  resizeMode="contain"
                />
              </View>

              {/* Content wrapper */}
              <View className="justify-center mt-8">
                <Text className="text-3xl text-secondary-400 font-psemibold">
                  Reset Your Password
                </Text>

                <Text className="text-base text-secondary-300 font-pregular mt-2 mb-6">
                  Enter your email address and we'll send you instructions to
                  reset your password.
                </Text>

                {/* Email input section */}
                <View className="mt-4">
                  <Text className="text-xl font-pmedium text-secondary-300 mb-2">
                    Email
                  </Text>
                  <View
                    className={`border-2 p-1 rounded-xl overflow-hidden ${
                      emailError
                        ? "border-red-500"
                        : isTouched && !emailError
                        ? "border-green-500"
                        : "border-secondary-300 "
                    }`}
                  >
                    <TextInput
                      value={email}
                      onChangeText={handleEmailChange}
                      onBlur={() => setIsTouched(true)}
                      placeholder="Enter your email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      className="px-4 py-3 font-psemibold text-base text-secondary-400"
                    />
                  </View>
                  {emailError && (
                    <Text className="text-red-500 text-sm mt-1 ml-2">
                      {emailError}
                    </Text>
                  )}
                </View>

                {/* Button section */}
                <View className="mt-6">
                  <LargeButton
                    title={
                      isSubmitting
                        ? "Sending..."
                        : isDisabled
                        ? `Wait ${formatTime(remainingTime)}`
                        : "Send Reset Link"
                    }
                    handlePress={handleResetPassword}
                    containerStyles={`w-full ${
                      isButtonDisabled ? "bg-gray-300" : "bg-primary"
                    }`}
                    disabled={isButtonDisabled}
                    textStyles="text-white font-pbold text-lg"
                  />

                  {isDisabled && (
                    <Text className="text-center text-secondary-300 text-sm mt-2">
                      Please wait {formatTime(remainingTime)} before requesting
                      another reset email
                    </Text>
                  )}
                </View>

                {/* Footer section */}
                <View className="mt-8 flex-row justify-center gap-2">
                  <Text className="text-lg text-secondary-400 font-pregular">
                    Remember your password?
                  </Text>
                  <TouchableOpacity onPress={() => router.back()}>
                    <Text className="text-lg font-psemibold text-primary">
                      Log In
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPassword;
