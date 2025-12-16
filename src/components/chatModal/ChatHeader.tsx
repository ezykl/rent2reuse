// Updated ChatHeader component
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
import { icons } from "@/constant";
import RentalProgressIndicator from "@/components/RentalProgressIndicator";

interface ChatHeaderProps {
  recipientName: {
    firstname: string;
    lastname: string;
    middlename?: string;
  };
  recipientImage?: string;
  itemDetails?: {
    name?: string;
    image?: string;
  };
  recipientStatus?: any;
  status: any;
  recipientId: string;
  onBack: () => void;
  isOwner: boolean;
  onShowDetails: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  recipientName,
  recipientImage,
  itemDetails,
  recipientStatus,
  status,
  onBack,
  recipientId,
  isOwner,
  onShowDetails,
}) => {
  const formatFullName = () => {
    const middleInitial = recipientName.middlename
      ? ` ${recipientName.middlename.charAt(0)}.`
      : "";
    return `${recipientName.firstname}${middleInitial} ${recipientName.lastname}`;
  };

  // ✅ NEW: Get the current stage in the rental flow
  const getRentalStage = (): {
    stage: string;
    stageNumber: number;
    color: string;
  } => {
    switch (status) {
      case "pending":
        return { stage: "Request", stageNumber: 1, color: "#FCD34D" }; // Yellow
      case "accepted":
      case "initial_payment_paid":
      case "assessment_submitted":
        return { stage: "Pick-Up", stageNumber: 2, color: "#60A5FA" }; // Blue
      case "pickedup":
        return { stage: "Renting", stageNumber: 3, color: "#34D399" }; // Green
      case "completed":
        return { stage: "Return", stageNumber: 4, color: "#A78BFA" }; // Purple
      case "declined":
      case "cancelled":
        return { stage: "Cancelled", stageNumber: 0, color: "#EF4444" }; // Red
      default:
        return { stage: "Request", stageNumber: 1, color: "#9CA3AF" }; // Gray
    }
  };

  const currentStage = getRentalStage();

  // ✅ All 5 stages
  const stages = [
    { name: "Request", number: 1 },
    { name: "Pick-Up", number: 2 },
    { name: "Renting", number: 3 },
    { name: "Return", number: 4 },
    { name: "Rate", number: 5 },
  ];

  const isRentalConversation = itemDetails && status;

  return (
    <View className="bg-white border-b border-gray-300 rounded-b-xl">
      {/* Main Header */}
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>

        <View className="flex-row items-center relative">
          <Image
            source={{
              uri: itemDetails?.image || "https://placehold.co/40x40@2x.png",
            }}
            className="w-12 h-12 rounded-xl bg-gray-200"
            resizeMode="cover"
          />

          <View
            className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full items-center justify-center ${
              isOwner ? "bg-green-500" : "bg-blue-500"
            }`}
          >
            <Image
              source={icons.leftArrow}
              className={`w-5 h-5 ${isOwner ? "-rotate-90" : "rotate-90"}`}
              tintColor="#fff"
            />
          </View>
        </View>

        <View className="ml-3 flex-1">
          <TouchableOpacity onPress={() => router.push(`/user/${recipientId}`)}>
            <Text
              className="text-base font-semibold text-gray-900"
              numberOfLines={1}
            >
              {formatFullName()}
              {itemDetails?.name && (
                <>
                  <Text className="text-gray-400"> • </Text>
                  <Text
                    className={`${
                      status === "cancelled" || status === "declined"
                        ? "text-red-500"
                        : "text-primary"
                    }`}
                  >
                    {itemDetails.name}
                  </Text>
                </>
              )}
            </Text>
          </TouchableOpacity>

          {/* ✅ NEW: Show rental progress flow */}
          {isRentalConversation && status && (
            <View className="mt-2">
              <View className="flex-row items-center justify-between relative">
                {stages.map((stageItem, index) => (
                  <View
                    key={stageItem.number}
                    className="flex-1 items-center relative"
                  >
                    {/* Connector Line - behind the circles */}
                    {index < stages.length - 1 && (
                      <View
                        className={`absolute top-3 left-1/2 right-0 w-full h-0.5 z-0 ${
                          stageItem.number < currentStage.stageNumber
                            ? "bg-primary"
                            : "bg-gray-300"
                        }`}
                      />
                    )}

                    {/* Stage Circle */}
                    <View
                      className={`w-6 h-6 rounded-full items-center justify-center mb-1 z-10 ${
                        stageItem.number <= currentStage.stageNumber
                          ? "bg-primary"
                          : "bg-gray-300"
                      }`}
                    >
                      <Text
                        className={`font-pbold text-xs ${
                          stageItem.number <= currentStage.stageNumber
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      >
                        {stageItem.number}
                      </Text>
                    </View>

                    {/* Stage Name - Show all stages */}
                    <Text
                      className={`text-[8px] font-pmedium ${
                        stageItem.number === currentStage.stageNumber
                          ? "text-primary font-pbold"
                          : stageItem.number < currentStage.stageNumber
                          ? "text-gray-700"
                          : "text-gray-500"
                      }`}
                    >
                      {stageItem.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Details Menu Button */}
        <TouchableOpacity
          onPress={onShowDetails}
          className="w-8 h-8 items-center justify-center"
        >
          <Image source={icons.menu} className="w-6 h-6" tintColor="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatHeader;
