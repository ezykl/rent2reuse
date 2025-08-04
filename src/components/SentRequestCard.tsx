import { View, Text, Image, TouchableOpacity } from "react-native";
import React from "react";
import { icons } from "../constant";
import dayjs from "dayjs";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { min } from "date-fns";

interface SentRequestCardProps {
  request: {
    id: string;
    itemId: string;
    itemName: string;
    itemImage?: string;
    ownerName: string;
    status: "pending" | "approved" | "rejected" | "completed";
    startDate: string;
    endDate: string;
    pickupTime: number;
    totalPrice: number;
  };
  onPress: (id: string) => void;
}

const SentRequestCard = ({ request, onPress }: SentRequestCardProps) => {
  const { minutesToTime } = useTimeConverter();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-700",
          icon: "#EAB308",
        };
      case "approved":
        return {
          bg: "bg-green-100",
          text: "text-green-700",
          icon: "#22C55E",
        };
      case "rejected":
        return {
          bg: "bg-red-100",
          text: "text-red-700",
          icon: "#EF4444",
        };
      default:
        return {
          bg: "bg-gray-100",
          text: "text-gray-700",
          icon: "#6B7280",
        };
    }
  };

  const statusStyle = getStatusColor(request.status);

  // Convert the pickup time
  const formattedTime = minutesToTime(Number(request.pickupTime));
  console.log("Formatted Pickup Time:", formattedTime);

  return (
    <TouchableOpacity
      className="bg-white rounded-xl mb-4 shadow-sm border border-gray-100 overflow-hidden"
      onPress={() => onPress(request.id)}
      activeOpacity={0.7}
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="space-y-1">
            <View className="flex-row items-center">
              <Image
                source={icons.calendar}
                className="w-4 h-4 mr-2"
                tintColor="#6B7280"
              />
              <Text className="text-sm text-gray-600">
                {request.startDate} - {request.endDate}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Image
                source={icons.clock}
                className="w-4 h-4 mr-2"
                tintColor="#6B7280"
              />
              <Text className="text-sm text-gray-600">
                Pickup: {formattedTime.toString()}
              </Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusStyle.bg}`}>
            <Text
              className={`text-xs font-psemibold capitalize ${statusStyle.text}`}
            >
              {request.status}
            </Text>
          </View>
        </View>

        {/* Item Details */}
        <View className="flex-row">
          <Image
            source={
              request.itemImage
                ? { uri: request.itemImage }
                : require("../assets/thumbnail.png")
            }
            className="w-20 h-20 rounded-lg"
          />
          <View className="flex-1 ml-3">
            <Text
              className="text-lg font-pbold text-gray-800"
              numberOfLines={1}
            >
              {request.itemName}
            </Text>
            <Text className="text-sm text-gray-500 mb-1">
              Owner: {request.ownerName}
            </Text>
            <Text className="text-base font-psemibold text-primary">
              ₱{request.totalPrice} total
            </Text>
          </View>
        </View>

        {/* Timeline for pending requests */}
        {request.status === "pending" && (
          <View className="mt-3 pt-3 border-t border-gray-100">
            <View className="flex-row items-center">
              <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                <Image
                  source={icons.arrowDown}
                  className="w-4 h-4"
                  tintColor="white"
                />
              </View>
              <Text className="ml-2 text-sm text-gray-600">
                Waiting for owner's approval
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default SentRequestCard;
