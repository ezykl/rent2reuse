import React from "react";
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { icons } from "@/constant";

interface ReturnConfirmationMessageProps {
  item: {
    id: string;
    senderId: string;
    createdAt: any;
    text: string;
    status?: string;
  };
  isCurrentUser: boolean;
  isRenter: boolean;
  isOwner: boolean;
  onConfirmReturn: () => void;
  onDeclineReturn?: () => void;
  isLoading: boolean;
}

const ReturnConfirmationMessage: React.FC<ReturnConfirmationMessageProps> = ({
  item,
  isCurrentUser,
  isRenter,
  isOwner,
  onConfirmReturn,
  onDeclineReturn,
  isLoading,
}) => {
  const isConfirmed = item.status === "confirmed";
  const isDeclined = item.status === "declined";

  return (
    <View className="flex-row mb-3 justify-center px-2">
      <View
        style={{
          borderWidth: 2,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 14,
          maxWidth: "90%",
          backgroundColor: isDeclined
            ? "#FFF7F7"
            : isConfirmed
            ? "#F0FDF4"
            : "#FEFCE8",
          borderColor: isDeclined
            ? "#FCA5A5"
            : isConfirmed
            ? "#86EFAC"
            : "#FBBF24",
        }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-3">
          <Image
            source={icons.check}
            className="w-5 h-5 mr-2"
            tintColor={
              isDeclined ? "#DC2626" : isConfirmed ? "#16A34A" : "#CA8A04"
            }
          />
          <Text
            style={{
              color: isDeclined
                ? "#991B1B"
                : isConfirmed
                ? "#065F46"
                : "#78350F",
              fontFamily: "Inter_700Bold",
              fontSize: 16,
            }}
          >
            {isDeclined
              ? "Return Rejected"
              : isConfirmed
              ? "✓ Return Confirmed"
              : "🔄 Return Request"}
          </Text>
        </View>

        {/* Message */}
        <Text
          style={{
            color: isDeclined ? "#7F1D1D" : isConfirmed ? "#065F46" : "#78350F",
            fontSize: 14,
            marginBottom: 12,
            lineHeight: 20,
          }}
        >
          {isDeclined
            ? "Return was rejected due to condition issues"
            : isConfirmed
            ? "Item return confirmed. Processing final payment."
            : isRenter && !isCurrentUser
            ? "Please return the item in the same condition. Confirm once you're ready to return."
            : "Item has been returned. Please inspect and confirm condition before releasing final payment."}
        </Text>

        {/* Return Checklist for Owner */}
        {!isConfirmed && !isDeclined && isOwner && isCurrentUser && (
          <View className="bg-white/60 rounded-lg p-3 mb-3">
            <Text className="text-xs text-gray-700 font-pbold mb-2">
              🔍 Return Inspection:
            </Text>
            <View className="gap-1">
              <Text className="text-xs text-gray-600">
                ✓ Condition matches original state
              </Text>
              <Text className="text-xs text-gray-600">
                ✓ No additional damage or wear
              </Text>
              <Text className="text-xs text-gray-600">
                ✓ All parts/accessories returned
              </Text>
            </View>
          </View>
        )}

        {/* ACTION BUTTONS */}
        {!isConfirmed && !isDeclined && (
          <View className="gap-2">
            {/* Renter initiating return */}
            {isRenter && !isCurrentUser && (
              <TouchableOpacity
                onPress={onConfirmReturn}
                disabled={isLoading}
                className={`bg-blue-600 rounded-xl py-3 flex-row items-center justify-center ${
                  isLoading ? "opacity-60" : ""
                }`}
              >
                <Image
                  source={icons.check}
                  className="w-4 h-4 mr-2"
                  tintColor="white"
                />
                <Text className="text-white font-pbold text-sm">
                  {isLoading ? "Confirming..." : "Confirm Return Ready"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Owner verifying return */}
            {isOwner && isCurrentUser && (
              <View className="gap-2 flex-row">
                <TouchableOpacity
                  onPress={onConfirmReturn}
                  disabled={isLoading}
                  className={`flex-1 bg-green-600 rounded-xl py-3 flex-row items-center justify-center ${
                    isLoading ? "opacity-60" : ""
                  }`}
                >
                  <Image
                    source={icons.check}
                    className="w-4 h-4 mr-2"
                    tintColor="white"
                  />
                  <Text className="text-white font-pbold text-sm">
                    {isLoading ? "Confirming..." : "Accept Return"}
                  </Text>
                </TouchableOpacity>

                {onDeclineReturn && (
                  <TouchableOpacity
                    onPress={onDeclineReturn}
                    disabled={isLoading}
                    className={`flex-1 bg-red-600 rounded-xl py-3 flex-row items-center justify-center ${
                      isLoading ? "opacity-60" : ""
                    }`}
                  >
                    <Image
                      source={icons.close}
                      className="w-4 h-4 mr-2"
                      tintColor="white"
                    />
                    <Text className="text-white font-pbold text-sm">
                      Report Issue
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Confirmed Status */}
        {isConfirmed && (
          <View className="bg-white/50 rounded-lg p-3 mt-2">
            <Text className="text-xs text-green-700 font-pmedium">
              ✓ Return confirmed. Rental completed successfully.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default ReturnConfirmationMessage;
