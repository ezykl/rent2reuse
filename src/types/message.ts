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


  paymentId?: string;           // ADD this
  paypalCheckoutUrl?: string;   // ADD this  
  usdAmount?: string;           // ADD this

  confirmedAmount?: string;     // ADD this

  sentAt?: any;



}
