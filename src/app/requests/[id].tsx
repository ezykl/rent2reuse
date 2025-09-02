import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  TextInput,
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
import relativeTime from "dayjs/plugin/relativeTime";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import LottieView from "lottie-react-native";
import DateTimePicker, {
  DateType,
  useDefaultClassNames,
} from "react-native-ui-datepicker";

dayjs.extend(isSameOrAfter);
dayjs.extend(relativeTime);

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

interface RequestFilters {
  duration: number | null;
  dateRange: {
    startDate: Date | null;
    endDate: Date | null;
  };
  sortBy: "newest" | "oldest" | "price_asc" | "price_desc" | "duration";
  priceRange: {
    min: number;
    max: number;
  };
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
        return {
          bgColor: "bg-yellow-100",
          textColor: "text-yellow-700",
        };
      case "approved":
        return {
          bgColor: "bg-green-100",
          textColor: "text-green-700",
        };
      case "rejected":
        return {
          bgColor: "bg-red-100",
          textColor: "text-red-700",
        };
      default:
        return {
          bgColor: "bg-gray-100",
          textColor: "text-gray-700",
        };
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
            </View>
            <View className="flex-1">
              <Text className="font-pbold text-gray-800 text-base">
                {getFullName()}
              </Text>
              <Text className="text-xs font-pregular text-gray-500 mt-1">
                Joined {dayjs(request.createdAt).format("MMM YYYY")}
              </Text>
            </View>

