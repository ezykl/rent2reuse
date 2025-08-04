// filepath: paypal-payment-app/src/types/api.ts

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface TransactionData {
  transactionId: string;
  paypalOrderId: string;
  planId: string;
  planType: string;
  amount: number;
  currency: "USD" | "PHP";
  phpAmount: string;
  status: "pending" | "completed" | "failed";
  paypalTransactionId?: string;
  timestamp: string;
  error?: string;
  planDetails: {
    duration: string;
    listLimit: number;
    rentLimit: number;
  };
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
}

export interface PaymentResponse {
  id: string;
  status: string;
  create_time: string;
  update_time: string;
  payer: {
    email: string;
    name: {
      given_name: string;
      surname: string;
    };
  };
}
