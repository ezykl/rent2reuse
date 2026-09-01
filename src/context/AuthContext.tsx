import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  updateSessionActivity,
  terminateCurrentSession,
} from "@/lib/firebaseConfig";
import { ALERT_TYPE, Dialog } from "react-native-alert-notification";
import { removeUserToken } from "@/utils/tokenManagement";
import { usePushNotifications } from "@/utils/userPushNotifications";

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
  setSignupMode: (inSignup: boolean) => void;
  // Called right after a session doc is created (see createUserSession call
  // sites in sign-in.tsx) so the "kicked out by another device" listener
  // below attaches deterministically instead of racing a reactive
  // AsyncStorage read against the user-state update (see setupSessionListener).
  attachSessionListener: (sessionId: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  setSignupMode: () => {},
  attachSessionListener: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<ExtendedUser | null>(null);
  const [loading, setLoading] = useState(true);
  // useRef, not useState: read inside a setInterval callback created by an
  // effect that doesn't (and shouldn't need to) depend on this value —
  // useState would risk the callback closing over a stale value across
  // repeated auth-state transitions without a full app remount.
  const sessionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const { expoPushToken } = usePushNotifications();
  const [isSigningUp, setIsSigningUp] = useState(false);
  // Set explicitly by attachSessionListener right after a session is
  // created, rather than inferred reactively from AsyncStorage — see the
  // session-listener effect below for why.
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const setSignupMode = (inSignup: boolean) => {
    setIsSigningUp(inSignup);
  };

  const attachSessionListener = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

  // Function to handle user logout with session cleanup
  const logout = async () => {
    try {
      // Terminate the current session in Firestore
      await terminateCurrentSession();

      // Sign out the user from Firebase Auth
      await auth.signOut();

      // Clear any local storage data
      await AsyncStorage.removeItem("currentSessionId");
      setActiveSessionId(null);

      // Remove user token from the server
      const currentUser = auth.currentUser;
      if (currentUser && expoPushToken?.data) {
        await removeUserToken(currentUser.uid, expoPushToken.data);
      }
    } catch (error) {
      console.log("Error during logout:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (isSigningUp && currentUser) {
        console.log("Skipping user set during signup");
        return;
      }

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
              if (sessionCheckInterval.current === null) {
                const interval = setInterval(
                  async () => {
                    const currentSessionId =
                      await AsyncStorage.getItem("currentSessionId");
                    if (currentSessionId) {
                      updateSessionActivity(currentSessionId);
                    }
                  },
                  5 * 60 * 1000
                ); // 5 minutes

                sessionCheckInterval.current = interval;
              }
            }
          } else {
            setUser(null); // fallback to basic user if no profile data
          }
        } catch (error) {
          console.log("Failed to fetch Firestore user data:", error);
          setUser(currentUser); // fallback to auth-only
        }
      } else {
        setUser(null);

        // Clear session check interval when user is logged out
        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
          sessionCheckInterval.current = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Clean up interval when component unmounts
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
        sessionCheckInterval.current = null;
      }
    };
  }, [isSigningUp]);

  // Listen for session termination (e.g., when logged in on another device).
  // Keyed on [user, activeSessionId] rather than just [user]: activeSessionId
  // is set explicitly by attachSessionListener right after a session doc is
  // created (see sign-in.tsx), so this effect doesn't have to guess whether
  // AsyncStorage has been written yet by the time `user` updates — it just
  // falls back to AsyncStorage for the app-restart-while-still-logged-in
  // case, where nothing just called attachSessionListener.
  useEffect(() => {
    let unsubscribeSessionListener: any = null;

    const setupSessionListener = async () => {
      if (!user) return;

      try {
        const sessionId =
          activeSessionId ?? (await AsyncStorage.getItem("currentSessionId"));
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
            console.log("Error in session listener:", error);
          }
        );
      } catch (error) {
        console.log("Error setting up session listener:", error);
      }
    };

    const forceLogout = async (message: string) => {
      // First clear the listener to prevent multiple calls
      if (unsubscribeSessionListener) {
        unsubscribeSessionListener();
        unsubscribeSessionListener = null;
      }

      // Then perform logout
      await auth.signOut();
      await AsyncStorage.removeItem("currentSessionId");
      setActiveSessionId(null);

      Dialog.show({
        type: ALERT_TYPE.WARNING,
        title: "Session Expired",
        textBody: message,
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
  }, [user, activeSessionId]);

  return (
    <AuthContext.Provider
      value={{ user, loading, logout, setSignupMode, attachSessionListener }}
    >
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
