import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { BackHandler } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DateTimePicker, {
  useDefaultClassNames,
} from "react-native-ui-datepicker";
import type { DateType } from "react-native-ui-datepicker";
import dayjs from "dayjs";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "../../hooks/useLocation";
import { LocationUtils } from "../../utils/locationUtils";
import { useUserLimits } from "@/hooks/useUserLimits";

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { icons, images } from "@/constant";
import Carousel from "react-native-reanimated-carousel";
import { useAuth } from "@/context/AuthContext";
import { useLoader } from "@/context/LoaderContext";
import { LinearGradient } from "expo-linear-gradient";
import { Item } from "@/types/item";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { checkAndUpdateLimits } from "@/utils/planLimits";
import { Toast, ALERT_TYPE } from "react-native-alert-notification";
import CustomImageViewer from "@/components/CustomImageViewer";
import * as Linking from "expo-linking";

import TimePicker from "@/components/TimePicker";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { sendRentRequestNotifications } from "@/utils/notificationHelper";
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import React from "react";
import Skeleton from "@/components/Skeleton";
import { StatusBar } from "expo-status-bar";
import { MAP_TILER_API_KEY } from "@env";

type RangeChange = { startDate?: DateType; endDate?: DateType };

interface UserRating {
  averageRating?: number;
  totalRatings?: number;
  ratingCount?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

interface UserPlan {
  listLimit: number;
  listUsed: number;
  rentLimit: number;
  rentUsed: number;
  planType: string;
  status: string;
}

const { width, height } = Dimensions.get("window");

export default function ItemDetails() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<Item | null>(null);
  const { isLoading, setIsLoading } = useLoader();
  const [isLocalLoad, setIsLocalLoad] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useAuth();
  const { timeToMinutes } = useTimeConverter();
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [hasExistingRequest, setHasExistingRequest] = useState(false);
  const [existingRequestData, setExistingRequestData] = useState<{
    id: string;
    status: string;
    chatId: string;
  } | null>(null);
  const [ownerRating, setOwnerRating] = useState<UserRating | null>(null);
  const { canList, rentLimit, rentUsed, updateListUsage, fetchUserLimits } =
    useUserLimits();

  const [userPlan, setUserPlan] = useState<UserPlan>({
    listLimit: 0,
    listUsed: 0,
    rentLimit: 0,
    rentUsed: 0,
    planType: "",
    status: "",
  });

  const [fullscreenImageVisible, setFullscreenImageVisible] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Add new state for form visibility
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Add this state for time picker visibility
  const [showTimePickerView, setShowTimePickerView] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<"start" | "end">(
    "start"
  );

