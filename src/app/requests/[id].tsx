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
  startDate: Date | null;
  sortBy: "newest" | "oldest" | "price_asc" | "price_desc" | "duration";
  priceRange: {
    min: number;
    max: number;
  };
}

// Simple Date Picker Component
const SimpleDatePicker: React.FC<{
  value: Date | null;
  onSelect: (date: Date) => void;
  onClear: () => void;
}> = ({ value, onSelect, onClear }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const today = new Date();
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} className="w-10 h-10" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = value && date.toDateString() === value.toDateString();
      const isPast = date < today && !isToday;

      days.push(
        <TouchableOpacity
          key={day}
          onPress={() => {
            if (!isPast) {
              onSelect(date);
              setShowPicker(false);
            }
          }}
          disabled={isPast}
          className={`w-10 h-10 items-center justify-center rounded-full ${
            isSelected
              ? "bg-primary"
              : isToday
              ? "bg-blue-100"
              : isPast
              ? "opacity-30"
              : ""
          }`}
        >
          <Text
            className={`text-sm ${
              isSelected
                ? "text-white font-pbold"
                : isToday
                ? "text-primary font-psemibold"
                : isPast
                ? "text-gray-300"
                : "text-gray-700"
            }`}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );
    }

    return days;
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        className="flex-row items-center justify-between bg-gray-100 rounded-lg px-4 py-3"
      >
        <Text
          className={`${
            value ? "text-gray-800" : "text-gray-500"
          } font-pmedium`}
        >
          {value ? dayjs(value).format("MMM D, YYYY") : "Select date"}
        </Text>
        <Image
          source={icons.calendar}
          className="w-5 h-5"
          tintColor="#6B7280"
        />
      </TouchableOpacity>

      {value && (
        <TouchableOpacity onPress={onClear} className="mt-2">
          <Text className="text-primary font-pmedium text-center">
            Clear Date
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white rounded-2xl p-4 mx-6 w-100">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity
                onPress={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(selectedYear - 1);
                  } else {
                    setSelectedMonth(selectedMonth - 1);
                  }
                }}
                className="p-2"
              >
                <Image
                  source={icons.leftArrow}
                  className="w-6 h-6"
                  tintColor="#374151"
                />
              </TouchableOpacity>

              <Text className="font-pbold text-lg">
                {months[selectedMonth]} {selectedYear}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(selectedYear + 1);
                  } else {
                    setSelectedMonth(selectedMonth + 1);
                  }
                }}
                className="p-2"
              >
                <Image
                  source={icons.rightArrow}
                  className="w-6 h-6"
                  tintColor="#374151"
                />
              </TouchableOpacity>
            </View>

            {/* Days of week */}
            <View className="flex-row justify-between mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <Text
                  key={index}
                  className="w-10 text-center font-psemibold text-gray-600 text-xs"
                >
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap">{renderCalendar()}</View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setShowPicker(false)}
              className="mt-4 bg-gray-100 py-3 rounded-lg"
            >
              <Text className="text-center font-pmedium text-gray-600">
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

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
            <View className="flex-col items-end space-y-1">
              <View className=" bg-gray-100/80 px-3 py-1 rounded-full">
                <Text className="text-xs font-pmedium text-gray-600">
                  {dayjs(request.createdAt).fromNow()}
                </Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${getStatusColor(
                  request.status
                )}`}
              >
                <Text className="text-xs font-pbold capitalize">
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

  const toggleCardExpansion = (requestId: string) => {
    setExpandedCard(expandedCard === requestId ? null : requestId);
  };
  const { minutesToTime } = useTimeConverter();

  // Add filter states
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<RequestFilters>({
    duration: null,
    startDate: null,
    priceRange: {
      min: 0,
      max: 10000,
    },
    sortBy: "newest",
  });

  // Add a new state for temporary filters
  const [tempFilters, setTempFilters] = useState<RequestFilters>({
    duration: null,
    startDate: null,
    priceRange: {
      min: 0,
      max: 10000,
    },
    sortBy: "newest",
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

    // Apply start date filter
    if (currentFilters.startDate) {
      filtered = filtered.filter((request) =>
        dayjs(request.startDate.toDate()).isSameOrAfter(
          currentFilters.startDate,
          "day"
        )
      );
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

      // Sort by newest first by default
      const sortedData = [...requestsData].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      setAllRequests(sortedData);
      setFilteredRequests(sortedData); // Set filtered requests with default sorting
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
    if (filters.startDate !== null) count++;
    if (filters.sortBy !== "newest") count++;
    if (filters.priceRange.min !== 0 || filters.priceRange.max !== 10000)
      count++;
    return count;
  };

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

              {/* Start Date Filter */}
              <View className="mb-6">
                <Text className="text-base font-psemibold mb-3 ">
                  Start From
                </Text>
                <SimpleDatePicker
                  value={tempFilters.startDate}
                  onSelect={(date) =>
                    setTempFilters((prev) => ({ ...prev, startDate: date }))
                  }
                  onClear={() =>
                    setTempFilters((prev) => ({ ...prev, startDate: null }))
                  }
                />
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
                  setTempFilters({
                    duration: null,
                    startDate: null,
                    sortBy: "newest",
                    priceRange: { min: 0, max: 10000 },
                  });
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
                  applyFilters(tempFilters);
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
              source={icons.filter || icons.setting}
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
                    onPress={() =>
                      setFilters((prev) => ({ ...prev, duration: null }))
                    }
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      tintColor="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {filters.startDate && (
                <View className="bg-primary px-3 py-2 rounded-full flex-row items-center">
                  <Text className="text-white text-sm font-pmedium mr-1">
                    From {dayjs(filters.startDate).format("MMM D")}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      setFilters((prev) => ({ ...prev, startDate: null }))
                    }
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
                    onPress={() =>
                      setFilters((prev) => ({ ...prev, sortBy: "newest" }))
                    }
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      tintColor="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}
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
                    startDate: null,
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
