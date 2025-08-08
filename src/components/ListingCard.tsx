import { View, Text, Image, TouchableOpacity } from "react-native";
import React from "react";
import { icons } from "../constant";

// Update the props interface
interface ListingCardProps {
  item: {
    id: string;
    itemName: string;
    itemDesc: string;
    itemPrice: number;
    itemStatus: string;
    images?: string[];
    requestCount: number;
    createdAt?: string; // Add this
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (id: string) => void;
}

const ListingCard = ({ item, onEdit, onDelete, onPress }: ListingCardProps) => {
  const isAvailable = item.itemStatus.toLowerCase() === "available";
  const isUnavailable = item.itemStatus.toLowerCase() === "unavailable";

  return (
    <TouchableOpacity
      className={`w-full bg-white rounded-xl mb-4 shadow-sm border-l-4 ${
        isAvailable
          ? "border-l-green-500"
          : isUnavailable
          ? "border-l-gray-400"
          : "border-l-orange-500"
      } `}
      onPress={() => onPress(item.id)}
      activeOpacity={0.7}
      style={{ height: 100 }} // Make height consistent
    >
      <View className="flex-row h-full">
        {/* Image with status indicator */}
        <Image
          source={
            item.images?.[0]
              ? { uri: item.images[0] }
              : require("../assets/thumbnail.png")
          }
          style={{ width: 100 }}
          className="h-full rounded-l-xl"
        />

        {/* {item.requestCount > 0 && (
          <View className="absolute top-2 right-2 bg-red-500 w-6 h-6 rounded-full items-center justify-center">
            <Text className="text-white text-xs font-pbold">
              {item.requestCount}
            </Text>
          </View>
        )} */}

        {/* Content */}
        <View className="flex-1 p-3 justify-between">
          <View>
            <Text
              className="text-lg font-pbold text-gray-800"
              numberOfLines={1}
            >
              {item.itemName}
            </Text>
            <Text className="text-sm text-gray-500 mb-1" numberOfLines={1}>
              {item.itemDesc}
            </Text>
            <Text className="text-base font-psemibold text-primary">
              ₱{item.itemPrice}/day
            </Text>
          </View>

          {/* Bottom row with date and status */}
          <View className="flex-row justify-between items-center">
            <Text className="text-xs text-gray-500">
              Listed {item.createdAt}
            </Text>
            <View
              className={`px-2 py-1 rounded-full ${
                isAvailable
                  ? "bg-green-100"
                  : isUnavailable
                  ? "bg-gray-100"
                  : "bg-orange-100"
              }`}
            >
              <Text
                className={`text-xs font-psemibold ${
                  isAvailable
                    ? "text-green-700"
                    : isUnavailable
                    ? "text-gray-600"
                    : "text-orange-700"
                }`}
              >
                {item.itemStatus}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Actions */}
        <View className="justify-center pr-4 gap-2">
          <TouchableOpacity
            onPress={() => onEdit(item.id)}
            className="p-2 rounded-xl bg-blue-50"
          >
            <Image source={icons.edit} className="w-5 h-5" tintColor="blue" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(item.id)}
            className="p-2 rounded-xl bg-red-50"
          >
            <Image
              source={icons.trash}
              className="w-5 h-5"
              tintColor="#EF4444"
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ListingCard;
