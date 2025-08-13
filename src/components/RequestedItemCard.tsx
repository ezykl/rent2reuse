import { View, Text, Image, TouchableOpacity } from "react-native";
import React from "react";
import { icons } from "../constant";

interface RequestedItemCardProps {
  item: {
    id: string;
    itemName: string;
    itemPrice: number;
    images?: string[];
    requestCount: number;
    newRequestCount: number; // Add this for unread/new requests
    requests: {
      userId: string;
      userName: string;
      status: string;
      startDate: string;
      endDate: string;
      isNew?: boolean; // Add this to track new requests
    }[];
  };
  onViewRequests: (id: string) => void;
}

const RequestedItemCard = ({
  item,
  onViewRequests,
}: RequestedItemCardProps) => {
  return (
    <TouchableOpacity
      className="w-full bg-white rounded-xl border border-gray-200 mb-4 shadow-sm"
      onPress={() => onViewRequests(item.id)}
      activeOpacity={0.7}
      style={{ height: 100 }}
    >
      <View className="flex-row h-full justify-between items-center">
        {/* Image */}
        <Image
          source={
            item.images && item.images.length > 0
              ? { uri: item.images[0] }
              : require("../assets/thumbnail.png")
          }
          style={{ width: 90 }}
          className="h-full rounded-l-xl overflow-hidden"
        />

        {/* New Request Badge - only show for unread requests */}
        {item.newRequestCount > 0 && (
          <View className="absolute top-1 right-1 bg-red-500 w-3 h-3 rounded-full items-center justify-center"></View>
        )}

        {/* Content */}
        <View className="flex-1 p-2 justify-between">
          <View className="gap-2">
            <Text
              className="text-lg font-pbold text-gray-800"
              numberOfLines={1}
            >
              {item.itemName}
            </Text>
            <Text className="text-base font-psemibold text-primary">
              ₱{item.itemPrice}/day
            </Text>

            {/* Request Status - Show total requests */}
            <View className="flex-row items-center justify-between">
              <View className="bg-orange-100 px-3 py-1.5 rounded-full flex-row items-center">
                <Text className="text-xs font-psemibold text-orange-700">
                  {item.requestCount}{" "}
                  {item.requestCount === 1 ? "request" : "requests"}
                  {item.newRequestCount > 0 && ` • ${item.newRequestCount} new`}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Image
          source={icons.arrowRight}
          className="w-5 h-5 px-3 mx-2"
          tintColor="#6B7280"
        />
      </View>
    </TouchableOpacity>
  );
};

export default RequestedItemCard;
