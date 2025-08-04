import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  onSnapshot,
} from "firebase/firestore";
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

export const useItems = (
  type: "recent" | "popular" | "category",
  params?: { category?: string }
) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q;
    if (type === "category" && params?.category) {
      q = query(
        collection(db, "items"),
        where("category", "==", params.category),
        where("itemStatus", "==", "active"),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, "items"),
        orderBy("createdAt", "desc"),
        limit(6)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
        .filter((item): item is Item => {
          if (!item) return false;
          const status = item.itemStatus?.toLowerCase();
          return status === "available" || status === "Available";
        });

      setItems(itemsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [type, params?.category]);

  return { items, loading, error };
};
