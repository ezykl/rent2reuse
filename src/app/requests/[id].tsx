import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
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
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { useDateConverter } from "@/hooks/useDateConverter";

// Update the interfaces to match your current structure
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
  startDate: string;
  endDate: string;
  pickupTime: number;
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

interface ItemDetails {
  itemName: string;
  itemPrice: number;
  images?: string[];
}

const ViewRequests = () => {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<RequestType[]>([]);
  const [itemDetails, setItemDetails] = useState<ItemDetails | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { minutesToTime } = useTimeConverter();
  const { convertDate } = useDateConverter();

  useEffect(() => {
    fetchItemAndRequests();
  }, [id]);

  const fetchItemAndRequests = async () => {
    try {
      setIsLoading(true);
      console.log("🔍 Fetching requests for item:", id);

      // Fetch rent requests for this item
      const requestsRef = collection(db, "rentRequests");
      const q = query(
        requestsRef,
        where("itemId", "==", id),
        where("status", "==", "pending")
      );

      const querySnapshot = await getDocs(q);
      console.log(`📋 Found ${querySnapshot.size} requests`);

      // Process requests
      const requestsData = await Promise.all(
        querySnapshot.docs.map(async (document) => {
          const data = document.data() as RentRequestData;
          console.log("📄 Processing request:", document.id, data);

          // Fetch requester data
          let requesterData: UserData | undefined;
          try {
            const userDoc = await getDoc(doc(db, "users", data.requesterId));
            if (userDoc.exists()) {
              requesterData = userDoc.data() as UserData;
              console.log("👤 Found user data for:", data.requesterId);
            }
          } catch (error) {
            console.log("❌ Error fetching user data:", error);
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
      console.error("❌ Error:", error);
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
    // Implement status update logic here
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateDaysDifference = (
    startDateString: string,
    endDateString: string
  ) => {
    const startDate = convertDate(startDateString);
    const endDate = convertDate(endDateString);

    if (!startDate || !endDate) {
      return 0;
    }

    // Calculate difference in milliseconds, then convert to days
    const timeDifference = endDate.getTime() - startDate.getTime();
    const daysDifference = Math.ceil(timeDifference / (1000 * 3600 * 24));

    // Add 1 to include both start and end dates in the count
    return daysDifference + 1;
  };

  const toggleCardExpansion = (requestId: string) => {
    setExpandedCard(expandedCard === requestId ? null : requestId);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <LottieActivityIndicator size={100} />
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="items-center justify-center"
          >
            <Image
              source={icons.leftArrow}
              className="w-8 h-8"
              tintColor="#6B7280"
            />
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-xl font-pbold text-gray-800">
              Rental Requests
            </Text>
          </View>
          <View className="w-8" />
        </View>

        {/* Item Details */}
        {itemDetails && (
          <View className="p-4 border-b border-gray-100">
            <View className="flex-row">
              <Image
                source={
                  itemDetails.images && itemDetails.images.length > 0
                    ? { uri: itemDetails.images[0] }
                    : require("@/assets/thumbnail.png")
                }
                className="w-16 h-16 rounded-lg"
              />
              <View className="ml-3 flex-1">
                <Text className="text-lg font-psemibold text-secondary-400">
                  {itemDetails.itemName}
                </Text>
                <Text className="text-sm font-pmedium text-primary mt-1">
                  ₱{itemDetails.itemPrice}/day
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Requests List */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="p-4">
            {requests.length === 0 ? (
              <View className="flex-1 justify-center items-center py-10">
                <Text className="text-secondary-300 font-pregular text-center">
                  No pending requests for this item
                </Text>
              </View>
            ) : (
              requests.map((request) => {
                const rentalDays = calculateDaysDifference(
                  request.startDate,
                  request.endDate
                );
                const isExpanded = expandedCard === request.id;

                return (
                  <TouchableOpacity
                    key={request.id}
                    onPress={() => toggleCardExpansion(request.id)}
                    className="bg-white rounded-xl border border-gray-200 p-4 mb-3 shadow-sm"
                    activeOpacity={0.7}
                  >
                    {/* Header with User Info and Total Price */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center flex-1">
                        <Image
                          source={
                            request.requesterData?.profileImage
                              ? { uri: request.requesterData.profileImage }
                              : icons.user
                          }
                          className="w-12 h-12 rounded-full"
                        />
                        <View className="ml-3 flex-1">
                          <Text className="font-psemibold text-secondary-400 text-base">
                            {request.requesterName || "Anonymous"}
                          </Text>
                          <Text className="text-xs font-pregular text-secondary-300">
                            {formatDateTime(request.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <View className="bg-green-100 px-3 py-1 rounded-full mb-1">
                          <Text className="text-sm font-pbold text-green-700">
                            ₱{request.totalPrice.toLocaleString()}
                          </Text>
                        </View>
                        <Text className="text-xs font-pregular text-gray-400">
                          Total
                        </Text>
                      </View>
                    </View>

                    {/* Compact Rental Summary */}
                    <View className="bg-gray-50 rounded-lg p-3 mb-3">
                      <View className="flex-row justify-between items-center">
                        <View className="flex-1">
                          <Text className="text-sm font-pmedium text-secondary-400">
                            {convertDate(request.startDate)
                              ? formatDate(convertDate(request.startDate)!)
                              : request.startDate || "Invalid date"}{" "}
                            -{" "}
                            {convertDate(request.endDate)
                              ? formatDate(convertDate(request.endDate)!)
                              : request.endDate || "Invalid date"}
                          </Text>
                          <Text className="text-xs font-pregular text-secondary-300 mt-1">
                            {rentalDays} {rentalDays === 1 ? "day" : "days"}{" "}
                            rental
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-sm font-pmedium text-secondary-400">
                            {minutesToTime(Number(request.pickupTime))}
                          </Text>
                          <Text className="text-xs font-pregular text-secondary-300">
                            Pickup
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="bg-yellow-100 px-3 py-1 rounded-full">
                        <Text className="text-sm font-psemibold text-yellow-700">
                          {request.status.charAt(0).toUpperCase() +
                            request.status.slice(1)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text className="text-xs font-pregular text-gray-400 mr-1">
                          {isExpanded ? "Less" : "More"} details
                        </Text>
                        <Image
                          source={icons.arrowDown}
                          className={`w-4 h-4 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                          tintColor="#9CA3AF"
                        />
                      </View>
                    </View>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <View className="border-t border-gray-100 pt-3">
                        {/* Detailed Rental Information */}
                        <View className="mb-3">
                          <Text className="text-xs font-psemibold text-secondary-300 mb-2">
                            RENTAL DETAILS
                          </Text>
                          <View className="bg-blue-50 rounded-lg p-3">
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm font-pregular text-secondary-400">
                                Start Date:
                              </Text>
                              <Text className="text-sm font-pmedium text-secondary-400">
                                {convertDate(request.startDate)
                                  ? formatDate(convertDate(request.startDate)!)
                                  : request.startDate || "Invalid date"}
                              </Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm font-pregular text-secondary-400">
                                End Date:
                              </Text>
                              <Text className="text-sm font-pmedium text-secondary-400">
                                {convertDate(request.endDate)
                                  ? formatDate(convertDate(request.endDate)!)
                                  : request.endDate || "Invalid date"}
                              </Text>
                            </View>
                            <View className="flex-row justify-between mb-2">
                              <Text className="text-sm font-pregular text-secondary-400">
                                Duration:
                              </Text>
                              <Text className="text-sm font-pmedium text-secondary-400">
                                {rentalDays} {rentalDays === 1 ? "day" : "days"}
                              </Text>
                            </View>
                            <View className="flex-row justify-between">
                              <Text className="text-sm font-pregular text-secondary-400">
                                Pickup Time:
                              </Text>
                              <Text className="text-sm font-pmedium text-secondary-400">
                                {minutesToTime(Number(request.pickupTime))}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Pricing Breakdown */}
                        <View className="mb-3">
                          <Text className="text-xs font-psemibold text-secondary-300 mb-2">
                            PRICING BREAKDOWN
                          </Text>
                          <View className="bg-green-50 rounded-lg p-3">
                            <View className="flex-row justify-between mb-1">
                              <Text className="text-sm font-pregular text-secondary-400">
                                Daily Rate:
                              </Text>
                              <Text className="text-sm font-pmedium text-secondary-400">
                                ₱{(request.totalPrice / rentalDays).toFixed(2)}
                              </Text>
                            </View>
                            <View className="flex-row justify-between mb-1">
                              <Text className="text-sm font-pregular text-secondary-400">
                                Duration:
                              </Text>
                              <Text className="text-sm font-pmedium text-secondary-400">
                                × {rentalDays}{" "}
                                {rentalDays === 1 ? "day" : "days"}
                              </Text>
                            </View>
                            <View className="border-t border-green-200 pt-1 mt-1">
                              <View className="flex-row justify-between">
                                <Text className="text-sm font-psemibold text-secondary-400">
                                  Total Amount:
                                </Text>
                                <Text className="text-sm font-pbold text-green-700">
                                  ₱{request.totalPrice.toLocaleString()}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Requester Information */}
                        <View className="mb-3">
                          <Text className="text-xs font-psemibold text-secondary-300 mb-2">
                            REQUESTER INFORMATION
                          </Text>
                          <View className="bg-gray-50 rounded-lg p-3">
                            <View className="flex-row items-center mb-2">
                              <Image
                                source={
                                  request.requesterData?.profileImage
                                    ? {
                                        uri: request.requesterData.profileImage,
                                      }
                                    : icons.user
                                }
                                className="w-8 h-8 rounded-full mr-3"
                              />
                              <View className="flex-1">
                                <Text className="text-sm font-pmedium text-secondary-400">
                                  {request.requesterData?.firstname || ""}{" "}
                                  {request.requesterData?.middlename || ""}{" "}
                                  {request.requesterData?.lastname || ""}
                                </Text>
                                <Text className="text-xs font-pregular text-secondary-300">
                                  {request.requesterData?.email ||
                                    "No email provided"}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Message */}
                        {request.message && (
                          <View className="mb-3">
                            <Text className="text-xs font-psemibold text-secondary-300 mb-2">
                              MESSAGE
                            </Text>
                            <View className="bg-blue-50 rounded-lg p-3">
                              <Text className="text-sm text-secondary-400 leading-5">
                                {request.message}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Action Buttons */}
                        <View className="flex-row gap-3 mt-2">
                          <TouchableOpacity
                            onPress={() =>
                              handleStatusUpdate(request.id, "approved")
                            }
                            className="flex-1 bg-primary py-3 rounded-lg"
                          >
                            <Text className="text-white font-psemibold text-center text-sm">
                              Approve Request
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              handleStatusUpdate(request.id, "rejected")
                            }
                            className="flex-1 bg-red-500 py-3 rounded-lg"
                          >
                            <Text className="text-white font-psemibold text-center text-sm">
                              Decline Request
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Collapsed View Action Hint */}
                    {!isExpanded && (
                      <View className="flex-row gap-2 mt-1">
                        <View className="flex-1 bg-gray-100 py-2 rounded-lg">
                          <Text className="text-gray-600 font-pmedium text-center text-xs">
                            Tap to view details and respond
                          </Text>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default ViewRequests;