  const [imageLoadError, setImageLoadError] = useState<Set<number>>(new Set());
  const [imageDebugInfo, setImageDebugInfo] = useState<any[]>([]);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    source: "device" | "profile";
  } | null>(null);
  const [distanceToItem, setDistanceToItem] = useState<number | null>(null);

  const handleImageError = (index: number) => {
    setImageLoadError((prev) => new Set(prev).add(index));
  };

  const createCirclePolygon = (
    center: [number, number],
    radiusInMeters: number,
    points: number = 64
  ) => {
    const coords: number[][] = [];
    const distanceX =
      radiusInMeters / (111320 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = radiusInMeters / 110540;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]);

    return {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
      properties: {},
    };
  };

  const fetchUserPlan = async () => {
    if (user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user!.uid));
      if (userDoc.exists() && userDoc.data().currentPlan) {
        const planData = userDoc.data().currentPlan;
        console.log("Fetched updated plan data:", {
          rentUsed: planData.rentUsed,
          renLimit: planData.renLimit,
        });

        setUserPlan(planData);
      }
    } catch (error) {
      console.error("Error fetching user plan:", error);
    } finally {
    }
  };

  // Function to get directions to the location
  const getDirectionsToLocation = (
    latitude: number,
    longitude: number,
    address: string
  ) => {
    const latLng = `${latitude},${longitude}`;
    const label = address || "Pickup Location";

    // URL schemes for directions
    const url =
      Platform.select({
        ios: `maps:?daddr=${latLng}&dirflg=w`,
        android: `google.navigation:q=${latLng}&mode=w`,
      }) || "";

    // Fallback to web Google Maps directions
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&destination_place_id=${encodeURIComponent(
      label
    )}`;

    Linking.canOpenURL(url || webUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch((err) => {
        // Fallback to web version
        Linking.openURL(webUrl);
      });
  };

  // Calculate distance between two coordinates
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get user's current location
  const getCurrentLocation = async () => {
    try {
      // First try to get user's stored location from Firestore
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.data();

        if (userData?.location?.latitude && userData?.location?.longitude) {
          setUserLocation({
            latitude: userData.location.latitude,
            longitude: userData.location.longitude,
            source: "profile",
          });

          // Calculate distance if item location exists
          if (item?.itemLocation) {
            const distance = calculateDistance(
              userData.location.latitude,
              userData.location.longitude,
              item.itemLocation.latitude,
              item.itemLocation.longitude
            );
            setDistanceToItem(distance);
          }
        }
      }

      // Then try to get device location if permission is granted
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const deviceLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          source: "device" as const,
        };

        setUserLocation(deviceLocation);

        if (item?.itemLocation) {
          const distance = calculateDistance(
            deviceLocation.latitude,
            deviceLocation.longitude,
            item.itemLocation.latitude,
            item.itemLocation.longitude
          );
          setDistanceToItem(distance);
        }
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setIsLocationLoading(false); // Stop loading
    }
  };
  // Function to fetch user rating data
  const fetchUserRating = async (
    userId: string
  ): Promise<UserRating | null> => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          averageRating: userData.averageRating,
          totalRatings: userData.totalRatings || 0,
          ratingCount: userData.ratingCount || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user rating:", error);
      return null;
    }
  };

  // Function to render stars
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Text key={i} className="text-yellow-500 text-sm">
            ★
          </Text>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Text key={i} className="text-yellow-500 text-sm">
            ☆
          </Text>
        );
      } else {
        stars.push(
          <Text key={i} className="text-gray-300 text-sm">
            ★
          </Text>
        );
      }
    }
    return stars;
  };

  useEffect(() => {
    const fetchItem = async () => {
      try {
        setIsLocalLoad(true);
        const docRef = doc(db, "items", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const itemData = docSnap.data();

          // Fetch owner details including profile image
          if (itemData.owner?.id) {
            const ownerRef = doc(db, "users", itemData.owner.id);
            const ownerSnap = await getDoc(ownerRef);

            if (ownerSnap.exists()) {
              const ownerData = ownerSnap.data();
              // Update owner data with profile image
              itemData.owner = {
                id: itemData.owner.id,
                fullname: itemData.owner.fullname,
                profileImage: ownerData.profileImage || null,
              };
            }
          }

          const completeItemData = {
            id: docSnap.id,
            ...itemData,
          } as Item;

          setItem(completeItemData);

          // Fetch owner rating
          if (completeItemData.owner?.id) {
            const rating = await fetchUserRating(completeItemData.owner.id);
            setOwnerRating(rating);
          }
        }
      } catch (error) {
        console.error("Error fetching item:", error);
        Alert.alert("Error", "Failed to load item details");
      } finally {
        setIsLocalLoad(false);
      }
    };

    fetchItem();
  }, [id]);

  // Modify checkExistingRequest function to only check for specific statuses
  const checkExistingRequest = async () => {
    if (!user?.uid || !item?.id) return;

    try {
      const requestQuery = query(
        collection(db, "rentRequests"),
        where("itemId", "==", item.id),
        where("requesterId", "==", user.uid),
        where("status", "in", ["pending", "approved"]) // Only check these statuses
      );

      const requestSnap = await getDocs(requestQuery);

      if (!requestSnap.empty) {
        const requestDoc = requestSnap.docs[0];
        const requestData = requestDoc.data();

        setHasExistingRequest(true);
        setExistingRequestData({
          id: requestDoc.id,
          status: requestData.status,
          chatId: requestData.chatId || null,
        });
      } else {
        setHasExistingRequest(false);
        setExistingRequestData(null);
      }
    } catch (error) {
      console.error("Error checking request:", error);
    }
  };

  // Add this effect to check requests on item or user change
  useEffect(() => {
    if (item && user) {
      checkExistingRequest();
      fetchUserPlan();
    }
  }, [item, user]);

  useEffect(() => {
    getCurrentLocation();
  }, [item]);

  // Update the checkExistingRequests function
  const checkExistingRequests = async (userId: string, itemId: string) => {
    try {
      // Only check for active requests (pending or approved)
      const requestsQuery = query(
        collection(db, "rentRequests"),
        where("requesterId", "==", userId),
        where("itemId", "==", itemId),
        where("status", "==", "pending") // Only check for pending requests
      );

      const activeRequestsSnap = await getDocs(requestsQuery);

      // For debugging
      console.log(`Found ${activeRequestsSnap.size} active requests`);
      if (!activeRequestsSnap.empty) {
        console.log("Request data:", activeRequestsSnap.docs[0].data());
      }

      return {
        hasActiveRequests: !activeRequestsSnap.empty,
        request: activeRequestsSnap.empty
          ? null
          : {
              id: activeRequestsSnap.docs[0].id,
              ...activeRequestsSnap.docs[0].data(),
            },
      };
    } catch (error) {
      console.error("Error checking requests:", error);
      return { hasActiveRequests: false, request: null };
    }
  };

  const handleRentRequest = async () => {
    try {
      if (!user?.uid || !item?.owner?.id) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to load profile data",
        });
        return;
      }

      if (rentUsed >= rentLimit) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Rent Limit Reached",
          textBody: "Please upgrade your plan to add more items.",
        });
        return;
      }

      // Check for existing request
      const { hasActiveRequests, request } = await checkExistingRequests(
        user.uid,
        item.id
      );

      if (hasActiveRequests) {
        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Pending Request",
          textBody:
            "You have a pending request for this item. Please wait for the owner's response.",
        });
        if (request) {
          router.push(`/request-detail/${request.id}`);
        }
        return;
      }

      // Show the form instead of creating request
      setShowRequestForm(true);
    } catch (error) {
      console.error("Error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to process request",
      });
    }
  };

  const formatDistance = (distance: number | null) => {
    if (distance === null || distance === undefined) return "";

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 10) {
      return `${distance.toFixed(1)}km`;
    } else {
      return `${Math.round(distance)}km`;
    }
  };

  // Add new function to handle form submission
  const handleRequestSubmit = async (formData: {
    startDate: Date;
    endDate: Date;
    message: string;
    selectedTime: string;
  }) => {
    try {
      setIsLoading(true);

      if (!user?.uid) {
        Alert.alert("Error", "User not found. Please login again.");
        return;
      }

      // Convert pickup time to hours and minutes
      const [time, modifier] = formData.selectedTime.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;

      // Create start and end dates with pickup time
      const startDateTime = dayjs(formData.startDate)
        .hour(hours)
        .minute(minutes)
        .second(0);

      const endDateTime = dayjs(formData.endDate)
        .hour(hours)
        .minute(minutes)
        .second(0);

      // Calculate days difference including both start and end dates
      const daysDifference = endDateTime.diff(startDateTime, "day");

      // Create rent request with complete data
      const requesterFullName = [
        user?.firstname ?? "",
        user?.middlename ?? "",
        user?.lastname ?? "",
      ]
        .filter((name) => name && name.trim().length > 0)
        .join(" ");

      // Create chat document first
      const chatRef = await addDoc(collection(db, "chat"), {
        participants: [user.uid, item?.owner?.id],
        itemId: item?.id,

        requesterId: user.uid, // Add this explicitly
        ownerId: item?.owner?.id, // Add this explicitly
        itemDetails: {
          name: item?.itemName,
          image: item?.images?.[0],
          price: item?.itemPrice,
          totalPrice: daysDifference * (item?.itemPrice ?? 0),
          rentalDays: daysDifference,
          downpaymentPercentage: item?.downpaymentPercentage ?? 0,
          itemLocation: item?.itemLocation ?? null,
          startDate: Timestamp.fromDate(startDateTime.toDate()),
          endDate: Timestamp.fromDate(endDateTime.toDate()),
          pickupTime: timeToMinutes(formData.selectedTime),
          message: formData.message,
        },
        createdAt: serverTimestamp(),
        lastMessage: formData.message,
        lastMessageTime: serverTimestamp(),
        lastSender: user.uid,
        status: "pending",
        unreadCounts: {
          [user.uid]: 0,
          [item?.owner?.id || ""]: 1,
        },
      });

      // Create rent request with chat reference
      const rentRequestRef = await addDoc(collection(db, "rentRequests"), {
        itemId: item?.id ?? "",
        itemName: item?.itemName ?? "",
        itemImage: item?.images?.[0] ?? "",
        requesterId: user?.uid ?? "",
        requesterName: requesterFullName,
        ownerId: item?.owner?.id ?? "",
        ownerName: item?.owner?.fullname ?? "",
        status: "pending",
        startDate: Timestamp.fromDate(startDateTime.toDate()),
        endDate: Timestamp.fromDate(endDateTime.toDate()),
        pickupTime: timeToMinutes(formData.selectedTime),
        message: formData.message,
        totalPrice: daysDifference * (item?.itemPrice ?? 0),
        rentalDays: daysDifference,
        createdAt: serverTimestamp(),
        chatId: chatRef.id,
        unread: true,
      });

      await updateDoc(chatRef, {
        rentRequestId: rentRequestRef.id,
      });
      // Add initial message to chat
      await addDoc(collection(db, "chat", chatRef.id, "messages"), {
        senderId: user.uid,
        text: formData.message,
        createdAt: serverTimestamp(),
        type: "rentRequest",
        rentRequestId: rentRequestRef.id,
        read: false,
      });

      await checkAndUpdateLimits(user?.uid, "rent");

      // Send notifications
      await sendRentRequestNotifications(item?.owner?.id!, {
        itemId: item?.id!,
        itemName: item?.itemName!,
        requestId: rentRequestRef.id,
        requesterName: requesterFullName,
        daysDifference: daysDifference,
        startDate: startDateTime.format("MMMM D, YYYY"),
        endDate: endDateTime.format("MMMM D, YYYY"),
        imageUrl: item?.images[0],
      });

      if (user?.uid) {
        try {
          const userNotificationsRef = collection(
            db,
            `users/${user?.uid}/notifications`
          );

          await addDoc(userNotificationsRef, {
            type: "RENT_SENT",
            title: "Rental Request Submitted",
            message: `Your rental request for ${item?.itemName!} has been submitted to the owner. You'll be notified when they respond.`,
            isRead: false,
            createdAt: serverTimestamp(),
          });
        } catch (error) {
          console.error("Error creating welcome notification:", error);
        }
        // await createNotification(auth.currentUser.uid, "REPORT_ISSUE", {
        //   reportReason: reportData.reason,
        // });
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Rent request sent successfully",
      });

      setShowRequestForm(false);
      router.push({ pathname: "/tools", params: { tab: "outgoing" } });
    } catch (error) {
      console.error("Error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to send request",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add the form component to your JSX
  // Add handleProfilePress function
  const handleProfilePress = () => {
    if (item?.owner?.id) {
      router.push(`/user/${item.owner.id}`);
    }
  };

  // Helper function to check if the item is available
  const isItemAvailable = () => {
    const status = item?.itemStatus?.toLowerCase();
    return status === "available";
  };

  // Determine if the current user is the owner of the item
  const isCurrentUserOwner = item?.owner?.id === user?.uid;

  const handleEdit = () => {
    // Verify item status before allowing edit
    if (!isItemAvailable()) {
      Alert.alert(
        "Cannot Edit",
        "This item can only be edited when its status is 'Available'."
      );
      return;
    }
    router.push(`/edit-listing/${id}`);
  };

  const handleDelete = async () => {
    // Verify item status before allowing delete
    if (!isItemAvailable()) {
      Alert.alert(
        "Cannot Delete",
        "This item can only be deleted when its status is 'Available'."
      );
      return;
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
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
          <Text className="text-xl font-pbold text-gray-800">Item Details</Text>
        </View>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image Section */}
        <View>
          {/* AI Badge Enhancement
          {item?.enableAI && (
            <View className="mb-4">
             
            </View>
          )} */}

          <View className="h-[370px] relative mb-4 ">
            {item && item.images && item.images.length > 0 ? (
              <>
                <Carousel
                  loop={false}
                  width={width}
                  height={384}
                  autoPlay={false}
                  data={item.images}
                  scrollAnimationDuration={500}
                  onSnapToItem={(index) => {
                    setActiveIndex(index);
                  }}
                  renderItem={({ item: imageUrl, index }) => (
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() => {
                        if (!imageLoadError.has(index)) {
                          console.log("Opening fullscreen with index:", index);
                          console.log("Available images:", item.images);
                          setFullscreenImageIndex(index);
                          setFullscreenImageVisible(true);
                        }
                      }}
                      className="flex-1 items-center justify-center p-2"
                    >
                      <View className="w-full h-full relative">
                        <Image
                          source={{ uri: imageUrl as string }}
                          className="w-full h-full rounded-2xl"
                          resizeMode="cover"
                          onError={() => handleImageError(index)}
                          onLoad={() => {
                            // Remove from error set if it loads successfully
                            setImageLoadError((prev) => {
                              const newSet = new Set(prev);
                              newSet.delete(index);
                              return newSet;
                            });
                          }}
                        />
                        {imageLoadError.has(index) && (
                          <View className="absolute inset-0 bg-gray-200 rounded-2xl items-center justify-center">
                            <Image
                              source={images.logoSmall}
                              className="w-20 h-20 opacity-30"
                              resizeMode="contain"
                            />
                            <Text className="text-gray-400 text-sm mt-2">
                              Image unavailable
                            </Text>
                          </View>
                        )}
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.7)"]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          className="absolute bottom-0 left-0 right-0 h-32 rounded-b-2xl p-4"
                          style={{ borderRadius: 16 }}
                        />
                      </View>
                    </TouchableOpacity>
                  )}
                />

                {item.enableAI && (
                  <View className="flex-row  absolute bottom-2 right-2 py-1 px-4  items-end ">
                    <LinearGradient
                      colors={["#8B5CF6", "#EC4899", "#F59E0B"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="p-4 py-2 rounded-2xl"
                      style={{ borderRadius: 23, opacity: 0.85 }}
                    >
                      <View className="flex-row items-end ">
                        <Image
                          source={icons.aiImage}
                          className="w-5 h-5"
                          tintColor={"white"}
                        />
                        <Text className="font-pmedium text-xs text-white ml-1">
                          Ai Enabled
                        </Text>
                      </View>
                    </LinearGradient>
                    {/* 
                    <Image
                      source={icons.aiImage}
                      className="w-6 h-6"
                      tintColor={"#EC4899"}
                    />
                    <Text className="font-pmedium text-sm text-white ">
                      Ai Enabled
                    </Text> */}
                  </View>
                )}

                {/* Move price and title to bottom with gradient */}
                <View className="absolute bottom-0 left-6 right-6 flex-row justify-between items-end">
                  {/* Title and Price Container (Left) */}
                  <View className="rounded-xl pb-2">
                    <Text
                      className="text-white text-2xl font-pbold mb-1"
                      numberOfLines={1}
                    >
                      {item.itemName}
                    </Text>
                    <View className="flex-row items-baseline">
                      <Text className="text-3xl font-pbold text-primary">
                        ₱{item?.itemPrice ?? ""}
                      </Text>
                      <Text className="text-white font-pregular text-base ml-1">
                        /day
                      </Text>
                    </View>
                  </View>
                  {/* Listed Date & Time (Right) */}
                </View>

                {/* Image Counter */}
                <View className="absolute top-6 right-6 bg-black/50 px-3 py-1 rounded-full">
                  <Text className="text-white text-sm font-medium">
                    {activeIndex + 1}/{item.images.length}
                  </Text>
                </View>
                {/* Distance indicator with loading state */}
                {(isLocationLoading || distanceToItem) && (
                  <View className="absolute top-6 left-6 bg-black/50 px-3 py-1 rounded-full flex-row items-center justify-center">
                    {isLocationLoading ? (
                      <>
                        <ActivityIndicator
                          size="small"
                          color="white"
                          style={{ marginRight: 6 }}
                        />
                        <Text className="text-white font-psemibold text-sm">
                          Finding location...
                        </Text>
                      </>
                    ) : distanceToItem ? (
                      <>
                        {userLocation?.source === "profile" ? (
                          <View className="flex-row gap-1 items-center">
                            <ActivityIndicator size={"small"} color="#9CA3AF" />
                          </View>
                        ) : (
                          <View className="flex-row gap-1 items-center">
                            <Image
                              source={icons.footstep}
                              className="w-4 h-4 mr-1"
                              resizeMode="contain"
                              tintColor="white"
                            />
                            <Text className="text-white font-psemibold">
                              {formatDistance(distanceToItem)}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : null}
                  </View>
                )}

                {/* Dots Indicator */}
                {item.images.length > 1 && (
                  <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
                    {item.images.map((_, index) => (
                      <View
                        key={index}
                        className={`h-2 rounded-full mx-1 ${
                          index === activeIndex
                            ? "w-6 bg-primary"
                            : "w-2 bg-white/60"
                        }`}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Skeleton
                dimension={"h-full"}
                rounded="rounded-2xl"
                className="m-2"
              />
            )}
          </View>
        </View>

        {/* Product Info */}
        <View className="px-4 ">
          {/* Owner Badge with Dynamic Rating */}
          <TouchableOpacity
            className="flex-row items-center my-4 gap-4 rounded-xl"
            onPress={handleProfilePress}
            activeOpacity={0.7}
          >
            {/* Profile Image or Letter Avatar */}
            <View className="relative">
              {item && item.owner?.profileImage ? (
                <>
                  <Image
                    source={{ uri: item.owner.profileImage }}
                    className="w-12 h-12 rounded-full"
                    resizeMode="cover"
                  />
                  <Image
                    source={icons.verified}
                    className="w-4 h-4 absolute -right-1 bottom-0"
                    resizeMode="contain"
                  />
                </>
              ) : (
                <View className="relative">
                  <Skeleton dimension={"w-12 h-12"} rounded="rounded-full" />
                </View>
              )}
            </View>

            <View className="flex-1">
              {item?.owner?.fullname &&
              item.owner.fullname.trim().length > 0 ? (
                <Text className="text-gray-800 text-base font-pmedium">
                  {item.owner.fullname}
                </Text>
              ) : (
                <Skeleton
                  dimension={"w-20 h-5"}
                  rounded="rounded-md"
                  className="mb-2"
                />
              )}

              <View className="flex-row items-center font-pregular">
                {ownerRating ? (
                  ownerRating.averageRating && ownerRating.totalRatings ? (
                    <>
                      <View className="flex-row items-center mr-2">
                        {renderStars(ownerRating.averageRating)}
                      </View>
                      <Text className="text-gray-600 text-sm font-pregular">
                        {ownerRating.averageRating.toFixed(1)}
                      </Text>
                      <Text className="text-gray-400 text-sm ml-1 font-pregular">
                        ({ownerRating.totalRatings}
                        {ownerRating.totalRatings === 1
                          ? " review"
                          : " reviews"}
                        )
                      </Text>
                    </>
                  ) : (
                    <Text className="text-gray-400 mt-1 text-sm font-pregular">
                      No ratings yet
                    </Text>
                  )
                ) : (
                  <Skeleton dimension={"w-12 h-3"} rounded="rounded-md" />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Condition, Location, and Distance Info */}
          <View className="flex-row mb-4 gap-3">
            {/* Condition Card */}
            {item?.itemCondition ? (
              <View className="flex-1 bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <View className="flex-row items-center mb-1">
                  <View className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  <Text className="text-gray-500 text-xs font-pmedium">
                    CONDITION
                  </Text>
                </View>
                <Text className="text-gray-800 text-base font-psemibold">
                  {item?.itemCondition ?? "Not specified"}
                </Text>
              </View>
            ) : (
              <Skeleton dimension="flex-1 h-28" rounded="rounded-xl" />
            )}

            {/* Listed Date Card */}
            {item?.createdAt ? (
              <View className="flex-1 bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <View className="flex-row items-center mb-1">
                  <View className="w-2 h-2 bg-primary rounded-full mr-2" />
                  <Text className="text-gray-500 text-xs font-pmedium">
                    LISTED
                  </Text>
                </View>
                <Text className="text-gray-800 font-psemibold">
                  {dayjs(item.createdAt.toDate?.() ?? item.createdAt).format(
                    "MMM D, YYYY"
                  )}
                </Text>
                <Text className="text-gray-500 text-sm font-pregular">
                  {dayjs(item.createdAt.toDate?.() ?? item.createdAt).format(
                    "h:mm A"
                  )}
                </Text>
              </View>
            ) : (
              <Skeleton dimension="flex-1 h-28" rounded="rounded-xl" />
            )}
          </View>

          {item?.itemDesc ? (
            <View className="mb-4 ">
              <Text className="text-xl font-psemibold text-gray-900 mb-3">
                About this item
              </Text>
              <View className="bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                <Text className="text-gray-700 text-base leading-6 font-pregular">
                  {item?.itemDesc}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Skeleton dimension="w-40 h-10 mb-3" rounded="rounded-xl" />
              <Skeleton
                dimension="flex-1 h-[200px] mb-3"
                rounded="rounded-xl"
              />
            </View>
          )}

          {item?.itemPrice || item?.itemMinRentDuration ? (
            <>
              <View className="flex-row items-center mb-4">
                <Text className="text-xl font-psemibold text-gray-900">
                  Rental Details
                </Text>
              </View>
              <View className="bg-gray-50   p-5 rounded-2xl mb-6  border border-gray-200">
                <View className="gap-2">
                  <View className="flex-row justify-between items-center ">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-primary rounded-full mr-3" />
                      <Text className="text-gray-700 font-pmedium">
                        Daily Rate
                      </Text>
                    </View>
                    <Text className="font-psemibold text-gray-900 text-lg">
                      ₱{item?.itemPrice}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center ">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-primary rounded-full mr-3" />
                      <Text className="text-gray-700 font-pmedium">
                        Minimum Rental
                      </Text>
                    </View>
                    <Text className="font-psemibold text-gray-900">
                      {item?.itemMinRentDuration}
                      {item?.itemMinRentDuration && item.itemMinRentDuration > 1
                        ? " days"
                        : " day"}
                    </Text>
                  </View>

                  {item?.downpaymentPercentage && (
                    <View className="flex-row justify-between items-center ">
                      <View className="flex-row items-center">
                        <View className="w-2 h-2 bg-orange-500 rounded-full mr-3" />
                        <Text className="text-gray-700 font-pmedium">
                          Downpayment
                        </Text>
                      </View>
                      <Text className="font-psemibold text-orange-600">
                        {item.downpaymentPercentage}%
                      </Text>
                    </View>
                  )}

                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center">
                      <View className="w-2 h-2 bg-green-500 rounded-full mr-3" />
                      <Text className="text-gray-700 font-pmedium">Status</Text>
                    </View>
                    <View className="bg-green-100 px-3 py-1 rounded-full">
                      <Text className="font-psemibold text-green-700 text-sm">
                        Available
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          ) : (
            <Skeleton dimension="w-40 h-10 mb-3" rounded="rounded-xl" />
          )}

          {/* Pickup Location Map */}
          {item?.itemLocation &&
            item.itemLocation.latitude &&
            item.itemLocation.longitude && (
              <View className="mb-6 ">
                <Text className="text-xl font-psemibold text-gray-900 mb-3">
                  Pickup Location
                </Text>

                {/* Map container with touchable overlay for Google Maps */}
                <View className="relative">
                  <View className="h-48 rounded-s-xl overflow-hidden border border-gray-200">
                    <MapView
                      style={{ flex: 1 }}
                      rotateEnabled={false}
                      attributionEnabled={false}
                      logoEnabled={false}
                      compassEnabled={false}
                      compassViewPosition={3}
                      mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAP_TILER_API_KEY}`}
                    >
                      <Camera
                        defaultSettings={{
                          centerCoordinate: [
                            item.itemLocation.longitude,
                            item.itemLocation.latitude,
                          ],
                          zoomLevel: 15,
                        }}
                      />

                      {/* Radius circle if available */}
                      {item.itemLocation.radius && (
                        <ShapeSource
                          id="pickup-radius"
                          shape={createCirclePolygon(
                            [
                              item.itemLocation.longitude,
                              item.itemLocation.latitude,
                            ],
                            item.itemLocation.radius
                          )}
                        >
                          <FillLayer
                            id="pickup-radius-fill"
                            style={{
                              fillColor: "rgba(33, 150, 243, 0.15)",
                              fillOutlineColor: "#2196F3",
                            }}
                          />
                        </ShapeSource>
                      )}

                      {/* Pickup location marker */}
                      <MarkerView
                        coordinate={[
                          item.itemLocation.longitude,
                          item.itemLocation.latitude,
                        ]}
                        anchor={{ x: 0.5, y: 1 }}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Image
                            source={require("@/assets/images/marker-home.png")}
                            style={{ width: 32, height: 40 }}
                            resizeMode="contain"
                          />
                        </View>
                      </MarkerView>
                    </MapView>
                  </View>
                  <TouchableOpacity
                    className="absolute bottom-2 right-2 flex-row justify-center  items-end bg-white rounded-lg p-2 shadow-md"
                    onPress={() =>
                      getDirectionsToLocation(
                        item.itemLocation!.latitude,
                        item.itemLocation!.longitude,
                        item.itemLocation!.address
                      )
                    }
                  >
                    <Text className="text-blue-600 text-sm font-medium">
                      Get Direction
                    </Text>
                    <Image
                      source={icons.rightArrow}
                      className="w-5 h-5 mr-1"
                      tintColor={"#2563eb"}
                    />
                  </TouchableOpacity>
                </View>

                <View className="p-3 bg-gray-50 rounded-e-xl border border-gray-200">
                  <Text className="text-gray-600 font-pmedium text-sm">
                    {item.itemLocation?.address || "Address not available"}
                  </Text>
                  {item.itemLocation?.radius &&
                    typeof item.itemLocation.radius === "number" && (
                      <Text className="text-gray-500 text-xs">
                        Pickup radius:{" "}
                        {item.itemLocation.radius >= 1000
                          ? `${(item.itemLocation.radius / 1000).toFixed(1)}km`
                          : `${item.itemLocation.radius}m`}
                      </Text>
                    )}
                </View>
              </View>
            )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isCurrentUserOwner && !isLocalLoad ? (
        <SafeAreaView edges={["bottom"]}>
          <View className="bg-white border-t border-gray-100 px-4 py-4">
            <TouchableOpacity
              className={`rounded-xl ${
                hasExistingRequest ? "bg-blue-500" : "bg-primary"
              } ${isLocalLoad ? "opacity-50" : ""}`}
              onPress={() => {
                if (hasExistingRequest && existingRequestData) {
                  router.push({
                    pathname: "/tools",
                    params: { tab: "outgoing" },
                  });
                } else {
                  handleRentRequest();
                }
              }}
              disabled={isLocalLoad}
            >
              <View className="flex-row py-4 items-center justify-center">
                <Image
                  source={hasExistingRequest ? icons.box : icons.plane}
                  className="w-5 h-5 mr-2"
                  resizeMode="contain"
                  tintColor="white"
                />
                <Text className="text-white font-bold text-base">
                  {hasExistingRequest ? "View Request" : "Request to Rent"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      ) : null}

      <RentRequestForm
        visible={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        onSubmit={handleRequestSubmit}
        itemName={item?.itemName ?? ""}
        itemPrice={item?.itemPrice ?? 0}
        itemImage={item?.images?.[0] ?? ""}
        itemMinRentDuration={item?.itemMinRentDuration ?? 1}
        downpaymentPercentage={item?.downpaymentPercentage ?? 0}
      />

      <CustomImageViewer
        images={
          item?.images?.filter((uri) => {
            // More robust filtering
            if (typeof uri !== "string") return false;
            if (!uri || uri.trim().length === 0) return false;
            if (!uri.startsWith("http")) return false;

            // Additional validation
            try {
              new URL(uri);
              return true;
            } catch {
              return false;
            }
          }) || []
        }
        visible={fullscreenImageVisible}
        imageIndex={fullscreenImageIndex}
        onRequestClose={() => {
          setFullscreenImageVisible(false);
          // Reset any other state if needed
          setFullscreenImageIndex(0);
        }}
        onImageIndexChange={(index) => {
          setFullscreenImageIndex(index);
          // Optional: sync with carousel if needed
          setActiveIndex(index);
        }}
      />
    </View>
  );
}

const RentRequestForm = ({
  visible,
  onClose,
  onSubmit,
  itemName,
  itemPrice,
  itemImage,
  downpaymentPercentage,
  itemMinRentDuration,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    startDate: Date;
    endDate: Date;
    message: string;
    selectedTime: string;
  }) => void;
  itemName: string;
  itemPrice: number;
  itemImage: string;
  downpaymentPercentage: number;
  itemMinRentDuration: number;
}) => {
  if (!visible) return null;
  const insets = useSafeAreaInsets();
  const defaultClassNames = useDefaultClassNames();
  // Get current date at start of day to ensure proper comparison
  const today = dayjs().add(1, "day").startOf("day");
  const itemMinDuration: number = Number(itemMinRentDuration) || 1;

  const [selectedDates, setSelectedDates] = useState<{
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  }>({
    startDate: today, // Initialize with today's date
    endDate: today.add(itemMinDuration, "day"), // Initialize with tomorrow's date
  });

  // Simplified to single time for both start and end
  const [selectedTime, setSelectedTime] = useState("9:00 AM");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [message, setMessage] = useState("");

  const minimumDate = today.toDate();

  // State to track current viewing month/year
  const [currentViewDate, setCurrentViewDate] = useState(today);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const calculateTotalPrice = () => {
    if (!selectedDates.startDate || !selectedDates.endDate) return itemPrice;

    const days = selectedDates.endDate.diff(selectedDates.startDate, "day");
    return Math.max(1, days) * itemPrice;
  };

  // useFocusEffect(
  //   React.useCallback(() => {
  //     const onBackPress = () => {
  //       if (visible) {
  //         onClose();
  //         return true;
  //       }
  //       return false;
  //     };

  //     const subscription = BackHandler.addEventListener(
  //       "hardwareBackPress",
  //       onBackPress
  //     );

  //     return () => subscription.remove();
  //   }, [visible, onClose])
  // );

  const handleDateChange = ({ startDate, endDate }: RangeChange) => {
    if (startDate) {
      const start = dayjs(startDate).startOf("day");
      const end = endDate ? dayjs(endDate).startOf("day") : null;

      // Ensure start date is not before today
      if (start.isBefore(today)) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Invalid Date",
          textBody: "Start date cannot be before today",
        });
        return;
      }

      // If end date is selected, ensure it's not before start date
      if (end && end.isBefore(start)) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Invalid Date Range",
          textBody: "End date cannot be before start date",
        });
        return;
      }

      // Ensure minimum rental period (1 day)
      if (end && end.diff(start, "day") < 1) {
        setSelectedDates({
          startDate: start,
          endDate: start.add(1, "day"),
        });
      } else {
        setSelectedDates({
          startDate: start,
          endDate: end,
        });
      }
    }
  };

  // Check if current viewing month is the current month
  const isCurrentMonth = currentViewDate.isSame(today, "month");

  // Custom function to handle month navigation
  const handleMonthChange = (date: Date) => {
    const newViewDate = dayjs(date);
    setCurrentViewDate(newViewDate);
  };

  const validateMessage = (message: string) => {
    if (!message.trim()) {
      return "Please enter a message for the owner";
    }
    if (message.trim().length < 10) {
      return "Message must be at least 10 characters long";
    }
    return "";
  };

  const validateForm = () => {
    if (!selectedDates.startDate || !selectedDates.endDate) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Invalid Dates",
        textBody: "Please select both start and end dates",
      });
      return false;
    }

    if (selectedDates.startDate.isBefore(today)) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Invalid Start Date",
        textBody: "Start date cannot be before today",
      });
      return false;
    }

    if (selectedDates.endDate.isBefore(selectedDates.startDate)) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Invalid Date Range",
        textBody: "End date cannot be before start date",
      });
      return false;
    }

    return true;
  };

  // Date Picker Component
  const DatePickerModal = () => {
    if (!showDatePicker) return null;

    // Calculate number of days
    const dayCount =
      selectedDates.startDate && selectedDates.endDate
        ? selectedDates.endDate.diff(selectedDates.startDate, "day")
        : 0;

    return (
      <View
        className="absolute inset-0 bg-white"
        style={{ paddingTop: insets.top }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center p-2  border-b border-gray-100">
          <TouchableOpacity
            onPress={() => setShowDatePicker(false)}
            className="p-2"
          >
            <Image
              source={icons.leftArrow}
              className="w-8 h-8"
              tintColor="#6B7280"
            />
          </TouchableOpacity>
          <Text className="text-xl font-pbold text-gray-800">Select Dates</Text>
          <View className="w-8 h-8" />
        </View>

        <View className="flex-1">
          <ScrollView className="flex-1 p-4">
            {/* Calendar */}
            <View className="rounded-xl border-2 overflow-hidden border-gray-200 p-2">
              <DateTimePicker
                mode="range"
                startDate={selectedDates.startDate?.toDate()}
                endDate={selectedDates.endDate?.toDate()}
                minDate={minimumDate}
                maxDate={dayjs().add(1, "year").toDate()}
                disableYearPicker={true}
                disableMonthPicker={true}
                showOutsideDays={true}
                onChange={handleDateChange}
                classNames={{
                  ...defaultClassNames,
                  weekday_label: "text-secondary-300 font-pregular",
                  year_selector_label: "font-pbold text-xl text-primary ",
                  month_selector_label: "font-pbold text-xl text-primary ",
                  day_label: "font-pregular text-lg",
                  month_label: "font-pregular text-lg",
                  year_label: "font-pregular text-lg",
                  selected_month_label: "text-white ",
                  selected_year_label: "text-white",
                  outside_label: "text-gray-400",
                  range_fill: "bg-primary/20",
                  range_middle_label: "text-gray-600",
                  range_start_label: "text-white font-pmedium  ",
                  range_end_label: "text-white font-pmedium ",
                  range_start: "bg-primary border-2 border-green-500 ",
                  range_end: "bg-primary border-2 border-green-500 ",
                  day: `${defaultClassNames.day} hover:bg-amber-100`,
                  disabled: "opacity-50",
                }}
              />
            </View>

            {/* Day Count Display */}
            {selectedDates.startDate && selectedDates.endDate && (
              <View
                className={`mt-4 p-4 rounded-xl ${
                  selectedDates.endDate.diff(selectedDates.startDate, "day") <
                  itemMinDuration
                    ? "bg-red-100"
                    : "bg-primary/10"
                }`}
              >
                <Text
                  className={`text-center font-psemibold ${
                    selectedDates.endDate.diff(selectedDates.startDate, "day") <
                    itemMinDuration
                      ? "text-red-600"
                      : "text-primary"
                  }`}
                >
                  {dayCount} {dayCount === 1 ? "day" : "days"} selected
                </Text>
                <Text
                  className={`text-center text-sm mt-1 ${
                    selectedDates.endDate.diff(selectedDates.startDate, "day") <
                    itemMinDuration
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {selectedDates.startDate.format("MMM DD")} -{" "}
                  {selectedDates.endDate.format("MMM DD, YYYY")}
                </Text>
                {selectedDates.endDate.diff(selectedDates.startDate, "day") <
                  itemMinDuration && (
                  <Text className="text-center text-xs text-red-600 mt-2">
                    Minimum rental period is {itemMinDuration}
                    {itemMinDuration === 1 ? " day" : " days"}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          {/* Set Date Button */}
          <View className="p-4 border-t border-gray-100">
            <TouchableOpacity
              disabled={
                !selectedDates.startDate ||
                !selectedDates.endDate ||
                (selectedDates.startDate &&
                  selectedDates.endDate &&
                  selectedDates.endDate.diff(selectedDates.startDate, "day") <
                    itemMinDuration)
              }
              className={`py-4 rounded-xl items-center ${
                !selectedDates.startDate ||
                !selectedDates.endDate ||
                (selectedDates.startDate &&
                  selectedDates.endDate &&
                  selectedDates.endDate.diff(selectedDates.startDate, "day") <
                    itemMinDuration)
                  ? "bg-gray-300"
                  : "bg-primary"
              }`}
              onPress={() => {
                if (validateForm()) {
                  setShowDatePicker(false);
                }
              }}
            >
              <Text
                className={`font-pbold text-base ${
                  !selectedDates.startDate ||
                  !selectedDates.endDate ||
                  (selectedDates.startDate &&
                    selectedDates.endDate &&
                    selectedDates.endDate.diff(selectedDates.startDate, "day") <
                      itemMinDuration)
                    ? "text-gray-400"
                    : "text-white"
                }`}
              >
                {!selectedDates.startDate || !selectedDates.endDate
                  ? "Select Dates"
                  : "Set Dates"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const TermsModal = () => {
    if (!showTermsModal) return null;

    return (
      <Modal
        visible={showTermsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center px-4">
          <View
            className="bg-white rounded-2xl"
            style={{
              maxHeight: height * 0.9, // Use 90% of screen height
              minHeight: height * 0.9, // Minimum height to ensure content fits
            }}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-100">
              <Text className="text-xl font-pbold text-gray-800">
                Terms & Conditions
              </Text>
              <TouchableOpacity
                onPress={() => setShowTermsModal(false)}
                className="w-8 h-8 items-center justify-center"
              >
                <Image source={icons.close} className="w-6 h-6" />
              </TouchableOpacity>
            </View>

            {/* Terms Content - Fixed ScrollView */}
            <ScrollView
              className="flex-1 px-6 py-4"
              showsVerticalScrollIndicator={true}
              style={{ maxHeight: height * 0.8 }} // Constrain scroll area
            >
              <Text className="text-base font-psemibold text-gray-800 mb-4">
                Rental Agreement Terms
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  1. Rental Responsibility
                </Text>
                <Text className="text-sm font-pregular text-gray-600 leading-5 mb-3">
                  By submitting this rental request, you agree to take full
                  responsibility for the rented item during the rental period.
                  You will return the item in the same condition as received,
                  except for normal wear and tear.
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  2. Damage and Loss Policy
                </Text>
                <Text className="text-sm font-pregular text-gray-600 leading-5 mb-3">
                  You are liable for any damage, loss, or theft of the rented
                  item during the rental period. Repair or replacement costs
                  will be your responsibility and may exceed the item's rental
                  fee.
                </Text>
              </View>

              {/* <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  3. Payment Terms
                </Text>
                <Text className="text-sm font-pregular text-gray-600 leading-5 mb-3">
                  Payment must be made as agreed with the owner. Late returns
                  may incur additional daily charges at the standard rental
                  rate. Any required downpayment must be paid before item
                  pickup.
                </Text>
              </View> */}

              <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  3. Pickup and Return
                </Text>
                <Text className="text-sm font-pregular text-gray-600 leading-5 mb-3">
                  You must pick up and return the item at the agreed time and
                  location. Late pickup or return without prior arrangement may
                  result in cancellation or additional fees.
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  4. Cancellation Policy
                </Text>
                <Text className="text-sm text-gray-600 leading-5 mb-3">
                  Rental requests can be cancelled by either party before
                  pickup. Once the item is picked up, cancellation terms will be
                  determined by mutual agreement between renter and owner.
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  5. Platform Limitation
                </Text>
                <Text className="text-sm text-gray-600 leading-5 mb-3">
                  This platform facilitates connections between renters and
                  owners but is not responsible for disputes, damages, or issues
                  arising from rental agreements. All transactions are between
                  users.
                </Text>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-pmedium text-gray-700 mb-2">
                  6. Safety and Proper Use
                </Text>
                <Text className="text-sm text-gray-600 leading-5 mb-3">
                  You agree to use the rented item safely and as intended.
                  Misuse that results in damage or safety hazards is strictly
                  prohibited and may result in account suspension.
                </Text>
              </View>

              <View className="bg-amber-50 border border-orange-200 p-3 rounded-lg mb-4">
                <Text className="text-sm font-pmedium text-orange-600 mb-1">
                  Important Notice:
                </Text>
                <Text className="text-xs text-amber-500 leading-4">
                  By accepting these terms, you acknowledge that you have read,
                  understood, and agree to be bound by these conditions for the
                  duration of your rental period.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Footer - Fixed positioning */}
            <View className="px-6 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
              <TouchableOpacity
                className="bg-primary py-3 rounded-xl"
                onPress={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
              >
                <Text className="text-white font-pbold text-center">
                  Accept Terms
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View
      className="absolute inset-0 bg-white"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <TouchableOpacity
          onPress={onClose}
          className="items-center justify-center"
        >
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">Rent Request</Text>
        <View className="w-8 h-8" />
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Item Preview */}
        <View className="flex-row items-center p-3 bg-gray-50 border border-gray-200 rounded-xl my-4">
          <Image
            source={itemImage ? { uri: itemImage } : images.thumbnail}
            className="w-16 h-16 rounded-lg"
            resizeMode="cover"
          />
          <View className="ml-3">
            <Text className="text-lg font-psemibold text-gray-800">
              {itemName}
            </Text>
            <Text className="text-primary font-psemibold">
              ₱{itemPrice}/day
            </Text>
          </View>
        </View>

        {/* Rental Period Section */}
        <View className="mb-6 p-3 border border-gray-200 rounded-xl">
          <Text className="text-lg font-psemibold text-gray-700 mb-2">
            Rental Period
          </Text>

          {/* Date Selection Button */}

          <Text className="text-sm text-gray-500 font-pregular mb-1">
            Rental Dates
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="  flex-row  overflow-hidden bg-white border border-gray-200 rounded-lg mb-3"
          >
            <View className="flex-1  justify-center p-4 ">
              <Text className="font-psemibold text-gray-800 ">
                {selectedDates.startDate && selectedDates.endDate
                  ? `${selectedDates.startDate.format(
                      "MMM DD"
                    )} - ${selectedDates.endDate.format("MMM DD, YYYY")}`
                  : "Select rental dates"}
              </Text>

              {selectedDates.startDate && selectedDates.endDate && (
                <Text className="text-xl font-psemibold text-primary ">
                  {selectedDates.endDate.diff(selectedDates.startDate, "day")}{" "}
                  {selectedDates.endDate.diff(
                    selectedDates.startDate,
                    "day"
                  ) === 1
                    ? "day"
                    : "days"}
                </Text>
              )}
            </View>

            <View className="bg-primary rounded-r-lg justify-center p-4">
              <Image
                source={icons.calendar}
                className="w-5 h-5"
                tintColor="#fff"
              />
            </View>
          </TouchableOpacity>

          {/* Time Selection */}

          <Text className="text-sm text-gray-500 font-pregular mb-1">
            Pickup Time
          </Text>
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            className=" flex-row border border-gray-200 rounded-lg overflow-hidden "
          >
            <View className="flex-1 p-4  border-gray-200">
              <Text className="font-psemibold text-gray-800">
                {selectedTime}
              </Text>
              <Text className="text-sm italic text-red-400 mt-1">
                Avoid any delays
              </Text>
            </View>
            <View className="bg-primary  rounded-r-md justify-center p-4">
              <Image
                source={icons.clock}
                className="w-5 h-5"
                tintColor="#fff"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Message */}
        <View className="mb-6  rounded-xl border p-3 border-gray-200">
          <Text className="text-lg font-psemibold text-gray-700 mb-2">
            Message to Owner
          </Text>
          <Text className="text-xs text-gray-500 mb-2">
            Please include a message or note for the owner. Conversation will
            only start if the owner responds to your request.
          </Text>
          <View>
            <TextInput
              style={{ height: 100, textAlignVertical: "top" }}
              className={`p-3  border border-gray-200 rounded-lg ${
                message.trim().length > 0 && message.trim().length < 10
                  ? "border border-orange-400"
                  : ""
              }`}
              placeholder="Enter your message here..."
              placeholderClassName="text-gray-400 font-pregular"
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />
            {message.trim().length > 0 && message.trim().length < 10 && (
              <Text className="text-orange-600 text-xs mt-1">
                Message must be at least 10 characters
              </Text>
            )}
          </View>
        </View>

        <View className="p-4 border  border-gray-200 rounded-xl mb-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-psemibold text-gray-800">
              Price Breakdown
            </Text>
            {selectedDates.startDate && selectedDates.endDate && (
              <Text className="text-sm text-gray-500">
                {selectedDates.endDate.diff(selectedDates.startDate, "day")}{" "}
                days
              </Text>
            )}
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600">
              ₱{itemPrice} ×{" "}
              {selectedDates.startDate && selectedDates.endDate
                ? selectedDates.endDate.diff(selectedDates.startDate, "day")
                : 1}{" "}
              days
            </Text>
            <Text className="font-pmedium text-gray-800">
              ₱{calculateTotalPrice()}
            </Text>
          </View>

          {downpaymentPercentage && (
            <View>
              <View className="border-t border-gray-200 my-2" />
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-orange-400 font-pmedium">
                  Required Downpayment ({downpaymentPercentage}%)
                </Text>
                <Text className="font-psemibold text-orange-400">
                  ₱
                  {(
                    calculateTotalPrice() *
                    (downpaymentPercentage / 100)
                  ).toFixed(2)}
                </Text>
              </View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-600 font-pmedium">
                  Balance on Return ({100 - downpaymentPercentage}%)
                </Text>
                <Text className="font-psemibold text-gray-800">
                  ₱
                  {(
                    calculateTotalPrice() *
                    ((100 - downpaymentPercentage) / 100)
                  ).toFixed(2)}
                </Text>
              </View>
            </View>
          )}
          <View className="border-t border-gray-200 my-2" />
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-psemibold text-gray-800">
              Total Amount
            </Text>
            <Text className="text-lg font-pbold text-primary">
              ₱{calculateTotalPrice().toFixed(2)}
            </Text>
          </View>
        </View>

        <View className="mb-6 p-4 border border-gray-200 rounded-xl">
          <Text className="text-lg font-psemibold text-gray-700 mb-3">
            Agreement
          </Text>

          {/* <TouchableOpacity
            onPress={() => setShowTermsModal(true)}
            className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <Text className="text-blue-600 font-pmedium text-sm text-center">
              Read Terms & Conditions
            </Text>
          </TouchableOpacity> */}

          <TouchableOpacity
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            className="flex-row items-center"
          >
            <View
              className={`w-5 h-5 border-2 rounded mr-3 items-center justify-center ${
                acceptedTerms ? "bg-primary border-primary" : "border-gray-300"
              }`}
            >
              {acceptedTerms && (
                <Text className="text-white text-xs font-bold">✓</Text>
              )}
            </View>
            <Text className="flex-1 text-sm text-gray-600 leading-5">
              I have read and agree to the{" "}
              <Text
                className="text-primary font-pmedium"
                onPress={() => setShowTermsModal(true)}
              >
                Terms & Conditions
              </Text>{" "}
              for this rental agreement
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="p-4 border-t border-gray-100 bg-white">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            !selectedDates.startDate ||
            !selectedDates.endDate ||
            !message.trim() ||
            message.trim().length < 10 ||
            !acceptedTerms
              ? "bg-gray-300"
              : "bg-primary"
          }`}
          onPress={() => {
            if (!validateForm()) return;

            onSubmit({
              startDate: (() => {
                const [time, modifier] = selectedTime.split(" ");
                let [hours, minutes] = time.split(":").map(Number);
                if (modifier === "PM" && hours < 12) hours += 12;
                if (modifier === "AM" && hours === 12) hours = 0;
                return selectedDates
                  .startDate!.hour(hours)
                  .minute(minutes)
                  .toDate();
              })(),
              endDate: (() => {
                const [time, modifier] = selectedTime.split(" ");
                let [hours, minutes] = time.split(":").map(Number);
                if (modifier === "PM" && hours < 12) hours += 12;
                if (modifier === "AM" && hours === 12) hours = 0;
                return selectedDates
                  .endDate!.hour(hours)
                  .minute(minutes)
                  .toDate();
              })(),
              message,
              selectedTime,
            });
          }}
          disabled={
            !selectedDates.startDate ||
            !selectedDates.endDate ||
            !message.trim() ||
            message.trim().length < 10 ||
            !acceptedTerms
          }
        >
          <Text className="text-white font-pbold text-base">
            {!selectedDates.startDate || !selectedDates.endDate
              ? "Select Dates"
              : !message.trim()
              ? "Enter Message"
              : message.trim().length < 10
              ? "Message Too Short"
              : "Submit Request"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal />

      {/* Time Picker Modal */}
      {showTimePicker && (
        <View
          className="absolute inset-0 bg-white"
          style={{ paddingTop: insets.top }}
        >
          <View className="flex-row justify-between items-center p-2 border-b border-gray-100">
            <TouchableOpacity
              onPress={() => setShowTimePicker(false)}
              className="p-2"
            >
              <Image
                source={icons.leftArrow}
                className="w-8 h-8"
                tintColor="#6B7280"
              />
            </TouchableOpacity>
            <Text className="text-xl font-pbold text-gray-800">
              Select Time
            </Text>
            <View className="w-8 h-8" />
          </View>

          <TimePicker
            initialTime={selectedTime}
            minTime="8:00 AM"
            maxTime="6:00 PM"
            onTimeChange={(time) => {
              setSelectedTime(time);
              setShowTimePicker(false);
            }}
            onDone={() => {
              setShowTimePicker(false);
            }}
          />
        </View>
      )}
      <TermsModal />
    </View>
  );
};
