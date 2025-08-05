export type NotificationType =
  | "WELCOME"
  | "RENT_REQUEST"
  | "RENT_ACCEPTED"
  | "RENT_REJECTED"
  | "MESSAGE_RECEIVED"
  | "PAYMENT_RECEIVED"
  | "ITEM_RETURNED"
  | "REVIEW_REMINDER"
  | "SYSTEM_ALERT";

export interface FirestoreNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any; // Firestore Timestamp
  data?: {
    itemId?: string;
    requestId?: string;
    messageId?: string;
    paymentId?: string;
    userId?: string;
    route?: string;
    params?: Record<string, any>;
  };
}
