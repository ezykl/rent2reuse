// context/NotificationProvider.js or providers/NotificationProvider.js

import { createContext, useContext, useState, ReactNode } from "react";
import { notificationMessages } from "@/lib/notifications";

// Define interfaces
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: "urgent" | "high" | "normal" | "low";
  isRead: boolean;
  actionRequired?: boolean;
  dateReceived: string;
  senderName?: string;
  itemName?: string;
  // Add other optional properties as needed
}

interface NotificationContextType {
  notifications: AppNotification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getNotificationsByType: (type: string) => AppNotification[];
  getUnreadCount: () => number;
  getUnreadCountByType: (type: string) => number;
  filterByPriority: (
    priority: "urgent" | "high" | "normal" | "low"
  ) => AppNotification[];
  getActionRequiredNotifications: () => AppNotification[];
  deleteNotification: (id: string) => void;
  addNotification: (notification: Partial<AppNotification>) => void;
  getSortedNotifications: (
    sortBy?: "date" | "priority" | "unread" | "type"
  ) => AppNotification[];
  getNotificationStats: () => {
    total: number;
    unread: number;
    actionRequired: number;
    urgent: number;
  };
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(
    notificationMessages as AppNotification[]
  );

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({ ...notification, isRead: true }))
    );
  };

  const getNotificationsByType = (type: string) => {
    return notifications.filter((notif) => notif.type === type);
  };

  const getUnreadCount = () => {
    return notifications.filter((notif) => !notif.isRead).length;
  };

  const getUnreadCountByType = (type: string) => {
    return notifications.filter((notif) => notif.type === type && !notif.isRead)
      .length;
  };

  const filterByPriority = (priority: string) => {
    return notifications.filter((notif) => notif.priority === priority);
  };

  const getActionRequiredNotifications = () => {
    return notifications.filter(
      (notif) => notif.actionRequired && !notif.isRead
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  const addNotification = (notification: Partial<AppNotification>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: Date.now().toString(),
      dateReceived: new Date().toISOString(),
      isRead: false,
      type: notification.type || "general",
      title: notification.title || "",
      message: notification.message || "",
      priority: notification.priority || "normal",
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const getSortedNotifications = (
    sortBy: "date" | "priority" | "unread" | "type" = "date"
  ) => {
    const sorted = [...notifications];

    switch (sortBy) {
      case "date":
        return sorted.sort(
          (a, b) =>
            new Date(b.dateReceived).getTime() -
            new Date(a.dateReceived).getTime()
        );
      case "priority":
        const priorityOrder: Record<string, number> = {
          urgent: 0,
          high: 1,
          normal: 2,
          low: 3,
        };
        return sorted.sort(
          (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
        );
      case "unread":
        return sorted.sort((a, b) =>
          a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1
        );
      case "type":
        return sorted.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return sorted;
    }
  };

  const getNotificationStats = () => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;
    const actionRequired = notifications.filter(
      (n) => n.actionRequired && !n.isRead
    ).length;
    const urgent = notifications.filter(
      (n) => n.priority === "urgent" && !n.isRead
    ).length;

    return { total, unread, actionRequired, urgent };
  };

  const value: NotificationContextType = {
    notifications,
    markAsRead,
    markAllAsRead,
    getNotificationsByType,
    getUnreadCount,
    getUnreadCountByType,
    filterByPriority,
    getActionRequiredNotifications,
    deleteNotification,
    addNotification,
    getSortedNotifications,
    getNotificationStats,
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
