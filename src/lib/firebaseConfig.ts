import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  where,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Payment } from "../models/payment";

import { Platform } from "react-native";
import { writeBatch } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_DATABASE_URL,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
} from "@env";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  databaseURL: FIREBASE_DATABASE_URL,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase if it hasn't been initialized
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase services
const db = getFirestore(app);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
const storage = getStorage(app);

const paymentsCollection = collection(db, "payments");

// Create a new payment record in Firestore
export const createPayment = async (
  paymentData: Omit<Payment, "id" | "createdAt" | "updatedAt">
): Promise<string> => {
  try {
    const timestamp = Date.now();
    const payment: Omit<Payment, "id"> = {
      ...paymentData,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await addDoc(paymentsCollection, payment);
    return docRef.id;
  } catch (error) {
    console.log("Error creating payment:", error);
    throw error;
  }
};

// Update an existing payment record
export const updatePayment = async (
  paymentId: string,
  updates: Partial<Payment>
): Promise<void> => {
  try {
    const paymentRef = doc(db, "payments", paymentId);

    await updateDoc(paymentRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.log("Error updating payment:", error);
    throw error;
  }
};

// Get payment history for a user
export const getPaymentHistory = async (userId: string): Promise<Payment[]> => {
  try {
    const q = query(
      paymentsCollection,
      where("payerId", "==", userId),
      orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Payment)
    );
  } catch (error) {
    console.log("Error getting payment history:", error);
    throw error;
  }
};

// Get a specific payment by ID
export const getPaymentById = async (
  paymentId: string
): Promise<Payment | null> => {
  try {
    const paymentRef = doc(db, "payments", paymentId);
    const paymentDoc = await getDoc(paymentRef);

    if (paymentDoc.exists()) {
      return {
        id: paymentDoc.id,
        ...paymentDoc.data(),
      } as Payment;
    }

    return null;
  } catch (error) {
    console.log("Error getting payment:", error);
    throw error;
  }
};

// ---------------

// Session management
const userSessionsCollection = collection(db, "userSessions");

export const createUserSession = async (userId: String) => {
  try {
    // Generate a unique session ID
    const sessionId = `${userId}_${Date.now()}`;
    const deviceInfo = {
      platform: Platform.OS,
      deviceName: Platform.OS === "ios" ? "iOS Device" : "Android Device",
      // You can add more device info if needed
    };

    // Create a session document
    const sessionRef = doc(db, "userSessions", sessionId);
    await setDoc(sessionRef, {
      userId,
      sessionId,
      deviceInfo,
      lastActive: Date.now(),
      createdAt: Date.now(),
      isActive: true,
    });

    // Store the session ID locally
    await AsyncStorage.setItem("currentSessionId", sessionId);

    return { sessionId, error: null };
  } catch (error: any) {
    console.log("Error creating session:", error);
    return { sessionId: null, error: error.message };
  }
};

export const checkActiveSession = async (userId: String) => {
  try {
    const q = query(
      userSessionsCollection,
      where("userId", "==", userId),
      where("isActive", "==", true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { hasActiveSession: false, sessions: [] };
    }

    const sessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      hasActiveSession: true,
      sessions,
      currentSession: sessions[0], // Return the first active session
    };
  } catch (error: any) {
    console.log("Error checking active session:", error);
    return { hasActiveSession: false, sessions: [], error: error.message };
  }
};

// Function to forcefully terminate sessions and notify clients
export const forceTerminateSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, "userSessions", sessionId);

    // First, get the current session data
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists() || !sessionDoc.data().isActive) {
      return { success: false, error: "Session not found or already inactive" };
    }

    // Update the session as terminated
    await updateDoc(sessionRef, {
      isActive: false,
      terminatedAt: Date.now(),
      terminationReason: "forced_by_new_login",
    });

    return { success: true };
  } catch (error: any) {
    console.log("Error force terminating session:", error);
    return { success: false, error: error.message };
  }
};

export const terminateUserSessions = async (
  userId: String,
  exceptSessionId = null
) => {
  try {
    const q = query(
      userSessionsCollection,
      where("userId", "==", userId),
      where("isActive", "==", true)
    );

    const snapshot = await getDocs(q);

    // Process each session individually instead of using batch
    // This ensures we can perform additional actions for each session
    for (const docSnapshot of snapshot.docs) {
      const sessionId = docSnapshot.id;
      // If exceptSessionId is provided, don't terminate that specific session
      if (!exceptSessionId || sessionId !== exceptSessionId) {
        await forceTerminateSession(sessionId);

        console.log(`✅ Successfully terminated session: ${sessionId}`);
      }
    }

    return {
      success: true,
      error: null,
      terminatedCount: snapshot.docs.length,
    };
  } catch (error: any) {
    console.log("Error terminating sessions:", error);
    return { success: false, error: error.message };
  }
};

export const updateSessionActivity = async (sessionId: string) => {
  if (!sessionId) return;

  try {
    const sessionRef = doc(db, "userSessions", sessionId);
    await updateDoc(sessionRef, {
      lastActive: Date.now(),
    });
  } catch (error) {
    console.log("Error updating session activity:", error);
  }
};

export const terminateCurrentSession = async () => {
  try {
    const sessionId = await AsyncStorage.getItem("currentSessionId");
    if (sessionId) {
      const sessionRef = doc(db, "userSessions", sessionId);
      await updateDoc(sessionRef, {
        isActive: false,
        terminatedAt: Date.now(),
      });
      await AsyncStorage.removeItem("currentSessionId");
    }
    return { success: true, error: null };
  } catch (error: any) {
    console.log("Error terminating current session:", error);
    return { success: false, error: error.message };
  }
};

interface Item {
  id: string;
  title: string;
  category: string;
  description: string;
  condition: "New" | "Like New" | "Good" | "Fair";
  brand: string;
  model: string;
  pricePerDay: number;
  deposit: number;
  minRentalDays: number;
  availableFrom: Timestamp;
  location: string;
  specifications: string[];
  images: string[];
  createdAt: Timestamp;
  userId: string;
  status: "Available" | "Rented" | "Reserved";
  rentalHistory: {
    renterId: string;
    startDate: Timestamp;
    endDate: Timestamp;
    price: number;
  }[];
}

export { db, auth, storage };
