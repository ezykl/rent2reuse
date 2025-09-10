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
    daysDifference: number;
    requesterName: string;
    startDate: any;
    endDate: any;
    imageUrl?: string;
  }
) => {
  try {
    // 1. Create in-app notification with retry mechanism
    const notificationData = {
      type: "RENT_REQUEST",
      title: "New Rental Request",
      message: `${requestData.requesterName} wants to rent your ${requestData.itemName} for ${requestData.daysDifference} days on ${requestData.startDate} to ${requestData.endDate}.`,
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
        body: `${requestData.requesterName} wants to rent your ${requestData.itemName} for ${requestData.daysDifference} days on ${requestData.startDate} to ${requestData.endDate}.`,
        imageUrl: requestData.imageUrl,
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

export const createInAppNotification = async (
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
) => {
  try {
    const userNotificationsRef = collection(
      db,
      `users/${userId}/notifications`
    );
    await addDoc(userNotificationsRef, {
      ...notification,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    console.log(`📱 In-app notification created for user: ${userId}`);
  } catch (error) {
    console.error("Error creating in-app notification:", error);
  }
};

// Helper function to send push notifications
export const sendPushNotification = async ({
  to,
  title,
  body,
  data,
  imageUrl,
}: {
  to: string;
  title: string;
  body: string;
  data?: any;
  imageUrl?: string;
}) => {
  try {
    const message: any = {
      to,
      sound: "default",
      title,
      body,
      data,
      badge: 1,
      _displayInForeground: true,
    };

    if (imageUrl) {
      console.log("Testing image URL:", imageUrl);
      try {
        const imageResponse = await fetch(imageUrl, { method: "HEAD" });
        console.log("Image URL status:", imageResponse.status);
        console.log(
          "Image content-type:",
          imageResponse.headers.get("content-type")
        );
      } catch (error) {
        console.error("Image URL test failed:", error);
      }
    }

    if (imageUrl) {
      message.android = {
        notification: {
          imageUrl: imageUrl,
        },
      };
    }

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
      const responseText = await response.text();
      console.error("Push notification failed:", response.status, responseText);
      throw new Error(`Push notification failed: ${response.status}`);
    }

    console.log("Push notification sent successfully with image:", imageUrl);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
};
export const sendItemUnavailableNotifications = async (
  declinedUserIds: string[],
  itemData: {
    itemId: string;
    itemName: string;
    acceptedRequesterName: string;
  }
) => {
  const promises = declinedUserIds.map(async (userId) => {
    try {
      // 1. Create in-app notification
      const uniqueId = `ITEM_UNAVAILABLE_${
        itemData.itemId
      }_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await setDoc(doc(db, `users/${userId}/notifications`, uniqueId), {
        type: "ITEM_UNAVAILABLE",
        title: "Item No Longer Available",
        message: `Sorry, "${itemData.itemName}" is no longer available. It has been rented to another user.`,
        isRead: false,
        createdAt: serverTimestamp(),
        data: {
          itemId: itemData.itemId,
          reason: "rented_to_other_user",
          route: "/tools",
          params: { tab: "outgoing" },
        },
      });

      // 2. Get user data for push notification
      const userDoc = await getDoc(doc(db, "users", userId));
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      if (userData.pushTokens?.token) {
        // 3. Send push notification
        await sendPushNotification({
          to: userData.pushTokens.token,
          title: "Item No Longer Available",
          body: `"${itemData.itemName}" has been rented to another user.`,
          data: {
            type: "ITEM_UNAVAILABLE",
            itemId: itemData.itemId,
            reason: "rented_to_other_user",
            route: "/tools",
            params: { tab: "outgoing" },
          },
        });
      }

      console.log(`📱 Item unavailable notification sent to user: ${userId}`);
    } catch (error) {
      console.error(`Error sending notification to user ${userId}:`, error);
    }
  });

  // Send all notifications concurrently
  await Promise.allSettled(promises);
};

// Helper to send acceptance notification
export const sendRequestAcceptedNotification = async (
  acceptedUserId: string,
  requestData: {
    itemId: string;
    itemName: string;
    requestId: string;
    chatId: string;
    ownerName: string;
  }
) => {
  try {
    // 1. Create in-app notification
    const uniqueId = `REQUEST_ACCEPTED_${requestData.requestId}_${Date.now()}`;

    await setDoc(doc(db, `users/${acceptedUserId}/notifications`, uniqueId), {
      type: "RENT_REQUEST_ACCEPTED",
      title: "Request Accepted! 🎉",
      message: `Great news! ${requestData.ownerName} has accepted your rental request for "${requestData.itemName}".`,
      isRead: false,
      createdAt: serverTimestamp(),
      data: {
        itemId: requestData.itemId,
        requestId: requestData.requestId,
        chatId: requestData.chatId,
        route: "/chat",
        params: { id: requestData.chatId },
      },
    });

    // 2. Get user data for push notification
    const userDoc = await getDoc(doc(db, "users", acceptedUserId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    if (userData.pushTokens?.token) {
      // 3. Send push notification
      await sendPushNotification({
        to: userData.pushTokens.token,
        title: "Request Accepted! 🎉",
        body: `Your rental request for "${requestData.itemName}" has been accepted!`,
        data: {
          type: "RENT_REQUEST_ACCEPTED",
          itemId: requestData.itemId,
          requestId: requestData.requestId,
          chatId: requestData.chatId,
          route: "/chat",
          params: { id: requestData.chatId },
        },
      });
    }

    console.log(
      `📱 Request accepted notification sent to user: ${acceptedUserId}`
    );
  } catch (error) {
    console.error("Error sending acceptance notification:", error);
  }
};
