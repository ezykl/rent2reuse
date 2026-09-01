import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
} from "react-native";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import { LinearGradient } from "expo-linear-gradient";

type PlanType = "free" | "basic" | "premium" | "platinum" | "limited";
type SubscriptionStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "pending"
  | "inactive";

const getPlanHierarchy = (
  plans: Plan[],
  planType: string,
  planId?: string
): number => {
  const plan = plans.find((p) =>
    planId
      ? p.id === planId
      : p.planType.toLowerCase() === planType.toLowerCase()
  );
  return plan?.price || 0;
};

const getGradientColors = (planType: string): [string, string, string] => {
  const colors: Record<PlanType, [string, string, string]> = {
    free: ["#F59E0B", "#D97706", "#B45309"],
    basic: ["#4B5563", "#374151", "#1F2937"],
    premium: ["#ffd000", "#F59E0B", "#F59E0B"],
    platinum: ["#21AEE6", "#906CDA", "#FF29CD"],
    limited: ["#58629F", "#FFF3AA", "#D97706"],
  };

  return colors[planType.toLowerCase() as PlanType] || colors.free;
};

interface Plan {
  id: string;
  planType: string;
  color?: string;
  description: string;
  duration: string;
  list: number;
  rent: number;
  price: number;
  isPopular: boolean;
  textColor: string;
  useCustomDescription: boolean;
}

interface PlanSubscriptionProps {
  currentPlan?: {
    planId?: string;
    planType: string;
    rentLimit: number;
    listLimit: number;
    rentUsed: number;
    listUsed: number;
    status?: SubscriptionStatus;
    expiryDate?: Date;
    hasUsedFreeTrial?: boolean;
    subscriptionId?: string;
  };
  onSelectPlan: (plan: Plan) => void;
  onUpgradePlan?: (plan: Plan) => void; // Separate handler for upgrades
  onDowngradePlan?: (plan: Plan) => void; // Separate handler for downgrades
}

