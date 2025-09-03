import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
} from "react-native";
import { icons } from "@/constant";
import { auth } from "@/lib/firebaseConfig";
import { sendEmailVerification, onAuthStateChanged } from "firebase/auth";
import { useState, useEffect } from "react";
import Toast, { ALERT_TYPE } from "react-native-alert-notification";

interface EmailVerificationContentProps {
  onClose?: () => void;
  onVerified?: () => void;
}

export const EmailVerificationContent = ({
  onClose,
  onVerified,
}: EmailVerificationContentProps) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendVerification = async () => {
    const user = auth.currentUser;

    if (!user) {
      setError("No user found. Please log in again.");
      return;
    }

    // Check if email is already verified
    if (user.emailVerified) {
      setError("Email is already verified!");
      return;
    }

    try {
      setSending(true);
      setError(null);

      await sendEmailVerification(user);

      setSent(true);

      // Optional: Call onVerified callback
      if (onVerified) onVerified();
    } catch (error: any) {
      // Handle specific Firebase errors
      let errorMessage = "Failed to send verification email.";

      switch (error.code) {
        case "auth/too-many-requests":
          errorMessage = "Too many requests. Please try again later.";
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled.";
          break;
        case "auth/user-not-found":
          errorMessage = "User not found. Please log in again.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection.";
          break;
        default:
          errorMessage = error.message || "Failed to send verification email.";
      }

      setError(errorMessage);
      setSent(false);
    } finally {
      setSending(false);
    }
  };

  const checkVerificationStatus = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        // Force reload user to get the latest emailVerified status
        await user.reload();

        // Get the updated user after reload
        const updatedUser = auth.currentUser;

        if (updatedUser && updatedUser.emailVerified) {
          // Call onVerified callback first
          if (onVerified) {
            await onVerified();
            if (onClose) {
              onClose();
            }
          }

          // Show success message
          Toast.Toast.show({
            type: ALERT_TYPE.SUCCESS,
            title: "Email Verified",
            textBody: "Your email has been successfully verified!",
          });

          // Small delay to ensure state updates propagate
          setTimeout(() => {
            if (onClose) {
              onClose();
            }
          }, 500);
        } else {
          Toast.Toast.show({
            type: ALERT_TYPE.WARNING,
            title: "Not Verified",
            textBody:
              "Your email is not yet verified. Please check your inbox and click the verification link.",
          });
        }
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
      Toast.Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to check verification status",
      });
    }
  };

  // Add useEffect to check verification status periodically when modal is open
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (sent) {
      interval = setInterval(async () => {
        const user = auth.currentUser;
        if (user) {
          await user.reload();
          if (user.emailVerified) {
            clearInterval(interval);
            await checkVerificationStatus();
          }
        }
      }, 3000); // Check every 3 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [sent]);

  // Add useEffect to listen for email verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Force refresh the user to get the latest emailVerified status
        await user.reload();
        const refreshedUser = auth.currentUser;

        if (refreshedUser && refreshedUser.emailVerified) {
          // Email has been verified
          if (onVerified) {
            await onVerified();
          }
        }
      }
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [onVerified, onClose]);
  // Update the checkVerificationStatus function

  // Add a refresh button in the UI
  const renderRefreshButton = () => {
    if (sent) {
      return (
        <TouchableOpacity
          onPress={checkVerificationStatus}
          className="mt-3 py-3 px-4 bg-gray-100 rounded-xl"
        >
          <Text className="text-gray-600 font-pmedium text-center">
            I've verified my email
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <View className="p-6">
      {/* Header */}
      <View className="flex-row items-center mb-6">
        <View className="flex-1">
          <Text className="font-pbold text-xl text-gray-800">
            Email Verification
          </Text>
          <Text className="font-pregular text-gray-500 mt-1">
            Verify your email address to unlock all features
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="bg-blue-50 rounded-xl p-4 mb-4">
        <View className="flex-row items-start">
          <Image
            source={icons.envelope}
            className="w-5 h-5 mt-0.5 mr-3"
            resizeMode="contain"
            tintColor="#3B82F6"
          />
          <View className="flex-1">
            <Text className="font-pmedium text-blue-600">
              {auth.currentUser?.email}
            </Text>
            <Text className="text-blue-600/80 text-sm mt-1">
              A verification link will be sent to this email address
            </Text>
          </View>
        </View>
      </View>

      {/* Success Alert */}
      {sent && (
        <View className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Text className="text-green-700 text-center font-pmedium">
            Verification email sent successfully!
          </Text>
          <Text className="text-green-600 text-center text-sm mt-1">
            Please check your inbox and spam folder.
          </Text>
        </View>
      )}

      {/* Error Alert */}
      {error && (
        <View className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <Text className="text-red-600 text-center text-sm mt-1">{error}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="space-y-3">
        {/* Send Email Button */}
        <TouchableOpacity
          onPress={handleSendVerification}
          disabled={sending}
          className={`bg-primary py-4 rounded-xl ${
            sending ? "opacity-70" : ""
          }`}
        >
          <Text className="text-white font-pbold text-center">
            {sending
              ? "Sending..."
              : sent
              ? "Resend Verification Email"
              : "Send Verification Email"}
          </Text>
        </TouchableOpacity>

        {/* Add the refresh button */}
        {renderRefreshButton()}
      </View>

      {/* Additional Info */}
      {sent && (
        <View className="mt-4 p-3 bg-gray-50 rounded-lg">
          <Text className="text-gray-600 text-sm text-center">
            Didn't receive the email? Check your spam folder or try resending.
          </Text>
        </View>
      )}
    </View>
  );
};
