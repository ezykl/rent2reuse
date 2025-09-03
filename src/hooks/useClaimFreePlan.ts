import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

const useClaimFreePlan = () => {
  const [canClaimFreePlan, setCanClaimFreePlan] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  useEffect(() => {
    const checkCanClaimFreePlan = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const isProfileComplete =
          userData.emailVerified &&
          userData.location &&
          userData.contactNumber &&
          userData.birthday &&
          userData.profileImage &&
          userData.idVerified;

        // Check if the user has a plan already
        const hasPlan = !!userData.currentPlan;

        setCanClaimFreePlan(isProfileComplete && !hasPlan);
      }
    };

    checkCanClaimFreePlan();
  }, []);

  const claimFreePlan = async () => {
    setIsClaiming(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Define the free plan details
      const freePlanDetails = {
        planType: "Free",
        rentLimit: 5,
        listLimit: 10,
      };

      // Grant the free plan by creating a plan document
      await setDoc(doc(db, "plans", user.uid), freePlanDetails);

      // Update currentPlan in the user document
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        currentPlan: freePlanDetails,
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Free plan claimed successfully!",
      });

      // Update canClaimFreePlan state
      setCanClaimFreePlan(false);
    } catch (error) {
      console.error("Error claiming free plan:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to claim free plan. Please try again.",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  return { canClaimFreePlan, claimFreePlan, isClaiming };
};

export default useClaimFreePlan;