interface PlanValidation {
  isAllowed: boolean;
  reason?: string;
  action: "current" | "upgrade" | "downgrade" | "select" | "blocked";
  requiresConfirmation?: boolean;
  warningMessage?: string;
  daysRemaining?: number;
}

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  currentPlan: string;
  newPlan: string;
  currentPrice: number;
  newPrice: number;
  daysRemaining?: number;
  onConfirm: () => void;
  onCancel: () => void;
}
const PlanConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  currentPlan,
  newPlan,
  currentPrice,
  newPrice,
  daysRemaining,
  onConfirm,
  onCancel,
}) => {
  const formatDaysRemaining = (days: number) => {
    if (days <= 0) return "Expired";
    if (days === 1) return "1 day";
    if (days < 30) return `${days} days`;
    if (days < 365) {
      const months = Math.floor(days / 30);
      const remainingDays = days % 30;
      if (remainingDays === 0) return `${months} month${months > 1 ? "s" : ""}`;
      return `${months} month${months > 1 ? "s" : ""} ${remainingDays} day${
        remainingDays > 1 ? "s" : ""
      }`;
    }
    return `${Math.floor(days / 365)} year${
      Math.floor(days / 365) > 1 ? "s" : ""
    }`;
  };

  const getActionText = () => {
    if (currentPrice === 0) return "upgrade to"; // From free
    if (newPrice > currentPrice) return "upgrade to";
    if (newPrice < currentPrice) return "downgrade to";
    return "switch to";
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
    >
      <View className="flex-1 bg-black/50 justify-center  items-center">
        <View className="bg-white rounded-2xl p-4 border w-full max-w-md">
          {/* Header */}
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center mb-3">
              <Text className="text-orange-600 text-2xl font-pbold">!</Text>
            </View>
            <Text className="text-xl font-pbold text-gray-800 text-center">
              Confirm Plan Change
            </Text>
            <Text className="text-sm text-gray-600 text-center mt-1">
              You want to {getActionText()}{" "}
              {newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}
            </Text>
          </View>

          {/* Current Plan Status */}
          {daysRemaining && daysRemaining > 0 && (
            <View className="bg-blue-50 p-4 rounded-lg mb-4">
              <Text className="text-center text-sm text-gray-600 mb-1">
                Current Plan Status
              </Text>
              <Text className="text-center font-pbold text-blue-800 text-lg">
                {currentPlan} Plan
              </Text>
              <Text className="text-center text-blue-600 font-pmedium">
                {formatDaysRemaining(daysRemaining)} remaining
              </Text>
              <Text className="text-center text-xs text-blue-600 mt-1">
                (₱{currentPrice} plan value)
              </Text>
            </View>
          )}

          {/* Plan Change Arrow */}
          <View className="items-center mb-4">
            <View className="flex-row items-center">
              <View className=" flex-1 bg-red-100 px-3 py-2 rounded-lg">
                <Text className="font-psemibold text-base text-red-700">
                  {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </Text>
                <Text className="text-lg text-red-600 font-pmedium">
                  ₱{currentPrice}
                </Text>
              </View>

              <Image source={icons.arrowRight} className="w-6 h-6" />

              <View className="flex-1 bg-green-100 px-3 py-2 rounded-lg">
                <Text className="font-psemibold text-base text-green-700 ">
                  {newPlan.charAt(0).toUpperCase() + newPlan.slice(1)}
                </Text>
                <Text className="text-lg text-green-600 font-pmedium">
                  ₱{newPrice}
                </Text>
              </View>
            </View>
          </View>

          {/* Warning Section */}
          <View className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-4">
            <View className="flex-row items-start mb-2">
              <Text className="text-orange-600 mr-2">⚠</Text>
              <Text className="text-orange-800 font-pbold text-sm flex-1">
                Important Notice
              </Text>
            </View>

            {daysRemaining && daysRemaining > 0 ? (
              <Text className="text-orange-700 text-sm leading-5">
                Your current subscription will be immediately cancelled and
                replaced. The remaining {formatDaysRemaining(daysRemaining)} of
                your {currentPlan} plan will be forfeited without refund.
              </Text>
            ) : (
              <Text className="text-orange-700 text-sm leading-5">
                {message}
              </Text>
            )}
          </View>

          {/* No Refund Policy */}
          <View className="bg-red-50 border border-red-200 p-3 rounded-lg mb-6">
            <View className="flex-row items-center justify-center">
              <Text className="text-red-600 mr-2">🚫</Text>
              <Text className="text-red-700 text-sm font-pmedium text-center">
                No refunds for unused subscription time
              </Text>
            </View>
          </View>

          {/* Financial Impact */}
          {daysRemaining && daysRemaining > 0 && (
            <View className="bg-gray-50 p-3 rounded-lg mb-6">
              <Text className="text-center text-xs text-gray-600 mb-1">
                Financial Impact
              </Text>
              <Text className="text-center text-gray-700 font-pmedium">
                You'll lose ₱{((currentPrice / 30) * daysRemaining).toFixed(0)}{" "}
                in unused value
              </Text>
              <Text className="text-center text-gray-700 font-pmedium">
                New plan cost: ₱{newPrice}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 bg-primary py-4 rounded-xl"
            >
              <Text className="text-center font-pbold text-white">
                Keep Current Plan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              className="flex-1 bg-red-500 py-4 rounded-xl"
            >
              <Text className="text-center font-pbold text-white">
                Confirm Change
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const PlanSubscription: React.FC<PlanSubscriptionProps> = ({
  currentPlan,
  onSelectPlan,
  onUpgradePlan,
  onDowngradePlan,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Add these new state variables
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [confirmationData, setConfirmationData] = useState<{
    title: string;
    message: string;
    action: string;
    daysRemaining?: number;
  } | null>(null);

  // Memoize current plan hierarchy level
  const currentPlanLevel = useMemo(() => {
    if (!currentPlan?.planType || plans.length === 0) return -1;
    return getPlanHierarchy(plans, currentPlan.planType, currentPlan.planId);
  }, [currentPlan?.planType, currentPlan?.planId, plans]);

  const getDaysRemaining = (expiryDate: Date): number => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const validatePlanSelection = useCallback(
    (plan: Plan): PlanValidation => {
      const planLevel = plan.price;

      // If user has no current plan, allow any plan
      if (!currentPlan || currentPlan.status !== "active") {
        return {
          isAllowed: true,
          action: "select",
        };
      }

      // If selecting the same plan
      if (currentPlan.planId === plan.id) {
        return {
          isAllowed: false,
          reason: "This is your current active plan",
          action: "current",
        };
      }

      // Check if current plan is still active and has time remaining
      if (currentPlan.expiryDate && currentPlan.status === "active") {
        const daysRemaining = getDaysRemaining(currentPlan.expiryDate);

        if (daysRemaining > 0) {
          // Current plan is still active
          if (currentPlanLevel > 0) {
            // Has a paid plan
            return {
              isAllowed: true,
              action:
                planLevel > currentPlanLevel
                  ? "upgrade"
                  : planLevel < currentPlanLevel
                  ? "downgrade"
                  : "select",
              requiresConfirmation: true,
              warningMessage: `Your ${
                currentPlan.planType
              } plan is still active and expires in ${daysRemaining} day${
                daysRemaining !== 1 ? "s" : ""
              }. Switching plans will immediately replace your current subscription.`,
              daysRemaining: daysRemaining,
            };
          }
        }
      }

      // Free plan special rules
      if (plan.price === 0) {
        // Free plan
        if (currentPlan.hasUsedFreeTrial) {
          return {
            isAllowed: false,
            reason: "Free plan can only be used once",
            action: "blocked",
          };
        }

        if (currentPlanLevel > 0) {
          return {
            isAllowed: true,
            action: "downgrade",
            requiresConfirmation: true,
            warningMessage:
              "Downgrading will reduce your limits. Any active listings/rentals exceeding free limits may be affected.",
          };
        }
      }

      // Plan upgrade/downgrade logic
      if (planLevel > currentPlanLevel) {
        return { isAllowed: true, action: "upgrade" };
      } else if (planLevel < currentPlanLevel) {
        const exceedsLimits =
          currentPlan.rentUsed > plan.rent || currentPlan.listUsed > plan.list;
        return {
          isAllowed: true,
          action: "downgrade",
          requiresConfirmation: true,
          warningMessage: exceedsLimits
            ? `You currently have ${currentPlan.listUsed} listings and ${currentPlan.rentUsed} rentals. Downgrading may affect your active items.`
            : `Confirm downgrade from ${currentPlan.planType} to ${plan.planType}?`,
        };
      }

      return { isAllowed: true, action: "select" };
    },
    [currentPlan, currentPlanLevel, plans]
  );
  const handlePlanSelection = useCallback(
    async (plan: Plan) => {
      const validation = validatePlanSelection(plan);

      if (!validation.isAllowed) {
        Alert.alert(
          "Plan Selection",
          validation.reason || "Cannot select this plan"
        );
        return;
      }

      // Handle confirmation with custom modal
      if (validation.requiresConfirmation && validation.warningMessage) {
        setPendingPlan(plan);
        setConfirmationData({
          title:
            validation.action === "upgrade"
              ? "Upgrade Plan"
              : validation.action === "downgrade"
              ? "Downgrade Plan"
              : "Replace Plan",
          message: validation.warningMessage,
          action: validation.action,
          daysRemaining: validation.daysRemaining,
        });
        setShowConfirmModal(true);
        return;
      }

      executePlanSelection(plan, validation.action);
    },
    [validatePlanSelection]
  );

  // Add confirmation handlers
  const handleConfirmPlan = () => {
    if (pendingPlan && confirmationData) {
      executePlanSelection(pendingPlan, confirmationData.action);
      setShowConfirmModal(false);
      setPendingPlan(null);
      setConfirmationData(null);
    }
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setPendingPlan(null);
    setConfirmationData(null);
  };
  const executePlanSelection = (plan: Plan, action: string) => {
    switch (action) {
      case "upgrade":
        onUpgradePlan?.(plan) || onSelectPlan(plan);
        break;
      case "downgrade":
        onDowngradePlan?.(plan) || onSelectPlan(plan);
        break;
      case "select":
      default:
        onSelectPlan(plan);
        break;
    }
  };

  const getButtonState = useCallback(
    (plan: Plan) => {
      const validation = validatePlanSelection(plan);

      if (!validation.isAllowed) {
        return {
          text: validation.reason || "Not Available",
          disabled: true,
          style: "bg-white/40",
          textStyle: "text-white/80",
        };
      }

      switch (validation.action) {
        case "current":
          return {
            text: "Current Plan",
            disabled: true,
            style: "bg-white/40",
            textStyle: "text-white/80",
          };
        case "upgrade":
          // Check if user has active plan that will be replaced
          const hasActivePlan =
            currentPlan?.expiryDate &&
            getDaysRemaining(currentPlan.expiryDate) > 0 &&
            currentPlan.planType.toLowerCase() !== "free";

          return {
            text: hasActivePlan
              ? `Replace Plan - ₱${plan.price}`
              : `Upgrade - ₱${plan.price}`,
            disabled: false,
            style: hasActivePlan ? "bg-orange-500" : "bg-green-500",
            textStyle: "text-white",
          };
        case "downgrade":
          return {
            text: "Downgrade",
            disabled: false,
            style: "bg-orange-500",
            textStyle: "text-white",
          };
        case "select":
        default:
          return {
            text:
              plan.price === 0 ? "Select Free Plan" : `Select - ₱${plan.price}`,
            disabled: false,
            style: "bg-white",
            textStyle: "text-gray-800",
          };
      }
    },
    [validatePlanSelection, currentPlan]
  );

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const plansRef = collection(db, "plans");
        const planSnapshot = await getDocs(query(plansRef));
        const plansData = planSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Plan)
        );

        // Sort plans by price (ascending order: Free -> Basic -> Premium -> Platinum)
        const sortedPlans = plansData.sort((a, b) => {
          // Handle free plans (price 0) to always be first
          if (a.price === 0 && b.price !== 0) return -1;
          if (b.price === 0 && a.price !== 0) return 1;

          // For all other plans, sort by price ascending
          return a.price - b.price;
        });

        setPlans(sortedPlans);
      } catch (error) {
        console.log("Error fetching plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);
  const renderPlanCard = useCallback(
    (plan: Plan) => {
      const isActive =
        currentPlan?.planId === plan.id && currentPlan?.status === "active";
      const gradientColors = getGradientColors(plan.planType);
      const buttonState = getButtonState(plan);
      const validation = validatePlanSelection(plan);

      return (
        <TouchableOpacity
          key={plan.id}
          onPress={() => !buttonState.disabled && handlePlanSelection(plan)}
          disabled={buttonState.disabled}
          className="mr-4 w-[280px] rounded-2xl overflow-hidden"
        >
          <LinearGradient
            colors={gradientColors}
            style={{
              borderRadius: 16,
              padding: 16,
              minHeight: 320,
            }}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
          >
            {/* Status Badge */}
            {isActive && (
              <View className="absolute top-3 right-3 bg-primary px-3 py-1 rounded-full">
                <Text className="text-white text-xs font-pbold">Active</Text>
              </View>
            )}

            {/* Plan Type */}
            <View className="min-h-[180px]">
              <View className="flex-row items-center mb-2 py-2 rounded-lg w-auto">
                <Image
                  source={
                    plan.planType.toLowerCase() === "free"
                      ? icons.bronzePlan
                      : plan.planType.toLowerCase() === "basic"
                      ? icons.silverPlan
                      : plan.planType.toLowerCase() === "premium"
                      ? icons.goldPlan
                      : icons.platinumPlan
                  }
                  className="w-6 h-6 mr-2"
                  style={{ resizeMode: "contain" }}
                />
                <Text
                  className="text-2xl font-pbold text-center"
                  style={{ color: plan.textColor }}
                >
                  {plan.planType.toLowerCase() === "platinum"
                    ? "Limited Time Offer"
                    : plan.planType.charAt(0).toUpperCase() +
                      plan.planType.slice(1)}
                </Text>
              </View>

              {/* Price */}
              <Text
                className="text-3xl font-pbold mb-4"
                style={{ color: plan.textColor }}
              >
                ₱{plan.price}
                <Text className="text-lg opacity-80">/{plan.duration}</Text>
              </Text>

              {/* Features */}
              <View className="space-y-2">
                <Text
                  className="font-psemibold"
                  style={{ color: plan.textColor }}
                >
                  • List up to {plan.list} items concurrently
                </Text>
                <Text
                  className="font-psemibold"
                  style={{ color: plan.textColor }}
                >
                  • Rent up to {plan.rent} items concurrently
                </Text>
                {plan.description && (
                  <Text
                    numberOfLines={3}
                    style={{ color: plan.textColor }}
                    className="opacity-80 font-plight mt-2"
                  >
                    {plan.description}
                  </Text>
                )}
              </View>
            </View>

            {/* Action Button */}
            <View className="mt-auto">
              <TouchableOpacity
                className={`mt-4 py-3 rounded-xl ${buttonState.style}`}
                onPress={() =>
                  !buttonState.disabled && handlePlanSelection(plan)
                }
                disabled={buttonState.disabled}
              >
                <Text
                  className={`text-center font-pbold ${buttonState.textStyle}`}
                >
                  {buttonState.text}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [currentPlan, handlePlanSelection, getButtonState, validatePlanSelection]
  );

  if (loading) {
    return (
      <View className="p-4 items-center justify-center">
        <Text className="text-gray-600">Loading plans...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="py-4 h-auto"
      >
        {plans.map(renderPlanCard)}
      </ScrollView>

      {/* Add the confirmation modal */}
      {showConfirmModal && confirmationData && pendingPlan && (
        <PlanConfirmationModal
          visible={showConfirmModal}
          title={confirmationData.title}
          message={confirmationData.message}
          currentPlan={currentPlan?.planType || ""}
          newPlan={pendingPlan.planType}
          currentPrice={currentPlanLevel}
          newPrice={pendingPlan.price}
          daysRemaining={confirmationData.daysRemaining}
          onConfirm={handleConfirmPlan}
          onCancel={handleCancelConfirm}
        />
      )}
    </>
  );
};

export default PlanSubscription;
