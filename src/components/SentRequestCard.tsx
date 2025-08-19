import { View, Text, Image, TouchableOpacity } from "react-native";
import React from "react";
import { icons } from "../constant";
import dayjs from "dayjs";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { min } from "date-fns";

interface SentRequestCardProps {
  request: {
    id: string;
    startDate: any;
    endDate: any;
    status: string;
    itemId: string;
    itemName: string;
    itemImage?: string;
    ownerName: string;
    pickupTime: number;
    totalPrice: number;
    chatId: string;
  };
  onPress: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit?: (id: string) => void;
}

const getRequestStatus = (startDate: any, endDate: any, status: string) => {
  const now = dayjs();
  const start = dayjs(startDate.toDate?.() ?? startDate);
  const end = dayjs(endDate.toDate?.() ?? endDate);

  if (status === "rejected" || status === "cancelled") {
    return {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      color: "bg-red-100 text-red-700",
    };
  }

  if (now.isAfter(end)) {
    return {
      label: "Expired",
      color: "bg-gray-100 text-gray-700",
    };
  }

  if (now.isAfter(start) && status === "pending") {
    return {
      label: "Past Due",
      color: "bg-orange-100 text-orange-700",
    };
  }

  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    color:
      status === "approved"
        ? "bg-green-100 text-green-700"
        : "bg-yellow-100 text-yellow-700",
  };
};

const SentRequestCard = ({
  request,
  onPress,
  onCancel,
  onEdit,
}: SentRequestCardProps) => {
  const requestStatus = getRequestStatus(
    request.startDate,
    request.endDate,
    request.status
  );
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

  const convertFirestoreTimestamp = (timestamp: any) => {
    if (!timestamp) return null;

    // If it's a Firestore Timestamp object
    if (timestamp.toDate) {
      return timestamp.toDate();
    }

    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }

    // If it's a string or other format, try to parse it
    return new Date(timestamp);
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
              {/* <Text className="text-sm text-gray-600">
                {request.startDate} - {request.endDate}
              </Text> */}
              <Text className="font-psemibold text-gray-800">
                {request.startDate && request.endDate
                  ? (() => {
                      const startDate = convertFirestoreTimestamp(
                        request.startDate
                      );
                      const endDate = convertFirestoreTimestamp(
                        request.endDate
                      );

                      if (
                        startDate &&
                        endDate &&
                        dayjs(startDate).isValid() &&
                        dayjs(endDate).isValid()
                      ) {
                        return `${dayjs(startDate).format("MMM DD")} - ${dayjs(
                          endDate
                        ).format("MMM DD, YYYY")}`;
                      }
                      return "Invalid dates";
                    })()
                  : "Select rental dates"}
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

        {/* Timeline and Cancel Button for pending requests */}
        <View className="flex-row justify-end mt-3 gap-2">
          {request.status === "pending" &&
            !dayjs().isAfter(request.startDate) && (
              <>
                <TouchableOpacity
                  onPress={() => onEdit?.(request.id)}
                  className="px-4 py-2 bg-blue-50 rounded-lg"
                >
                  <Text className="text-blue-600 font-psemibold">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onCancel(request.id)}
                  className="px-4 py-2 bg-red-50 rounded-lg"
                >
                  <Text className="text-red-600 font-psemibold">Cancel</Text>
                </TouchableOpacity>
              </>
            )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default SentRequestCard;
