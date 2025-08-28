export type NotificationType =
  | "WELCOME"
  | "RENT_REQUEST"
  | "RENT_ACCEPTED"
  | "RENT_REQUEST_CANCELLED"
  | "RENT_REQUEST_DECLINED"
  | "RENT_REQUEST_COMPLETED"
  | "RENT_REQUEST_ACCEPTED"
  | "MESSAGE_RECEIVED"
  | "PAYMENT_RECEIVED"
  | "ITEM_RETURNED"
  | "REVIEW_REMINDER"
  | "SUPPORT_TICKET"
  | "REPORT_ISSUE"
  | "REPORT_RESPONSE"
  | "SYSTEM_ALERT";

export interface FirestoreNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: any;
  description?: string;
  data?: {
    reportId?: string;
    reportReason?: string;
    itemId?: string;
    requestId?: string;
    messageId?: string;
    paymentId?: string;
    userId?: string;
    route?: string;
    params?: Record<string, any>;
  };
}
