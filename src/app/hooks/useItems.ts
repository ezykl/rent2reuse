import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface Item {
  id: string;
  images: string[];
  createdAt: Date;
  itemCategory: string;
  itemCondition: string;
  itemDesc: string;
  itemLocation: string;
  itemMinRentDuration: number;
  itemName: string;
  itemPrice: number;
  itemStatus: string;
  owner: {
    fullname: string;
    id: string;
  };
}

export const useItems = (type: "recent" | "popular", itemLimit: number = 6) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const itemsRef = collection(db, "items");
        const q = query(
          itemsRef,
          orderBy("createdAt", "desc"),
          limit(itemLimit)
        );

        const snapshot = await getDocs(q);
        const itemsData = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            if (!data) return null;

            return {
              id: doc.id,
              images: Array.isArray(data.images) ? data.images : [],
              createdAt: data.createdAt?.toDate() || new Date(),
              itemCategory: data.itemCategory || "",
              itemCondition: data.itemCondition || "",
              itemDesc: data.itemDesc || "",
              itemLocation: data.itemLocation || "",
              itemMinRentDuration: data.itemMinRentDuration || 0,
              itemName: data.itemName || "",
              itemPrice: data.itemPrice || 0,
              itemStatus: data.itemStatus || "Available",
              owner: {
                fullname: data.owner?.fullname || "Unknown User",
                id: data.owner?.id || "",
              },
            } as Item;
          })
          .filter(Boolean) as Item[];

        setItems(itemsData);
      } catch (err) {
        console.error("Error fetching items:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch items");
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [type, itemLimit]);

  return { items, loading, error };
};
