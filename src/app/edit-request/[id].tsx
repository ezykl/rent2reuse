import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  addDoc,
  collection,
  increment,
} from "firebase/firestore";
import dayjs from "dayjs";
import { auth, db } from "@/lib/firebaseConfig";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import RentRequestForm from "@/components/RentRequestForm";
import { useTimeConverter } from "@/hooks/useTimeConverter";

interface EditRequestData {
  startDate: Timestamp;
  endDate: Timestamp;
  itemId: string;
  itemImage: string;
  itemName: string;
  message: string;
  pickupTime: number;
  rentalDays: number;
  status: string;
  totalPrice: number;
  chatId?: string;
  ownerId?: string;
}

interface ItemData {
  itemMinRentDuration: number;
  itemPrice: number;
  itemName: string;
  images: string[];
}

export default function EditRequest() {
  const { id } = useLocalSearchParams();
  const [requestData, setRequestData] = useState<EditRequestData | null>(null);
  const [itemData, setItemData] = useState<ItemData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { minutesToTime } = useTimeConverter();

  useEffect(() => {
    fetchRequestAndItemData();
  }, [id]);

  const fetchRequestAndItemData = async () => {
    try {
      setIsLoading(true);

      // Get request data
      const requestDoc = await getDoc(doc(db, "rentRequests", id as string));
      if (!requestDoc.exists()) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Request not found",
        });
        router.back();
        return;
      }

      const requestData = requestDoc.data() as EditRequestData;

      // Get item data for validation
      const itemDoc = await getDoc(doc(db, "items", requestData.itemId));
      if (!itemDoc.exists()) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Item not found",
        });
        router.back();
        return;
      }

      const itemData = itemDoc.data() as ItemData;

      setRequestData(requestData);
      setItemData(itemData);
    } catch (error) {
      console.error("Error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to load request details",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (formData: {
    startDate: Date;
    endDate: Date;
    message: string;
    selectedTime: string;
  }) => {
    try {
      if (!requestData || !itemData) return;

      setIsLoading(true);

      const startDate = dayjs(formData.startDate);
      const endDate = dayjs(formData.endDate);
      const rentalDays = endDate.diff(startDate, "day");

      // Validate minimum rental duration
      if (rentalDays < itemData.itemMinRentDuration) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Invalid Duration",
          textBody: `Minimum rental period is ${itemData.itemMinRentDuration} days`,
        });
        return;
      }

      // Calculate total price using current item price
      const totalPrice = rentalDays * itemData.itemPrice;

      // Convert time to minutes
      const [time, modifier] = formData.selectedTime.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
      const pickupTimeInMinutes = hours * 60 + minutes;

      // Update request
      try {
        // 1. Update the rentRequests collection (existing)
        await updateDoc(doc(db, "rentRequests", id as string), {
          startDate: Timestamp.fromDate(startDate.toDate()),
          endDate: Timestamp.fromDate(endDate.toDate()),
          pickupTime: pickupTimeInMinutes,
          message: formData.message,
          totalPrice,
          rentalDays,
          updatedAt: serverTimestamp(),
        });

        // 2. Update the chat collection itemDetails (NEW)
        if (requestData.chatId) {
          await updateDoc(doc(db, "chat", requestData.chatId), {
            "itemDetails.startDate": Timestamp.fromDate(startDate.toDate()),
            "itemDetails.endDate": Timestamp.fromDate(endDate.toDate()),
            "itemDetails.pickupTime": pickupTimeInMinutes,
            "itemDetails.message": formData.message,
            "itemDetails.totalPrice": totalPrice,
            "itemDetails.rentalDays": rentalDays,

            // Update chat-level fields
            lastMessage: "Request details updated",
            lastMessageTime: serverTimestamp(),
            lastSender: auth.currentUser?.uid,

            // Update unread count for the other participant
            [`unreadCounts.${requestData.ownerId}`]: increment(1),
          });

          // 3. Add chat notification message (existing)
          await addDoc(collection(db, "chat", requestData.chatId, "messages"), {
            type: "statusUpdate",
            text: "Requester made updates to the request details.",
            senderId: auth.currentUser?.uid,
            createdAt: serverTimestamp(),
            read: false,
          });
        }

        console.log(
          "Successfully updated both rentRequests and chat collections"
        );
      } catch (error) {
        console.error("Error updating request:", error);
        throw error;
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request updated successfully",
      });

      router.back();
    } catch (error) {
      console.error("Error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update request",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !requestData || !itemData) {
    return (
      <View className="flex-1 justify-center bg-white items-center">
        <LottieActivityIndicator size={100} />
      </View>
    );
  }

  return (
    <RentRequestForm
      mode="edit"
      initialData={{
        startDate: requestData.startDate.toDate(),
        endDate: requestData.endDate.toDate(),
        message: requestData.message,
        selectedTime: minutesToTime(requestData.pickupTime),
      }}
      itemData={{
        itemName: itemData.itemName,
        itemPrice: itemData.itemPrice,
        itemImage: requestData.itemImage,
        itemMinRentDuration: itemData.itemMinRentDuration,
      }}
      onSubmit={handleUpdate}
      onClose={() => router.back()}
    />
  );
}
