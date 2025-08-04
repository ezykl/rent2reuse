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
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import DateTimePicker, {
  useDefaultClassNames,
} from "react-native-ui-datepicker";
import type { DateType } from "react-native-ui-datepicker";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
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
import type { PinchGestureHandlerGestureEvent } from "react-native-gesture-handler";
import { checkAndUpdateLimits } from "@/utils/planLimits";
import { Toast, ALERT_TYPE } from "react-native-alert-notification";
import ImageView from "react-native-image-viewing";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  useAnimatedGestureHandler,
  runOnJS,
} from "react-native-reanimated";
import {
  PinchGestureHandler,
  PanGestureHandler,
  GestureHandlerRootView,
  State,
} from "react-native-gesture-handler";
import TimePicker from "@/components/TimePicker";
import { useTimeConverter } from "@/hooks/useTimeConverter";

// Add this type for rent requests
interface RentRequest {
  itemId: string;
  itemName: string;
  price: number;
  requesterId: string;
  ownerId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: any;
}

// Update the UserRating interface to make properties optional
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

const { width, height } = Dimensions.get("window");

export default function ItemDetails() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<Item | null>(null);
  const { isLoading, setIsLoading } = useLoader();
  const [activeIndex, setActiveIndex] = useState(0);
  const { user } = useAuth();
  const { timeToMinutes } = useTimeConverter();

  const [hasExistingRequest, setHasExistingRequest] = useState(false);
  const [existingRequestData, setExistingRequestData] = useState<{
    id: string;
    status: string;
    chatId: string;
  } | null>(null);
  const [ownerRating, setOwnerRating] = useState<UserRating | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  // Add these state declarations at the top of your component
  const [fullscreenImageVisible, setFullscreenImageVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Add new state for form visibility
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Add this state for time picker visibility
  const [showTimePickerView, setShowTimePickerView] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<"start" | "end">(
    "start"
  );

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
        setIsLoading(true);
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
        setIsLoading(false);
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
    }
  }, [item, user]);

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
      const limitCheck = await checkAndUpdateLimits(user.uid, "rent");
      if (!limitCheck.success) {
        Alert.alert("Plan Limit", limitCheck.message);
        return;
      }

      // Format dates as "Month DD, YYYY"
      const formattedStartDate = dayjs(formData.startDate).format(
        "MMMM DD, YYYY"
      );
      const formattedEndDate = dayjs(formData.endDate).format("MMMM DD, YYYY");

      const pickupTimeInMinutes = timeToMinutes(formData.selectedTime);

      // Create rent request with complete data
      const requesterFullName = [
        user?.firstname ?? "",
        user?.middlename ?? "",
        user?.lastname ?? "",
      ]
        .filter((name) => name && name.trim().length > 0)
        .join(" ");

      const rentRequestRef = await addDoc(collection(db, "rentRequests"), {
        itemId: item?.id ?? "",
        itemName: item?.itemName ?? "",
        itemImage: item?.images?.[0] ?? "",
        requesterId: user?.uid ?? "",
        requesterName: requesterFullName,
        ownerId: item?.owner?.id ?? "",
        ownerName: item?.owner?.fullname ?? "",
        status: "pending",
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        pickupTime: pickupTimeInMinutes,
        message: formData.message,
        totalPrice:
          Math.max(
            1,
            Math.ceil(
              (formData.endDate.getTime() - formData.startDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          ) * (item?.itemPrice ?? 0),
        createdAt: serverTimestamp(),
      });

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
      router.push(`/profile/${item.owner.id}`);
    }
  };

  // Determine if the current user is the owner of the item
  const isCurrentUserOwner = item?.owner?.id === user?.uid;

  return (
    <View
      className="absolute inset-0 bg-white"
      style={{ paddingTop: insets.top }}
    >
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
                        setCurrentImageIndex(index);
                        setFullscreenImageVisible(true);
                      }}
                      className="flex-1 items-center justify-center p-2"
                    >
                      <View className="w-full h-full relative">
                        <Image
                          source={{ uri: imageUrl as string }}
                          className="w-full h-full rounded-2xl"
                          resizeMode="cover"
                        />

                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.7)"]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          className="absolute bottom-0 left-0 right-0 h-32 rounded-b-2xl p-4"
                          style={{ borderRadius: 16 }}
                        ></LinearGradient>
                      </View>
                    </TouchableOpacity>
                  )}
                />

                {/* Move price and title to bottom with gradient */}
                <View className="absolute bottom-0 left-6 right-6">
                  {/* Title and Price Container */}
                  <View className="rounded-xl pb-2">
                    <Text
                      className="text-white text-2xl font-bold mb-1"
                      numberOfLines={1}
                    >
                      {item.itemName}
                    </Text>
                    <View className="flex-row items-baseline">
                      <Text className="text-3xl font-bold text-primary">
                        ₱{item?.itemPrice ?? ""}
                      </Text>
                      <Text className="text-white text-base ml-1">/day</Text>
                    </View>
                  </View>
                </View>

                {/* Image Counter */}
                <View className="absolute top-6 right-6 bg-black/50 px-3 py-1 rounded-full">
                  <Text className="text-white text-sm font-medium">
                    {activeIndex + 1}/{item.images.length}
                  </Text>
                </View>

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
              <View className="flex-1 items-center justify-center">
                <View className="w-24 h-24 bg-gray-200 rounded-2xl items-center justify-center mb-3">
                  <Image
                    source={images.thumbnail}
                    className="w-40 h-40 opacity-50"
                    resizeMode="contain"
                  />
                </View>
                <Text className="text-gray-400 text-base">
                  No images available
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Product Info */}
        <View className="px-4 ">
          {/* Owner Badge with Dynamic Rating */}
          <TouchableOpacity
            className="flex-row items-center my-4  rounded-xl"
            onPress={handleProfilePress}
            activeOpacity={0.7}
          >
            {/* Profile Image or Letter Avatar */}
            {item && item.owner?.profileImage ? (
              <Image
                source={{ uri: item.owner.profileImage }}
                className="w-10 h-10 rounded-full mr-3"
                resizeMode="cover"
              />
            ) : (
              <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center mr-3">
                <Text className="text-primary font-bold text-sm">
                  {(item && item.owner?.fullname?.charAt(0)?.toUpperCase()) ||
                    "U"}
                </Text>
              </View>
            )}

            <View className="flex-1">
              <Text className="text-gray-800 text-base font-medium">
                {item?.owner?.fullname ?? ""}
              </Text>
              <View className="flex-row items-center mt-1">
                {ownerRating?.averageRating && ownerRating?.totalRatings ? (
                  <>
                    <View className="flex-row items-center mr-2">
                      {renderStars(ownerRating.averageRating)}
                    </View>
                    <Text className="text-gray-600 text-sm">
                      {ownerRating.averageRating.toFixed(1)}
                    </Text>
                    <Text className="text-gray-400 text-sm ml-1">
                      ({ownerRating.totalRatings}{" "}
                      {ownerRating.totalRatings === 1 ? "review" : "reviews"})
                    </Text>
                  </>
                ) : (
                  <Text className="text-gray-400 text-sm">No ratings yet</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Condition & Location Quick Info */}
          <View className="flex-row mb-6">
            <View className="flex-1 bg-green-50 p-3 rounded-xl mr-2">
              <Text className="text-green-700 text-xs font-medium mb-1">
                CONDITION
              </Text>
              <Text className="text-green-800 font-semibold">
                {item?.itemCondition ?? ""}
              </Text>
            </View>
            <View className="flex-1 bg-blue-50 p-3 rounded-xl ml-2">
              <Text className="text-blue-700 text-xs font-medium mb-1">
                LOCATION
              </Text>
              <Text className="text-blue-800 font-semibold">
                {item?.itemLocation ?? ""}
              </Text>
            </View>
          </View>

          {/* Description Section */}
          <View className="mb-8">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              Description
            </Text>
            <Text className="text-gray-600 text-base leading-6">
              {item?.itemDesc}
            </Text>
          </View>

          {/* Rental Terms */}
          <View className="bg-gray-50 p-4 rounded-xl mb-6">
            <Text className="text-base font-semibold text-gray-900 mb-3">
              Rental Information
            </Text>
            <View className="space-y-2">
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Daily Rate</Text>
                <Text className="font-semibold text-gray-900">
                  ₱{item?.itemPrice}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Minimum Rental</Text>
                <Text className="font-semibold text-gray-900">1 day</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Availability</Text>
                <Text className="font-semibold text-green-600">Available</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      {!isCurrentUserOwner && (
        <SafeAreaView edges={["bottom"]}>
          <View className="bg-white border-t border-gray-100 px-4 py-4">
            <TouchableOpacity
              className={`rounded-xl ${
                hasExistingRequest ? "bg-primary" : "bg-primary"
              } ${isLoading ? "opacity-50" : ""}`}
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
              disabled={isLoading}
            >
              <View className="flex-row py-4 items-center justify-center">
                <Image
                  source={hasExistingRequest ? icons.bookmark : icons.plane}
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
      )}

      <ImageView
        images={
          item && item.images
            ? item.images.map((url) => ({
                uri: url,
                width: width, // Add dimensions
                height: width, // Square aspect ratio by default
              }))
            : []
        }
        imageIndex={initialImageIndex}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
        swipeToCloseEnabled={true}
        doubleTapToZoomEnabled={true}
        presentationStyle="overFullScreen"
        animationType="fade"
        HeaderComponent={({ imageIndex }) => (
          <SafeAreaView className="w-full">
            <View className="flex-row justify-between items-center px-4 py-2">
              <Text className="text-white font-medium">
                {imageIndex + 1} / {item?.images?.length ?? 0}
              </Text>
              <TouchableOpacity
                onPress={() => setImageViewerVisible(false)}
                className="p-2"
              >
                <Image
                  source={icons.close}
                  className="w-6 h-6"
                  tintColor="white"
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
        FooterComponent={() => (
          <SafeAreaView className="w-full">
            <View className="h-10" />
          </SafeAreaView>
        )}
      />

      {/* <FullScreenImageViewer /> */}

      <RentRequestForm
        visible={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        onSubmit={handleRequestSubmit}
        itemName={item?.itemName ?? ""}
        itemPrice={item?.itemPrice ?? 0}
        itemImage={item?.images?.[0] ?? ""}
      />
    </View>
  );
}
// Replace your existing RentRequestForm component with this updated version

const RentRequestForm = ({
  visible,
  onClose,
  onSubmit,
  itemName,
  itemPrice,
  itemImage,
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
}) => {
  if (!visible) return null;
  const insets = useSafeAreaInsets();
  const defaultClassNames = useDefaultClassNames();
  // Get current date at start of day to ensure proper comparison
  const today = dayjs().startOf("day");

  const [selectedDates, setSelectedDates] = useState<{
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  }>({
    startDate: today, // Initialize with today's date
    endDate: today.add(1, "day"), // Initialize with tomorrow's date
  });

  // Simplified to single time for both start and end
  const [selectedTime, setSelectedTime] = useState("9:00 AM");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [message, setMessage] = useState("");

  const minimumDate = today.toDate();

  // State to track current viewing month/year
  const [currentViewDate, setCurrentViewDate] = useState(today);

  const calculateTotalPrice = () => {
    if (!selectedDates.startDate || !selectedDates.endDate) return itemPrice;

    const days = selectedDates.endDate.diff(selectedDates.startDate, "day");
    return Math.max(1, days) * itemPrice;
  };

  const handleDateChange = ({
    startDate,
    endDate,
  }: {
    startDate?: Date;
    endDate?: Date;
  }) => {
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
                navigationPosition="around"
                disableMonthPicker={true}
                showOutsideDays={true}
                displayFullDays={true}
                firstDayOfWeek={0}
                onChange={handleDateChange}
                onMonthYearChange={handleMonthChange}
                classNames={{
                  ...defaultClassNames,

                  weekday_label: "text-secondary-300 font-pregular",
                  year_selector_label: "font-pbold text-xl text-primary ",
                  month_selector_label: "font-pbold text-xl text-primary ",
                  button_next:
                    "bg-primary text-white rounded-lg h-[30px] w-[30px] justify-center items-center hover:bg-primary/80",
                  button_prev:
                    "bg-primary rounded-lg h-[30px] w-[30px] justify-center items-center hover:bg-primary/80",

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
                timePicker={false}
                headerButtonStyle={{
                  backgroundColor: isCurrentMonth ? "#f3f4f6" : "#f3f4f6",
                  opacity: isCurrentMonth ? 0.3 : 1,
                }}
                headerButtonsPosition="around"
              />
            </View>

            {/* Day Count Display */}
            {selectedDates.startDate && selectedDates.endDate && (
              <View className="mt-4 bg-primary/10 p-4 rounded-xl">
                <Text className="text-center text-primary font-psemibold">
                  {dayCount} {dayCount === 1 ? "day" : "days"} selected
                </Text>
                <Text className="text-center text-gray-600 text-sm mt-1">
                  {selectedDates.startDate.format("MMM DD")} -{" "}
                  {selectedDates.endDate.format("MMM DD, YYYY")}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Set Date Button */}
          <View className="p-4 border-t border-gray-100">
            <TouchableOpacity
              className={`py-4 rounded-xl items-center ${
                !selectedDates.startDate || !selectedDates.endDate
                  ? "bg-gray-300"
                  : "bg-primary"
              }`}
              onPress={() => {
                if (validateForm()) {
                  setShowDatePicker(false);
                }
              }}
              disabled={!selectedDates.startDate || !selectedDates.endDate}
            >
              <Text className="text-white font-pbold text-base">
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
        <View className="flex-row items-center p-3 bg-gray-50 rounded-xl my-4">
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
        <View className="mb-6">
          <Text className="text-base font-psemibold text-gray-700 mb-2">
            Rental Period
          </Text>

          {/* Date Selection Button */}
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="p-4 bg-gray-50 rounded-xl mb-3"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-gray-500 mb-1">Rental Dates</Text>
                <Text className="font-psemibold text-gray-800">
                  {selectedDates.startDate && selectedDates.endDate
                    ? `${selectedDates.startDate.format(
                        "MMM DD"
                      )} - ${selectedDates.endDate.format("MMM DD, YYYY")}`
                    : "Select rental dates"}
                </Text>
                {selectedDates.startDate && selectedDates.endDate && (
                  <Text className="text-sm text-gray-500 mt-1">
                    {selectedDates.endDate.diff(selectedDates.startDate, "day")}{" "}
                    days
                  </Text>
                )}
              </View>
              <Image
                source={icons.calendar}
                className="w-5 h-5"
                tintColor="#6B7280"
              />
            </View>
          </TouchableOpacity>

          {/* Time Selection */}
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            className="p-4 bg-gray-50 rounded-xl"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-gray-500 mb-1">Pickup Time</Text>
                <Text className="font-psemibold text-gray-800">
                  {selectedTime}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Avoid any delays
                </Text>
              </View>
              <Image
                source={icons.clock}
                className="w-5 h-5"
                tintColor="#6B7280"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Message */}
        <View className="mb-6">
          <Text className="text-base font-psemibold text-gray-700 mb-2">
            Message to Owner
          </Text>
          <Text className="text-xs text-gray-500 mb-2">
            Please include a message or note for the owner. Conversation will
            only start if the owner responds to your request.
          </Text>
          <View>
            <TextInput
              className={`p-3 bg-gray-50 rounded-xl ${
                message.trim().length > 0 && message.trim().length < 10
                  ? "border border-orange-400"
                  : ""
              }`}
              placeholder="Enter your message here..."
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

        {/* Total Price with Duration */}
        <View className="flex-row justify-between items-center p-4 bg-gray-50 rounded-xl mb-6">
          <View>
            <Text className="text-base font-psemibold text-gray-700">
              Total Price
            </Text>
            {selectedDates.startDate && selectedDates.endDate && (
              <Text className="text-sm text-gray-500">
                for {selectedDates.endDate.diff(selectedDates.startDate, "day")}{" "}
                days
              </Text>
            )}
          </View>
          <Text className="text-xl font-pbold text-primary">
            ₱{calculateTotalPrice()}
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="p-4 border-t border-gray-100 bg-white">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            !selectedDates.startDate ||
            !selectedDates.endDate ||
            !message.trim() ||
            message.trim().length < 10
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
            message.trim().length < 10
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
    </View>
  );
};
