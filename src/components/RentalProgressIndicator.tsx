import React from "react";
import { View, Text, Image, ScrollView } from "react-native";
import { icons } from "@/constant";

interface RentalStep {
  id: string;
  title: string;
  icon: any;
  status: "completed" | "current" | "pending" | "cancelled" | "declined";
  subSteps?: {
    id: string;
    title: string;
    completed: boolean;
  }[];
}

type RentalStatus =
  | "pending"
  | "accepted"
  | "paid"
  | "pickedup"
  | "active"
  | "completed"
  | "declined"
  | "cancelled";

interface RentalProgressIndicatorProps {
  currentStatus: RentalStatus;
  isOwner: boolean;
  compact?: boolean; // For smaller display in header
}

const RentalProgressIndicator: React.FC<RentalProgressIndicatorProps> = ({
  currentStatus,
  isOwner,
  compact = false,
}) => {
  // Define the rental process steps
  const getRentalSteps = (): RentalStep[] => {
    const baseSteps: RentalStep[] = [
      {
        id: "request",
        title: "Request",
        icon: icons.plane,
        status: "completed",
        subSteps: [
          { id: "submit-request", title: "Submit Request", completed: true },
          { id: "review", title: "Review Request", completed: false },
          { id: "decision", title: "Accept/Decline", completed: false },
        ],
      },
      {
        id: "pickup",
        title: "Pickup",
        icon: icons.location,
        status: "pending",
        subSteps: [
          { id: "downpayment", title: "Down Payment", completed: false },
          { id: "condition-check", title: "Condition Check", completed: false },
          { id: "agreement", title: "Agreement", completed: false },
        ],
      },
      {
        id: "return",
        title: "Return",
        icon: icons.refresh,
        status: "pending",
        subSteps: [
          { id: "full-payment", title: "Full Payment", completed: false },
          {
            id: "condition-assessment",
            title: "Condition Assessment",
            completed: false,
          },
        ],
      },
      {
        id: "rate",
        title: "Rate",
        icon: icons.star,
        status: "pending",
      },
    ];

    // Update step statuses based on current status
    switch (currentStatus.toLowerCase()) {
      case "pending":
        baseSteps[0].status = "current";
        baseSteps[0].subSteps![0].completed = true; // Submit completed
        baseSteps[0].subSteps![1].completed = false; // Review in progress
        break;

      case "accepted":
        baseSteps[0].status = "completed";
        baseSteps[0].subSteps?.forEach((step) => (step.completed = true));
        baseSteps[1].status = "current";
        break;

      case "paid":
        baseSteps[0].status = "completed";
        baseSteps[0].subSteps?.forEach((step) => (step.completed = true));
        baseSteps[1].status = "current";
        baseSteps[1].subSteps![0].completed = true; // Down payment completed
        baseSteps[1].subSteps![1].completed = true; // Agreement completed
        break;

      case "pickedup":
        baseSteps[0].status = "completed";
        baseSteps[0].subSteps?.forEach((step) => (step.completed = true));
        baseSteps[1].status = "completed";
        baseSteps[1].subSteps?.forEach((step) => (step.completed = true));
        baseSteps[2].status = "current";
        break;

      case "completed":
        baseSteps.forEach((step, index) => {
          if (index < baseSteps.length - 1) {
            step.status = "completed";
            step.subSteps?.forEach((subStep) => (subStep.completed = true));
          }
          if (index === baseSteps.length - 1) {
            step.status = "current"; // Rate step
          }
        });
        break;

      case "declined":
        baseSteps[0].status = "declined";
        baseSteps[0].subSteps![0].completed = true;
        baseSteps[0].subSteps![1].completed = true;
        baseSteps[0].subSteps![2].completed = true;
        baseSteps.slice(1).forEach((step) => {
          step.status = "cancelled";
        });
        break;

      case "cancelled":
        baseSteps[0].status = "cancelled";
        baseSteps[0].subSteps![0].completed = true;
        baseSteps.slice(1).forEach((step) => {
          step.status = "cancelled";
        });
        break;
    }

    return baseSteps;
  };

  const steps = getRentalSteps();
  const currentStep =
    steps.find((step) => step.status === "current") || steps[0];

  const getStepStyle = (status: string) => {
    switch (status) {
      case "completed":
        return {
          containerClass: "bg-green-500",
          iconTintColor: "#ffffff",
          textColor: "text-green-600",
          lineColor: "#10b981",
        };
      case "current":
        return {
          containerClass: "bg-blue-500",
          iconTintColor: "#ffffff",
          textColor: "text-blue-600",
          lineColor: "#e5e7eb",
        };
      case "declined":
        return {
          containerClass: "bg-red-500",
          iconTintColor: "#ffffff",
          textColor: "text-red-600",
          lineColor: "#e5e7eb",
        };
      case "cancelled":
        return {
          containerClass: "bg-gray-400",
          iconTintColor: "#ffffff",
          textColor: "text-gray-500",
          lineColor: "#e5e7eb",
        };
      default:
        return {
          containerClass: "bg-gray-200",
          iconTintColor: "#9ca3af",
          textColor: "text-gray-400",
          lineColor: "#e5e7eb",
        };
    }
  };

  if (compact) {
    // Compact version for header
    const completedSteps = steps.filter(
      (step) => step.status === "completed"
    ).length;
    const totalSteps = steps.length;

    return (
      <View className="flex-row items-center">
        {/* Progress bar */}
        <View className="flex-row items-center mr-2">
          <View className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{
                width: `${(completedSteps / totalSteps) * 100}%`,
              }}
            />
          </View>
        </View>

        {/* Current step info */}
        <View className="flex-row items-center">
          <View
            className={`w-6 h-6 rounded-full items-center justify-center ${
              getStepStyle(currentStep.status).containerClass
            }`}
          >
            <Image
              source={currentStep.icon}
              className="w-3 h-3"
              tintColor={getStepStyle(currentStep.status).iconTintColor}
            />
          </View>
          <Text
            className={`text-xs font-pmedium ml-1 ${
              getStepStyle(currentStep.status).textColor
            }`}
          >
            {currentStep.title}
          </Text>
        </View>
      </View>
    );
  }

  // Enhanced current step view
  return (
    <View className="py-4 px-5 bg-white border-b border-gray-100">
      {/* Progress Bar */}
      <View className="flex-row items-center mb-4">
        <View className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
          <View
            className={`h-full rounded-full ${getStatusColor(currentStatus)}`}
            style={{
              width: `${
                ((steps.findIndex((s) => s.id === currentStep.id) + 1) /
                  steps.length) *
                100
              }%`,
            }}
          />
        </View>
        <Text className="ml-3 text-xs font-pmedium text-gray-500">
          {steps.findIndex((s) => s.id === currentStep.id) + 1}/{steps.length}
        </Text>
      </View>

      {/* Current Step Header */}
      <View className="flex-row items-center mb-3">
        <View
          className={`w-10 h-10 rounded-full items-center justify-center ${getStatusColor(
            currentStatus
          )}`}
        >
          <Image
            source={currentStep.icon}
            className="w-5 h-5"
            tintColor="#ffffff"
          />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-lg font-pbold text-gray-800">
            {currentStep.title}
          </Text>
          <Text className="text-sm text-gray-500">
            {getStatusMessage(currentStatus, isOwner)}
          </Text>
        </View>
      </View>

      {/* Sub Steps if available */}
      {currentStep.subSteps && (
        <View className="flex-row gap-2 justify-center">
          {currentStep.subSteps.map((subStep, index) => (
            <View
              key={subStep.id}
              className="flex-row items-center mb-2 last:mb-0"
            >
              <View
                className={`w-6 h-6 rounded-full items-center justify-center ${
                  subStep.completed ? "bg-green-500" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-pbold ${
                    subStep.completed ? "text-white" : "text-gray-400"
                  }`}
                >
                  {index + 1}
                </Text>
              </View>
              <Text
                className={`ml-2 text-sm ${
                  subStep.completed
                    ? "text-green-600 font-pmedium"
                    : "text-gray-500"
                }`}
              >
                {subStep.title}
              </Text>
              {subStep.completed && (
                <Image
                  source={icons.singleCheck}
                  className="w-4 h-4 ml-2"
                  tintColor="#10b981"
                />
              )}
            </View>
          ))}
        </View>
      )}

      {/* Next Step Preview */}
      {currentStep.id !== "rate" && (
        <View className="mt-4 pt-4 border-t border-gray-100">
          <Text className="text-xs font-pmedium text-gray-400 mb-2">
            NEXT STEP
          </Text>
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full items-center justify-center bg-gray-100">
              <Image
                source={
                  steps[steps.findIndex((s) => s.id === currentStep.id) + 1]
                    ?.icon
                }
                className="w-4 h-4"
                tintColor="#9ca3af"
              />
            </View>
            <Text className="ml-2 text-sm text-gray-400">
              {
                steps[steps.findIndex((s) => s.id === currentStep.id) + 1]
                  ?.title
              }
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

type StatusMessages = {
  [K in RentalStatus]: string;
};

const ownerMessages: StatusMessages = {
  pending: "New rental request received, please review",
  accepted: "Request accepted. Waiting for payment and pickup",
  paid: "Payment received. Ready for pickup",
  pickedup: "Item has been picked up",
  active: "Item is currently being rented",
  completed: "Rental completed successfully",
  declined: "You declined this rental request",
  cancelled: "Request was cancelled",
};

const renterMessages: StatusMessages = {
  pending: "Request submitted, waiting for review",
  accepted: "Request accepted! Please proceed with payment",
  paid: "Payment confirmed. Ready for pickup",
  pickedup: "Item picked up. Remember return date",
  active: "You are currently renting this item",
  completed: "Rental completed. Please rate your experience",
  declined: "Your request was declined",
  cancelled: "You cancelled this request",
};

const getStatusMessage = (status: string, isOwner: boolean): string => {
  const messages = isOwner ? ownerMessages : renterMessages;
  return messages[status as keyof typeof messages] || "Unknown status";
};

const getStatusColor = (status: RentalStatus) => {
  switch (status) {
    case "accepted":
      return "bg-blue-500";
    case "paid":
    case "completed":
      return "bg-green-500";
    case "declined":
      return "bg-red-500";
    case "cancelled":
      return "bg-gray-400";
    default:
      return "bg-primary";
  }
};

export default RentalProgressIndicator;
