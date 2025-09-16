type MessageType =
  | "message"
  | "rentRequest"
  | "statusUpdate"
  | "image"
  | "paymentRequest";

export interface Message {
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
}
