import { View, Text, Image, TouchableOpacity } from "react-native";
import React, { useEffect, useState } from "react";
import { icons } from "../constant";
import dayjs from "dayjs";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { min } from "date-fns";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

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

  // First check if request is cancelled, rejected, or declined
  if (
    status === "rejected" ||
    status === "cancelled" ||
    status === "declined"
  ) {
    return {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      color: "bg-red-100 text-red-700",
      isActive: false,
    };
  }

  // Check if request is expired (past start date)
  if (now.isAfter(start) && status === "pending") {
    return {
      label: "Expired",
      color: "bg-gray-100 text-gray-500",
      isActive: false,
    };
  }

  // Check if rental period is over
  if (now.isAfter(end)) {
    return {
      label: "Completed",
      color: "bg-gray-100 text-gray-700",
      isActive: false,
    };
  }

  // For active requests
  return {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    color:
      status === "approved"
        ? "bg-green-100 text-green-700"
        : "bg-yellow-100 text-yellow-700",
    isActive: true,
  };
};

const SentRequestCard = ({
  request,
  onPress,
  onCancel,
  onEdit,
}: SentRequestCardProps) => {
  const { minutesToTime } = useTimeConverter();
  const [securityDepositPercentage, setSecurityDepositPercentage] = useState<
    number | null
  >(null);
  const [loading, setLoading] = useState(true);

  // Fetch security deposit percentage from item document
  useEffect(() => {
    const fetchSecurityDeposit = async () => {
      try {
        if (request.itemId) {
          const itemDoc = await getDoc(doc(db, "items", request.itemId));
          if (itemDoc.exists()) {
            const data = itemDoc.data();
            setSecurityDepositPercentage(
              data.securityDepositPercentage || null
            );
          }
        }
      } catch (error) {
        console.error("Error fetching security deposit:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityDeposit();
  }, [request.itemId]);

  // Add this function to check if request is expired
  const isExpired = () => {
    const now = dayjs();
    const start = dayjs(request.startDate.toDate?.() ?? request.startDate);
    return now.isAfter(start) && request.status === "pending";
  };

  // Calculate deposit amount
  const calculateDepositAmount = (): number => {
    if (!securityDepositPercentage) return 0;
    // totalPrice already includes rental, so we calculate deposit based on it
    const baseTotal = request.totalPrice; // This is the rental total
    const depositAmount = (baseTotal * securityDepositPercentage) / 100;
    return Math.round(depositAmount);
  };

  // Get total with deposit
  const getTotalWithDeposit = (): number => {
    const depositAmount = calculateDepositAmount();
    return request.totalPrice - depositAmount;
  };

  // Get card styles based on status and expiry
  const getCardStyle = () => {
    if (
      isExpired() ||
      request.status === "declined" ||
      request.status === "rejected" ||
      request.status === "cancelled"
    ) {
      return "border-gray-200 bg-gray-50";
    }
    return "border-gray-100 bg-white";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: "bg-yellow-100",
          text: "text-yellow-700",
          icon: "#EAB308",
        };
      case "accepted":
        return {
          bg: "bg-green-100",
          text: "text-green-700",
          icon: "#22C55E",
        };
      case "rejected":
      case "declined": // Add this case
        return {
          bg: "bg-red-100",
          text: "text-red-700",
          icon: "#EF4444",
        };
      case "cancelled":
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
      className={`rounded-xl mb-2 shadow-sm border overflow-hidden ${getCardStyle()}`}
      onPress={() => onPress(request.id)}
      activeOpacity={0.7}
    >
      <View className="p-4">
        {/* Add Expired Banner if expired */}
        {isExpired() && (
          <View className="bg-orange-100 px-4 py-2 rounded-lg mb-3">
            <Text className="text-orange-700 font-pmedium text-sm">
              This request has passed its start date. Please edit the dates or
              cancel the request.
            </Text>
          </View>
        )}

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
              <Text className="font-psemibold text-gray-800">
                {formattedTime.toString()}
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

            {/* Price Breakdown */}
            {securityDepositPercentage && securityDepositPercentage > 0 ? (
              <View className="mb-2">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs text-gray-600">Rental:</Text>
                  <Text className="text-xs font-psemibold text-gray-800">
                    ₱{request.totalPrice.toLocaleString()}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-xs text-orange-600">
                    Downpayment ({securityDepositPercentage}%):
                  </Text>
                  <Text className="text-xs font-psemibold text-orange-600">
                    ₱{calculateDepositAmount().toLocaleString()}
                  </Text>
                </View>
                <View className="border-t border-orange-200 pt-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm font-pbold text-gray-800">
                      Total Amount Due at Pickup:
                    </Text>
                    <Text className="text-sm font-pbold text-primary">
                      ₱{getTotalWithDeposit().toLocaleString()}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text className="text-base font-psemibold text-primary">
                ₱{request.totalPrice.toLocaleString()} total
              </Text>
            )}
          </View>
        </View>

        {/* Timeline and Cancel Button for pending requests */}
        <View className="flex-row justify-end  gap-2">
          {request.status === "pending" && (
            <>
              <TouchableOpacity
                onPress={() => onEdit?.(request.id)}
                className={`px-4 py-2 rounded-lg ${
                  isExpired() ? "bg-primary" : "bg-blue-50"
                }`}
              >
                <Text
                  className={`font-psemibold ${
                    isExpired() ? "text-white" : "text-blue-600"
                  }`}
                >
                  {isExpired() ? "Update Dates" : "Edit"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onCancel(request.id)}
                className="px-4 py-2 bg-red-50 rounded-lg"
              >
                <Text className="text-red-600 font-psemibold">
                  {isExpired() ? "Remove" : "Cancel"}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {request.status === "declined" && (
            <TouchableOpacity
              onPress={() => onCancel(request.id)}
              className="px-4 py-2 bg-red-50 rounded-lg"
            >
              <Text className="text-red-600 font-psemibold">Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default SentRequestCard;
