import { AssessmentData } from "../components/chatModal/ConditionalAssessmentMessage";

type MessageType =
  | "message"
  | "rentRequest"
  | "statusUpdate"
  | "image"
  | "paymentRequest"
  | "ownerConfirmation"
  | "itemUnavailable"
  | "conditionalAssessment"
  | "rating"
  | "payment";

export default interface Message {
  rating(rating: any): import("react").ReactNode;

  assessmentType?: "pickup" | "return";
  assessment?: AssessmentData;
  
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
    startDate?: any;
    endDate?: any;
    rentalDays?: number;
    pickupTime?: number;
    itemLocation?: string | { address?: string };
    itemId?: string;
    itemName?: string;
    totalPrice?: number;
  };

  transactionId?: string;
  paidAt?: any;
  confirmedByOwner?: boolean;
  confirmedAt?: any;
  recipientPayPalEmail?: string;
  paypalOrderId?: string;
  paypalApprovalUrl?: string;
  paypalCaptureId?: string;
  paymentType?: "initial" | "full";
  amount?: number;
  totalAmount?: number;
  downpaymentPercentage?: number;
  paymentId?: string;
  paypalCheckoutUrl?: string;
  usdAmount?: string;
  confirmedAmount?: string;
  sentAt?: any;

  confirmationRequestId?: string;
  itemDetails?: {
    name?: string;
    price?: number;
    image?: string;
    downpaymentPercentage?: number;
    startDate?: any;
    endDate?: any;
    rentalDays?: number;
    pickupTime?: number;
  };

}
