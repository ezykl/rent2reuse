type MessageType =
  | "message"
  | "rentRequest"
  | "statusUpdate"
  | "image"
  | "paymentRequest"
  | "payment";

export default interface Message {
  isDeleted?: boolean;
  deletedAt?: any;
  isEdited?: boolean;
  editedAt?: any;
  status?: string;
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  type?: MessageType;
  read: boolean;
  readAt: any;
  rentRequestId?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  rentRequestDetails?: {
    itemId: string;
    itemName: string;
    itemImage: string;
    totalPrice: number;
    startDate: any;
    endDate: any;
    rentalDays: number;
    ownerId: string;
    ownerName: string;
    requesterId: string;
    requesterName: string;
    pickupTime: number;
    message: string;
    status: string;
  };
  paymentType?: "initial" | "full";
  amount?: number;
  totalAmount?: number;
  downpaymentPercentage?: number;
  // Owner's payout destination, captured when the payment request is created
  // (see payment-options.tsx / chat/[id].tsx sendPaymentMessage).
  ownerPayPalEmail?: string;
  // The renter/payer's uid — who owes this payment.
  recipientId?: string;
  paypalOrderId?: string;
  transactionId?: string;
  paidAt?: any;
  // Server-set outcome of the platform's payout to the owner (see
  // paypalCaptureOrder in functions/src/index.ts). "failed" surfaces the
  // manual "Mark as Received" fallback in PaymentMessage.tsx.
  payoutStatus?: "success" | "failed";
  payoutBatchId?: string;
  payoutError?: string;
  // Manual fallback: the owner self-reports having received the money
  // outside of the automated payout (e.g. after a payout failure).
  confirmedByOwner?: boolean;
  confirmedAt?: any;
}
