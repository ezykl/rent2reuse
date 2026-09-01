import {
  doc,
  increment,
  updateDoc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";

export const useItemViews = () => {
  const trackItemView = async (
    itemId: string,
    source: "search" | "browse" = "browse",
    searchText?: string
  ) => {
    try {
      const userId = auth.currentUser?.uid;
      const batch = writeBatch(db);

      // Update item's view count
      const itemRef = doc(db, "items", itemId);
      batch.update(itemRef, {
        viewCount: increment(1),
        lastViewed: serverTimestamp(),
      });

      // Record view analytics
      if (userId) {
        const viewRef = doc(
          db,
          "itemViews",
          `${itemId}_${userId}_${Date.now()}`
        );
        batch.set(viewRef, {
          itemId,
          userId,
          timestamp: serverTimestamp(),
          source,
          searchQuery: source === "search" ? searchText : null,
        });
      }

      await batch.commit();
    } catch (error) {
      console.log("Error tracking item view:", error);
    }
  };

  return { trackItemView };
};
