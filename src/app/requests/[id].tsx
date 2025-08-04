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

// First, update the RentRequestData interface to properly type the Timestamp
interface RentRequestData {
  createdAt: any; // Firestore Timestamp
  itemId: string;
  itemName: string;
  ownerId: string;
  price: number;
  requesterId: string;
  status: string;
  pickUpDate: Timestamp; // Change this to explicitly be Firestore Timestamp
  daysRent?: number;
}

interface UserData {
  email: string;
  firstname: string;
  lastname: string;
  middlename?: string;
  profileImage?: string;
}

interface RequestType {
  id: string;
  createdAt: Date;
  itemId: string;
  itemName: string;
  ownerId: string;
  price: number;
  requesterId: string;
  status: string;
  pickUpDate?: Date;
  daysRent?: number;
  requesterData?: UserData;
  priceSubtotal?: number;
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

  useEffect(() => {
    fetchItemAndRequests();
  }, [id]);

  const fetchItemAndRequests = async () => {
    try {
      setIsLoading(true);
      console.log("🔍 Fetching requests for item:", id);

      // 1. Fetch rent requests for this item
      const requestsRef = collection(db, "rentRequests");
      const q = query(
        requestsRef,
        where("itemId", "==", id),
        where("status", "==", "pending")
      );

      const querySnapshot = await getDocs(q);
      console.log(`📋 Found ${querySnapshot.size} requests`);

      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log("Raw pickUpDate:", {
          exists: !!data.pickUpDate,
          type: data.pickUpDate?.constructor.name,
          value: data.pickUpDate,
          jsDate: data.pickUpDate?.toDate(),
        });
      });

      // 2. Process each request and fetch user data
      const requestsData = await Promise.all(
        querySnapshot.docs.map(async (document) => {
          const data = document.data() as RentRequestData;
          console.log("📄 Processing request:", document.id, data);

          // Fetch requester data using requesterId
          let requesterData: UserData | undefined;
          try {
            const userDoc = await getDoc(doc(db, "users", data.requesterId));
            if (userDoc.exists()) {
              const userData = userDoc.data() as UserData;
              requesterData = {
                email: userData.email,
                firstname: userData.firstname,
                lastname: userData.lastname,
                middlename: userData.middlename,
                profileImage: userData.profileImage,
              };
              console.log("👤 Found user data for:", data.requesterId);
            }
          } catch (error) {
            console.log("❌ Error fetching user data:", error);
          }

          // Calculate subtotal if we have both price and daysRent
          const priceSubtotal = data.daysRent
            ? data.price * data.daysRent
            : undefined;

          // Return combined data
          return {
            id: document.id,
            ...data,
            requesterData,
            priceSubtotal,
            // Convert Timestamp to Date if it exists
            pickUpDate: data.pickUpDate ? data.pickUpDate.toDate() : undefined,
            createdAt: data.createdAt?.toDate() || new Date(),
          };
        })
      );

      console.log("✅ Processed all requests:", requestsData.length);

      // Sort by creation date, newest first
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
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => router.back()}>
            <Image source={icons.leftArrow} className="w-6 h-6" />
          </TouchableOpacity>
          <Text className="text-xl font-psemibold ml-4">Rental Requests</Text>
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
              requests.map((request) => (
                <View
                  key={request.id}
                  className="bg-white rounded-xl border border-gray-100 p-4 mb-3"
                >
                  {/* User Info */}
                  <View className="flex-row items-center">
                    <Image
                      source={
                        request.requesterData?.profileImage
                          ? { uri: request.requesterData.profileImage }
                          : icons.user
                      }
                      className="w-10 h-10 rounded-full"
                    />
                    <View className="ml-3 flex-1">
                      <Text className="font-psemibold text-secondary-400">
                        {request.requesterData
                          ? `${request.requesterData.firstname} ${request.requesterData.lastname}`
                          : "Anonymous"}
                      </Text>
                      <Text className="text-xs font-pregular text-secondary-300">
                        {request.requesterData?.email || "No email provided"}
                      </Text>
                    </View>
                    <View className="bg-yellow-100 px-2 py-1 rounded-full">
                      <Text className="text-xs font-psemibold text-yellow-700">
                        {request.status}
                      </Text>
                    </View>
                  </View>

                  {/* Rental Details - Show if available */}
                  <View className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-sm font-pregular text-secondary-300">
                        Item Price
                      </Text>
                      <Text className="text-sm font-pmedium text-secondary-400">
                        ₱{request.price.toLocaleString()}/day
                      </Text>
                    </View>

                    {/* Only show if daysRent exists and is greater than 0 */}
                    {(request.daysRent ?? 0) > 0 && (
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-sm font-pregular text-secondary-300">
                          Rental Duration
                        </Text>
                        <Text className="text-sm font-pmedium text-secondary-400">
                          {request.daysRent ?? 0} day
                          {(request.daysRent ?? 0) > 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}

                    {/* Only show if pickUpDate exists */}
                    {request.pickUpDate && (
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-sm font-pregular text-secondary-300">
                          Pick-up Date
                        </Text>
                        <Text className="text-sm font-pmedium text-secondary-400">
                          {request.pickUpDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    )}

                    {/* Calculate and show subtotal if we have price and daysRent */}
                    {request.price && (request.daysRent ?? 0) > 0 && (
                      <View className="flex-row justify-between">
                        <Text className="text-sm font-pregular text-secondary-300">
                          Subtotal
                        </Text>
                        <Text className="text-sm font-psemibold text-primary">
                          ₱
                          {(
                            request.price * (request.daysRent ?? 1)
                          ).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() => handleStatusUpdate(request.id, "approved")}
                      className="flex-1 bg-primary py-2 rounded-lg"
                    >
                      <Text className="text-white font-psemibold text-center">
                        Approve
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleStatusUpdate(request.id, "rejected")}
                      className="flex-1 bg-red-500 py-2 rounded-lg"
                    >
                      <Text className="text-white font-psemibold text-center">
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default ViewRequests;
