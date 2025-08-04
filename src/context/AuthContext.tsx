import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  updateSessionActivity,
  terminateCurrentSession,
} from "@/lib/firebaseConfig";
import { ALERT_TYPE, Dialog } from "react-native-alert-notification";

// Define your custom user data structure
interface ExtendedUser extends FirebaseUser {
  firstname?: string;
  middlename?: string;
  lastname?: string;
  role?: string;
  // add more custom fields here if needed
}

interface AuthContextType {
  user: ExtendedUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionCheckInterval, setSessionCheckInterval] =
    useState<NodeJS.Timeout | null>(null);

  // Function to handle user logout with session cleanup
  const logout = async () => {
    try {
      // Terminate the current session in Firestore
      await terminateCurrentSession();

      // Sign out the user from Firebase Auth
      await auth.signOut();

      // Clear any local storage data
      await AsyncStorage.removeItem("currentSessionId");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const firestoreData = docSnap.data();
            const extendedUser: ExtendedUser = {
              ...currentUser,
              ...firestoreData, // Merge custom fields
            };
            setUser(extendedUser);

            // Set up session activity update interval
            const sessionId = await AsyncStorage.getItem("currentSessionId");
            if (sessionId) {
              // Update session activity immediately
              updateSessionActivity(sessionId);

              // Set up interval to update session activity every 5 minutes
              if (sessionCheckInterval === null) {
                const interval = setInterval(async () => {
                  const currentSessionId = await AsyncStorage.getItem(
                    "currentSessionId"
                  );
                  if (currentSessionId) {
                    updateSessionActivity(currentSessionId);
                  }
                }, 5 * 60 * 1000); // 5 minutes

                setSessionCheckInterval(interval);
              }
            }
          } else {
            setUser(currentUser); // fallback to basic user if no profile data
          }
        } catch (error) {
          console.error("Failed to fetch Firestore user data:", error);
          setUser(currentUser); // fallback to auth-only
        }
      } else {
        setUser(null);

        // Clear session check interval when user is logged out
        if (sessionCheckInterval) {
          clearInterval(sessionCheckInterval);
          setSessionCheckInterval(null);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Clean up interval when component unmounts
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
      }
    };
  }, []);

  // Listen for session termination (e.g., when logged in on another device)
  useEffect(() => {
    let unsubscribeSessionListener = null;

    const setupSessionListener = async () => {
      if (!user) return;

      try {
        const sessionId = await AsyncStorage.getItem("currentSessionId");
        if (!sessionId) return;

        console.log(`Setting up real-time listener for session: ${sessionId}`);

        // Set up a real-time listener for the session document
        const sessionRef = doc(db, "userSessions", sessionId);
        unsubscribeSessionListener = onSnapshot(
          sessionRef,
          async (docSnapshot) => {
            if (!docSnapshot.exists()) {
              console.log("Session document doesn't exist anymore");
              await forceLogout("Your session was deleted");
              return;
            }

            const sessionData = docSnapshot.data();
            if (!sessionData.isActive) {
              console.log("Session was marked as inactive:", sessionData);

              // Only show specific message for forced termination
              let message = "Your session has ended.";
              if (sessionData.terminationReason === "forced_by_new_login") {
                message = "Your account has been logged in on another device.";
              }

              await forceLogout(message);
            }
          },
          (error) => {
            console.error("Error in session listener:", error);
          }
        );
      } catch (error) {
        console.error("Error setting up session listener:", error);
      }
    };

    const forceLogout = async (message) => {
      // First clear the listener to prevent multiple calls
      if (unsubscribeSessionListener) {
        unsubscribeSessionListener();
        unsubscribeSessionListener = null;
      }

      // Then perform logout
      await auth.signOut();
      await AsyncStorage.removeItem("currentSessionId");

      // Notify user
      // Alert.alert("Session Ended", message, [{ text: "OK" }]);

      Dialog.show({
        type: ALERT_TYPE.WARNING,
        title: "Session Expired",
        textBody:
          "Your session has expired or your account was logged in on another device.",
        autoClose: 3000,
      });
    };

    // Set up the listener when component mounts or user changes
    setupSessionListener();

    // Cleanup listener when component unmounts or user changes
    return () => {
      if (unsubscribeSessionListener) {
        unsubscribeSessionListener();
      }
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
