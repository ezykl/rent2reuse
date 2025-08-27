import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
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

// Define plan hierarchy for validation
const PLAN_HIERARCHY: Record<PlanType, number> = {
  free: 0,
  basic: 1,
  premium: 2,
  platinum: 3,
  limited: 4, // Special case - might have different rules
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
    hasUsedFreeTrial?: boolean; // Track if user already used free plan
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
}

const PlanSubscription: React.FC<PlanSubscriptionProps> = ({
  currentPlan,
  onSelectPlan,
  onUpgradePlan,
  onDowngradePlan,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Memoize current plan hierarchy level
  const currentPlanLevel = useMemo(() => {
    if (!currentPlan?.planType) return -1;
    return PLAN_HIERARCHY[currentPlan.planType.toLowerCase() as PlanType] ?? -1;
  }, [currentPlan?.planType]);

  // Validate plan selection
  const validatePlanSelection = useCallback(
    (plan: Plan): PlanValidation => {
      const planLevel = PLAN_HIERARCHY[plan.planType.toLowerCase() as PlanType];

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

      // Free plan special rules
      if (plan.planType.toLowerCase() === "free") {
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

      // Plan upgrade
      if (planLevel > currentPlanLevel) {
        return {
          isAllowed: true,
          action: "upgrade",
        };
      }

      // Plan downgrade
      if (planLevel < currentPlanLevel) {
        // Check if user has active items that exceed the new plan limits
        const exceedsLimits =
          currentPlan.rentUsed > plan.rent || currentPlan.listUsed > plan.list;

        return {
          isAllowed: true,
          action: "downgrade",
          requiresConfirmation: true,
          warningMessage: exceedsLimits
            ? `You currently have ${currentPlan.listUsed} listings and ${currentPlan.rentUsed} rentals. Downgrading to ${plan.planType} (${plan.list} listings, ${plan.rent} rentals) may affect your active items.`
            : `Are you sure you want to downgrade from ${currentPlan.planType} to ${plan.planType}?`,
        };
      }

      return {
        isAllowed: true,
        action: "select",
      };
    },
    [currentPlan, currentPlanLevel]
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

      // Handle confirmation for downgrades
      if (validation.requiresConfirmation && validation.warningMessage) {
        Alert.alert("Confirm Plan Change", validation.warningMessage, [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Continue",
            onPress: () => executePlanSelection(plan, validation.action),
          },
        ]);
        return;
      }

      executePlanSelection(plan, validation.action);
    },
    [validatePlanSelection]
  );

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
          return {
            text: `Upgrade - ₱${plan.price}`,
            disabled: false,
            style: "bg-green-500",
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
    [validatePlanSelection]
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

        // Sort plans by hierarchy
        const sortedPlans = plansData.sort((a, b) => {
          const aLevel =
            PLAN_HIERARCHY[a.planType.toLowerCase() as PlanType] ?? 999;
          const bLevel =
            PLAN_HIERARCHY[b.planType.toLowerCase() as PlanType] ?? 999;
          return aLevel - bLevel;
        });

        setPlans(sortedPlans);
      } catch (error) {
        console.error("Error fetching plans:", error);
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
                  {plan.planType.charAt(0).toUpperCase() +
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="py-4 h-auto"
    >
      {plans.map(renderPlanCard)}
    </ScrollView>
  );
};

export default PlanSubscription;
