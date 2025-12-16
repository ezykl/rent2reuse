import { useState, useEffect, useCallback } from "react";
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
  itemLocation?: {
    // Change this line
    latitude: number;
    longitude: number;
    address?: string;
  };
  itemMinRentDuration: number;
  itemName: string;
  itemPrice: number;
  itemStatus: string;
  enableAI: boolean;
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

  // Add the refresh function
  const refreshItems = useCallback(async () => {
    try {
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
            itemLocation:
              data.itemLocation && typeof data.itemLocation === "object"
                ? data.itemLocation
                : undefined,
            itemMinRentDuration: data.itemMinRentDuration || 0,
            itemName: data.itemName || "",
            itemPrice: data.itemPrice || 0,
            enableAI: data.enableAI || false,
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
    } catch (error) {
      console.log("Error refreshing items:", error);
      setError(error instanceof Error ? error.message : "Unknown error");
    }
  }, [type, params?.category]);

  // Use the refresh function in useEffect
  useEffect(() => {
    refreshItems();
    // Set up real-time updates
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
            itemLocation:
              data.itemLocation && typeof data.itemLocation === "object"
                ? data.itemLocation
                : undefined,
            itemMinRentDuration: data.itemMinRentDuration || 0,
            itemName: data.itemName || "",
            itemPrice: data.itemPrice || 0,
            enableAI: data.enableAI || false,
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

  return { items, loading, error, refreshItems };
};
