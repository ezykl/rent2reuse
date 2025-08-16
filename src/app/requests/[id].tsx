import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
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
}

// Compact RequestCard Component with Toggle
const RequestCard: React.FC<{
  request: RequestType;
  onStatusUpdate: (id: string, status: string) => void;
  minutesToTime: (minutes: number) => string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
}> = ({ request, onStatusUpdate, minutesToTime, isExpanded, onToggle }) => {
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

  return (
    <View className="bg-white rounded-xl mx-4 mb-3 shadow-sm border border-gray-100 overflow-hidden">
      {/* Header - Always Visible */}
      <View className="p-4">
        {/* User & Price Row */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <Image
              source={
                request.requesterData?.profileImage
                  ? { uri: request.requesterData.profileImage }
                  : icons.user
              }
              className="w-10 h-10 rounded-full mr-3"
            />
            <View className="flex-1">
              <Text className="font-psemibold text-gray-800 text-sm">
                {getFullName()}
              </Text>
              <Text className="text-xs font-pregular text-gray-500">
                {dayjs(request.createdAt).format("MMM D, h:mm A")}
              </Text>
            </View>
          </View>

          <View className="items-end">
            <Text className="font-pbold text-green-600 text-lg">
              ₱{request.totalPrice.toLocaleString()}
            </Text>
            <Text className="text-xs text-gray-500">
              {request.rentalDays} day{request.rentalDays !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Quick Info Row */}
        <View className="bg-gray-50 rounded-lg p-3 mb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-xs font-pmedium text-gray-600 mb-1">
                {formatShortDate(request.startDate)} -{" "}
                {formatShortDate(request.endDate)}
              </Text>
              <Text className="text-xs text-gray-500">
                Pickup: {minutesToTime(Number(request.pickupTime))}
              </Text>
            </View>
            <View className="bg-yellow-100 px-2 py-1 rounded-full">
              <Text className="text-xs font-pmedium text-yellow-700 capitalize">
                {request.status}
              </Text>
            </View>
          </View>
        </View>

        {/* Message */}
        {request.message && (
          <View className="mb-2">
            <Text className="text-xs font-pbold text-gray-400 uppercase tracking-wider mb-2">
              Message
            </Text>
            <View className="bg-white rounded-lg p-3">
              <Text className="text-sm text-gray-700 leading-5 italic">
                "{request.message}"
              </Text>
            </View>
          </View>
        )}

        {/* Toggle Button */}
        <TouchableOpacity
          onPress={() => onToggle(request.id)}
          className="flex-row items-center justify-center py-2 mb-3"
          activeOpacity={0.7}
        >
          <Text className="text-xs font-pmedium text-blue-600 mr-1">
            {isExpanded ? "Hide details" : "View details"}
          </Text>
          <Image
            source={icons.arrowDown}
            className={`w-4 h-4 ${isExpanded ? "rotate-180" : ""}`}
            tintColor="#2563EB"
          />
        </TouchableOpacity>

        {/* Action Buttons - Always Visible */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => onStatusUpdate(request.id, "approved")}
            className="flex-1 bg-green-500 py-3 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-white font-pmedium text-center text-sm">
              Respond
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onStatusUpdate(request.id, "rejected")}
            className="flex-1 bg-red-500 py-3 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-white font-pmedium text-center text-sm">
              Decline
            </Text>
          </TouchableOpacity>
        </View>
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

  const fetchItemAndRequests = async () => {
    try {
      setIsLoading(true);

      const requestsRef = collection(db, "rentRequests");
      const q = query(
        requestsRef,
        where("itemId", "==", id),
        where("status", "==", "pending")
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

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
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
      }

      // Add status update message
      if (requestData.chatId) {
        await addDoc(collection(db, "chat", requestData.chatId, "messages"), {
          type: "statusUpdate",
          text: `Request ${newStatus}`,
          senderId: id,
          createdAt: serverTimestamp(),
          read: false,
        });
      }

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
    }
  };

  const toggleCardExpansion = (requestId: string) => {
    setExpandedCard(expandedCard === requestId ? null : requestId);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <LottieActivityIndicator size={80} />
        <Text className="text-gray-500 font-pregular mt-3 text-sm">s...</Text>
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
            <Text className="text-xs font-pregular text-gray-500">
              {requests.length} pending
            </Text>
          </View>
        </View>
      </View>

      {/* Requests List */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        {requests.length === 0 ? (
          <View className="flex-1 justify-center items-center py-16">
            <Text className="text-4xl mb-3">📋</Text>
            <Text className="text-lg font-pmedium text-gray-600 mb-2">
              No Pending Requests
            </Text>
            <Text className="text-sm font-pregular text-gray-500 text-center px-8">
              Rental requests will appear here when users want to rent your
              item.
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
