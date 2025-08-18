import { db } from "@/lib/firebaseConfig";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
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
    // 1. Create in-app notification
    await addDoc(collection(db, `users/${ownerId}/notifications`), {
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

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};
