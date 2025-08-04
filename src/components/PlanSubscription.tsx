import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image } from "react-native";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import { LinearGradient } from "expo-linear-gradient";

// First, modify the getGradientColors function to ensure it returns the correct type
type PlanType = "free" | "basic" | "premium" | "platinum" | "limited";

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

// Update the interfaces first
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

// Update the component props interface
interface PlanSubscriptionProps {
  currentPlan?: {
    planId?: string;
    planType: string;
    rentLimit: number;
    listLimit: number;
    rentUsed: number;
    listUsed: number;
    status?: string;
  };
  onSelectPlan: (plan: Plan) => void;
}

const PlanSubscription: React.FC<PlanSubscriptionProps> = ({
  currentPlan,
  onSelectPlan,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("PlanSubscription", currentPlan);
  }, [currentPlan]);

  // Move isActivePlan function outside of component or use useMemo
  const isActivePlan = useCallback(
    (planId: string) => {
      return (
        currentPlan?.planId === planId &&
        currentPlan?.status?.toLowerCase() === "active"
      );
    },
    [currentPlan]
  );

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const plansRef = collection(db, "plans");
        const planSnapshot = await getDocs(query(plansRef));
        const plansData = planSnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Plan)
        );

        // Sort plans
        const sortedPlans = plansData.sort((a, b) => {
          if (a.planType === "free") return -1;
          if (b.planType === "free") return 1;
          return a.price - b.price;
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
      const isActive = isActivePlan(plan.id);
      const gradientColors = getGradientColors(plan.planType);
      console.log("Rendering plan:", plan.id, "Active:", isActive);

      return (
        <TouchableOpacity
          key={plan.id}
          onPress={() => !isActive && onSelectPlan(plan)}
          disabled={isActive}
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
            {/* Current Plan Badge - Only show if this plan is active */}
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
                  className=" w-6 h-6 mr-2"
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

            {/* Action Button - Show different states based on isActive */}
            <View className="mt-auto">
              <TouchableOpacity
                className={`mt-4 py-3 rounded-xl ${
                  isActive ||
                  (plan.planType.toLowerCase() === "free" &&
                    currentPlan?.planType &&
                    currentPlan.planType.toLowerCase() !== "free")
                    ? "bg-white/40"
                    : "bg-white"
                }`}
                onPress={() => !isActive && onSelectPlan(plan)}
                disabled={
                  isActive ||
                  (plan.planType.toLowerCase() === "free" &&
                    currentPlan?.planType &&
                    currentPlan.planType.toLowerCase() !== "free")
                }
              >
                <Text
                  className={`text-center font-pbold ${
                    isActive ||
                    (plan.planType.toLowerCase() === "free" &&
                      currentPlan?.planType &&
                      currentPlan.planType.toLowerCase() !== "free")
                      ? "text-white/80"
                      : "text-gray-800"
                  }`}
                >
                  {isActive
                    ? "Current Plan"
                    : plan.planType.toLowerCase() === "free" &&
                      currentPlan?.planType &&
                      currentPlan.planType.toLowerCase() !== "free"
                    ? "Claimed Already"
                    : "Select Plan"}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [isActivePlan, onSelectPlan]
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
