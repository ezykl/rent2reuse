import { db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Platform } from "react-native";

export const manageUserToken = async (
  userId: string,
  expoPushToken: string | undefined
) => {
  try {
    if (!userId || !expoPushToken) {
      console.log("Missing userId or token");
      return;
    }

    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.log("User document not found");
      return;
    }

    // Update with single token object
    await updateDoc(userDocRef, {
      pushTokens: {
        token: expoPushToken,
        lastUpdate: new Date(),
        platform: Platform.OS,
      },
    });

    console.log("Push token registered successfully");
  } catch (error) {
    console.error("Error managing push token:", error);
  }
};

export const removeUserToken = async (
  userId: string,
  expoPushToken: string | undefined
) => {
  try {
    if (!userId || !expoPushToken) return;

    const userDocRef = doc(db, "users", userId);

    // Remove entire pushTokens object
    await updateDoc(userDocRef, {
      pushTokens: null,
    });

    console.log("Push token removed successfully");
  } catch (error) {
    console.error("Error removing push token:", error);
  }
};
