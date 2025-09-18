import { createPayment, updatePayment } from "@/lib/firebaseConfig";
import { getFirestore, doc, updateDoc, addDoc } from "firebase/firestore";

interface CreatePaymentOrderParams {
  amount: number;
  currency: string;
  userId: string;
  email?: string;
  month?: string;
  year?: number;
  propertyId?: string;
}

interface Payment {
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

const createPaymentOrder = async (
  params: CreatePaymentOrderParams
): Promise<string> => {
  const { amount, currency, userId, email, month, year, propertyId } = params;

  // Create a payment record in Firebase
  const paymentData: Omit<Payment, "id" | "createdAt" | "updatedAt"> = {
    amount,
    currency,
    payerId: userId,
    payerEmail: email,
    status: "pending",
    month,
    year,
    propertyId,
  };

  // Remove undefined fields
  Object.keys(paymentData).forEach((key) => {
    if (paymentData[key as keyof typeof paymentData] === undefined)
      delete paymentData[key as keyof typeof paymentData];
  });

  return await createPayment(paymentData);
};

const completePayment = async (
  paymentId: string,
  paypalPaymentId: string,
  status: "completed" | "cancelled" | "failed" = "completed"
) => {
  const db = getFirestore();
  const paymentRef = doc(db, "payments", paymentId);

  const updateData: any = {
    status,
    paypalPaymentId,
    updatedAt: new Date(),
  };

  // Remove undefined fields
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) delete updateData[key];
  });

  await updateDoc(paymentRef, updateData);
};

export default createPaymentOrder;
