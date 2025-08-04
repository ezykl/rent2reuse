import { Plan } from "./plan";

export interface PaymentTransaction {
  userId: string;
  subscriptionId: string;
  transactionId: string;
  planId: string;
  amount: number;
  currency: "PHP" | "USD";
  paymentMethod: "paypal";
  paypalOrderId?: string;
  paypalTransactionId?: string;
  status: "success" | "failed" | "pending";
  createAt: Date;
  planDetails: {
    planType: string;
    duration: string;
    listLimit: number;
    rentLimit: number;
  };
}

export interface PayPalPaymentProps {
  plan: Plan;
  clientId: string;
  clientSecret: string;
  onPaymentSuccess: (result: PayPalPaymentResult) => void;
  onPaymentError: (error: any) => void;
  onPaymentCancel: () => void;
}

export interface PayPalPaymentResult {
  id: string;
  customTransactionId: string;
  purchase_units: Array<{
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
      }>;
    };
  }>;
}
