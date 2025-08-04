export interface Payment {
  id?: string;
  amount: number;
  currency: string;
  payerId: string;
  payerEmail?: string;
  paymentId?: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  createdAt: number;
  updatedAt: number;
  month?: string;
  year?: number;
  propertyId?: string;
}
