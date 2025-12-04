import React, { useState } from "react";
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { icons } from "@/constant";

interface PickupConfirmationMessageProps {
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
  onConfirmPickup: () => void;
  onDeclinePickup?: () => void;
  isLoading: boolean;
}

const PickupConfirmationMessage: React.FC<PickupConfirmationMessageProps> = ({
  item,
  isCurrentUser,
  isRenter,
  isOwner,
  onConfirmPickup,
  onDeclinePickup,
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
            : "#FDF7FF",
          borderColor: isDeclined
            ? "#FCA5A5"
            : isConfirmed
            ? "#86EFAC"
            : "#E879F9",
        }}
      >
        {/* Header */}
        <View className="flex-row items-center mb-3">
          <Image
            source={icons.check}
            className="w-5 h-5 mr-2"
            tintColor={
              isDeclined ? "#DC2626" : isConfirmed ? "#16A34A" : "#A855F7"
            }
          />
          <Text
            style={{
              color: isDeclined
                ? "#991B1B"
                : isConfirmed
                ? "#065F46"
                : "#6B21A8",
              fontFamily: "Inter_700Bold",
              fontSize: 16,
            }}
          >
            {isDeclined
              ? "Pickup Declined"
              : isConfirmed
              ? "✓ Pickup Confirmed"
              : "📍 Pickup Confirmation"}
          </Text>
        </View>

        {/* Message */}
        <Text
          style={{
            color: isDeclined ? "#7F1D1D" : isConfirmed ? "#065F46" : "#6B21A8",
            fontSize: 14,
            marginBottom: 12,
            lineHeight: 20,
          }}
        >
          {isDeclined
            ? "Pickup request declined"
            : isConfirmed
            ? "Item pickup confirmed. Proceeding to next steps."
            : isRenter && !isCurrentUser
            ? "Owner confirms item is ready for pickup. Please confirm receipt once you collect it."
            : "Please confirm the renter has received the item in good condition."}
        </Text>

        {/* Details Section for Renter Confirmation View */}
        {!isConfirmed && !isDeclined && isRenter && !isCurrentUser && (
          <View className="bg-white/60 rounded-lg p-3 mb-3">
            <Text className="text-xs text-gray-700 font-pbold mb-2">
              📋 Pickup Checklist:
            </Text>
            <View className="gap-1">
              <Text className="text-xs text-gray-600">
                ✓ Item condition matches description
              </Text>
              <Text className="text-xs text-gray-600">
                ✓ All accessories/parts included
              </Text>
              <Text className="text-xs text-gray-600">
                ✓ No damage or defects
              </Text>
            </View>
          </View>
        )}

        {/* ACTION BUTTONS */}
        {!isConfirmed && !isDeclined && (
          <View className="gap-2">
            {/* Renter confirming pickup */}
            {isRenter && !isCurrentUser && (
              <View className="gap-2 flex-row">
                <TouchableOpacity
                  onPress={onConfirmPickup}
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
                    {isLoading ? "Confirming..." : "Confirm Received"}
                  </Text>
                </TouchableOpacity>

                {onDeclinePickup && (
                  <TouchableOpacity
                    onPress={onDeclinePickup}
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
                      Issue Report
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Owner confirming item ready */}
            {isOwner && isCurrentUser && (
              <TouchableOpacity
                onPress={onConfirmPickup}
                disabled={isLoading}
                className={`bg-purple-600 rounded-xl py-3 flex-row items-center justify-center ${
                  isLoading ? "opacity-60" : ""
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Image
                      source={icons.check}
                      className="w-4 h-4 mr-2"
                      tintColor="white"
                    />
                    <Text className="text-white font-pbold text-sm">
                      Item Ready for Pickup
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Confirmed Status */}
        {isConfirmed && (
          <View className="bg-white/50 rounded-lg p-3 mt-2">
            <Text className="text-xs text-green-700 font-pmedium">
              ✓ Pickup confirmed. Item is in renter's possession.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default PickupConfirmationMessage;
