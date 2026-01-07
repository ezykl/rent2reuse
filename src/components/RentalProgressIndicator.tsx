import React from "react";
import { View, Text } from "react-native";

type RentalStatus =
  | "pending"
  | "accepted"
  | "initial_payment_paid"
  | "assessment_submitted"
  | "pickedup"
  | "completed"
  | "declined"
  | "cancelled"
  | "rated"
  | "downpayment_paid"
  | "pickup"
  | "renting";

interface RentalProgressIndicatorProps {
  currentStatus: RentalStatus;
  isOwner: boolean;
  compact?: boolean;
}

const RentalProgressIndicator: React.FC<RentalProgressIndicatorProps> = ({
  currentStatus,
  isOwner,
  compact = false,
}) => {
  // ✅ Updated to 5 stages with new status names
  const stages = [
    { name: "Request", status: ["pending"] },
    {
      name: "Pick-Up",
      status: [
        "accepted",
        "initial_payment_paid",
        "assessment_submitted",
        "downpayment_paid",
        "pickup",
      ],
    },
    { name: "Renting", status: ["pickedup", "renting"] },
    { name: "Return", status: ["completed"] },
    { name: "Rate", status: ["rated"] },
  ];

  const getStageIndex = (): number => {
    for (let i = 0; i < stages.length; i++) {
      if (stages[i].status.includes(currentStatus)) {
        return i;
      }
    }
    return 0;
  };

  const currentStageIndex = getStageIndex();
  const completedStages = Math.min(currentStageIndex + 1, stages.length);
  const progressPercentage = (completedStages / stages.length) * 100;

  if (compact) {
    // Compact version for header
    return (
      <View className="flex-row items-center gap-2">
        {/* Progress bar */}
        <View className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{
              width: `${progressPercentage}%`,
            }}
          />
        </View>

        {/* Current stage info */}
        <Text className="text-xs font-pmedium text-primary">
          {completedStages}/{stages.length}
        </Text>
      </View>
    );
  }

  return (
    <View className="py-4 px-5 bg-white rounded-xl">
      {/* Progress Bar */}
      <View className="flex-row items-center mb-4">
        <View className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{
              width: `${progressPercentage}%`,
            }}
          />
        </View>
        <Text className="ml-3 text-xs font-pmedium text-gray-500">
          {completedStages}/{stages.length}
        </Text>
      </View>

      {/* Stages Grid */}
      <View className="flex-row justify-between">
        {stages.map((stage, index) => (
          <View key={index} className="flex-1 items-center">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center mb-2 ${
                index < completedStages
                  ? "bg-primary"
                  : index === currentStageIndex
                  ? "bg-primary"
                  : "bg-gray-200"
              }`}
            >
              <Text
                className={`font-pbold text-xs ${
                  index < completedStages || index === currentStageIndex
                    ? "text-white"
                    : "text-gray-600"
                }`}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              className={`text-xs font-pmedium text-center ${
                index === currentStageIndex
                  ? "text-primary font-pbold"
                  : index < currentStageIndex
                  ? "text-gray-700"
                  : "text-gray-500"
              }`}
            >
              {stage.name}
            </Text>
          </View>
        ))}
      </View>

      {/* Current Stage Message */}
      <View className="mt-4 pt-3 border-t border-gray-100">
        <Text className="text-xs font-pmedium text-gray-600 mb-1">
          Current:{" "}
          <Text className="text-primary font-pbold">
            {stages[currentStageIndex].name}
          </Text>
        </Text>
        <Text className="text-xs text-gray-500">
          {getStatusMessage(currentStatus, isOwner)}
        </Text>
      </View>
    </View>
  );
};

const getStatusMessage = (status: RentalStatus, isOwner: boolean): string => {
  const messages: Record<RentalStatus, string> = {
    pending: isOwner
      ? "Waiting for your response to this request"
      : "Request submitted, waiting for owner review",
    accepted: isOwner
      ? "Ready for payment and pickup"
      : "Request accepted! Prepare for payment",
    downpayment_paid: isOwner
      ? "Downpayment received, ready for pickup assessment"
      : "Downpayment confirmed, ready for assessment",
    pickup: isOwner
      ? "Completing pickup assessment"
      : "Completing pickup assessment",
    initial_payment_paid: isOwner
      ? "Initial payment received"
      : "Initial payment confirmed",
    assessment_submitted: isOwner
      ? "Renter submitted item condition"
      : "Item condition assessment submitted",
    pickedup: isOwner ? "Item with renter" : "You're renting this item",
    renting: isOwner ? "Item being rented out" : "You're renting this item",
    completed: isOwner ? "Ready for return inspection" : "Return the item",
    declined: "Request was declined",
    cancelled: "Request was cancelled",
    rated: isOwner ? "Leave your review" : "Leave your review",
  };

  return messages[status] || "Unknown status";
};

export default RentalProgressIndicator;
