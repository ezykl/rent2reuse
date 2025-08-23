import { db } from "@/lib/firebaseConfig";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { Platform } from "react-native";

interface NotificationPayload {
  title: string;
  message: string;
  data?: any;
}

export const sendRentRequestNotifications = async (
  ownerId: string,
  requestData: {
    itemId: string;
    itemName: string;
    requestId: string;
    requesterName: string;
    startDate: any;
    endDate: any;
  }
) => {
  try {
    // 1. Create in-app notification with retry mechanism
    const notificationData = {
      type: "RENT_REQUEST",
      title: "New Rental Request",
      message: `${requestData.requesterName} wants to rent your ${requestData.itemName}`,
      isRead: false,
      createdAt: serverTimestamp(),
      data: {
        itemId: requestData.itemId,
        requestId: requestData.requestId,
        route: "/tools",
        params: { tab: "incoming" },
        startDate: requestData.startDate,
        endDate: requestData.endDate,
      },
    };

    // Use a more robust approach to avoid duplicate document IDs
    let notificationCreated = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!notificationCreated && attempts < maxAttempts) {
      try {
        await addDoc(
          collection(db, `users/${ownerId}/notifications`),
          notificationData
        );
        notificationCreated = true;
      } catch (error: any) {
        attempts++;
        if (error.code === "already-exists" && attempts < maxAttempts) {
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
          continue;
        } else if (attempts >= maxAttempts) {
          // As a last resort, use setDoc with a custom ID
          const customId = `${
            requestData.requestId
          }_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(
            doc(db, `users/${ownerId}/notifications`, customId),
            notificationData
          );
          notificationCreated = true;
        } else {
          throw error;
        }
      }
    }

    // 2. Check if owner has push token
    const ownerDoc = await getDoc(doc(db, "users", ownerId));
    if (!ownerDoc.exists()) return;

    const ownerData = ownerDoc.data();
    const pushTokens = ownerData.pushTokens;

    if (pushTokens?.token) {
      // 3. Send push notification
      await sendPushNotification({
        to: pushTokens.token,
        title: "New Rental Request",
        body: `${requestData.requesterName} wants to rent your ${requestData.itemName}`,
        data: {
          type: "RENT_REQUEST",
          itemId: requestData.itemId,
          requestId: requestData.requestId,
          route: "/tools",
          params: { tab: "incoming" },
        },
      });
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
    // Don't throw the error to prevent breaking the rent request flow
  }
};

// Alternative approach using a unique document ID
export const sendRentRequestNotificationsV2 = async (
  ownerId: string,
  requestData: {
    itemId: string;
    itemName: string;
    requestId: string;
    requesterName: string;
    startDate: any;
    endDate: any;
  }
) => {
  try {
    // Create a unique document ID using request ID and timestamp
    const uniqueId = `${requestData.requestId}_${Date.now()}`;

    // 1. Create in-app notification with setDoc to ensure uniqueness
    await setDoc(doc(db, `users/${ownerId}/notifications`, uniqueId), {
      type: "RENT_REQUEST",
      title: "New Rental Request",
      message: `${requestData.requesterName} wants to rent your ${requestData.itemName}`,
      isRead: false,
      createdAt: serverTimestamp(),
      data: {
        itemId: requestData.itemId,
        requestId: requestData.requestId,
        route: "/tools",
        params: { tab: "incoming" },
        startDate: requestData.startDate,
        endDate: requestData.endDate,
      },
    });

    // 2. Check if owner has push token
    const ownerDoc = await getDoc(doc(db, "users", ownerId));
    if (!ownerDoc.exists()) return;

    const ownerData = ownerDoc.data();
    const pushTokens = ownerData.pushTokens;

    if (pushTokens?.token) {
      // 3. Send push notification
      await sendPushNotification({
        to: pushTokens.token,
        title: "New Rental Request",
        body: `${requestData.requesterName} wants to rent your ${requestData.itemName}`,
        data: {
          type: "RENT_REQUEST",
          itemId: requestData.itemId,
          requestId: requestData.requestId,
          route: "/tools",
          params: { tab: "incoming" },
        },
      });
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
};

// Helper function to send push notifications
export const sendPushNotification = async ({
  to,
  title,
  body,
  data,
}: {
  to: string;
  title: string;
  body: string;
  data?: any;
}) => {
  try {
    const message = {
      to,
      sound: "default",
      title,
      body,
      data,
      badge: 1,
      _displayInForeground: true,
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Push notification failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};
