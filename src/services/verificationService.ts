import {
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { updateEmail } from "firebase/auth";

export const verifyEmailToken = async (token: string, userId: string) => {
  try {
    const tokensRef = collection(db, "verification-tokens");
    const q = query(
      tokensRef,
      where("token", "==", token),
      where("userId", "==", userId),
      where("used", "==", false)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("Invalid or expired verification token");
    }

    const tokenDoc = querySnapshot.docs[0];
    const tokenData = tokenDoc.data();

    const createdAt = tokenData.createdAt.toDate();
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      throw new Error("Verification token has expired");
    }

    await updateDoc(tokenDoc.ref, {
      used: true,
      usedAt: new Date(),
    });

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      emailVerified: true,
      verifiedAt: new Date(),
    });

    return { success: true, message: "Email verified successfully" };
  } catch (error: any) {
    console.error("Email verification error:", error);
    return { success: false, error: error.message };
  }
};

export const handleVerificationLink = async (url: string) => {
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get("token");
    const uid = urlObj.searchParams.get("uid");

    if (!token || !uid) {
      throw new Error("Invalid verification link");
    }

    return await verifyEmailToken(token, uid);
  } catch (error: any) {
    console.error("Handle verification link error:", error);
    return { success: false, error: error.message };
  }
};
