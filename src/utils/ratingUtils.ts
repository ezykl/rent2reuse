import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

export interface UserRating {
  averageRating?: number;
  totalRatings?: number;
  ratingCount?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface Rating {
  id?: string;
  ratedUserId: string;
  raterUserId: string;
  rating: number;
  review?: string;
  itemId?: string;
  transactionType?: "rental" | "general";
  timestamp: any;
}

/**
 * Fetch user's rating data
 */
export const fetchUserRating = async (
  userId: string
): Promise<UserRating | null> => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        averageRating: userData.averageRating,
        totalRatings: userData.totalRatings || 0,
        ratingCount: userData.ratingCount || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user rating:", error);
    return null;
  }
};

/**
 * Check if user has already rated another user
 */
export const hasUserRated = async (
  raterUserId: string,
  ratedUserId: string
): Promise<boolean> => {
  try {
    const ratingsQuery = query(
      collection(db, "ratings"),
      where("raterUserId", "==", raterUserId),
      where("ratedUserId", "==", ratedUserId)
    );

    const ratingsSnap = await getDocs(ratingsQuery);
    return !ratingsSnap.empty;
  } catch (error) {
    console.error("Error checking if user has rated:", error);
    return false;
  }
};

/**
 * Add or update a rating (uses transaction for data consistency)
 */
export const addOrUpdateRating = async (
  raterUserId: string,
  ratedUserId: string,
  rating: number,
  review?: string,
  itemId?: string,
  transactionType: "rental" | "general" = "general"
): Promise<{ success: boolean; message: string }> => {
  try {
    // Validate rating
    if (rating < 1 || rating > 5) {
      return { success: false, message: "Rating must be between 1 and 5" };
    }

    // Prevent self-rating
    if (raterUserId === ratedUserId) {
      return { success: false, message: "You cannot rate yourself" };
    }

    const result = await runTransaction(db, async (transaction) => {
      // Check if rating already exists
      const existingRatingQuery = query(
        collection(db, "ratings"),
        where("raterUserId", "==", raterUserId),
        where("ratedUserId", "==", ratedUserId)
      );

      const existingRatingsSnap = await getDocs(existingRatingQuery);
      const userDocRef = doc(db, "users", ratedUserId);
      const userDoc = await transaction.get(userDocRef);

      let isUpdate = false;
      let oldRating = 0;

      if (!existingRatingsSnap.empty) {
        // Update existing rating
        isUpdate = true;
        const existingRatingDoc = existingRatingsSnap.docs[0];
        oldRating = existingRatingDoc.data().rating;

        transaction.update(existingRatingDoc.ref, {
          rating,
          review: review || "",
          timestamp: serverTimestamp(),
          itemId,
          transactionType,
        });
      } else {
        // Add new rating
        const newRatingRef = doc(collection(db, "ratings"));
        transaction.set(newRatingRef, {
          ratedUserId,
          raterUserId,
          rating,
          review: review || "",
          itemId,
          transactionType,
          timestamp: serverTimestamp(),
        });
      }

      // Update user's aggregated rating data
      const userData = userDoc.exists() ? userDoc.data() : {};
      const currentAverage = userData.averageRating || 0;
      const currentTotal = userData.totalRatings || 0;
      const currentRatingCount = userData.ratingCount || {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      let newTotal = currentTotal;
      let newRatingCount = { ...currentRatingCount };

      if (isUpdate) {
        // Remove old rating and add new rating
        newRatingCount[oldRating as keyof typeof newRatingCount]--;
        newRatingCount[rating as keyof typeof newRatingCount]++;
      } else {
        // Add new rating
        newTotal++;
        newRatingCount[rating as keyof typeof newRatingCount]++;
      }

      // Calculate new average
      const totalStars = Object.entries(newRatingCount).reduce(
        (sum, [stars, count]) => sum + parseInt(stars) * (count as number),
        0
      );
      const newAverage = newTotal > 0 ? totalStars / newTotal : 0;

      // Update user document
      transaction.set(
        userDocRef,
        {
          ...userData,
          averageRating: newAverage,
          totalRatings: newTotal,
          ratingCount: newRatingCount,
        },
        { merge: true }
      );

      return {
        success: true,
        message: isUpdate
          ? "Rating updated successfully"
          : "Rating added successfully",
      };
    });

    return result;
  } catch (error) {
    console.error("Error adding/updating rating:", error);
    return { success: false, message: "Failed to save rating" };
  }
};

/**
 * Get all ratings for a user
 */
export const getUserRatings = async (userId: string): Promise<Rating[]> => {
  try {
    const ratingsQuery = query(
      collection(db, "ratings"),
      where("ratedUserId", "==", userId)
    );

    const ratingsSnap = await getDocs(ratingsQuery);
    return ratingsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Rating[];
  } catch (error) {
    console.error("Error fetching user ratings:", error);
    return [];
  }
};

/**
 * Format rating display
 */
export const formatRating = (rating?: number): string => {
  if (!rating) return "No rating";
  return rating.toFixed(1);
};

/**
 * Get rating color based on value
 */
export const getRatingColor = (rating?: number): string => {
  if (!rating) return "#9CA3AF"; // gray-400
  if (rating >= 4.5) return "#10B981"; // green-500
  if (rating >= 4.0) return "#84CC16"; // lime-500
  if (rating >= 3.5) return "#F59E0B"; // amber-500
  if (rating >= 3.0) return "#EF4444"; // red-500
  return "#DC2626"; // red-600
};

/**
 * Render stars component (for React Native)
 */
export const renderStarsArray = (rating: number) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push({ type: "full", key: i });
    } else if (i === fullStars && hasHalfStar) {
      stars.push({ type: "half", key: i });
    } else {
      stars.push({ type: "empty", key: i });
    }
  }
  return stars;
};
