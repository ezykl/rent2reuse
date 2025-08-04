import { useEffect } from "react";
import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";

export const useUserStatus = () => {
  useEffect(() => {
    if (!auth.currentUser) return;

    const userStatusRef = doc(db, "userStatus", auth.currentUser.uid);

    const updateStatus = async (isOnline: boolean) => {
      await updateDoc(userStatusRef, {
        isOnline,
        lastSeen: serverTimestamp(),
      });
    };

    // Update status when component mounts
    updateStatus(true);

    // Set up listener for app state changes
    const unsubscribe = () => {
      updateStatus(false);
    };

    return () => unsubscribe();
  }, []);
};
