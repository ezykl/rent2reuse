import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert, // Add this
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { router } from "expo-router";
import { icons, images } from "../../constant";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import { checkAndUpdateLimits } from "@/utils/planLimits";
import thumbnail from "@/constant/images";
import useProfileCompletion from "@/hooks/useProfileCompletion";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  orderBy,
  serverTimestamp,
  addDoc,
  onSnapshot,
  QuerySnapshot, // Add this
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUserLimits } from "@/hooks/useUserLimits";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import ListingCard from "@/components/ListingCard";
import { ref, deleteObject, listAll } from "firebase/storage";
import RequestedItemCard from "@/components/RequestedItemCard";
import SentRequestCard from "@/components/SentRequestCard";
import { useLoader } from "@/context/LoaderContext";

interface UserPlan {
  listLimit: number;
  listUsed: number;
  rentLimit: number;
  rentUsed: number;
  planType: string;
  status: string;
}

const Tools = () => {
  const insets = useSafeAreaInsets();
  const { canList, listUsed, listLimit, updateListUsage, fetchUserLimits } =
    useUserLimits();

  const { completionPercentage } = useProfileCompletion();
  const [activeTab, setActiveTab] = useState("listings");
  const [myListings, setMyListings] = useState<ListingItemType[]>([]);
  const [rentedTools, setRentedTools] = useState<RentedItem[]>([]);
  const [rentRequests, setRentRequests] = useState<RequestItem[]>([]);
  const { isLoading: loaderIsLoading, setIsLoading: setLoaderIsLoading } =
    useLoader();
  const [isLoading, setIsLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<UserPlan>({
    listLimit: 0,
    listUsed: 0,
    rentLimit: 0,
    rentUsed: 0,
    planType: "",
    status: "",
  });
  const [refreshing, setRefreshing] = useState(false); // Add this
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isDataReady, setIsDataReady] = useState(false);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false); // Add this
  // Add a state for incoming requests count
  const [incomingRequestsCount, setIncomingRequestsCount] = useState(0);

  // Add these states for real-time listeners
  const [incomingRequestsListener, setIncomingRequestsListener] = useState<
    () => void
  >(() => {});
  const [outgoingRequestsListener, setOutgoingRequestsListener] = useState<
    () => void
  >(() => {});

  const params = useLocalSearchParams();
  useEffect(() => {
    if (params.tab && typeof params.tab === "string") {
      setActiveTab(params.tab);
    }
  }, [params.tab]);

  const handleEditRequest = async (requestId: string) => {
    try {
      setLoaderIsLoading(true);

      // Fetch the request data
      const requestDoc = await getDoc(doc(db, "rentRequests", requestId));
      if (!requestDoc.exists()) {
        throw new Error("Request not found");
      }

      const requestData = requestDoc.data();

      // Navigate to edit form with existing data
      router.push({
        pathname: `/edit-request/${requestId}`,
        params: {
          itemId: requestData.itemId,
          startDate: requestData.startDate.toDate().toISOString(),
          endDate: requestData.endDate.toDate().toISOString(),
          pickupTime: requestData.pickupTime,
          message: requestData.message,
          totalPrice: requestData.totalPrice,
        },
      });
    } catch (error) {
      console.error("Error editing request:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to edit request",
      });
    } finally {
      setLoaderIsLoading(false);
    }
  };

  // Move the updates out of the render cycle
  const handleRequestUpdates = useCallback((snapshot: QuerySnapshot) => {
    const newCount = snapshot.docs.length;
    setIncomingRequestsCount(newCount);
  }, []);

  const UsageLimitBox = ({
    used,
    limit,
    label,
    color,
  }: {
    used: number;
    limit: number;
    label: string;
    color: string;
  }) => {
    const percentage = Math.round((used / limit) * 100) || 0;

    return (
      <View className="items-center">
        <View
          className="w-16 h-16 justify-center items-center rounded-full border-[3px]"
          style={{ borderColor: color }}
        >
          <Text className="text-lg font-pbold" style={{ color }}>
            {percentage}
          </Text>
          <Text className="text-[10px] font-pmedium text-gray-500">%</Text>
        </View>
        <Text className="text-xs text-gray-600 font-pmedium mt-1">{label}</Text>
        <Text className="text-xs text-gray-400">
          {used}/{limit}
        </Text>
      </View>
    );
  };

  // This function would fetch data from Firestore once integrated
  const fetchUserListings = async () => {
    if (!auth.currentUser) {
      console.log("🔍 Debug: No authenticated user found");
      return;
    }

    setIsLoading(true);
    try {
      console.log("📱 Debug: Starting to fetch user listings...");
      const itemsRef = collection(db, "items");
      const q = query(itemsRef, where("owner.id", "==", auth.currentUser.uid));

      const querySnapshot = await getDocs(q);
      let totalIncomingRequests = 0;

      const listings = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const data = doc.data();
          console.log(`\n🔎 Debug: Processing listing ${doc.id}:`);

          // Get total pending requests
          const requestsRef = collection(db, "rentRequests");
          const requestsQuery = query(
            requestsRef,
            where("itemId", "==", doc.id),
            where("status", "in", ["pending", "approved"])
            //find me later    where("status", "!=", "accepted")
          );
          const requestsSnap = await getDocs(requestsQuery);
          totalIncomingRequests += requestsSnap.size;

          // Get unread notifications count for this item
          const notificationsRef = collection(
            db,
            `users/${auth.currentUser?.uid}/notifications`
          );
          const unreadQuery = query(
            notificationsRef,
            where("type", "==", "RENT_REQUEST"),
            where("data.itemId", "==", doc.id),
            where("isRead", "==", false)
          );
          const unreadSnap = await getDocs(unreadQuery);
          const newRequestCount = unreadSnap.size;

          console.log(
            `📊 Debug: Item ${doc.id} has ${newRequestCount} unread requests`
          );

          const listingData = {
            id: doc.id,
            itemName: data.itemName || "",
            itemDesc: data.itemDesc || "",
            itemPrice: data.itemPrice || 0,
            itemStatus: data.itemStatus || "Available",
            images: data.images || [],
            createdAt: data.createdAt?.toDate().toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            requestCount: requestsSnap.size,
            newRequestCount: newRequestCount, // Add the unread notifications count
            renterInfo: data.renterInfo || null,
          };

          console.log("📦 Debug: Final listing data:", {
            id: listingData.id,
            name: listingData.itemName,
            requestCount: listingData.requestCount,
            newRequestCount: listingData.newRequestCount,
          });

          return listingData;
        })
      );

      setIncomingRequestsCount(totalIncomingRequests);
      setMyListings(listings);
    } catch (error) {
      console.error("❌ Error fetching listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPlan = async () => {
    if (!auth.currentUser) return;

    setIsPlanLoading(true);
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists() && userDoc.data().currentPlan) {
        const planData = userDoc.data().currentPlan;
        console.log("Fetched updated plan data:", {
          listUsed: planData.listUsed,
          listLimit: planData.listLimit,
        });
        setUserPlan(planData);
      }
    } catch (error) {
      console.error("Error fetching user plan:", error);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const fetchSentRequests = async () => {
    if (!auth.currentUser) return;

    try {
      setIsRequestsLoading(true);
      console.log("Fetching sent requests for user:", auth.currentUser.uid);

      const requestsQuery = query(
        collection(db, "rentRequests"),
        where("requesterId", "==", auth.currentUser.uid)
      );

      const querySnapshot = await getDocs(requestsQuery);
      console.log("Found requests:", querySnapshot.size);

      const requests = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        console.log("Request data:", data);

        return {
          id: doc.id,
          itemId: data.itemId,
          itemName: data.itemName,
          itemImage: data.itemImage,
          ownerName: data.ownerName,
          status: data.status,
          startDate: data.startDate,
          endDate: data.endDate,
          pickupTime: data.pickupTime,
          totalPrice: data.totalPrice,
          createdAt: data.createdAt?.toDate(),
          type: "outgoing",
          chatId: data.chatId,
        };
      });

      console.log("Processed requests:", requests);
      setRentRequests((prev) => [...requests]);
    } catch (error) {
      console.error("Error fetching sent requests:", error);
    } finally {
      setIsRequestsLoading(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      setIsDataReady(false);
      await Promise.all([
        fetchUserPlan(),
        fetchUserListings(),
        fetchSentRequests(), // Add this
      ]);
      setIsDataReady(true);
    };

    initializeData();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setIsDataReady(false);

    const fetchAllData = async () => {
      try {
        await Promise.all([
          fetchUserPlan(),
          fetchUserListings(),
          fetchSentRequests(), // Add this
        ]);
      } catch (error) {
        console.error("Error refreshing data:", error);
      } finally {
        setRefreshing(false);
        setIsDataReady(true);
      }
    };

    fetchAllData();
  }, []);

  const handleAddListing = () => {
    if (completionPercentage < 100) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Complete Your Profile",
        textBody: `Your profile is ${completionPercentage}% complete. Please complete your profile before listing items.`,
      });
      router.push("/profile");
      return;
    }

    if (!canList) {
      Toast.show({
        type: ALERT_TYPE.INFO,
        title: "Listing Limit Reached",
        textBody: "Please upgrade your plan to add more items.",
      });
      return;
    }

    router.push("/add-listing");
  };

  const handleEditListing = (id: string) => {
    router.push(`/edit-listing/${id}`);
  };

  const handleDeleteListing = async (id: string) => {
    Alert.alert(
      "Delete Listing",
      "Are you sure you want to delete this listing? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              console.log("Starting deletion process...");
              console.log("Current list usage:", userPlan.listUsed);

              // 1. Delete images from storage
              const storageRef = ref(storage, `items/${id}`);
              try {
                const imagesList = await listAll(storageRef);
                await Promise.all(
                  imagesList.items.map((imageRef) => deleteObject(imageRef))
                );
                console.log("Images deleted successfully");
              } catch (error) {
                console.log("No images found or error deleting images:", error);
              }

              // 2. Delete the document from Firestore
              await deleteDoc(doc(db, "items", id));
              console.log("Item document deleted successfully");

              // 3. Update the user's plan usage directly in Firestore
              if (auth.currentUser) {
                const userRef = doc(db, "users", auth.currentUser.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                  const currentPlan = userDoc.data().currentPlan;
                  const newListUsed = Math.max(0, currentPlan.listUsed - 1);

                  console.log("Updating list usage:", {
                    current: currentPlan.listUsed,
                    new: newListUsed,
                  });

                  await updateDoc(userRef, {
                    "currentPlan.listUsed": newListUsed,
                    "currentPlan.updatedAt": new Date(),
                  });

                  // 4. Refresh user plan data
                  await fetchUserPlan();
                  console.log("Plan usage updated successfully");

                  // 5. Update local state
                  setMyListings((prev) =>
                    prev.filter((item) => item.id !== id)
                  );

                  Toast.show({
                    type: ALERT_TYPE.SUCCESS,
                    title: "Success",
                    textBody: "Listing deleted successfully",
                  });
                }
              }
            } catch (error) {
              console.error("Error in deletion process:", error);
              Toast.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: "Failed to delete listing",
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelRequest = async (requestId: string) => {
    Alert.alert(
      "Cancel Request",
      "Are you sure you want to cancel this request?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          style: "destructive",
          onPress: async () => {
            try {
              setLoaderIsLoading(true);

              // Get the request data first to find associated chat
              const requestRef = doc(db, "rentRequests", requestId);
              const requestSnap = await getDoc(requestRef);

              if (requestSnap.exists()) {
                const requestData = requestSnap.data();
                const chatId = requestData.chatId; // Assuming chatId is stored in request

                if (chatId) {
                  // Check if chat exists first
                  const chatRef = doc(db, "chat", chatId);
                  const chatDoc = await getDoc(chatRef);

                  if (chatDoc.exists()) {
                    // Chat exists, proceed with updates
                    await updateDoc(chatRef, {
                      status: "cancelled",
                      lastMessage: "Request cancelled by requester",
                      lastMessageTime: serverTimestamp(),
                    });

                    // Add status update message
                    await addDoc(collection(db, "chat", chatId, "messages"), {
                      type: "statusUpdate",
                      text: "Request cancelled by requester",
                      senderId: auth.currentUser?.uid,
                      createdAt: serverTimestamp(),
                      read: false,
                      status: "cancelled",
                    });

                    // Update rent request message in chat
                    const messagesRef = collection(
                      db,
                      "chat",
                      chatId,
                      "messages"
                    );
                    const q = query(
                      messagesRef,
                      where("rentRequestId", "==", requestId),
                      where("type", "==", "rentRequest")
                    );

                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                      const rentRequestMessage = querySnapshot.docs[0];
                      await updateDoc(rentRequestMessage.ref, {
                        status: "cancelled",
                        updatedAt: serverTimestamp(),
                      });
                    }
                  } else {
                    console.log(
                      "Chat document does not exist, skipping chat updates"
                    );
                  }
                }

                // Delete the request
                await deleteDoc(requestRef);

                // Update user's rentUsed count
                if (auth.currentUser) {
                  const userRef = doc(db, "users", auth.currentUser.uid);
                  const userDoc = await getDoc(userRef);

                  if (userDoc.exists()) {
                    const currentPlan = userDoc.data().currentPlan;
                    const newRentUsed = Math.max(0, currentPlan.rentUsed - 1);

                    await updateDoc(userRef, {
                      "currentPlan.rentUsed": newRentUsed,
                      "currentPlan.updatedAt": new Date(),
                    });

                    await fetchUserPlan();
                  }
                }

                Toast.show({
                  type: ALERT_TYPE.SUCCESS,
                  title: "Success",
                  textBody: "Request cancelled successfully",
                });

                // Refresh the requests list
                fetchSentRequests();
              }
            } catch (error) {
              console.error("Error cancelling request:", error);
              Toast.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: "Failed to cancel request",
              });
            }
            setLoaderIsLoading(false);
          },
        },
      ]
    );
  };

  interface ListingItem {
    id: string;
    [key: string]: any; // For other potential properties
  }

  interface RentedItem {
    id: string;
    title: string;
    description: string;
    thumbnails: any[];
    owner: string;
    rentedUntil: string;
    [key: string]: any; // For other potential properties
  }

  interface RequestItem {
    id: string;
    [key: string]: any; // For other potential properties
  }

  type ItemType = "listing" | "rented" | "request";

  const handleItemPress = (
    item: ListingItem | RentedItem | RequestItem,
    type: ItemType
  ): void => {
    if (type === "listing") {
      router.push(`/items/${item.id}`);
    } else if (type === "rented") {
      router.push(`/rented-detail/${item.id}`);
    } else if (type === "request") {
      router.push(`/request-detail/${item.id}`);
    }
  };

  const renderTab = (tabName: string, label: string) => (
    <TouchableOpacity
      onPress={() => setActiveTab(tabName)}
      className={`flex-1 py-3 ${
        activeTab === tabName ? "border-b-2 border-primary" : ""
      }`}
    >
      <Text
        className={`text-center ${
          activeTab === tabName
            ? "text-primary font-psemibold"
            : "text-secondary-300 font-pregular"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  interface ListingItemType {
    id: string;
    itemName: string;
    itemDesc: string;
    itemPrice: number;
    itemStatus: string;
    images?: string[];
    createdAt?: string;
    [key: string]: any;
  }

  const ProgressBar = ({
    used,
    limit,
    label,
  }: {
    used: number;
    limit: number;
    label: string;
  }) => {
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

    // Function to determine color based on percentage (5-stage gradient)
    const getProgressColor = (percentage: number) => {
      if (percentage <= 20) {
        return "#4BD07F"; // Green (primary color) - Very safe
      } else if (percentage <= 40) {
        return "#7ED321"; // Light green - Safe
      } else if (percentage <= 60) {
        return "#F5A623"; // Yellow/Amber - Moderate
      } else if (percentage <= 80) {
        return "#FF8C00"; // Orange - Warning
      } else {
        return "#FB2C36"; // Red - Danger/Full
      }
    };

    const progressColor = getProgressColor(percentage);

    return (
      <View>
        <View className="flex-row justify-between  items-center mb-1">
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          <Text className="text-sm text-gray-500">
            {used}/{limit}
          </Text>
        </View>
        <View className="w-full h-2 bg-gray-200 rounded-full mb-1">
          <View
            className="h-2 rounded-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: progressColor,
            }}
          />
        </View>
      </View>
    );
  };

  const ListingItem = ({ item }: { item: ListingItemType }) => {
    return (
      <TouchableOpacity
        className="w-[48%] bg-white rounded-xl mb-3 shadow-md" // Fixed width using percentage
        onPress={() => handleItemPress(item, "listing")}
      >
        <Image
          source={
            item.images && item.images.length > 0
              ? { uri: item.images[0] }
              : require("../../assets/thumbnail.png")
          }
          className="w-full h-32 rounded-t-xl"
        />
        <View className="p-3 h-[120px] justify-between">
          <View>
            <Text
              numberOfLines={1}
              className="text-lg font-psemibold text-secondary-400"
            >
              {item.itemName}
            </Text>
            <Text
              numberOfLines={2}
              className="text-sm font-pregular text-secondary-300 mt-1"
            >
              {item.itemDesc}
            </Text>
          </View>
          <View>
            <Text className="text-sm font-psemibold text-primary">
              ₱{item.itemPrice}/day
            </Text>
            <Text
              numberOfLines={1}
              className="text-xs font-pregular text-secondary-300"
            >
              {item.itemStatus}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const RentedItem = ({ item }: { item: RentedItem }) => (
    <TouchableOpacity
      className="w-[100%] bg-white rounded-xl shadow-md mb-4"
      onPress={() => handleItemPress(item, "rented")}
    >
      <View className="border border-secondary-200 rounded-xl overflow-hidden">
        <Image
          source={item.thumbnails}
          className="w-full h-36"
          resizeMode="cover"
          defaultSource={icons.location}
        />
        <View className="p-3">
          <Text className="text-lg font-psemibold text-secondary-400">
            {item.title}
          </Text>
          <Text className="text-sm font-pregular text-secondary-300">
            {item.description}
          </Text>
          <View className="flex-row justify-between mt-2">
            <Text className="text-sm font-pregular text-secondary-300">
              Owner: {item.owner}
            </Text>
            <Text className="text-sm font-psemibold text-primary">
              Until {item.rentedUntil}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const RequestItem = ({ item }: { item: RequestItem }) => (
    <TouchableOpacity
      className="mb-3 p-4 border border-secondary-200 rounded-xl"
      onPress={() => handleItemPress(item, "request")}
    >
      <View className="flex-row justify-between">
        <Text className="font-psemibold text-secondary-400">{item.title}</Text>
        <View
          className={`px-2 py-1 rounded-full ${
            item.status === "Pending"
              ? "bg-yellow-100"
              : item.status === "Approved"
              ? "bg-green-100"
              : "bg-red-100"
          }`}
        >
          <Text
            className={`text-xs font-psemibold ${
              item.status === "Pending"
                ? "text-yellow-700"
                : item.status === "Approved"
                ? "text-green-700"
                : "text-red-500"
            }`}
          >
            {item.status}
          </Text>
        </View>
      </View>
      <Text className="font-pregular text-secondary-300 mt-1">
        From: {item.requestor}
      </Text>
      <Text className="font-pregular text-secondary-300">
        Dates: {item.dateRange}
      </Text>
    </TouchableOpacity>
  );

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listener for incoming requests
    const incomingQuery = query(
      collection(db, "rentRequests"),
      where("ownerId", "==", auth.currentUser.uid),
      where("status", "in", ["pending", "accepted"])
    );

    const unsubscribeIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const updates = snapshot.docChanges();

      // Batch updates instead of updating in the loop
      let shouldRefreshListings = false;

      updates.forEach((change) => {
        if (change.type === "added") {
          // Toast.show({
          //   type: ALERT_TYPE.INFO,
          //   title: "New Rental Request",
          //   textBody: "You have received a new rental request",
          // });
          shouldRefreshListings = true;
        }
        if (change.type === "modified") {
          shouldRefreshListings = true;
        }
      });

      // Update count outside the loop
      handleRequestUpdates(snapshot);

      // Refresh listings if needed
      if (shouldRefreshListings) {
        fetchUserListings();
      }
    });

    // Listener for outgoing requests
    const outgoingQuery = query(
      collection(db, "rentRequests"),
      where("requesterId", "==", auth.currentUser.uid),
      where("status", "in", ["pending", "accepted", "rejected", "cancelled"])
    );

    const unsubscribeOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      const updates = snapshot.docChanges();
      let shouldRefreshRequests = false;

      updates.forEach((change) => {
        if (change.type === "modified") {
          const data = change.doc.data();
          if (data.status !== "pending") {
            Toast.show({
              type: ALERT_TYPE.INFO,
              title: "Request Update",
              textBody: `Your rental request has been ${data.status}`,
            });
            shouldRefreshRequests = true;
          }
        }
      });

      // Refresh requests outside the loop
      if (shouldRefreshRequests) {
        fetchSentRequests();
      }
    });

    setIncomingRequestsListener(() => unsubscribeIncoming);
    setOutgoingRequestsListener(() => unsubscribeOutgoing);

    return () => {
      unsubscribeIncoming();
      unsubscribeOutgoing();
    };
  }, [auth.currentUser, handleRequestUpdates]);

  // Add this cleanup in the existing cleanup logic or component unmount
  useEffect(() => {
    return () => {
      if (incomingRequestsListener) incomingRequestsListener();
      if (outgoingRequestsListener) outgoingRequestsListener();
    };
  }, [incomingRequestsListener, outgoingRequestsListener]);

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top }}
    >
      {!isDataReady ? (
        <View className="flex-1 justify-center items-center">
          <LottieActivityIndicator size={100} color="#5C6EF6" />
          <Text className="text-secondary-300 font-pmedium mt-4">
            Loading your data...
          </Text>
        </View>
      ) : (
        <View className="flex-1 px-4">
          <Header />
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#4BD07F"]} // Use your primary color
                tintColor="#56D07F"
              />
            }
          >
            <View>
              <View className="bg-white rounded-2xl ">
                {/* Headers */}
                <View className="flex-row justify-between items-center mb-2 px-4">
                  <View className="flex-1 items-center">
                    <Text className="text-base text-gray-600 font-psemibold text-center">
                      Items
                    </Text>
                  </View>
                  <View className="flex-1 items-center">
                    <Text className="text-base text-gray-600 font-psemibold text-center">
                      Request
                    </Text>
                  </View>
                </View>

                {/* Enhanced Tab Buttons */}
                <View className="flex-row justify-between items-center gap-2 pb-4">
                  {/* My Listed Tools */}
                  <TouchableOpacity
                    className={`flex-1 p-3 rounded-xl border-2 ${
                      activeTab === "listings"
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                    onPress={() => setActiveTab("listings")}
                    activeOpacity={0.8}
                  >
                    <View className="items-center">
                      <View
                        className={`w-12 h-12 rounded-2xl items-center justify-center mb-2 ${
                          activeTab === "listings"
                            ? "bg-blue-500"
                            : "bg-blue-50"
                        }`}
                      >
                        <Image
                          source={icons.shop}
                          className="w-6 h-6"
                          tintColor={
                            activeTab === "listings" ? "#FFFFFF" : "#3b82f6"
                          }
                        />
                      </View>
                      <Text
                        className={`text-[10px] font-medium mb-1 ${
                          activeTab === "listings"
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        Owned
                      </Text>
                      <View
                        className={`min-w-[24px] h-6 rounded-full items-center justify-center px-2 ${
                          activeTab === "listings"
                            ? "bg-blue-500"
                            : "bg-gray-300"
                        }`}
                      >
                        <Text
                          className={`text-sm font-pbold ${
                            activeTab === "listings"
                              ? "text-white"
                              : "text-gray-600"
                          }`}
                        >
                          {myListings.length}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Borrowed Tools */}
                  <TouchableOpacity
                    className={`flex-1 p-3 rounded-xl border-2 ${
                      activeTab === "rented"
                        ? "border-green-400 bg-green-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                    onPress={() => setActiveTab("rented")}
                    activeOpacity={0.8}
                  >
                    <View className="items-center">
                      <View
                        className={`w-12 h-12 rounded-2xl items-center justify-center mb-2 ${
                          activeTab === "rented"
                            ? "bg-green-500"
                            : "bg-green-50"
                        }`}
                      >
                        <Image
                          source={icons.boxLine}
                          className="w-6 h-6"
                          tintColor={
                            activeTab === "rented" ? "#FFFFFF" : "#22c55e"
                          }
                        />
                      </View>
                      <Text
                        className={`text-[10px] font-medium mb-1 ${
                          activeTab === "rented"
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        Rented
                      </Text>
                      <View
                        className={`min-w-[24px] h-6 rounded-full items-center justify-center px-2 ${
                          activeTab === "rented"
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      >
                        <Text
                          className={`text-sm font-pbold ${
                            activeTab === "rented"
                              ? "text-white"
                              : "text-gray-600"
                          }`}
                        >
                          {rentedTools.length}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Incoming Requests */}
                  <TouchableOpacity
                    className={`flex-1 p-3 rounded-xl border-2 relative ${
                      activeTab === "incoming"
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                    onPress={() => setActiveTab("incoming")}
                    activeOpacity={0.8}
                  >
                    <View className="items-center">
                      <View
                        className={`w-12 h-12 rounded-2xl items-center justify-center mb-2 ${
                          activeTab === "incoming"
                            ? "bg-orange-500"
                            : "bg-orange-50"
                        }`}
                      >
                        {/* Add notification dot here */}
                        {/* {myListings.some(
                          (item) => item.newRequestCount > 0
                        ) && (
                          <View
                            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 z-10"
                            style={{
                              elevation: 2,
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.2,
                              shadowRadius: 1,
                            }}
                          />
                        )} */}

                        <Image
                          source={icons.envelope}
                          className="w-6 h-6"
                          tintColor={
                            activeTab === "incoming" ? "#FFFFFF" : "#f97316"
                          }
                        />
                      </View>
                      <Text
                        className={`text-[10px] font-medium mb-1 ${
                          activeTab === "incoming"
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        Received
                      </Text>
                      <View
                        className={`min-w-[24px] h-6 rounded-full items-center justify-center px-2 ${
                          activeTab === "incoming"
                            ? "bg-orange-500"
                            : "bg-gray-300"
                        }`}
                      >
                        <Text
                          className={`text-sm font-pbold ${
                            activeTab === "incoming"
                              ? "text-white"
                              : "text-gray-600"
                          }`}
                        >
                          {incomingRequestsCount}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Sent Requests */}
                  <TouchableOpacity
                    className={`flex-1 p-3 rounded-xl border-2 ${
                      activeTab === "outgoing"
                        ? "border-red-400 bg-red-50"
                        : "border-gray-100 bg-gray-50"
                    }`}
                    onPress={() => setActiveTab("outgoing")}
                    activeOpacity={0.8}
                  >
                    <View className="items-center">
                      <View
                        className={`w-12 h-12 rounded-2xl items-center justify-center mb-2 ${
                          activeTab === "outgoing" ? "bg-red-500" : "bg-red-50"
                        }`}
                      >
                        <Image
                          source={icons.plane}
                          className="w-6 h-6"
                          tintColor={
                            activeTab === "outgoing" ? "#FFFFFF" : "#ef4444"
                          }
                        />
                      </View>
                      <Text
                        className={`text-[10px] font-medium mb-1 ${
                          activeTab === "outgoing"
                            ? "text-gray-700"
                            : "text-gray-400"
                        }`}
                      >
                        Sent
                      </Text>
                      <View
                        className={`min-w-[24px] h-6 rounded-full items-center justify-center px-2 ${
                          activeTab === "outgoing"
                            ? "bg-red-500"
                            : "bg-gray-300"
                        }`}
                      >
                        <Text
                          className={`text-sm font-pbold ${
                            activeTab === "outgoing"
                              ? "text-white"
                              : "text-gray-600"
                          }`}
                        >
                          {
                            rentRequests.filter(
                              (req) => req.type === "outgoing"
                            ).length
                          }
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Usage Progress */}
              <View className="p-4 rounded-2xl mb-4 border-2 border-gray-100 bg-gray-50 shadow-sm">
                {isPlanLoading ? (
                  <ActivityIndicator size="small" color="#5C6EF6" />
                ) : (
                  <>
                    <ProgressBar
                      used={userPlan.listUsed}
                      limit={userPlan.listLimit}
                      label="Listings Usage"
                    />
                    <ProgressBar
                      used={userPlan.rentUsed}
                      limit={userPlan.rentLimit}
                      label="Rentals Usage"
                    />
                  </>
                )}
              </View>

              {/* Conditional Content Based on Active Tab */}
              {activeTab === "listings" && (
                <View className="bg-white rounded-2xl ">
                  <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-lg font-pbold text-gray-800">
                      My Listed Tools
                    </Text>
                    {myListings.length !== 0 && (
                      <View className="flex-row items-center gap-2 justify-center">
                        <TouchableOpacity
                          onPress={handleAddListing}
                          className="bg-primary p-2  flex-row rounded-lg justify-center items-center gap-2"
                          activeOpacity={0.8}
                          style={{
                            elevation: 3,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 2,
                          }}
                        >
                          <Image
                            source={icons.plus}
                            className="w-5 h-5"
                            tintColor="white"
                            resizeMode="cover"
                          />
                          <Text className="text-white font-psemibold">
                            Add Listing
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {isLoading ? (
                    <ActivityIndicator size="large" color="#5C6EF6" />
                  ) : myListings.length === 0 ? (
                    <View className="py-10 items-center">
                      <View className=" items-center">
                        <Image
                          source={icons.emptyBox}
                          className="w-16 h-16 mb-4"
                          tintColor="#9CA3AF"
                        />
                        <Text className="text-gray-500">No listing yet</Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleAddListing}
                        className="mt-10 bg-primary px-6 py-3 rounded-lg"
                      >
                        <Text className="text-white font-psemibold">
                          Create First Listing
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      {myListings.map((item) => (
                        <ListingCard
                          key={item.id}
                          item={{
                            ...item,
                            requestCount: item.requestCount ?? 0,
                          }}
                          onEdit={handleEditListing}
                          onDelete={handleDeleteListing}
                          onPress={() => handleItemPress(item, "listing")}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {activeTab === "rented" && (
                <View className="bg-white rounded-2xl">
                  <Text className="text-lg font-pbold text-gray-800 mb-4">
                    Currently Borrowed Tools
                  </Text>
                  {rentedTools.length === 0 ? (
                    <View className="py-10 items-center">
                      <Image
                        source={icons.emptyBox}
                        className="w-16 h-16 mb-4"
                        tintColor="#9CA3AF"
                      />
                      <Text className="text-gray-500">No rented tools yet</Text>
                    </View>
                  ) : (
                    <View className="gap-4">
                      {rentedTools.map((item) => (
                        <RentedItem key={item.id} item={item} />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {activeTab === "incoming" && (
                <View className="bg-white rounded-2xl ">
                  <Text className="text-lg font-pbold text-gray-800 mb-4">
                    Tools with Rental Requests
                  </Text>

                  {myListings.filter((item) => item.requestCount > 0).length ===
                  0 ? (
                    <View className="py-10 items-center">
                      <Image
                        source={icons.emptyBox}
                        className="w-16 h-16 mb-4"
                        tintColor="#9CA3AF"
                      />
                      <Text className="text-gray-500">
                        No tools with rental request yet
                      </Text>
                    </View>
                  ) : (
                    myListings
                      .filter((item) => item.requestCount > 0)
                      .map((item) => (
                        <RequestedItemCard
                          key={item.id}
                          item={{
                            ...item,
                            requestCount: item.requestCount ?? 0,
                            newRequestCount: item.newRequestCount ?? 0,
                            requests: item.requests ?? [],
                          }}
                          onViewRequests={(id) =>
                            router.push(`/requests/${id}`)
                          }
                        />
                      ))
                  )}
                </View>
              )}

              {activeTab === "outgoing" && (
                <View className="bg-white rounded-2xl">
                  <Text className="text-lg font-pbold text-gray-800 mb-4">
                    My Sent Requests
                  </Text>
                  {isRequestsLoading ? (
                    <ActivityIndicator size="large" color="#5C6EF6" />
                  ) : rentRequests.filter((req) => req.type === "outgoing")
                      .length === 0 ? (
                    <View className="py-10 items-center">
                      <Image
                        source={icons.emptyBox}
                        className="w-16 h-16 mb-4"
                        tintColor="#9CA3AF"
                      />
                      <Text className="text-gray-500">
                        No sent requests yet
                      </Text>
                    </View>
                  ) : (
                    <View className="gap-2">
                      {rentRequests
                        .filter((req) => req.type === "outgoing")
                        .map((request) => (
                          <SentRequestCard
                            key={request.id}
                            request={{
                              id: request.id,
                              itemId: request.itemId,
                              itemName: request.itemName,
                              itemImage: request.itemImage,
                              ownerName: request.ownerName,
                              status: request.status,
                              startDate: request.startDate,
                              endDate: request.endDate,
                              pickupTime: request.pickupTime,
                              totalPrice: request.totalPrice,
                              chatId: request.chatId,
                            }}
                            onPress={(id) =>
                              router.push(`/chat/${request.chatId}`)
                            }
                            onCancel={handleCancelRequest}
                            onEdit={handleEditRequest}
                          />
                        ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
};

export default Tools;
