import { db } from "./firebaseConfig";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { FirestoreNotification, NotificationType } from "@/types/notification";

export const createNotification = async (
  userId: string,
  type: NotificationType,
  data?: FirestoreNotification["data"]
) => {
  try {
    // Create a reference to the user's notifications subcollection
    const userNotificationsRef = collection(
      db,
      `users/${userId}/notifications`
    );

    const notificationData = generateNotificationContent(type, data);

    await addDoc(userNotificationsRef, {
      type,
      ...notificationData,
      isRead: false,
      createdAt: serverTimestamp(),
      data,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Helper function to generate notification content based on type
const generateNotificationContent = (
  type: NotificationType,
  data?: FirestoreNotification["data"]
): Pick<FirestoreNotification, "title" | "message"> => {
  switch (type) {
    case "WELCOME":
      return {
        title: "Welcome to Rent2Reuse!",
        message: "Start exploring items to rent or list your own items.",
      };

    case "RENT_REQUEST":
      return {
        title: "New Rental Request",
        message: `Someone wants to rent your item. Check the details now.`,
      };

    case "RENT_ACCEPTED":
      return {
        title: "Rental Request Accepted",
        message: "Your rental request has been accepted. Proceed with payment.",
      };

    case "MESSAGE_RECEIVED":
      return {
        title: "New Message",
        message: `You have a new message regarding your rental.`,
      };

    // Add more cases as needed
    default:
      return {
        title: "Notification",
        message: "You have a new notification",
      };
  }
};

// Get user notifications
export const getUserNotifications = async (userId: string) => {
  try {
    // Query the user's notifications subcollection
    const userNotificationsRef = collection(
      db,
      `users/${userId}/notifications`
    );
    const q = query(userNotificationsRef, orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as FirestoreNotification)
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
};

// Mark notification as read
export const markNotificationAsRead = async (
  userId: string,
  notificationId: string
) => {
  try {
    const notificationRef = doc(
      db,
      `users/${userId}/notifications/${notificationId}`
    );
    await updateDoc(notificationRef, {
      isRead: true,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

export const deleteNotification = async (
  userId: string,
  notificationId: string
) => {
  try {
    const notificationRef = doc(
      db,
      `users/${userId}/notifications/${notificationId}`
    );
    await deleteDoc(notificationRef);
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
};

export const createRentRequestNotification = async (
  ownerId: string,
  itemId: string,
  requestId: string,
  itemName: string
) => {
  try {
    const userNotificationsRef = collection(
      db,
      `users/${ownerId}/notifications`
    );

    await addDoc(userNotificationsRef, {
      type: "RENT_REQUEST",
      title: "New Rental Request",
      message: `You have a new request for ${itemName}`,
      isRead: false,
      createdAt: serverTimestamp(),
      data: {
        itemId,
        requestId,
        route: "/requests",
        params: { id: itemId },
        status: "unread", // Track request notification status
      },
    });
  } catch (error) {
    console.error("Error creating rent request notification:", error);
    throw error;
  }
};

// Add a function to count new requests for an item
export const getNewRequestsCount = async (userId: string, itemId: string) => {
  try {
    const userNotificationsRef = collection(
      db,
      `users/${userId}/notifications`
    );
    const q = query(
      userNotificationsRef,
      where("type", "==", "RENT_REQUEST"),
      where("data.itemId", "==", itemId),
      where("isRead", "==", false)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error counting new requests:", error);
    return 0;
  }
};
