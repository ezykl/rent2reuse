import { View, Text, TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
import { FirestoreNotification } from "@/types/notification";
import { icons } from "@/constant";

interface NotificationCardProps {
  notification: FirestoreNotification;
  onPress: () => void;
  onDelete: () => void;
}

const NotificationCard = ({
  notification,
  onPress,
  onDelete,
}: NotificationCardProps) => {
  const getNotificationConfig = (type: string) => {
    switch (type) {
      case "RENT_REQUEST":
        return {
          icon: icons.envelope,
          bgColor: "bg-blue-100",
          iconColor: "#3B82F6",
        };
      case "RENT_ACCEPTED":
        return {
          icon: icons.check,
          bgColor: "bg-green-100",
          iconColor: "#22C55E",
        };
      case "RENT_REJECTED":
        return {
          icon: icons.close,
          bgColor: "bg-red-100",
          iconColor: "#EF4444",
        };
      case "RENT_REQUEST_DECLINED":
        return {
          icon: icons.close,
          bgColor: "bg-red-100",
          iconColor: "#EF4444",
        };
      case "REPORT_ISSUE":

      case "REPORT_RESPONSE":
        return {
          icon: icons.report,
          bgColor: "bg-red-100",
          iconColor: "#EF4444",
        };
      case "RENT_REQUEST_CANCELLED":
        return {
          icon: icons.check,
          bgColor: "bg-red-100",
          iconColor: "#EF4444",
        };
      case "ANNOUNCEMENT":
        return {
          icon: icons.check,
          bgColor: "bg-red-100",
          iconColor: "#EF4444",
        };
      case "RENT_REQUEST_ACCEPTED":
        return {
          icon: icons.check,
          bgColor: "bg-green-100",
          iconColor: "#22C55E",
        };
      case "MESSAGE_RECEIVED":
        return {
          icon: icons.envelope,
          bgColor: "bg-purple-100",
          iconColor: "#9333EA",
        };
      case "WELCOME":
        return {
          icon: icons.box,
          bgColor: "bg-amber-100",
          iconColor: "#F59E0B",
        };
      case "SUPPORT_TICKET":
        return {
          icon: icons.ticket,
          bgColor: "bg-orange-100",
          iconColor: "#d96c00",
        };
      case "RENTAL_STARTED":
        return {
          icon: icons.ticket,
          bgColor: "bg-blue-100",
          iconColor: "#3B82F6",
        };
      case "RENT_SENT":
        return {
          icon: icons.plane,
          bgColor: "bg-green-100",
          iconColor: "#22C55E",
        };

      case "REPORT_RESPOSE":
        return {
          icon: icons.report,
          bgColor: "bg-orange-100",
          iconColor: "#d96c00",
        };
      case "PLAN_ACTIVATED":
        return {
          icon: icons.platinumPlan,
          bgColor: "bg-orange-100",
          iconColor: "#d96c00",
        };
      default:
        return {
          icon: icons.notificationOff,
          bgColor: "bg-gray-100",
          iconColor: "#6B7280",
        };
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";

    try {
      const date = timestamp.toDate();
      const now = new Date();

      // Calculate time difference in milliseconds
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

      // More granular time display
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      // For older dates, show the actual date
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date error";
    }
  };

  const config = getNotificationConfig(notification.type);

  const handlePress = () => {
    onPress(); // This will open the modal now instead of navigating
  };

  const handleDelete = async (e: any) => {
    e.stopPropagation(); // Prevent triggering the parent's onPress
    // Call the provided onDelete function directly
    onDelete();
  };

  return (
    <TouchableOpacity onPress={handlePress} className="w-full">
      <View
        className={`p-4  border ${
          !notification.isRead
            ? "bg-blue-50 border-blue-200 shadow-sm"
            : "bg-white border-gray-100"
        }`}
        style={{ minHeight: 100, maxHeight: 110 }}
      >
        <View className="flex-row items-start gap-3 px-4 ">
          {/* Type Indicator */}
          <View className=" flex h-full justify-center">
            <View
              className={`w-10 h-10  rounded-full items-center justify-center ${config.bgColor}`}
            >
              <Image
                source={config.icon}
                className="w-5 h-5"
                resizeMode="contain"
                tintColor={config.iconColor}
              />
            </View>
          </View>
          {/* Content */}
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row justify-between items-start">
              <Text
                className={`text-base flex-1 ${
                  !notification.isRead
                    ? "font-pbold text-gray-900"
                    : "font-pmedium text-gray-700"
                }`}
              >
                {notification.title}
              </Text>
              <Text className="text-xs text-gray-500 ml-2">
                {formatDate(notification.createdAt)}
              </Text>
            </View>

            {/* Message */}
            <View className=" pr-4">
              <Text
                className={`text-sm mt-1 ${
                  !notification.isRead ? "text-gray-800" : "text-gray-600"
                }`}
                numberOfLines={2}
              >
                {notification.message}
              </Text>
            </View>

            {/* {notification.description && (
              <Text className="text-sm mt-1 text-gray-600" numberOfLines={4}>
                {notification.description}
              </Text>
            )} */}
          </View>

          {!notification.isRead && (
            <View className="absolute -top-2 -right-2 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </View>
      </View>
      {notification.isRead && (
        <TouchableOpacity
          className="absolute bottom-4 right-4 justify-center items-center p-4  w-2 h-2"
          onPress={handleDelete}
        >
          <Image source={icons.trash} className="w-5 h-5" tintColor="#f87171" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default NotificationCard;