            {/* Request Time Badge */}
            <View className="flex-col items-end gap-2">
              <View className=" bg-gray-100/80 px-3 py-1 rounded-full">
                <Text className="text-xs font-pmedium text-gray-600">
                  {dayjs(request.createdAt).fromNow()}
                </Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  getStatusColor(request.status).bgColor
                }`}
              >
                <Text
                  className={`text-xs font-pbold capitalize ${
                    getStatusColor(request.status).textColor
                  }`}
                >
                  {request.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Status Badge - Enhanced */}

        <View className="bg-gray-50 rounded-lg p-3  flex-row justify-between">
          <View className="gap-2">
            <View className="flex-row justify-between items-center">
              <View className="flex-row items-center">
                <Image
                  source={icons.calendar}
                  className="w-4 h-4 mr-2"
                  tintColor="#4B5563"
                />
                <Text className="text-sm font-pmedium text-gray-600">
                  {formatShortDate(request.startDate)} -{" "}
                  {formatShortDate(request.endDate)}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center ">
              <Image
                source={icons.clock}
                className="w-4 h-4 mr-2"
                tintColor="#4B5563"
              />
              <Text className="text-sm font-pmedium text-gray-600">
                Pickup at {minutesToTime(Number(request.pickupTime))}
              </Text>
            </View>
          </View>
          {/* Price */}
          <View className="items-end">
            <Text className="font-pbold text-green-600 text-xl">
              ₱{request.totalPrice.toLocaleString()}
            </Text>
            <Text className="text-xs font-pmedium text-gray-500">
              for {request.rentalDays} day
              {request.rentalDays !== 1 ? "s" : ""}
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
  const [allRequests, setAllRequests] = useState<RequestType[]>([]); // Store original data
  const [filteredRequests, setFilteredRequests] = useState<RequestType[]>([]); // Store filtered data
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const defaultClassNames = useDefaultClassNames();
  const [showCalendar, setShowCalendar] = useState(false);
  const toggleCardExpansion = (requestId: string) => {
    setExpandedCard(expandedCard === requestId ? null : requestId);
  };
  const { minutesToTime } = useTimeConverter();
  const today = dayjs().add(1, "day").startOf("day");
  const minimumDate = today.toDate();
  // Add filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RequestFilters>({
    duration: null,
    dateRange: {
      startDate: null,
      endDate: null,
    },
    sortBy: "newest",
    priceRange: {
      min: 0,
      max: 10000,
    },
  });

  // Add a new state for temporary filters
  const [tempFilters, setTempFilters] = useState<RequestFilters>({
    duration: null,
    dateRange: {
      startDate: null,
      endDate: null,
    },
    sortBy: "newest",
    priceRange: {
      min: 0,
      max: 10000,
    },
  });

  useEffect(() => {
    fetchItemAndRequests();
  }, [id]);

  // Initialize tempFilters when opening modal
  useEffect(() => {
    if (showFilters) {
      setTempFilters(filters);
    }
  }, [showFilters]);

  const applyFilters = (currentFilters: RequestFilters) => {
    let filtered = [...allRequests];

    // Apply duration filter
    if (currentFilters.duration) {
      filtered = filtered.filter(
        (request) => request.rentalDays <= currentFilters.duration!
      );
    }

    // Apply date range filter
    if (
      currentFilters.dateRange.startDate ||
      currentFilters.dateRange.endDate
    ) {
      filtered = filtered.filter((request) => {
        const requestStart = dayjs(request.startDate.toDate());

        if (
          currentFilters.dateRange.startDate &&
          currentFilters.dateRange.endDate
        ) {
          // Check if request start date falls within the selected range
          return (
            requestStart.isAfter(
              dayjs(currentFilters.dateRange.startDate).startOf("day")
            ) &&
            requestStart.isBefore(
              dayjs(currentFilters.dateRange.endDate).endOf("day")
            )
          );
        } else if (currentFilters.dateRange.startDate) {
          return requestStart.isAfter(
            dayjs(currentFilters.dateRange.startDate).startOf("day")
          );
        } else if (currentFilters.dateRange.endDate) {
          return requestStart.isBefore(
            dayjs(currentFilters.dateRange.endDate).endOf("day")
          );
        }
        return true;
      });
    }

    // Apply sorting
    switch (currentFilters.sortBy) {
      case "oldest":
        filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case "price_asc":
        filtered.sort((a, b) => a.totalPrice - b.totalPrice);
        break;
      case "price_desc":
        filtered.sort((a, b) => b.totalPrice - a.totalPrice);
        break;
      case "duration":
        filtered.sort((a, b) => a.rentalDays - b.rentalDays);
        break;
      default: // "newest"
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    setFilteredRequests(filtered);
  };

  // Apply filters whenever filters change or data is loaded
  // useEffect(() => {
  //   applyFilters();
  // }, [filters, allRequests]);

  // Update the fetchItemAndRequests function
  const fetchItemAndRequests = async () => {
    try {
      setIsLoading(true);
      const requestsRef = collection(db, "rentRequests");
      const q = query(requestsRef, where("itemId", "==", id));
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

      // Store original data
      setAllRequests(requestsData);

      // Apply initial sorting without filters
      const initialSorted = [...requestsData].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      setFilteredRequests(initialSorted);
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
      setIsLoading(true);

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

      // Update both original and filtered data
      const updateRequests = (prevRequests: RequestType[]) =>
        prevRequests.map((request) =>
          request.id === requestId
            ? { ...request, status: newStatus as any }
            : request
        );

      setAllRequests(updateRequests);
      setFilteredRequests(updateRequests);

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

  // Replace the FilterModal component with this:
  // Add this helper function to count active filters
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.duration !== null) count++;
    if (
      filters.dateRange.startDate !== null ||
      filters.dateRange.endDate !== null
    )
      count++;
    if (filters.sortBy !== "newest") count++;
    if (filters.priceRange.min !== 0 || filters.priceRange.max !== 10000)
      count++;
    return count;
  };

  // First, update the date picker modal to be a separate component
  const DatePickerModal = ({
    visible,
    onClose,
    tempFilters,
    setTempFilters,
  }: {
    visible: boolean;
    onClose: () => void;
    tempFilters: RequestFilters;
    setTempFilters: (filters: RequestFilters) => void;
  }) => {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-black/50">
          <View className="bg-white mt-auto rounded-t-3xl">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <Text className="text-lg font-pbold">Select Dates</Text>
              <TouchableOpacity onPress={onClose}>
                <Image source={icons.close} className="w-6 h-6" />
              </TouchableOpacity>
            </View>

            <View className="p-4">
              <DateTimePicker
                mode="range"
                startDate={tempFilters.dateRange.startDate}
                endDate={tempFilters.dateRange.endDate}
                disableMonthPicker
                disableYearPicker
                onChange={(date: any) => {
                  setTempFilters({
                    ...tempFilters,
                    dateRange: {
                      startDate: date.startDate as Date,
                      endDate: date.endDate as Date,
                    },
                  });
                }}
                showOutsideDays={true}
                classNames={{
                  ...useDefaultClassNames(),
                  weekday_label: "text-secondary-300 font-pregular",
                  year_selector_label: "font-pbold text-xl text-primary",
                  month_selector_label: "font-pbold text-xl text-primary",
                  day_label: "font-pregular text-lg",
                  month_label: "font-pregular text-lg",
                  year_label: "font-pregular text-lg",
                  selected_month_label: "text-white",
                  selected_year_label: "text-white",
                  outside_label: "text-gray-400",
                  range_fill: "bg-primary/20",
                  range_middle_label: "text-gray-600",
                  range_start_label: "text-white font-pmedium",
                  range_end_label: "text-white font-pmedium",
                  range_start: "bg-primary border-2 border-primary",
                  range_end: "bg-primary border-2 border-primary",
                  day: `${defaultClassNames.day} hover:bg-amber-100`,
                  disabled: "opacity-50",
                }}
              />
            </View>

            <View className="p-4 border-t border-gray-200">
              <TouchableOpacity
                onPress={onClose}
                className="bg-primary py-3 rounded-lg"
              >
                <Text className="text-white text-center font-pbold">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Then update the FilterSheet component to use the new DatePickerModal
  const FilterSheet = () => (
    <>
      {showFilters && (
        <View className="absolute inset-0 z-50">
          {/* Backdrop */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              setTempFilters(filters);
              setShowFilters(false);
            }}
            className="absolute inset-0 bg-black/50"
          />

          {/* Filter Sheet */}
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-pbold">Filter Requests</Text>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Image source={icons.close} className="w-6 h-6" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Duration Filter */}
              <View className="mb-6">
                <Text className="text-base font-psemibold mb-3">
                  Maximum Rental Duration (days)
                </Text>
                <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3">
                  <TextInput
                    value={
                      tempFilters.duration
                        ? tempFilters.duration.toString()
                        : ""
                    }
                    onChangeText={(text) => {
                      const num = parseInt(text) || null;
                      setTempFilters((prev) => ({ ...prev, duration: num }));
                    }}
                    placeholder="Enter max days"
                    keyboardType="numeric"
                    className="flex-1 font-pmedium text-gray-800"
                    maxLength={3}
                  />
                  {tempFilters.duration && (
                    <TouchableOpacity
                      onPress={() =>
                        setTempFilters((prev) => ({ ...prev, duration: null }))
                      }
                      className="ml-2"
                    >
                      <Image
                        source={icons.close}
                        className="w-5 h-5"
                        tintColor="#6B7280"
                      />
                    </TouchableOpacity>
                  )}
                </View>
                <Text className="text-xs text-gray-500 mt-1">
                  Show requests with rental duration up to this many days
                </Text>
              </View>

              {/* Date Range Filter */}
              <View className="mb-6">
                <Text className="text-base font-psemibold mb-3">
                  Request Date Range
                </Text>

                {/* Date Range Display Button */}
                <TouchableOpacity
                  onPress={() => setShowCalendar(true)}
                  className="bg-gray-100 rounded-lg px-4 py-3 flex-row justify-between items-center"
                >
                  <Text className="font-pmedium text-gray-800">
                    {tempFilters.dateRange.startDate
                      ? dayjs(tempFilters.dateRange.startDate).format(
                          "MMM D, YYYY"
                        )
                      : "Start Date"}
                    {" - "}
                    {tempFilters.dateRange.endDate
                      ? dayjs(tempFilters.dateRange.endDate).format(
                          "MMM D, YYYY"
                        )
                      : "End Date"}
                  </Text>
                  <Image
                    source={icons.calendar}
                    className="w-5 h-5"
                    tintColor="#374151"
                  />
                </TouchableOpacity>

                {/* Clear Dates Button */}
                {(tempFilters.dateRange.startDate ||
                  tempFilters.dateRange.endDate) && (
                  <TouchableOpacity
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        dateRange: { startDate: null, endDate: null },
                      }))
                    }
                    className="mt-2"
                  >
                    <Text className="text-primary font-pmedium">
                      Clear Dates
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Date Picker Modal */}
                {showCalendar && (
                  <Modal
                    visible={showCalendar}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowCalendar(false)}
                  >
                    <View className="flex-1 bg-black/50">
                      <View className="bg-white mt-auto rounded-t-3xl">
                        {/* Header */}
                        <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
                          <Text className="text-lg font-pbold">
                            Select Dates
                          </Text>
                          <TouchableOpacity
                            onPress={() => setShowCalendar(false)}
                            hitSlop={{
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10,
                            }}
                          >
                            <Image source={icons.close} className="w-6 h-6" />
                          </TouchableOpacity>
                        </View>

                        {/* Date Picker */}
                        <View className="p-4">
                          <DateTimePicker
                            mode="range"
                            startDate={tempFilters.dateRange.startDate}
                            endDate={tempFilters.dateRange.endDate}
                            onChange={(date: any) => {
                              setTempFilters((prev) => ({
                                ...prev,
                                dateRange: {
                                  startDate: date.startDate as Date,
                                  endDate: date.endDate as Date,
                                },
                              }));
                            }}
                            showOutsideDays={true}
                            classNames={{
                              ...useDefaultClassNames(),
                              weekday_label: "text-secondary-300 font-pregular",
                              year_selector_label:
                                "font-pbold text-xl text-primary",
                              month_selector_label:
                                "font-pbold text-xl text-primary",
                              day_label: "font-pregular text-lg",
                              month_label: "font-pregular text-lg",
                              year_label: "font-pregular text-lg",
                              selected_month_label: "text-white",
                              selected_year_label: "text-white",
                              outside_label: "text-gray-400",
                              range_fill: "bg-primary/20",
                              range_middle_label: "text-gray-600",
                              range_start_label: "text-white font-pmedium",
                              range_end_label: "text-white font-pmedium",
                              range_start: "bg-primary border-2 border-primary",
                              range_end: "bg-primary border-2 border-primary",
                              day: `${defaultClassNames.day} hover:bg-amber-100`,
                              disabled: "opacity-50",
                            }}
                          />
                        </View>

                        {/* Footer */}
                        <View className="p-4 border-t border-gray-200">
                          <TouchableOpacity
                            onPress={() => setShowCalendar(false)}
                            className="bg-primary py-3 rounded-lg"
                          >
                            <Text className="text-white text-center font-pbold">
                              Done
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Modal>
                )}
              </View>

              {/* Sort Options */}
              <View className="mb-6">
                <Text className="text-base font-psemibold mb-3">Sort By</Text>
                {[
                  { label: "Newest First", value: "newest" as const },
                  { label: "Oldest First", value: "oldest" as const },
                  { label: "Price: Low to High", value: "price_asc" as const },
                  { label: "Price: High to Low", value: "price_desc" as const },
                  { label: "Duration", value: "duration" as const },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() =>
                      setTempFilters((prev) => ({
                        ...prev,
                        sortBy: option.value,
                      }))
                    }
                    className={`flex-row items-center py-3 rounded-lg px-2 ${
                      tempFilters.sortBy === option.value ? "bg-blue-50" : ""
                    }`}
                  >
                    <View
                      className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        tempFilters.sortBy === option.value
                          ? "border-primary bg-primary"
                          : "border-gray-300"
                      }`}
                    />
                    <Text
                      className={
                        tempFilters.sortBy === option.value
                          ? "text-primary font-pmedium"
                          : "text-gray-600 font-pregular"
                      }
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Apply and Reset Buttons */}
            <View className="flex-row gap-3 mt-4 pt-4 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => {
                  const resetFilters: RequestFilters = {
                    duration: null,
                    dateRange: {
                      startDate: null,
                      endDate: null,
                    },
                    sortBy: "newest" as const,
                    priceRange: { min: 0, max: 10000 },
                  };
                  setTempFilters(resetFilters);
                }}
                className="flex-1 py-4 rounded-xl border border-gray-200"
              >
                <Text className="text-center font-pmedium text-gray-600">
                  Reset
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setFilters(tempFilters);
                  applyFilters(tempFilters); // Pass tempFilters directly
                  setShowFilters(false);
                }}
                className="flex-1 bg-primary py-4 rounded-xl"
              >
                <Text className="text-white text-center font-pbold">
                  Apply Filters
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );

  // Update the return statement of ViewRequests
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
            {getActiveFiltersCount() > 0 && (
              <Text className="text-xs text-primary font-pmedium">
                {getActiveFiltersCount()} filter
                {getActiveFiltersCount() > 1 ? "s" : ""} active
              </Text>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="relative"
          >
            <Image
              source={icons.filter}
              className="w-8 h-8"
              tintColor="#374151"
            />
            {getActiveFiltersCount() > 0 && (
              <View className="absolute -top-1 -right-1 bg-primary w-5 h-5 rounded-full items-center justify-center">
                <Text className="text-white text-xs font-pbold">
                  {getActiveFiltersCount()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Summary */}
      {getActiveFiltersCount() > 0 && (
        <View className="px-4 py-1">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {filters.duration !== null && (
                <View className="bg-primary px-3 py-2 rounded-full flex-row items-center">
                  <Text className="text-white text-sm font-pmedium mr-1">
                    {filters.duration} day{filters.duration !== 1 ? "s" : ""}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newFilters = { ...filters, duration: null };
                      setFilters(newFilters);
                      applyFilters(newFilters); // Apply filters immediately after removing
                    }}
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      tintColor="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {filters.dateRange.startDate && (
                <View className="bg-primary px-3 py-2 rounded-full flex-row items-center">
                  <Text className="text-white text-sm font-pmedium mr-1">
                    {dayjs(filters.dateRange.startDate).format("MMM D")}
                    {filters.dateRange.endDate &&
                      ` - ${dayjs(filters.dateRange.endDate).format("MMM D")}`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newFilters = {
                        ...filters,
                        dateRange: { startDate: null, endDate: null },
                      };
                      setFilters(newFilters);
                      applyFilters(newFilters);
                    }}
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      tintColor="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {filters.sortBy !== "newest" && (
                <View className="bg-primary px-3 py-2 rounded-full flex-row items-center">
                  <Text className="text-white text-sm font-pmedium mr-1">
                    {filters.sortBy === "oldest"
                      ? "Oldest"
                      : filters.sortBy === "price_asc"
                      ? "Price ↑"
                      : filters.sortBy === "price_desc"
                      ? "Price ↓"
                      : filters.sortBy === "duration"
                      ? "Duration"
                      : ""}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      const newFilters: RequestFilters = {
                        ...filters,
                        sortBy: "newest",
                      };
                      setFilters(newFilters);
                      applyFilters(newFilters);
                    }}
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      tintColor="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Clear All button */}
              <TouchableOpacity
                onPress={() => {
                  const resetFilters: RequestFilters = {
                    duration: null,
                    dateRange: { startDate: null, endDate: null },
                    sortBy: "newest" as const,
                    priceRange: { min: 0, max: 10000 },
                  };
                  setFilters(resetFilters);
                  applyFilters(resetFilters);
                }}
                className="bg-gray-200 px-3 py-2 rounded-full"
              >
                <Text className="text-gray-600 text-sm font-pmedium">
                  Clear All
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Results Counter */}
      <View className="px-4 py-2">
        {!isLoading && (
          <Text className="text-sm font-pmedium text-gray-600">
            {filteredRequests.length} request
            {filteredRequests.length !== 1 ? "s" : ""} found
            {allRequests.length !== filteredRequests.length && (
              <Text className="text-gray-400">
                {" "}
                of {allRequests.length} total
              </Text>
            )}
          </Text>
        )}
      </View>

      {/* Requests List */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {isLoading ? (
          <View className="flex-1 justify-center items-center py-24">
            <LottieView
              source={require("../../assets/searchingAnimation.json")}
              autoPlay
              loop
              style={{ width: 200, height: 200 }}
            />
            <Text className="text-base font-pmedium text-gray-600 mt-4">
              Fetching requests...
            </Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View className="flex-1 justify-center items-center py-24">
            <Image
              source={icons.emptyBox}
              className="w-16 h-16 mb-4"
              tintColor="#9CA3AF"
            />

            <Text className="text-lg font-pmedium text-gray-600 mb-2">
              {allRequests.length === 0
                ? "No Requests Yet"
                : "No Matching Requests"}
            </Text>
            <Text className="text-sm font-pregular text-gray-500 text-center px-8 mx-4">
              {allRequests.length === 0
                ? "Rental requests will appear here when users want to rent your item."
                : "Try adjusting your filters to see more results."}
            </Text>

            {getActiveFiltersCount() > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setFilters({
                    duration: null,
                    dateRange: {
                      startDate: null,
                      endDate: null,
                    },
                    sortBy: "newest",
                    priceRange: { min: 0, max: 10000 },
                  });
                }}
                className="mt-4 bg-primary px-6 py-3 rounded-full"
              >
                <Text className="text-white font-pmedium">Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredRequests.map((request) => (
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

      <FilterSheet />
    </SafeAreaView>
  );
};

export default ViewRequests;
