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
          <Image
            source={{
              uri: recipientImage || "https://placehold.co/40x40@2x.png",
            }}
            className="w-12 h-12 rounded-xl bg-gray-200 -ml-4 mt-4 mr-3"
            resizeMode="cover"
          />
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

          {/* Show compact progress indicator or online status */}
          {isRentalConversation ? (
            <View className="mt-1">
              <RentalProgressIndicator
                currentStatus={status}
                isOwner={isOwner}
                compact={true}
              />
            </View>
          ) : (
            <Text className="text-xs text-gray-500">
              {recipientStatus?.isOnline ? "Online" : "Offline"}
            </Text>
          )}
        </View>

        {/* Details Menu Button */}
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={onShowDetails}
            className="w-8 h-8 items-center justify-center"
          >
            <Image
              source={icons.menu}
              className="w-6 h-6"
              tintColor="#6B7280"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default ChatHeader;
