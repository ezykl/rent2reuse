import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import Message from "@/types/message";
import { format, isToday, isYesterday } from "date-fns";
import { auth, db } from "@/lib/firebaseConfig";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

interface OwnerConfirmationMessageProps {
  item: Message;
  isCurrentUser: boolean;
  onDecline: () => void;
  isLoading?: boolean;
  chatId?: string;
  chatData?: any;
}

const OwnerConfirmationMessage: React.FC<OwnerConfirmationMessageProps> = ({
  item,
  isCurrentUser,
  onDecline,
  isLoading = false,
  chatId,
  chatData,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | undefined>(item.status);
  const [autoSentDownpayment, setAutoSentDownpayment] = useState(false);
  const isSender = item.senderId === auth.currentUser?.uid;

  useEffect(() => {
    if (!chatId || !item.id) return;

    const messageRef = doc(db, "chat", String(chatId), "messages", item.id);

    const unsubscribe = onSnapshot(messageRef, (snapshot) => {
      if (snapshot.exists()) {
        const messageData = snapshot.data();
        setLiveStatus(messageData.status);

        // ✅ AUTO-SEND DOWNPAYMENT MESSAGE when renter confirms
        // Only send once, and only if we're the owner (sender receives confirmation)
        if (
          messageData.status === "accepted" &&
          isSender &&
          !autoSentDownpayment &&
          !isProcessing
        ) {
          handleAutoSendDownpaymentMessage(messageData);
          setAutoSentDownpayment(true);
        }
      }
    });

    return () => unsubscribe();
  }, [chatId, item.id, isSender, autoSentDownpayment, isProcessing]);

  // ✅ AUTO-SEND DOWNPAYMENT MESSAGE
  const handleAutoSendDownpaymentMessage = async (confirmationData: any) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      if (!chatId || !chatData) return;

      const downpaymentPercentage =
        chatData?.itemDetails?.downpaymentPercentage ||
        chatData?.itemDetails?.securityDepositPercentage ||
        0;
      const basePrice = chatData?.itemDetails?.price || 0;
      const rentalDays = chatData?.itemDetails?.rentalDays || 0;
      const baseTotal = basePrice * rentalDays;
      const downpaymentAmount = (baseTotal * downpaymentPercentage) / 100 || 0;

      // ✅ Check if downpayment message already exists
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const existingPaymentMsg = await new Promise((resolve) => {
        const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
          const msgs = snapshot.docs.find(
            (doc) =>
              doc.data().type === "payment" &&
              doc.data().paymentType === "downpayment" &&
              doc.data().status === "pending"
          );
          resolve(msgs);
          unsubscribe();
        });
      });

      if (existingPaymentMsg) {
        // Payment message already sent, don't create another
        setIsProcessing(false);
        return;
      }

      // ✅ CREATE AND SEND DOWNPAYMENT MESSAGE AUTOMATICALLY
      const downpaymentMessage = {
        type: "payment",
        paymentType: "downpayment",
        amount: downpaymentAmount,
        totalAmount: baseTotal,
        downpaymentPercentage: downpaymentPercentage,
        downpaymentAmount: downpaymentAmount,
        remainingAmount: baseTotal - downpaymentAmount,
        status: "pending",
        senderId: chatData.ownerId, // Owner sends the payment request
        recipientId: auth.currentUser?.uid, // Renter receives it
        recipientPayPalEmail: chatData.renterPayPalEmail || "",
        itemName: chatData?.itemDetails?.name || "Item",
        rentRequestId: chatData?.rentRequestId,
        createdAt: serverTimestamp(),
        read: false,
      };

      await addDoc(messagesRef, downpaymentMessage);

      // ✅ UPDATE CHAT STATUS
      const chatRef = doc(db, "chat", String(chatId));
      await updateDoc(chatRef, {
        status: "awaiting_downpayment",
        lastMessage: "Downpayment request sent automatically",
        lastMessageTime: serverTimestamp(),
      });

      console.log("Downpayment message auto-sent successfully");
    } catch (error) {
      console.log("Error auto-sending downpayment message:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ HANDLE CONFIRM (RENTER CONFIRMS THE CONFIRMATION MESSAGE)
  const handleConfirm = async () => {
    try {
      setIsProcessing(true);

      if (!chatId || !item.id) {
        throw new Error("Missing chatId or messageId");
      }

      // Update confirmation message status to accepted
      const messageRef = doc(db, "chat", String(chatId), "messages", item.id);
      await updateDoc(messageRef, {
        status: "accepted",
        confirmedAt: serverTimestamp(),
      });

      // ✅ Auto-create downpayment payment message immediately (so renter sees it)
      try {
        if (chatData) {
          const downpaymentPercentage =
            chatData?.itemDetails?.downpaymentPercentage ||
            chatData?.itemDetails?.securityDepositPercentage ||
            0;
          const basePrice = chatData?.itemDetails?.price || 0;
          const rentalDays = chatData?.itemDetails?.rentalDays || 0;
          const baseTotal = basePrice * rentalDays;
          const downpaymentAmount =
            (baseTotal * downpaymentPercentage) / 100 || 0;

          const messagesRef = collection(
            db,
            "chat",
            String(chatId),
            "messages"
          );

          // create payment message
          const downpaymentMessage = {
            type: "payment",
            paymentType: "downpayment",
            amount: downpaymentAmount,
            totalAmount: baseTotal,
            downpaymentPercentage: downpaymentPercentage,
            downpaymentAmount: downpaymentAmount,
            remainingAmount: baseTotal - downpaymentAmount,
            status: "pending",
            senderId: chatData.ownerId || item.senderId,
            recipientId: auth.currentUser?.uid,
            recipientPayPalEmail: chatData.renterPayPalEmail || "",
            itemName: chatData?.itemDetails?.name || "Item",
            rentRequestId: chatData?.rentRequestId,
            createdAt: serverTimestamp(),
            read: false,
          };

          await addDoc(messagesRef, downpaymentMessage);

          // update chat status
          const chatRef = doc(db, "chat", String(chatId));
          await updateDoc(chatRef, {
            status: "awaiting_downpayment",
            lastMessage: "Downpayment request sent",
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setAutoSentDownpayment(true);
        }
      } catch (err) {
        console.log("Error creating downpayment message on confirm:", err);
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Confirmed",
        textBody: "Rental confirmation accepted. Payment request sent.",
      });
    } catch (error) {
      console.log("Error confirming:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to confirm. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const displayStatus = liveStatus || item.status || "pending";

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return "";

    const date = timestamp.toDate();

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    } else {
      const now = new Date();
      const diffInDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffInDays < 7) {
        return format(date, "EEE h:mm a");
      } else {
        return format(date, "MMM d, h:mm a");
      }
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "accepted":
        return {
          bgColor: "bg-green-100",
          textColor: "text-green-700",
        };
      case "declined":
        return {
          bgColor: "bg-red-100",
          textColor: "text-red-700",
        };
      case "pending":
        return {
          bgColor: "bg-blue-100",
          textColor: "text-blue-700",
        };
      default:
        return {
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
        };
    }
  };

  const itemDetails = item.itemDetails;

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "N/A";
    const date = dateValue.toDate?.() || new Date(dateValue);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (minutes: number) => {
    if (!minutes) return "9:00 AM";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(mins).padStart(2, "0")} ${ampm}`;
  };

  // If current user is the OWNER who sent this, show confirmation sent message
  if (isSender) {
    return (
      <View className={`flex- mb-3 pl-24`}>
        <View className="p-4 shadow-sm flex-1 bg-white rounded-xl rounded-br-none border-2 border-blue-500">
          {/* Status Badge */}
          <View
            className={`absolute top-4 right-4 px-2 py-1 rounded-full ${
              getStatusBadge(displayStatus).bgColor
            }`}
          >
            <Text
              className={`text-xs font-psemibold capitalize ${
                getStatusBadge(displayStatus).textColor
              }`}
            >
              {displayStatus === "pending" ? "Waiting" : displayStatus}
            </Text>
          </View>

          <Text className="text-sm font-pmedium mb-2 text-gray-500">
            Confirmation Sent
          </Text>

          {/* Message */}
          <View className="mt-3 pt-3 border-t border-gray-100">
            <Text className="text-xs font-pbold uppercase text-gray-400">
              Status
            </Text>
            <Text className="text-sm mt-1 font-pregular text-gray-700">
              {displayStatus === "pending"
                ? "Waiting for renter to confirm this rental request..."
                : displayStatus === "declined"
                ? "Renter declined this confirmation"
                : displayStatus === "accepted"
                ? "Rental confirmed by renter!"
                : "Confirmation status unknown"}
            </Text>
          </View>

          <View className="mt-2 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // RENTER VIEW - Show confirmation with action buttons

  // If already confirmed, show accepted status
  if (displayStatus === "accepted") {
    return (
      <View className={`flex- mb-3 pr-24`}>
        <View className="p-4 shadow-sm flex-1 bg-white rounded-xl rounded-bl-none border border-gray-200">
          {/* Status Badge */}
          <View
            className={`absolute top-4 right-4 px-2 py-1 rounded-full ${
              getStatusBadge("accepted").bgColor
            }`}
          >
            <Text
              className={`text-xs font-psemibold capitalize ${
                getStatusBadge("accepted").textColor
              }`}
            >
              Accepted
            </Text>
          </View>

          <Text className="text-sm font-pmedium mb-2 text-gray-500">
            Rental Confirmed
          </Text>

          {/* Confirmed Message */}
          <View className="mt-3 pt-3 border-t border-gray-100">
            <Text className="text-xs font-pbold uppercase text-gray-400">
              Status
            </Text>
            <Text className="text-sm mt-1 font-pregular text-green-700">
              You confirmed this rental!
            </Text>
          </View>

          <View className="mt-2 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // If declined, show declined status
  if (displayStatus === "declined") {
    return (
      <View className={`flex- mb-3 pr-24`}>
        <View className="p-4 shadow-sm flex-1 bg-white rounded-xl rounded-bl-none border border-gray-200">
          {/* Status Badge */}
          <View
            className={`absolute top-4 right-4 px-2 py-1 rounded-full ${
              getStatusBadge("declined").bgColor
            }`}
          >
            <Text
              className={`text-xs font-psemibold capitalize ${
                getStatusBadge("declined").textColor
              }`}
            >
              Declined
            </Text>
          </View>

          <Text className="text-sm font-pmedium mb-2 text-gray-500">
            Confirmation Declined
          </Text>

          {/* Declined Message */}
          <View className="mt-3 pt-3 border-t border-gray-100">
            <Text className="text-xs font-pbold uppercase text-gray-400">
              Status
            </Text>
            <Text className="text-sm mt-1 font-pregular text-red-700">
              You declined this rental
            </Text>
          </View>

          <View className="mt-2 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // PENDING CONFIRMATION - Show action buttons (RENTER ONLY)
  return (
    <View className={`flex- mb-3 pr-24`}>
      <View className="p-4 shadow-sm flex-1 bg-white rounded-xl rounded-bl-none border border-gray-200">
        {/* Status Badge */}
        <View
          className={`absolute top-4 right-4 px-2 py-1 rounded-full ${
            getStatusBadge("pending").bgColor
          }`}
        >
          <Text
            className={`text-xs font-psemibold capitalize ${
              getStatusBadge("pending").textColor
            }`}
          >
            Pending
          </Text>
        </View>

        <Text className="text-sm font-pmedium mb-2 text-gray-500">
          Confirm Rental
        </Text>

        {/* Confirmation Message */}
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-xs font-pbold uppercase text-gray-400">
            Message
          </Text>
          <Text className="text-sm mt-1 font-pregular text-gray-700">
            The owner confirmed your rental request. Do you want to proceed with
            this rental?
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-2 mt-4">
          <TouchableOpacity
            onPress={onDecline}
            disabled={isLoading || isProcessing}
            className={`flex-1 rounded-lg py-3 items-center justify-center ${
              isLoading || isProcessing
                ? "bg-gray-300"
                : "bg-red-100 border border-red-300"
            }`}
          >
            {isLoading || isProcessing ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <Text className="text-red-600 font-psemibold text-md">
                  Decline
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isLoading || isProcessing}
            className={`flex-1 rounded-lg py-3 items-center justify-center ${
              isLoading || isProcessing
                ? "bg-gray-300"
                : "bg-green-100 border border-green-300"
            }`}
          >
            {isLoading || isProcessing ? (
              <ActivityIndicator color="#10B981" size="small" />
            ) : (
              <>
                <Text className="text-green-600 font-psemibold text-md">
                  Confirm
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View className="mt-2 flex-row justify-end">
          <Text className="text-xs text-gray-400">
            {item.createdAt ? formatTimestamp(item.createdAt) : ""}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default OwnerConfirmationMessage;
