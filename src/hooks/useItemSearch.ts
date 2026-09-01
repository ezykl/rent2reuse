import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { Item } from "@/types/item";

export const useItemSearch = () => {
  const [popularItems, setPopularItems] = useState<string[]>([]);

  // Get popular items on mount
  useEffect(() => {
    const fetchPopularItems = async () => {
      try {
        const itemsRef = collection(db, "items");
        const q = query(itemsRef, orderBy("itemCategory"), limit(5));

        const snapshot = await getDocs(q);
        const categories = new Set<string>();

        snapshot.forEach((doc) => {
          const category = doc.data().itemCategory;
          if (category) {
            categories.add(category);
          }
        });

        setPopularItems(Array.from(categories));
      } catch (error) {
        console.log("Error fetching popular items:", error);
        setPopularItems([]);
      }
    };

    fetchPopularItems();
  }, []);

  const searchItems = async (
    searchText: string,
    isCategory: boolean = false
  ): Promise<Item[]> => {
    if (!searchText.trim()) return [];

    try {
      const itemsRef = collection(db, "items");

      if (isCategory) {
        // Category search - keep as is
        const categoryQuery = query(
          itemsRef,
          where("itemCategory", "==", searchText),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(categoryQuery);
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Item[];
      }

      // Modified text search logic
      const searchLower = searchText.toLowerCase().trim();

      // Get all items and filter client-side for better text matching
      const allItemsQuery = query(itemsRef, orderBy("itemName"));
      const snapshot = await getDocs(allItemsQuery);

      const results = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Item)
        )
        .filter((item) => {
          const itemName = item.itemName?.toLowerCase() || "";
          const itemDesc = item.itemDesc?.toLowerCase() || "";
          return (
            itemName.includes(searchLower) || itemDesc.includes(searchLower)
          );
        });

      // Debug log
      console.log("Search text:", searchLower);
      console.log("Results found:", results.length);

      return results;
    } catch (error) {
      console.log("Search error:", error);
      return [];
    }
  };

  return { searchItems, popularItems };
};
