import { db } from "@/lib/firebaseConfig";
import {
  doc,
  addDoc,
  updateDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import type { Plan } from "@/types";

export const handleSubscriptionPayment = async (
  paypalResult: any,
  selectedPlan: Plan,
  userId: string
) => {
  const subscriptionRef = await addDoc(collection(db, "subscription"), {
    userId,
    planId: selectedPlan.id,
    planType: selectedPlan.planType,
    startDate: new Date(),
    endDate: new Date(Date.now() + getDurationInMs(selectedPlan.duration)),
    status: "active",
    transactionId: paypalResult.customTransactionId,
    createdAt: serverTimestamp(),
  });

  // Create transaction record
  await addDoc(collection(db, "transactions"), {
    userId,
    subscriptionId: subscriptionRef.id,
    transactionId: paypalResult.customTransactionId,
    planId: selectedPlan.id,
    amount: selectedPlan.price,
    currency: "PHP",
    paymentMethod: "paypal",
    paypalOrderId: paypalResult.id,
    status: "success",
    createdAt: serverTimestamp(),
    planDetails: {
      planType: selectedPlan.planType,
      duration: selectedPlan.duration,
      listLimit: selectedPlan.list,
      rentLimit: selectedPlan.rent,
    },
  });

  // Update user's current plan
  await updateDoc(doc(db, "users", userId), {
    currentPlan: {
      planId: selectedPlan.id,
      planType: selectedPlan.planType,
      rentLimit: selectedPlan.rent,
      listLimit: selectedPlan.list,
      rentUsed: 0,
      listUsed: 0,
      status: "active",
      subscriptionId: subscriptionRef.id,
      updatedAt: serverTimestamp(),
    },
  });
};

const getDurationInMs = (duration: string): number => {
  const DURATION_MAP = {
    monthly: 30 * 24 * 60 * 60 * 1000,
    quarterly: 90 * 24 * 60 * 60 * 1000,
    "semi-annual": 180 * 24 * 60 * 60 * 1000,
    annual: 365 * 24 * 60 * 60 * 1000,
  };

  return DURATION_MAP[duration as keyof typeof DURATION_MAP] || 0;
};
