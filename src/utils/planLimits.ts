import { db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

interface CurrentPlan {
  listLimit: number;
  listUsed: number;
  planId: string;
  planType: string;
  rentLimit: number;
  rentUsed: number;
  status: string;
  subscriptionId: string;
  updatedAt: string;
}

export const checkAndUpdateLimits = async (
  userId: string,
  action: "list" | "rent"
): Promise<{ success: boolean; message: string }> => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const userData = userSnap.data();
    const currentPlan = userData.currentPlan as CurrentPlan;

    // Debug log
    console.log("Current Plan Data:", currentPlan);

    // Check if plan exists and is active
    if (!currentPlan || currentPlan.status.toLocaleLowerCase() !== "active") {
      return {
        success: false,
        message: "Your subscription is not active. Please update your plan.",
      };
    }

    // Check limits based on action
    if (action === "list") {
      const remainingListings = currentPlan.listLimit - currentPlan.listUsed;

      if (remainingListings <= 0) {
        return {
          success: false,
          message: `You've reached your listing limit (${currentPlan.listLimit}). Current usage: ${currentPlan.listUsed}. Please upgrade your plan.`,
        };
      }

      // Update listing count
      await updateDoc(userRef, {
        "currentPlan.listUsed": increment(1),
      });
    }
    if (action === "rent") {
      const remainingRentals = currentPlan.rentLimit - currentPlan.rentUsed;

      if (remainingRentals <= 0) {
        return {
          success: false,
          message: `You've reached your rental limit (${currentPlan.rentLimit}). Current usage: ${currentPlan.rentUsed}. Please upgrade your plan.`,
        };
      }

      // Update rental count
      await updateDoc(userRef, {
        "currentPlan.rentUsed": increment(1),
      });
    }

    return { success: true, message: "Operation successful" };
  } catch (error) {
    console.error("Error checking limits:", error);
    return {
      success: false,
      message: "Failed to check usage limits. Please try again.",
    };
  }
};
