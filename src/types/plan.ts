export interface Plan {
  id: string;
  planType: string;
  price: number;
  duration: string;
  rent: number;
  list: number;
  color?: string;
  description?: string;
}

export interface Subscription {
  userId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
  status: "active" | "inactive";
  transactionId: string;
  rentLimit?: number;
  listLimit?: number;
  rentUsed?: number;
  listUsed?: number;
}
