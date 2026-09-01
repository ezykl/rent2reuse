import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { router } from "expo-router";

export function useAccountStatus() {
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  useEffect(() => {
    let unsubscribeDoc = () => {};

    // First listen to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAccountStatus(null);
        return;
      }

      console.log("Auth state changed, user is logged in:", user.uid);

      // Once we have a user, listen to their account status
      unsubscribeDoc = onSnapshot(
        doc(db, "users", user.uid),
        (docSnapshot) => {
          const userData = docSnapshot.data();
          const status = userData?.accountStatus || "active";
          console.log(`Account status updated: ${status}`);

          setAccountStatus(status);

          // Handle suspended account
          if (status === "suspended" || status === "Suspended") {
            console.log("Account suspended, redirecting to suspended screen");

            // Redirect to suspended screen
            setTimeout(() => {
              router.replace("/(auth)/account-suspended");
            }, 500);
          }
        },
        (error) => {
          console.log("Error getting account status:", error);
        }
      );
    });

    // Return a cleanup function
    return () => {
      unsubscribeAuth();
      unsubscribeDoc();
    };
  }, []);

  return { accountStatus };
}
