// components/NotificationCard.js or components/notifications/NotificationCard.js

import { View, Text, TouchableOpacity } from "react-native";
import { NOTIFICATION_TYPES, PRIORITY_LEVELS } from "@/lib/notifications";

interface NotificationCardProps {
  notification: Notification; // Use the same interface from NotificationProvider
  onPress: () => void;
  showActions?: boolean;
  onDelete?: () => void;
}

const NotificationCard = ({
  notification,
  onPress,
  showActions = false,
  onDelete,
}: NotificationCardProps) => {
  const typeConfig = NOTIFICATION_TYPES[notification.type];
  const priorityConfig = PRIORITY_LEVELS[notification.priority];

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderAdditionalInfo = () => {
    switch (notification.type) {
      case "PRICE_NEGOTIATION":
        return (
          notification.originalPrice &&
          notification.proposedPrice && (
            <View className="flex-row items-center mt-1">
              <Text className="text-sm text-gray-600">
                ${notification.originalPrice} →
              </Text>
              <Text className="text-sm font-semibold text-green-600 ml-1">
                ${notification.proposedPrice}
              </Text>
            </View>
          )
        );

      case "PAYMENT_RECEIVED":
      case "PAYMENT_SENT":
        return (
          notification.amount && (
            <View className="flex-row items-center mt-1">
              <Text className="text-sm font-semibold text-green-600">
                ${notification.amount}
              </Text>
              {notification.paymentMethod && (
                <Text className="text-sm text-gray-500 ml-2">
                  via {notification.paymentMethod}
                </Text>
              )}
            </View>
          )
        );

      case "BULK_INQUIRY":
        return (
          notification.requestedItems && (
            <Text className="text-sm text-blue-600 mt-1">
              {notification.requestedItems.join(", ")} • {notification.duration}
            </Text>
          )
        );

      case "DELIVERY_REQUEST":
        return (
          notification.deliveryAddress && (
            <Text className="text-sm text-gray-600 mt-1">
              📍 {notification.deliveryAddress}
            </Text>
          )
        );

      case "RETURN_REMINDER":
        return (
          notification.lateFeePenalty && (
            <Text className="text-sm text-red-600 mt-1">
              Late fee: ${notification.lateFeePenalty}/day
            </Text>
          )
        );

      default:
        return null;
    }
  };

  return (
    <TouchableOpacity onPress={onPress} className="w-full mb-2">
      <View
        className={`p-4 rounded-lg border ${
          !notification.isRead
            ? "bg-white border-blue-200 shadow-sm"
            : "bg-gray-50 border-gray-100"
        }`}
      >
        <View className="flex-row items-start gap-3">
          {/* Type Indicator */}
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: typeConfig?.bgColor }}
          >
            <Text className="text-lg">{typeConfig?.icon}</Text>
          </View>

          {/* Content */}
          <View className="flex-1">
            {/* Header */}
            <View className="flex-row justify-between items-start mb-1">
              <View className="flex-1">
                <Text
                  className={`text-base ${
                    !notification.isRead
                      ? "font-bold text-gray-900"
                      : "font-medium text-gray-700"
                  }`}
                >
                  {notification.title}
                </Text>
                {notification.senderName &&
                  notification.senderName !== "System" && (
                    <Text className="text-sm text-gray-500">
                      from {notification.senderName}
                    </Text>
                  )}
              </View>

              <View className="items-end">
                <Text className="text-xs text-gray-500">
                  {formatDate(notification.dateReceived)}
                </Text>
                {notification.priority === "urgent" && (
                  <View className="mt-1 px-2 py-0.5 bg-red-100 rounded-full">
                    <Text className="text-xs text-red-600 font-medium">
                      URGENT
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Item name if present */}
            {notification.itemName && (
              <Text className="text-sm text-blue-600 font-medium mb-1">
                📦 {notification.itemName}
              </Text>
            )}

            {/* Message */}
            <Text
              className={`text-sm ${
                !notification.isRead ? "text-gray-800" : "text-gray-600"
              }`}
              numberOfLines={2}
            >
              {notification.message}
            </Text>

            {/* Additional type-specific info */}
            {renderAdditionalInfo()}

            {/* Action buttons if needed */}
            {showActions &&
              notification.actionRequired &&
              !notification.isRead && (
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    className="px-3 py-1 bg-blue-100 rounded-full"
                    onPress={onPress}
                  >
                    <Text className="text-xs text-blue-600 font-medium">
                      {typeConfig?.actionText || "View"}
                    </Text>
                  </TouchableOpacity>
                  {onDelete && (
                    <TouchableOpacity
                      className="px-3 py-1 bg-gray-100 rounded-full"
                      onPress={onDelete}
                    >
                      <Text className="text-xs text-gray-600 font-medium">
                        Dismiss
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
          </View>

          {/* Status indicators */}
          <View className="items-center gap-2">
            {/* Unread indicator */}
            {!notification.isRead && (
              <View className="w-3 h-3 bg-blue-500 rounded-full" />
            )}

            {/* Action required indicator */}
            {notification.actionRequired && !notification.isRead && (
              <View className="px-2 py-1 bg-orange-100 rounded-full">
                <Text className="text-xs text-orange-600 font-medium">
                  ACTION
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default NotificationCard;
