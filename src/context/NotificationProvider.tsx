// context/NotificationProvider.js or providers/NotificationProvider.js

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";
import { useAuth } from "@/context/AuthContext";

import { FirestoreNotification } from "@/types/notification";
import {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification as deleteNotificationFromServer, // Update this import
} from "@/lib/notifications";

interface NotificationContextType {
  notifications: FirestoreNotification[];
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  getUnreadCount: () => number;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  // Change this to use useAuth hook
  const { user } = useAuth(); // Add this import at the top
  const [notifications, setNotifications] = useState<FirestoreNotification[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to notifications
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Update the reference path to match your Firestore structure
    const userNotificationsRef = collection(
      db,
      "users",
      user.uid,
      "notifications"
    );
    const q = query(userNotificationsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FirestoreNotification[];

      setNotifications(notificationData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = async (id: string) => {
    try {
      if (!user?.uid) return;
      await markNotificationAsRead(user.uid, id);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === id ? { ...notif, isRead: true } : notif
        )
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!user?.uid) return;
      const unreadNotifications = notifications.filter((n) => !n.isRead);
      await Promise.all(
        unreadNotifications.map((n) => markNotificationAsRead(user.uid, n.id))
      );

      setNotifications((prev) =>
        prev.map((notification) => ({ ...notification, isRead: true }))
      );
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteAllNotifications = async () => {
    try {
      if (!user?.uid) return;
      const unreadNotifications = notifications.filter((n) => n.isRead);
      await Promise.all(
        unreadNotifications.map((n) => deleteNotification(n.id))
      );

      setNotifications((prev) =>
        prev.filter((notification) => notification.isRead)
      );
    } catch (error) {
      console.error("Error deleting all notifications:", error);
    }
  };

  // Update other functions to use proper user reference
  const deleteNotification = async (notificationId: string) => {
    try {
      if (!user?.uid) return;

      // Delete from Firestore
      const notificationRef = doc(
        db,
        `users/${user.uid}/notifications/${notificationId}`
      );
      await deleteDoc(notificationRef);

      // Update local state
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== notificationId)
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getUnreadCount = () => {
    return notifications.filter((notif) => !notif.isRead).length;
  };

  const value: NotificationContextType = {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};
