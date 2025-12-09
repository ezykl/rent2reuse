import Message from "@/types/message";
import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "@/lib/firebaseConfig";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { doc, onSnapshot } from "firebase/firestore";
import { format, isToday, isYesterday } from "date-fns";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { icons } from "@/constant";

const RentRequestMessage = ({
  item,
  isOwner,
  onAccept,
  onDecline,
  onCancel,
  chatData,
  chatId,
  messages, // Add messages prop
}: {
  item: Message;
  isOwner: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  chatData?: any;
  chatId: string;
  messages?: any; // Define messages prop type
}) => {
  const [currentStatus, setCurrentStatus] = useState<string>("pending");
  const [rentRequestData, setRentRequestData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Loading state for button
  const isSender = item.senderId === auth.currentUser?.uid;
  const { minutesToTime } = useTimeConverter();

  const effectiveStatus = useMemo(() => {
    return currentStatus || item.status || chatData?.status || "pending";
  }, [currentStatus, item.status, chatData?.status]);

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

  const isRequestExpired = (startDate: any): boolean => {
    if (!startDate) return false;
    const date = startDate.toDate ? startDate.toDate() : startDate;
    return new Date() > date;
  };

  // Real-time status listener - SIMPLIFIED VERSION
  useEffect(() => {
    if (!chatId) return;

    const chatRef = doc(db, "chat", String(chatId));

    const unsubscribeChat = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const chatData = snapshot.data();

        // Update status
        setCurrentStatus(chatData.status || "pending");

        // Map chat data directly to rent request data
        // ✅ CHANGE: Fetch from securityDepositPercentage but store as downpaymentPercentage
        const securityDepositPercentage =
          chatData.itemDetails?.securityDepositPercentage || 0;
        const basePrice = chatData.itemDetails?.price || 0;
        const rentalDays = chatData.itemDetails?.rentalDays || 0;
        const baseTotal = basePrice * rentalDays;
        const depositAmount = (baseTotal * securityDepositPercentage) / 100;
        const totalWithDeposit = baseTotal + depositAmount;

        const requestData = {
          name: chatData.itemDetails?.name || "Unknown Item",
          itemImage: chatData.itemDetails?.image || "",
          price: basePrice,
          totalPrice: totalWithDeposit, // ✅ CHANGE: Include security deposit in total
          baseTotal: baseTotal, // ✅ NEW: Store base rental total separately
          rentalDays: rentalDays,
          downpaymentPercentage: securityDepositPercentage, // ✅ CHANGE: Use this variable name
          securityDepositPercentage: securityDepositPercentage, // ✅ NEW: Also store original name
          depositAmount: depositAmount, // ✅ NEW: Store deposit amount for display
          itemLocation: chatData.itemDetails?.itemLocation || null,
          pickupTime: chatData.itemDetails?.pickupTime || 480,
          startDate: chatData.itemDetails?.startDate?.toDate() || new Date(),
          endDate: chatData.itemDetails?.endDate?.toDate() || new Date(),
          message: chatData.itemDetails?.message || "",
          status: chatData.status || "pending",

          // Additional chat-level fields
          requesterId: chatData.requesterId,
          ownerId: chatData.ownerId,
          itemId: chatData.itemId,
          participants: chatData.participants,
          createdAt: chatData.createdAt?.toDate() || new Date(),
        };

        setRentRequestData(requestData);
      }
    });

    return () => {
      unsubscribeChat();
    };
  }, [chatId]);

  // Format date helper function
  const formatDate = (date: any) => {
    if (!date) return "";
    if (date.toDate) return format(date.toDate(), "MMM d, yyyy");
    if (date instanceof Date) return format(date, "MMM d, yyyy");
    return "Date unavailable";
  };

  // Check if there's a pending owner confirmation message
  const hasPendingConfirmation = messages?.some(
    (msg: any) =>
      msg.type === "ownerConfirmation" &&
      msg.status === "pending" &&
      msg.confirmationRequestId === item.rentRequestId
  );

  if (!rentRequestData) {
    return (
      <View className="bg-white rounded-xl p-4 mb-3">
        <Text className="text-gray-500">Loading request details...</Text>
      </View>
    );
  }

  const getStatusBadge = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "approved":
      case "accepted":
        return {
          bgColor: "bg-green-100",
          textColor: "text-green-700",
        };
      case "cancelled":
      case "declined":
      case "rejected":
        return {
          bgColor: "bg-red-100",
          textColor: "text-red-700",
        };
      case "pending":
        return {
          bgColor: "bg-yellow-100",
          textColor: "text-yellow-700",
        };
      default:
        return {
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
        };
    }
  };

  const getStatusDisplay = () => {
    switch (effectiveStatus.toLowerCase()) {
      case "cancelled":
        return (
          <View className="bg-gray-100 p-4 rounded-lg mt-4">
            <Text className="text-gray-600 text-center">
              This request was cancelled
            </Text>
          </View>
        );
      case "declined":
        return (
          <View className="bg-red-50 p-4 rounded-lg mt-4">
            <Text className="text-red-600 text-center">
              This request was declined
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View className={`flex- mb-3 ${isSender ? "pl-24" : "pr-24"}`}>
      <View
        className={`p-4 shadow-sm flex-1 ${
          isSender
            ? "bg-white rounded-xl rounded-br-none border-2 border-primary"
            : "bg-white rounded-xl rounded-bl-none border border-gray-200"
        }`}
      >
        {/* Status Badge - Use effectiveStatus */}
        <View
          className={`absolute top-4 right-4 px-2 py-1 rounded-full ${
            getStatusBadge(effectiveStatus).bgColor
          }`}
        >
          <Text
            className={`text-xs font-psemibold capitalize ${
              getStatusBadge(effectiveStatus).textColor
            }`}
          >
            {effectiveStatus}
          </Text>
        </View>

        <Text className="text-sm font-pmedium mb-2 text-gray-500">
          {isSender ? "Your Request" : "Rental Request"}
        </Text>

        {/* Basic Info */}
        <View className="flex-row items-start gap-3">
          <Image
            source={{
              uri:
                chatData?.itemDetails?.image ||
                rentRequestData?.itemImage ||
                "https://placehold.co/200x200.png",
            }}
            className="w-24 h-24 rounded-lg"
            resizeMode="cover"
          />
          <View className="flex-1">
            <Text className="font-pbold text-base  text-gray-900">
              {rentRequestData.name}
            </Text>
            <View className="flex-row items-center">
              <Image
                source={icons.calendar}
                className="w-4 h-4 mr-2"
                tintColor="#4B5563"
                resizeMode="contain"
              />
              <Text className="text-sm mt-1 font-pmedium text-gray-600">
                {formatDate(rentRequestData.startDate)} -{" "}
                {formatDate(rentRequestData.endDate)}
              </Text>
            </View>

            <View className="flex-row items-center">
              <Image
                source={icons.clock}
                className="w-4 h-4 mr-2"
                tintColor="#4B5563"
                resizeMode="contain"
              />
              <Text className="text-sm mt-1 font-pmedium text-gray-600">
                {minutesToTime(rentRequestData.pickupTime)}
              </Text>
            </View>

            <Text className="font-psemibold mt-1 text-primary">
              ₱{rentRequestData.price}
              /day
            </Text>
          </View>
        </View>

        {effectiveStatus !== "cancelled" && effectiveStatus !== "declined" && (
          <View className="mt-3 pt-3 border-t border-gray-100">
            <View>
              <Text className="text-xs font-pbold uppercase text-gray-400">
                Message
              </Text>
              <Text className="text-sm mt-1 font-pregular text-gray-700">
                {rentRequestData.message}
              </Text>
            </View>

            <View className="mt-3">
              <View>
                <Text className="text-xs font-pbold uppercase text-gray-400">
                  Rental Period
                </Text>
                <Text className="text-sm font-pmedium mt-1 text-gray-700">
                  {rentRequestData.rentalDays} days
                </Text>
              </View>

              {/* ✅ NEW: Price Breakdown Section */}
              <View className="mt-3 bg-gray-50 p-3 rounded-lg">
                <Text className="text-xs font-pbold uppercase text-gray-400 mb-2">
                  Price Breakdown
                </Text>

                {/* Base Rental */}
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm font-pregular text-gray-700">
                    Rental Fee ({rentRequestData.rentalDays} days × ₱
                    {rentRequestData.price})
                  </Text>
                  <Text className="text-sm font-pmedium text-gray-800">
                    ₱{(rentRequestData.baseTotal || 0).toLocaleString()}
                  </Text>
                </View>

                {/* Security Deposit - Only show if percentage > 0 */}
                {rentRequestData.downpaymentPercentage &&
                rentRequestData.downpaymentPercentage > 0 ? (
                  <>
                    <View className="flex-row justify-between py-2 border-t border-gray-200 mb-2">
                      <Text className="text-sm font-pregular text-gray-700">
                        Security Deposit (
                        {rentRequestData.downpaymentPercentage}
                        %)
                      </Text>
                      <Text className="text-sm font-pmedium text-orange-600">
                        ₱{(rentRequestData.depositAmount || 0).toLocaleString()}
                      </Text>
                    </View>

                    {/* Total with Deposit */}
                    <View className="flex-row justify-between pt-2 border-t border-gray-200">
                      <Text className="text-sm font-pbold text-gray-900">
                        Total Amount Due
                      </Text>
                      <Text className="text-base font-pbold text-primary">
                        ₱{(rentRequestData.totalPrice || 0).toLocaleString()}
                      </Text>
                    </View>

                    {/* Info Note */}
                    <View className="mt-2 bg-orange-50 p-2 rounded border border-orange-200">
                      <Text className="text-xs font-pregular text-orange-700">
                        💡 Security deposit will be collected at pickup and
                        refunded upon safe return.
                      </Text>
                    </View>
                  </>
                ) : (
                  // No security deposit
                  <View className="flex-row justify-between pt-2 border-t border-gray-200">
                    <Text className="text-sm font-pbold text-gray-900">
                      Total Amount Due
                    </Text>
                    <Text className="text-base font-pbold text-primary">
                      ₱{(rentRequestData.totalPrice || 0).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Status Display */}
        {getStatusDisplay()}

        {/* Action buttons - Only show if status is pending */}
        {effectiveStatus === "pending" && (
          <>
            {isOwner ? (
              <View className="flex-row gap-2 mt-4">
                {!isRequestExpired(rentRequestData.startDate) ? (
                  <>
                    <TouchableOpacity
                      onPress={onAccept}
                      disabled={
                        isLoading ||
                        hasPendingConfirmation ||
                        effectiveStatus !== "pending"
                      }
                      className={`flex-1 rounded-lg py-3 items-center justify-center ${
                        isLoading ||
                        hasPendingConfirmation ||
                        effectiveStatus !== "pending"
                          ? "bg-gray-300"
                          : "bg-green-500"
                      }`}
                    >
                      <Text
                        className={`font-psemibold ${
                          isLoading || hasPendingConfirmation
                            ? "text-gray-600"
                            : "text-white"
                        }`}
                      >
                        {hasPendingConfirmation
                          ? "Confirmation Sent"
                          : "Accept"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View className="w-full bg-gray-100 p-4 rounded-lg">
                    <Text className="text-gray-600 text-center">
                      This request has expired as the start date has passed
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              // ✅ RENTER SECTION - UPDATED
              <View className="mt-4">
                {!isRequestExpired(rentRequestData.startDate) ? (
                  <TouchableOpacity
                    onPress={onCancel}
                    disabled={hasPendingConfirmation || isLoading} // ✅ ADD DISABLED STATE
                    className={`py-3 rounded-xl ${
                      hasPendingConfirmation || isLoading
                        ? "bg-gray-300" // ✅ GREY OUT WHEN DISABLED
                        : "bg-red-400"
                    }`}
                  >
                    <Text
                      className={`font-pbold text-center ${
                        hasPendingConfirmation || isLoading
                          ? "text-gray-600" // ✅ GREY TEXT
                          : "text-white"
                      }`}
                    >
                      {hasPendingConfirmation
                        ? "Waiting for Confirmation"
                        : "CANCEL REQUEST"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View className="bg-gray-100 p-4 rounded-lg">
                    <Text className="text-gray-600 text-center">
                      This request has expired
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* Show accepted status message when accepted */}
        {effectiveStatus === "accepted" && (
          <View className="bg-green-50 p-4 rounded-lg mt-4">
            <Text className="text-green-600 text-center font-pmedium">
              Request accepted!
            </Text>
          </View>
        )}

        <View className="mt-2 flex-row justify-end">
          <Text className="text-xs text-gray-400">
            {item.createdAt ? formatTimestamp(item.createdAt) : ""}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default RentRequestMessage;
