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
    requests: {
      userId: string;
      userName: string;
      status: string;
      startDate: string;
      endDate: string;
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
      className="w-full bg-white rounded-xl mb-4 shadow-sm border border-gray-100"
      onPress={() => onViewRequests(item.id)}
      activeOpacity={0.7}
      style={{ height: 100 }}
    >
      <View className="flex-row h-full">
        {/* Image */}
        <Image
          source={
            item.images && item.images.length > 0
              ? { uri: item.images[0] }
              : require("../assets/thumbnail.png")
          }
          style={{ width: 100 }}
          className="h-full rounded-l-xl"
        />

        {/* Content */}
        <View className="flex-1 p-3 justify-between">
          <View>
            <Text
              className="text-lg font-psemibold text-gray-800"
              numberOfLines={1}
            >
              {item.itemName}
            </Text>
            <Text className="text-sm font-psemibold text-primary">
              ₱{item.itemPrice}/day
            </Text>
          </View>

          {/* Request Count Badge */}
          <View className="flex-row items-center">
            <View className="bg-orange-100 px-3 py-1.5 rounded-full flex-row items-center">
              <Image
                source={icons.userRequest}
                className="w-4 h-4 mr-2"
                tintColor="#F97316"
              />
              <Text className="text-sm font-psemibold text-orange-700">
                {item.requestCount} new{" "}
                {item.requestCount === 1 ? "request" : "requests"}
              </Text>
            </View>
          </View>
        </View>

        {/* Arrow Icon */}
        <View className="justify-center pr-4">
          <Image
            source={icons.arrowRight}
            className="w-5 h-5"
            tintColor="#6B7280"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default RequestedItemCard;
