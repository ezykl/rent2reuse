import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import React, { useEffect, useState } from "react";
import { Link, useRouter, useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  Timestamp,
  updateDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import dayjs from "dayjs";

// Interfaces
interface RentRequestData {
  createdAt: any;
  itemId: string;
  itemName: string;
  itemImage?: string;
  ownerId: string;
  ownerName: string;
  requesterId: string;
  requesterName: string;
  status: "pending" | "approved" | "rejected";
  startDate: any;
  endDate: any;
  pickupTime: number;
  rentalDays: number;
  message: string;
  totalPrice: number;
}

interface UserData {
  email: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  profileImage?: string;
}

interface RequestType extends Omit<RentRequestData, "createdAt"> {
  id: string;
  createdAt: Date;
  requesterData?: UserData;
  chatId?: string;
}

// Compact RequestCard Component with Toggle
const RequestCard: React.FC<{
  request: RequestType;
  onStatusUpdate: (id: string, status: string) => void;
  minutesToTime: (minutes: number) => string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}> = ({ request, onStatusUpdate, minutesToTime, isExpanded, onToggle }) => {
  const router = useRouter();

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp instanceof Timestamp) {
      return dayjs(timestamp.toDate()).format("MMM D, YYYY");
    }
    if (typeof timestamp === "string") {
      return dayjs(timestamp).format("MMM D, YYYY");
    }
    return "";
  };

  const formatShortDate = (timestamp: any) => {
    if (!timestamp) return "";
    if (timestamp instanceof Timestamp) {
      return dayjs(timestamp.toDate()).format("MMM D");
    }
    if (typeof timestamp === "string") {
      return dayjs(timestamp).format("MMM D");
    }
    return "";
  };

  const getFullName = () => {
    const { firstname = "", lastname = "" } = request.requesterData || {};
    return (
      `${firstname} ${lastname}`.trim() || request.requesterName || "Anonymous"
    );
  };

  // Add status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "approved":
        return "bg-green-100 text-green-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  // Add chat navigation handler
  const handleChatNavigation = () => {
    if (request.chatId) {
      router.push(`/chat/${request.chatId}`);
    } else {
      // Create new chat if doesn't exist
      // You'll need to implement this logic
      console.log("Chat needs to be created first");
    }
  };

  return (
    <View className="bg-white rounded-xl mx-4 mb-3 shadow-sm border border-gray-100 overflow-hidden">
      {/* Main Card Content */}
      <View className="p-4">
        {/* User & Price Row - Enhanced */}
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={() => router.push(`/user/${request.requesterId}`)}
            className="flex-row items-center flex-1"
          >
            <View className="relative">
              <Image
                source={
                  request.requesterData?.profileImage
                    ? { uri: request.requesterData.profileImage }
                    : icons.user
                }
                className="w-12 h-12 rounded-full mr-3"
              />
              <View className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
            </View>
            <View className="flex-1">
              <Text className="font-pbold text-gray-800 text-base">
                {getFullName()}
              </Text>
              <Text className="text-xs font-pregular text-gray-500 mt-1">
                Joined {dayjs(request.createdAt).format("MMM YYYY")}
              </Text>
            </View>
          </TouchableOpacity>

          <View className="items-end">
            <Text className="font-pbold text-green-600 text-xl">
              ₱{request.totalPrice.toLocaleString()}
            </Text>
            <Text className="text-xs font-pmedium text-gray-500">
              for {request.rentalDays} day{request.rentalDays !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Status Badge - Enhanced */}
        <View className="flex-row items-center justify-between bg-gray-50 rounded-lg p-3 mb-4">
          <View className="flex-row items-center gap-4">
            <Image
              source={icons.calendar}
              className="w-5 h-5"
              tintColor="#4B5563"
            />
            <Text className="text-sm font-pmedium text-gray-600">
              {formatShortDate(request.startDate)} -{" "}
              {formatShortDate(request.endDate)}
            </Text>
          </View>
          <View
            className={`px-3 py-1.5 rounded-full ${getStatusColor(
              request.status
            )}`}
          >
            <Text className="text-xs font-pbold capitalize">
              {request.status}
            </Text>
          </View>
        </View>

        {/* Action Buttons - Enhanced */}
        <View className="flex-row gap-3 mt-4">
          <TouchableOpacity
            onPress={handleChatNavigation}
            className="flex-1 bg-primary py-3 rounded-xl flex-row items-center justify-center gap-4"
            activeOpacity={0.8}
          >
            <Image
              source={icons.chat}
              className="w-6 h-6"
              tintColor="#FFFFFF"
              resizeMode="cover"
            />
            <Text className="text-white font-pbold text-base">
              Message Renter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onStatusUpdate(request.id, "declined")}
            className="bg-red-400 p-4 rounded-xl"
            activeOpacity={0.8}
          >
            <Image
              source={icons.close}
              className="w-6 h-6"
              tintColor="#FFFFFF"
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>

        {/* Toggle Details Button - Enhanced */}
        <TouchableOpacity
          onPress={() => onToggle(request.id)}
          className="flex-row items-center justify-center mt-4"
          activeOpacity={0.7}
        >
          <Text className="text-sm font-pmedium text-blue-500 mr-1">
            {isExpanded ? "Hide Details" : "View Details"}
          </Text>
          <Image
            source={icons.arrowDown}
            className={`w-4 h-4 ${isExpanded ? "" : "-rotate-90"}`}
            tintColor="#2563EB"
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Expanded Details */}
      {isExpanded && (
        <View className="border-t border-gray-100 p-4 bg-gray-50">
          {/* Contact Info */}
          <View className="mb-4">
            <Text className="text-xs font-pbold text-gray-400 uppercase tracking-wider mb-2">
              Contact Information
            </Text>
            <View className="bg-white rounded-lg p-3">
              <Text className="text-sm font-pmedium text-gray-700">
                {request.requesterData?.email || "No email provided"}
              </Text>
              {request.requesterData?.firstname && (
                <Text className="text-xs font-pregular text-gray-500 mt-1">
                  {request.requesterData.firstname}{" "}
                  {request.requesterData.middlename || ""}{" "}
                  {request.requesterData.lastname}
                </Text>
              )}
            </View>
          </View>

          {/* Detailed Dates */}
          <View className="mb-4">
            <Text className="text-xs font-pbold text-gray-400 uppercase tracking-wider mb-2">
              Rental Period
            </Text>
            <View className="bg-white rounded-lg p-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm font-pregular text-gray-600">
                  Start Date:
                </Text>
                <Text className="text-sm font-pmedium text-gray-800">
                  {formatTimestamp(request.startDate)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm font-pregular text-gray-600">
                  End Date:
                </Text>
                <Text className="text-sm font-pmedium text-gray-800">
                  {formatTimestamp(request.endDate)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-pregular text-gray-600">
                  Pickup Time:
                </Text>
                <Text className="text-sm font-pmedium text-gray-800">
                  {minutesToTime(Number(request.pickupTime))}
                </Text>
              </View>
            </View>
          </View>

          {/* Pricing Breakdown */}
          <View className="mb-4">
            <Text className="text-xs font-pbold text-gray-400 uppercase tracking-wider mb-2">
              Pricing Details
            </Text>
            <View className="bg-white rounded-lg p-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm font-pregular text-gray-600">
                  Daily Rate:
                </Text>
                <Text className="text-sm font-pmedium text-gray-800">
                  ₱{(request.totalPrice / request.rentalDays).toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm font-pregular text-gray-600">
                  Duration:
                </Text>
                <Text className="text-sm font-pmedium text-gray-800">
                  {request.rentalDays}{" "}
                  {request.rentalDays === 1 ? "day" : "days"}
                </Text>
              </View>
              <View className="border-t border-gray-200 pt-2 mt-2">
                <View className="flex-row justify-between">
                  <Text className="text-sm font-psemibold text-gray-800">
                    Total:
                  </Text>
                  <Text className="text-sm font-pbold text-green-600">
                    ₱{request.totalPrice.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const ViewRequests = () => {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<RequestType[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { minutesToTime } = useTimeConverter();

  useEffect(() => {
    fetchItemAndRequests();
  }, [id]);

  // Update the fetchItemAndRequests function
  const fetchItemAndRequests = async () => {
    try {
      setIsLoading(true);

      const requestsRef = collection(db, "rentRequests");
      const q = query(
        requestsRef,
        where("itemId", "==", id),
        where("status", "in", ["pending", "approved"]) // Only show pending and approved requests
      );

      const querySnapshot = await getDocs(q);

      const requestsData = await Promise.all(
        querySnapshot.docs.map(async (document) => {
          const data = document.data() as RentRequestData;

          let requesterData: UserData | undefined;
          try {
            const userDoc = await getDoc(doc(db, "users", data.requesterId));
            if (userDoc.exists()) {
              requesterData = userDoc.data() as UserData;
            }
          } catch (error) {
            console.log("Error fetching user data:", error);
          }

          return {
            id: document.id,
            ...data,
            requesterData,
            createdAt: data.createdAt?.toDate() || new Date(),
          };
        })
      );

      setRequests(
        requestsData.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )
      );
    } catch (error) {
      console.error("Error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to load requests",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update the handleStatusUpdate function
  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      setIsLoading(true); // Add loading state while updating

      const requestRef = doc(db, "rentRequests", requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) return;

      const requestData = requestSnap.data();

      // Update request status
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      // Update chat status to allow messaging
      if (requestData.chatId) {
        await updateDoc(doc(db, "chat", requestData.chatId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        // Add status update message to chat
        await addDoc(collection(db, "chat", requestData.chatId, "messages"), {
          type: "statusUpdate",
          text: `Request ${newStatus}`,
          senderId: id,
          createdAt: serverTimestamp(),
          read: false,
        });
      }

      // Update local state to reflect changes immediately
      setRequests((prevRequests) =>
        prevRequests.filter((request) => {
          // If status is declined, remove it from the list
          if (newStatus === "declined" || newStatus === "rejected") {
            return request.id !== requestId;
          }
          // Otherwise, update the status
          if (request.id === requestId) {
            return {
              ...request,
              status: newStatus,
            };
          }
          return request;
        })
      );

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: `Request ${newStatus} successfully!`,
      });
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

  const toggleCardExpansion = (requestId: string) => {
    setExpandedCard(expandedCard === requestId ? null : requestId);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <LottieActivityIndicator size={80} />
        <Text className="text-gray-500 font-pmedium mt-3 text-sm">
          Loading your data...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-3"
            activeOpacity={0.7}
          >
            <Image
              source={icons.leftArrow}
              className="w-8 h-8"
              tintColor="#374151"
            />
          </TouchableOpacity>

          <View className="flex-1 justify-center items-center">
            <Text className="text-lg font-pbold text-gray-800">
              Rental Requests
            </Text>
          </View>
          <View className="w-8" />
        </View>
      </View>

      {/* Requests List */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        {requests.length === 0 ? (
          <View className="flex-1 justify-center items-center py-24">
            <Image
              source={icons.emptyBox}
              className="w-16 h-16 mb-4"
              tintColor="#9CA3AF"
            />

            <Text className="text-lg font-pmedium text-gray-600 mb-2">
              No Pending Requests
            </Text>
            <Text className="text-sm font-pregular text-gray-500 text-center px-8 mx-4">
              Rental requests will appear here {"\n"}when users want to rent
              your item.
            </Text>
          </View>
        ) : (
          requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onStatusUpdate={handleStatusUpdate}
              minutesToTime={minutesToTime}
              isExpanded={expandedCard === request.id}
              onToggle={toggleCardExpansion}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ViewRequests;
