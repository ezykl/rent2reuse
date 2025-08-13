import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from "react-native";
import React, { useState, useRef } from "react";
import { images } from "../../constant";
import InputField from "../../components/InputField";
import LargeButton from "../../components/LargeButton";
import { Link, router, useRouter } from "expo-router";
import Terms from "./terms"; // Import Terms and Conditions component
import { Checkbox, useTheme } from "react-native-paper"; // Ensure you have this installed
import { ALERT_TYPE, Dialog, Toast } from "react-native-alert-notification";
import { useLoader } from "@/context/LoaderContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createUserWithEmailAndPassword } from "@firebase/auth";
import { auth, db } from "@/lib/firebaseConfig";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

const SignUp = () => {
  const insets = useSafeAreaInsets();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { isLoading, setIsLoading } = useLoader();
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  const [form, setForm] = useState<{
    firstname: string;
    middlename?: string;
    lastname: string;
    email: string;
    password: string;
    confirmPass: string;
  }>({
    firstname: "",
    middlename: "",
    lastname: "",
    email: "",
    password: "",
    confirmPass: "",
  });

  // Real-time validation states
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPass?: string;
    firstname?: string;
    lastname?: string;
  }>({});

  // Add/update these state variables at the top of your component
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const termsScrollRef = useRef<ScrollView>(null);

  const handleTermsScroll = ({ nativeEvent }: { nativeEvent: any }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
    setIsAtBottom(isCloseToBottom);
  };

  // Real-time validation functions
  const validateEmail = (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return "Email is required";
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) return "Invalid email format";
    return "";
  };

  const validatePassword = (password: string) => {
    const errors: string[] = [];

    if (!password) {
      errors.push("Password is required\n");
      return errors;
    }

    if (password.length < 6) {
      errors.push("Must be at least 6 characters\n");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Must include at least 1 uppercase letter\n");
    }

    if (!/\d/.test(password)) {
      errors.push("Must include at least 1 number\n");
    }

    if (!/[!@#$%^&*()\-_=\+\[\]{};:,.?\/|]/.test(password)) {
      errors.push(
        "Must include at least 1 special character (!@#$%^&*()-_=+[]{};:,.?/|)"
      );
    }

    return errors;
  };

  const validateConfirmPassword = (confirmPass: string, password: string) => {
    if (!confirmPass) return "Please confirm your password";
    if (confirmPass !== password) return "Passwords do not match";
    return "";
  };

  const validateName = (name: string, fieldName: string) => {
    if (!name.trim()) return `${fieldName} is required`;
    if (!/^[a-zA-Z\s]+$/.test(name)) {
      return `${fieldName} should contain only letters and spaces`;
    }
    return "";
  };

  // Handle form changes with real-time validation
  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    // Real-time validation
    let error = "";
    switch (field) {
      case "email":
        error = validateEmail(value);
        break;
      case "password":
        error = validatePassword(value).join("");
        // Also revalidate confirm password if it exists
        if (form.confirmPass) {
          const confirmError = validateConfirmPassword(form.confirmPass, value);
          setErrors((prev) => ({ ...prev, confirmPass: confirmError }));
        }
        break;
      case "confirmPass":
        error = validateConfirmPassword(value, form.password);
        break;
      case "firstname":
        error = validateName(value, "First name");
        break;
      case "lastname":
        error = validateName(value, "Last name");
        break;
    }

    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  // Check if current step is valid
  const isStepValid = () => {
    if (currentStep === 1) {
      return (
        form.email.trim() !== "" &&
        form.password !== "" &&
        form.confirmPass !== "" &&
        !errors.email &&
        !errors.password &&
        !errors.confirmPass
      );
    } else if (currentStep === 2) {
      return (
        form.firstname.trim() !== "" &&
        form.lastname.trim() !== "" &&
        !errors.firstname &&
        !errors.lastname &&
        isChecked
      );
    }
    return false;
  };

  const handleNext = () => {
    if (isStepValid()) {
      setCurrentStep(currentStep + 1);
    } else {
      // Trigger validation for all fields in current step
      if (currentStep === 1) {
        setErrors({
          ...errors,
          email: validateEmail(form.email),
          password: validatePassword(form.password).join(""),
          confirmPass: validateConfirmPassword(form.confirmPass, form.password),
        });
      } else if (currentStep === 2) {
        setErrors({
          ...errors,
          firstname: validateName(form.firstname, "First name"),
          lastname: validateName(form.lastname, "Last name"),
        });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const createWelcomeNotification = async (userId: string) => {
    try {
      // Create a reference to the user's notifications subcollection
      const userNotificationsRef = collection(
        db,
        `users/${userId}/notifications`
      );

      await addDoc(userNotificationsRef, {
        type: "WELCOME",
        title: "Welcome to Rent2Reuse! 👋",
        message:
          "Start your journey by completing your profile and exploring available items. Need help? Check out our quick start guide.",
        isRead: false,
        createdAt: serverTimestamp(),
        data: {
          route: "/profile",
          params: {
            setup: "true",
            source: "welcome",
          },
        },
      });
    } catch (error) {
      console.error("Error creating welcome notification:", error);
    }
  };

  // Update the submit function
  const submit = async () => {
    Keyboard.dismiss();

    if (!isStepValid()) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Validation Error",
        textBody: "Please fix all errors before proceeding.",
      });
      return;
    }

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      // 1. Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );

      const uid = userCredential.user.uid;

      // 2. Create user document in Firestore
      await setDoc(doc(db, "users", uid), {
        firstname: form.firstname,
        middlename: form.middlename || "",
        lastname: form.lastname,
        email: form.email.trim(),
        role: "user",
        status: "Pending",
        createdAt: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // 3. Sign out and show success dialog
      await new Promise((resolve) => {
        setIsLoading(false);
        // First show the success dialog
        Dialog.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Account Created",
          textBody:
            "Your account has been created successfully! Please log in with your credentials.",
          button: "Go to Login",
          onPressButton: () => {
            Dialog.hide();
            resolve(true);
          },
          closeOnOverlayTap: false,
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      await createWelcomeNotification(uid);

      // 4. Sign out and redirect
      await auth.signOut();

      // 5. Small delay to ensure signout completes
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 6. Redirect to sign-in
      router.replace("/sign-in");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("email-already-in-use")
      ) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Email Already Registered",
          textBody:
            "This email is already linked to an account. Try logging in or use a different email.",
        });
      } else {
        console.error("Signup error:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to create account. Please try again.",
        });
      }
    } finally {
      setIsSubmitting(false);
      setIsLoading(false);
    }
  };

  // Progress Indicator Component
  const ProgressIndicator = () => (
    <View className="flex-row justify-center items-center mt-2 mb-2">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <React.Fragment key={index}>
          <View
            className={`rounded-full flex items-center justify-center ${
              index + 1 <= currentStep
                ? "bg-primary w-7 h-7"
                : "bg-gray-300 w-6 h-6"
            }`}
          >
            <Text
              className={`text-sm  ${
                index + 1 <= currentStep
                  ? "text-white font-pbold"
                  : "text-gray-600 font-pregular"
              }`}
            >
              {index + 1}
            </Text>
          </View>
          {index < totalSteps - 1 && (
            <View
              className={`w-20 h-1 mx-1 ${
                index + 1 < currentStep ? "bg-primary" : "bg-gray-300"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // Step 1: Authentication Details
  const renderStep1 = () => (
    <View>
      <InputField
        title="Email"
        value={form.email}
        placeholder="sample@email.com"
        handleChangeText={(e: string) => handleFormChange("email", e)}
        otherStyles="mt-2"
        keyboardType="email-address"
      />
      {errors.email && (
        <Text className="text-red-500 text-sm mt-1 ml-2">{errors.email}</Text>
      )}

      <InputField
        title="Password"
        value={form.password}
        placeholder="Enter Password"
        handleChangeText={(e: string) => handleFormChange("password", e)}
        otherStyles="mt-2"
      />
      {errors.password && (
        <Text className="text-red-500 text-sm mt-1 ml-2">
          {errors.password}
        </Text>
      )}

      <InputField
        title="Confirm Password"
        value={form.confirmPass}
        placeholder="Confirm Password"
        handleChangeText={(e: string) => handleFormChange("confirmPass", e)}
        otherStyles="mt-2"
      />
      {errors.confirmPass && (
        <Text className="text-red-500 text-sm mt-1 ml-2">
          {errors.confirmPass}
        </Text>
      )}
    </View>
  );

  // Step 2: Personal Details
  const renderStep2 = () => (
    <View>
      <InputField
        title="First Name"
        value={form.firstname}
        placeholder="Enter first name"
        handleChangeText={(e: string) => handleFormChange("firstname", e)}
        otherStyles="mt-2"
      />
      {errors.firstname && (
        <Text className="text-red-500 text-sm mt-1 ml-2">
          {errors.firstname}
        </Text>
      )}

      <InputField
        title="Middle Name"
        value={form.middlename || ""}
        placeholder="Enter middle name (optional)"
        handleChangeText={(e: string) => handleFormChange("middlename", e)}
        otherStyles="mt-2"
      />

      <InputField
        title="Last Name"
        value={form.lastname}
        placeholder="Enter last name"
        handleChangeText={(e: string) => handleFormChange("lastname", e)}
        otherStyles="mt-2"
      />
      {errors.lastname && (
        <Text className="text-red-500 text-sm mt-1 ml-2">
          {errors.lastname}
        </Text>
      )}

      {/* Terms and Conditions Checkbox */}
      <View className="flex-row items-center mt-4">
        <Checkbox.Android
          status={isChecked ? "checked" : "unchecked"}
          onPress={() => setIsChecked(!isChecked)}
          color="#4BD07F"
          disabled={!isChecked} // Checkbox is disabled until terms are accepted
        />
        <TouchableOpacity
          onPress={() => setIsModalVisible(true)}
          className="flex-1"
        >
          <Text className="text-base text-gray-700">
            I've read and agreed to the{" "}
            <Text className="text-primary font-pmedium">
              Terms and Conditions
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Terms and Conditions */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        statusBarTranslucent
      >
        <SafeAreaView
          className="flex-1 bg-white"
          style={{ paddingTop: insets.top }}
        >
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-xl font-pbold text-gray-800">
              Terms and Conditions
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsModalVisible(false);
                setIsAtBottom(false); // Reset scroll position when closing
              }}
            >
              <Text className="text-red-500 font-pmedium">Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={termsScrollRef}
            onScroll={handleTermsScroll}
            scrollEventThrottle={16} // Increase scroll sensitivity
            className="flex-1 px-4"
          >
            <Terms />
            {/* Add padding to ensure last content is visible */}
            <View className="h-20" />
          </ScrollView>

          <View className="p-4 border-t border-gray-200">
            <TouchableOpacity
              onPress={() => {
                setIsChecked(true);
                setIsModalVisible(false);
              }}
              disabled={!isAtBottom}
              className={`py-4 px-6 rounded-xl ${
                !isAtBottom ? "bg-gray-400" : "bg-primary"
              }`}
            >
              <Text className="text-white text-center font-pbold text-lg">
                {isAtBottom ? "I Agree" : "Please read to the end"}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 20,
            paddingTop: insets.top + 20,
          }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 px-4 ">
              <Image
                source={images.logo}
                className="w-full h-[32px] my-2"
                resizeMode="contain"
              />
              <Text className="text-3xl text-secondary-400 font-psemibold mt-4">
                Sign Up
              </Text>

              {/* Progress Indicator */}
              <ProgressIndicator />

              {/* Render current step */}
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}

              {/* Navigation Buttons */}
              <View className="flex-row justify-between mt-7">
                {currentStep > 1 && (
                  <TouchableOpacity
                    onPress={handleBack}
                    className="flex-1 mr-2 bg-gray-500 rounded-xl py-4 items-center justify-center"
                    activeOpacity={0.7}
                  >
                    <Text className="text-white font-pbold text-lg">Back</Text>
                  </TouchableOpacity>
                )}

                {currentStep < totalSteps ? (
                  <LargeButton
                    title="Next"
                    handlePress={handleNext}
                    containerStyles={`flex-1 ${currentStep > 1 ? "ml-2" : ""} ${
                      !isStepValid() ? "opacity-50" : ""
                    }`}
                    textStyles="text-white"
                    disabled={!isStepValid()}
                  />
                ) : (
                  <LargeButton
                    title="Create Now"
                    handlePress={submit}
                    textStyles="text-white"
                    containerStyles={`flex-1 ${currentStep > 1 ? "ml-2" : ""} ${
                      !isStepValid() || isSubmitting ? "opacity-50" : ""
                    }`}
                    disabled={!isStepValid() || isSubmitting}
                  />
                )}
              </View>

              <View className="flex justify-center pt-5 flex-row gap-2">
                <Text className="text-lg text-secondary-400 font-pregular">
                  Have an account already?
                </Text>
                <Link
                  href="/sign-in"
                  className="text-lg font-psemibold text-primary"
                >
                  Login
                </Link>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignUp;
