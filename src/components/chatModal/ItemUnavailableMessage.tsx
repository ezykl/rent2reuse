import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { icons } from "@/constant";

interface ItemUnavailableMessageProps {
  item: {
    id: string;
    senderId: string;
    createdAt: any;
    text: string;
  };
  isRenter: boolean;
  onDelete?: () => void;
  isLoading?: boolean;
}

const ItemUnavailableMessage: React.FC<ItemUnavailableMessageProps> = ({
  item,
  isRenter,
  onDelete,
  isLoading = false,
}) => {
  return (
    <View className="flex-row mb-3 justify-center px-2">
      <View className="bg-gradient-to-r from-red-50 to-orange-50 rounded-3xl border-2 border-red-300 px-4 py-4 max-w-[85%]">
        {/* Header */}
        <View className="flex-row items-center mb-3">
          <Image
            source={icons.close}
            className="w-5 h-5 mr-2"
            tintColor="#DC2626"
          />
          <Text className="text-red-800 font-pbold text-base">
            Item Not Available
          </Text>
        </View>

        {/* Message */}
        <Text className="text-red-700 font-pmedium text-sm mb-4 leading-5">
          {item.text}
        </Text>

        {/* Delete Button - Only for renter to remove request */}
        {isRenter && onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            disabled={isLoading}
            className={`bg-red-600 rounded-xl py-3 px-4 flex-row items-center justify-center ${
              isLoading ? "opacity-60" : ""
            }`}
          >
            <Image
              source={icons.trash}
              className="w-4 h-4 mr-2"
              tintColor="white"
            />
            <Text className="text-white font-pbold text-sm">
              {isLoading ? "Deleting..." : "Delete Request"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default ItemUnavailableMessage;
