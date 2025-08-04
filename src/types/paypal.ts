export interface PayPalTransaction {
  transactionId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  payerEmail?: string;
  payerId?: string;
  payerName?: string;
  timestamp: Date;
}

export interface PayPalResponse {
  status: "SUCCESS" | "CANCELLED" | "ERROR";
  orderID?: string;
  paymentID?: string;
  details?: any;
  error?: any;
}
