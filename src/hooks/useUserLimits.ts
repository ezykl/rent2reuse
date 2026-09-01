import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface UserPlan {
  listLimit: number;
  listUsed: number;
  planId: string;
  planType: string;
  rentLimit: number;
  rentUsed: number;
  status: string;
  subscriptionId: string;
  updatedAt: Date;
}

export const useUserLimits = () => {
  const [listLimit, setListLimit] = useState(0);
  const [listUsed, setListUsed] = useState(0);
  const [rentLimit, setRentLimit] = useState(0);
  const [rentUsed, setRentUsed] = useState(0);
  const [canList, setCanList] = useState(false);
  const [planDetails, setPlanDetails] = useState<UserPlan | null>(null);

  const fetchUserLimits = async () => {
    if (!auth.currentUser) return null;

    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().currentPlan) {
        const planData = userDoc.data().currentPlan;
        setPlanDetails(planData);
        setListLimit(planData.listLimit);
        setListUsed(planData.listUsed);
        setRentLimit(planData.rentLimit);
        setRentUsed(planData.rentUsed);
        setCanList(planData.listUsed <= planData.listLimit);
        return planData;
      }
    } catch (error) {
      console.log("Error fetching user limits:", error);
    }
    return null;
  };

  const updateListUsage = async (change: number) => {
    if (!auth.currentUser || !planDetails) return false;

    try {
      const newListUsed = Math.max(0, planDetails.listUsed + change);
      const userRef = doc(db, "users", auth.currentUser.uid);

      await updateDoc(userRef, {
        "currentPlan.listUsed": newListUsed,
        "currentPlan.updatedAt": new Date(),
      });

      // Update local state
      setListUsed(newListUsed);
      setCanList(newListUsed < listLimit);
      return true;
    } catch (error) {
      console.log("Error updating list usage:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchUserLimits();
  }, []);

  return {
    canList,
    listUsed,
    listLimit,
    rentLimit,
    rentUsed,
    fetchUserLimits,
    updateListUsage,
    planDetails,
  };
};
