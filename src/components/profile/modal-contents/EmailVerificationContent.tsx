import { View, Text, TouchableOpacity, Image } from "react-native";
import { icons } from "@/constant";
import { auth } from "@/lib/firebaseConfig";
import { sendEmailVerification } from "firebase/auth";
import { useState } from "react";

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

  const handleSendVerification = async () => {
    if (!auth.currentUser) return;

    try {
      setSending(true);
      await sendEmailVerification(auth.currentUser);
      setSent(true);
      if (onVerified) onVerified();
    } catch (error) {
      setSent(false);
    } finally {
      setSending(false);
    }
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
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            className="p-2 -mr-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Image
              source={icons.close}
              className="w-6 h-6"
              resizeMode="contain"
              tintColor="#6B7280"
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View className="bg-blue-50 rounded-xl p-4 mb-6">
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

      {/* Inline Alert */}
      {sent && (
        <View className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Text className="text-green-700 text-center">
            Verification email sent! Please check your inbox.
          </Text>
        </View>
      )}

      {/* Action Button */}
      <TouchableOpacity
        onPress={handleSendVerification}
        disabled={sending || sent}
        className={`bg-primary py-4 rounded-xl ${
          sending || sent ? "opacity-70" : ""
        }`}
      >
        <Text className="text-white font-pbold text-center">
          {sending
            ? "Sending..."
            : sent
            ? "Email Sent"
            : "Send Verification Email"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
