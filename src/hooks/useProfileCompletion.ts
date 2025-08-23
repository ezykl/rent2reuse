import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebaseConfig";
import { getDoc, doc, onSnapshot } from "firebase/firestore";

export interface ProfileCompletionStatus {
  isComplete: boolean;
  completionPercentage: number;
  missingFields: {
    field:
      | "emailVerification"
      | "location"
      | "contact"
      | "profileImage"
      | "birthday"
      | "idVerification";
    label: string;
    description: string;
  }[];
  details: {
    isEmailVerified: boolean;
    hasLocation: boolean;
    hasContact: boolean;
    hasProfileImage: boolean;
    hasBirthday: boolean;
    hasIdVerification: boolean;
  };
}

const useProfileCompletion = () => {
  const [status, setStatus] = useState<ProfileCompletionStatus>({
    isComplete: false,
    completionPercentage: 0,
    missingFields: [],
    details: {
      isEmailVerified: false,
      hasLocation: false,
      hasContact: false,
      hasProfileImage: false,
      hasBirthday: false,
      hasIdVerification: false,
    },
  });

  // Function to check and update profile completion status
  const checkProfileCompletion = async (userData: any) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // IMPORTANT: Reload user to get latest emailVerified status
      await user.reload();

      // Now get the updated user
      const updatedUser = auth.currentUser;

      const details = {
        isEmailVerified: updatedUser?.emailVerified || false, // ← Now using fresh data
        hasLocation: !!(
          userData.location?.latitude &&
          userData.location?.longitude &&
          userData.location?.address
        ),
        hasContact: !!userData.contactNumber,
        hasProfileImage: !!userData.profileImage,
        hasBirthday: !!userData.birthday,
        hasIdVerification: !!userData.idVerified,
      };

      const missingFields: ProfileCompletionStatus["missingFields"] = [];

      if (!details.isEmailVerified) {
        missingFields.push({
          field: "emailVerification",
          label: "Verify Email",
          description: "Verify your email address to secure your account",
        });
      }
      if (!details.hasLocation) {
        missingFields.push({
          field: "location",
          label: "Add Location",
          description: "Add your location to find items near you",
        });
      }
      if (!details.hasContact) {
        missingFields.push({
          field: "contact",
          label: "Add Contact",
          description: "Add your contact number for easier communication",
        });
      }
      if (!details.hasProfileImage) {
        missingFields.push({
          field: "profileImage",
          label: "Add Profile Picture",
          description: "Add a profile picture to build trust",
        });
      }
      if (!details.hasBirthday) {
        missingFields.push({
          field: "birthday",
          label: "Add Birthday",
          description: "Add your birthday for account verification",
        });
      }
      if (!details.hasIdVerification) {
        missingFields.push({
          field: "idVerification",
          label: "Verify ID",
          description: "Upload a valid ID for account verification",
        });
      }

      const completedFields = Object.values(details).filter(Boolean).length;
      const totalFields = Object.keys(details).length;
      const completionPercentage = Math.round(
        (completedFields / totalFields) * 100
      );

      setStatus({
        isComplete: missingFields.length === 0,
        completionPercentage,
        missingFields,
        details,
      });
    } catch (error) {
      console.error("Error checking profile completion:", error);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsub = onSnapshot(doc(db, "users", user.uid), (userDoc) => {
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      checkProfileCompletion(userData);
    });

    return () => unsub();
  }, []);

  // Manual refresh function that can be called from components
  const refreshStatus = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        await checkProfileCompletion(userDoc.data());
      }
    } catch (error) {
      console.error("Error refreshing profile status:", error);
    }
  };

  return {
    ...status,
    refreshStatus,
  };
};

export default useProfileCompletion;
