import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useMemo } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  where,
  getDocs,
  writeBatch,
  limit,
  deleteDoc,
  Query,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import {
  format,
  isToday,
  isYesterday,
  differenceInMinutes,
  isSameDay,
} from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import {
  sendPushNotification,
  sendItemUnavailableNotifications,
  sendRequestAcceptedNotification,
} from "@/utils/notificationHelper";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import RentalProgressIndicator from "@/components/RentalProgressIndicator";
import { useLoader } from "@/context/LoaderContext";
import { storage } from "@/lib/firebaseConfig";
import {
  getDownloadURL,
  ref,
  uploadBytes,
  deleteObject,
  getStorage,
} from "firebase/storage";
import { ChatCamera } from "@/components/ChatCamera";

// Helper function to check if a request has expired
const isRequestExpired = (startDate: any): boolean => {
  if (!startDate) return false;
  const date = startDate.toDate ? startDate.toDate() : startDate;
  return new Date() > date;
};

// Helper function to format timestamp for display
const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return "";

  const date = timestamp.toDate();

  if (isToday(date)) {
    return format(date, "h:mm a"); // "2:30 PM"
  } else if (isYesterday(date)) {
    return `Yesterday ${format(date, "h:mm a")}`; // "Yesterday 2:30 PM"
  } else {
    // For older messages, show date and time
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays < 7) {
      return format(date, "EEE h:mm a"); // "Mon 2:30 PM"
    } else {
      return format(date, "MMM d, h:mm a"); // "Jan 15, 2:30 PM"
    }
  }
};

const MessageActionsModal = ({
  visible,
  onClose,
  onEdit,
  onSave,
  onDelete,
  message, // Add this prop
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave?: () => void;
  onDelete: () => void;
  message?: Message | null; // Add this type
}) => {
  const isImageMessage = message?.type === "image";
  const isTextMessage = message?.type === "message" || !message?.type;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/10 justify-end"
      >
        <View className="bg-white rounded-t-3xl p-4">
          <TouchableOpacity
            onPress={onEdit}
            className="flex-row items-center p-4"
          >
            <Image
              source={icons.edit}
              className="w-6 h-6 mr-3"
              tintColor="#3b82f6"
            />
            <Text className="text-blue-500 text-base">Edit Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDelete}
            className="flex-row items-center p-4"
          >
            <Image
              source={icons.trash}
              className="w-6 h-6 mr-3"
              tintColor="#EF4444"
            />
            <Text className="text-red-500 text-base">Delete Message</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// First fix the ChatHeader props interface
interface ChatHeaderProps {
  recipientName: {
    firstname: string;
    lastname: string;
    middlename?: string;
  };
  recipientImage?: string;
  itemDetails?: {
    name?: string;
    image?: string;
  };
  recipientStatus?: any;
  status: any;
  recipientId: string;
  onBack: () => void;
  isOwner: boolean;
  showFullProgress?: boolean;
  onToggleProgress?: () => void;
}

const RENTAL_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  PAID: "paid",
  PICKED_UP: "pickedup",
  ACTIVE: "active",
  COMPLETED: "completed",
  DECLINED: "declined",
  CANCELLED: "cancelled",
} as const;

const ChatHeader = ({
  recipientName,
  recipientImage,
  itemDetails,
  recipientStatus,
  status,
  onBack,
  recipientId,
  isOwner,
  showFullProgress,
  onToggleProgress,
}: ChatHeaderProps) => {
  const formatFullName = () => {
    const middleInitial = recipientName.middlename
      ? ` ${recipientName.middlename.charAt(0)}.`
      : "";
    return `${recipientName.firstname}${middleInitial} ${recipientName.lastname}`;
  };

  const isRentalConversation = itemDetails && status;

  return (
    <View className="bg-white border-b  border-gray-300 rounded-b-xl">
      {/* Main Header */}
      <View className="flex-row items-center px-4 pt-4">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>

        <View className="relative">
          <Image
            source={{
              uri:
                itemDetails?.image ||
                recipientImage ||
                "https://placehold.co/40x40@2x.png",
            }}
            className="w-10 h-10 rounded-full bg-gray-200"
            resizeMode="cover"
          />
        </View>

        <View className="ml-3 flex-1">
          <TouchableOpacity onPress={() => router.push(`/user/${recipientId}`)}>
            <Text
              className="text-base font-semibold text-gray-900"
              numberOfLines={1}
            >
              {formatFullName()}
              {itemDetails?.name && (
                <>
                  <Text className="text-gray-400"> • </Text>
                  <Text
                    className={`${
                      status === "cancelled" || status === "declined"
                        ? "text-red-500"
                        : "text-primary"
                    }`}
                  >
                    {itemDetails.name}
                  </Text>
                </>
              )}
            </Text>
          </TouchableOpacity>

          {/* Show progress indicator or online status */}
          {isRentalConversation ? (
            <View className="mt-1">
              <RentalProgressIndicator
                currentStatus={status}
                isOwner={isOwner}
                compact={true}
              />
            </View>
          ) : (
            <Text className="text-xs text-gray-500">
              {recipientStatus?.isOnline ? "Online" : "Offline"}
            </Text>
          )}
        </View>

        {/* Action buttons */}
        <View className="flex-row items-center">
          {/* Report button */}
          <TouchableOpacity
            onPress={() => router.push(`/report/${recipientId}`)}
            className="mr-3"
          >
            <Image
              source={icons.report}
              className="w-6 h-6"
              tintColor="#EF4444"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Full Progress Indicator (expandable) */}
      {isRentalConversation && showFullProgress && (
        <RentalProgressIndicator
          currentStatus={status}
          isOwner={isOwner}
          compact={false}
        />
      )}

      {/* Progress toggle button for rental conversations */}
      {isRentalConversation && (
        <View className="flex-row justify-center py-2">
          <TouchableOpacity
            onPress={onToggleProgress}
            className="mr-3 flex-row items-center gap-2"
          >
            <Text className="text-gray-500 font-pmedium text-sm">
              {showFullProgress ? "Hide Progress" : "View Progress"}
            </Text>
            <Image
              source={icons.arrowDown}
              className={`w-5 h-5 ${showFullProgress ? " rotate-180" : ""}`}
              tintColor={"#6b7280"}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Add these interfaces near your other interfaces
interface ActionMenuItem {
  id: string;
  icon: any;
  label: string;
  action: () => void;
  bgColor: string;
  iconColor: string;
}

// Add the ActionMenu component before your ChatScreen component
const ActionMenu = ({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: ActionMenuItem[];
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/10 px-2 justify-end"
      >
        <View className="flex flex-col mb-2 w-full py-4 bg-white rounded-3xl shadow-lg">
          <View className="flex-row flex-wrap justify-center ">
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  onClose();
                  item.action();
                }}
                className="items-center w-[72px]"
              >
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center mb-1`}
                  style={{ backgroundColor: item.bgColor }}
                >
                  <Image
                    source={item.icon}
                    className="w-6 h-6"
                    tintColor={item.iconColor}
                  />
                </View>
                <Text className="text-xs text-center text-gray-600 font-pmedium">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="flex-row flex-wrap justify-center ">
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  onClose();
                  item.action();
                }}
                className="items-center w-[72px]"
              >
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center mb-1`}
                  style={{ backgroundColor: item.bgColor }}
                >
                  <Image
                    source={item.icon}
                    className="w-6 h-6"
                    tintColor={item.iconColor}
                  />
                </View>
                <Text className="text-xs text-center text-gray-600 font-pmedium">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// First, update the Message interface to match rentRequest data structure
interface Message {
  isDeleted?: boolean;
  deletedAt?: any;
  isEdited?: boolean;
  editedAt?: any;
  status?: string;
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  type?:
    | "message"
    | "rentRequest"
    | "statusUpdate"
    | "image"
    | "paymentRequest";
  read: boolean;
  readAt: any;
  rentRequestId?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  rentRequestDetails?: {
    itemId: string;
    itemName: string;
    itemImage: string;
    totalPrice: number;
    startDate: any;
    endDate: any;
    rentalDays: number;
    ownerId: string;
    ownerName: string;
    requesterId: string;
    requesterName: string;
    pickupTime: number;
    message: string;
    status: string;
  };
}

interface MessageSelection {
  isSelecting: boolean;
  selectedMessages: string[];
}

interface MessageAction {
  label: string;
  icon: any;
  action: () => void;
}

const RentRequestMessage = ({
  item,
  isOwner,
  onAccept,
  onDecline,
  onCancel,
  chatData,
  chatId,
}: {
  item: Message;
  isOwner: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  chatData?: any;
  chatId: string;
}) => {
  const [currentStatus, setCurrentStatus] = useState<string>("pending");
  const [rentRequestData, setRentRequestData] = useState<any>(null);
  const isSender = item.senderId === auth.currentUser?.uid;
  const { minutesToTime } = useTimeConverter();

  const effectiveStatus = useMemo(() => {
    return currentStatus || item.status || chatData?.status || "pending";
  }, [currentStatus, item.status, chatData?.status]);

  // Real-time status listener - SIMPLIFIED VERSION
  useEffect(() => {
    if (!chatId || !item.id) return;

    // Listen for chat-level status changes (PRIMARY SOURCE)
    const chatRef = doc(db, "chat", String(chatId));
    const unsubscribeChat = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status) {
          console.log("Chat status updated to:", data.status);
          setCurrentStatus(data.status);
        }
      }
    });

    const messageRef = doc(db, "chat", String(chatId), "messages", item.id);
    const unsubscribeMessage = onSnapshot(messageRef, (snapshot) => {
      if (snapshot.exists()) {
        const messageData = snapshot.data();
        if (messageData.status) {
          console.log(
            `Message ${item.id} status updated to:`,
            messageData.status
          );
          // Only update if chat doesn't have a status
          setCurrentStatus((prevStatus) => messageData.status || prevStatus);
        }
      }
    });

    return () => {
      unsubscribeChat();
      unsubscribeMessage();
    };
  }, [chatId, item.id]);

  useEffect(() => {
    const setupRequestData = async () => {
      try {
        // Use chat data as the primary source
        if (chatData) {
          const baseData = {
            itemName: chatData.itemDetails?.name || "Unknown Item",
            itemImage: chatData.itemDetails?.image || "",
            totalPrice: chatData.itemDetails?.price || 0,
            status: effectiveStatus,
            rentalDays: 1, // Default, can be enhanced
            pickupTime: 480, // Default 8 AM
            message: item.text || "No message provided",
            startDate: new Date(),
            endDate: new Date(),
          };

          if (
            item.rentRequestId &&
            effectiveStatus !== "cancelled" &&
            effectiveStatus !== "declined"
          ) {
            try {
              const rentRequestRef = doc(
                db,
                "rentRequests",
                item.rentRequestId
              );
              const rentRequestSnap = await getDoc(rentRequestRef);

              if (rentRequestSnap.exists()) {
                const requestData = rentRequestSnap.data();
                // Merge additional details from rentRequest
                Object.assign(baseData, {
                  rentalDays: requestData.rentalDays || baseData.rentalDays,
                  pickupTime: requestData.pickupTime || baseData.pickupTime,
                  message: requestData.message || baseData.message,
                  startDate: requestData.startDate || baseData.startDate,
                  endDate: requestData.endDate || baseData.endDate,
                  totalPrice: requestData.totalPrice || baseData.totalPrice,
                });
              }
            } catch (error) {
              console.log(
                "rentRequest document not available, using chat data"
              );
            }
          }

          setRentRequestData(baseData);
        }
      } catch (error) {
        console.error("Error setting up request data:", error);
        // Fallback to minimal data
        const rentRequestRef = query(
          collection(db, "chat", String(chatId), "messages"),
          where("type", "==", "rentRequest"),
          where("id", "==", item.id),
          limit(1)
        );

        const rentRequestSnap = await getDocs(rentRequestRef);
        const rentRequestMessage = !rentRequestSnap.empty
          ? rentRequestSnap.docs[0].data()
          : null;

        setRentRequestData({
          itemName: chatData.itemDetails?.name || "Unknown Item",
          itemImage: chatData.itemDetails?.image,
          totalPrice: chatData.itemDetails?.price || 0,
          status: effectiveStatus,
          rentalDays: chatData.rentalDays || 1,
          pickupTime: chatData.pickupTime || 480,
          message: rentRequestMessage?.text || "Error loading request details",
          startDate: chatData.startDate || new Date(),
          endDate: chatData.endDate || new Date(),
        });
      }
    };

    setupRequestData();
  }, [chatData, effectiveStatus, item.rentRequestId, item.text]);

  // Format date helper function
  const formatDate = (date: any) => {
    if (!date) return "";
    if (date.toDate) return format(date.toDate(), "MMM d, yyyy");
    if (date instanceof Date) return format(date, "MMM d, yyyy");
    return "Date unavailable";
  };

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
      // case "cancelled":
      //   return {
      //     bgColor: "bg-gray-100",
      //     textColor: "text-gray-700",
      //   };
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
    <View className={`flex- mb-3 ${isSender ? "pl-8" : "pr-8"}`}>
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
              {rentRequestData.itemName}
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
              ₱
              {Math.round(
                (rentRequestData.totalPrice || 0) /
                  (rentRequestData.rentalDays || 1)
              )}
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

            <View className=" mt-3">
              <View>
                <Text className="text-xs font-pbold uppercase text-gray-400">
                  Rental Period
                </Text>
                <Text className="text-sm font-pmedium mt-1 text-gray-700">
                  {rentRequestData.rentalDays} days
                </Text>
              </View>

              <View className=" mt-3">
                <Text className="text-xs font-pbold uppercase text-gray-400">
                  Total Amount
                </Text>
                <Text className="text-sm font-pmedium mt-1 text-gray-700">
                  ₱{(rentRequestData.totalPrice || 0).toLocaleString()}
                </Text>
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
                      className="flex-1 bg-primary py-3 rounded-xl"
                    >
                      <Text className="text-white font-pbold text-center">
                        ACCEPT
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
              <View className="mt-4">
                {!isRequestExpired(rentRequestData.startDate) ? (
                  <TouchableOpacity
                    onPress={onCancel}
                    className="py-3 rounded-xl bg-red-400"
                  >
                    <Text className="font-pbold text-center text-white">
                      CANCEL REQUEST
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

// Add this helper function at the top of the file
const createInAppNotification = async (
  userId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: any;
  }
) => {
  try {
    const userNotificationsRef = collection(
      db,
      `users/${userId}/notifications`
    );
    await addDoc(userNotificationsRef, {
      ...notification,
      isRead: false,
      createdAt: serverTimestamp(),
    });
    console.log(`📱 In-app notification created for user: ${userId}`);
  } catch (error) {
    console.error("Error creating in-app notification:", error);
  }
};

const requestDataCache = new Map();

const ImageMessage = ({
  item,
  isCurrentUser,
  onLongPress,
}: {
  item: Message;
  isCurrentUser: boolean;
  onLongPress: () => void;
}) => {
  const [imageError, setImageError] = useState(false);
  const maxWidth = Dimensions.get("window").width * 0.65;
  const maxHeight = 300; // Maximum height for images
  const [aspectRatio, setAspectRatio] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (item.imageUrl && !item.isDeleted) {
      Image.getSize(
        item.imageUrl,
        (width, height) => {
          const imageAspectRatio = width / height;
          setAspectRatio(imageAspectRatio);
          setIsLoading(false);
        },
        () => {
          setImageError(true);
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
    }
  }, [item.imageUrl, item.isDeleted]);

  // Show deleted message state
  if (item.isDeleted) {
    return (
      <View
        className={`flex-col ${isCurrentUser ? "items-end" : "items-start"}`}
      >
        <View
          className={`p-3 rounded-xl mb-2 ${
            isCurrentUser
              ? "bg-primary rounded-tr-none self-end"
              : "bg-white rounded-tl-none border border-gray-200"
          }`}
        >
          <Text
            className={`text-base italic ${
              isCurrentUser ? "text-white/70" : "text-gray-500"
            }`}
          >
            [Image deleted]
          </Text>
        </View>
        {/* Message metadata */}
        <View
          className={`flex-row items-center mt-1 px-1 ${
            isCurrentUser ? "justify-end" : "justify-start"
          }`}
        >
          {isCurrentUser && (
            <>
              {item.read ? (
                <Image
                  source={icons.doubleCheck}
                  className="w-3 h-3 mr-1"
                  tintColor="#4285F4"
                />
              ) : (
                <Image
                  source={icons.singleCheck}
                  className="w-3 h-3 mr-1"
                  tintColor="#9CA3AF"
                />
              )}
            </>
          )}
          <Text className="text-xs text-gray-400">
            {item.createdAt ? format(item.createdAt.toDate(), "h:mm a") : ""}
          </Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (imageError || !item.imageUrl) {
    return (
      <View className="bg-gray-100 rounded-xl p-3 mb-2">
        <Text className="text-gray-500 text-center font-pmedium">
          Image not available
        </Text>
      </View>
    );
  }

  // Calculate dimensions maintaining aspect ratio with max height
  const imageWidth = maxWidth;
  const calculatedHeight = maxWidth / aspectRatio;
  const imageHeight = Math.min(calculatedHeight, maxHeight);

  return (
    <View className="flex-col">
      <TouchableOpacity
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={0.9}
      >
        <View className="rounded-xl overflow-hidden bg-gray-200">
          {isLoading ? (
            <View
              style={{ width: imageWidth, height: imageHeight }}
              className="items-center justify-center bg-gray-100"
            >
              <ActivityIndicator color="#4285F4" size="large" />
            </View>
          ) : (
            <Image
              source={{ uri: item.imageUrl }}
              style={{
                width: imageWidth,
                height: imageHeight,
              }}
              className="rounded-xl"
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Message metadata with read status */}
      <View
        className={`flex-row items-center mt-1 px-1 ${
          isCurrentUser ? "justify-end" : "justify-start"
        }`}
      >
        {isCurrentUser && (
          <>
            {item.read ? (
              <Image
                source={icons.doubleCheck}
                className="w-3 h-3 mr-1"
                tintColor="#4285F4"
              />
            ) : (
              <Image
                source={icons.singleCheck}
                className="w-3 h-3 mr-1"
                tintColor="#9CA3AF"
              />
            )}
          </>
        )}
        <Text className="text-xs text-gray-400">
          {item.createdAt ? format(item.createdAt.toDate(), "h:mm a") : ""}
        </Text>
      </View>
    </View>
  );
};
const ChatScreen = () => {
  const { id: chatId } = useLocalSearchParams();
  const navigation = useNavigation();
  const currentUserId = auth.currentUser?.uid;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState<{
    firstname: string;
    lastname: string;
    middlename?: string;
  }>({
    firstname: "",
    lastname: "",
  });
  const [recipientImage, setRecipientImage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [requestStatuses, setRequestStatuses] = useState<
    Record<string, string>
  >({});
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();
  const [showFullProgress, setShowFullProgress] = useState(false);

  const [selection, setSelection] = useState<MessageSelection>({
    isSelecting: false,
    selectedMessages: [],
  });
  const { setIsLoading } = useLoader();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);

  const [messageSelection, setMessageSelection] = useState<{
    isSelecting: boolean;
    selectedMessages: string[];
  }>({
    isSelecting: false,
    selectedMessages: [],
  });

  const [chatData, setChatData] = useState<{
    requesterId: string;
    ownerId: string;
    status: string;
    itemDetails?: {
      downpaymentPercentage?: number;
      name?: string;
      price?: number;
      image?: string;
      itemId?: string;
      totalPrice?: number;
    };
  } | null>(null);

  // Add state for camera visibility
  const [showCamera, setShowCamera] = useState(false);

  if (!currentUserId || !chatId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error: Missing user ID or chat ID</Text>
      </View>
    );
  }

  const handleMessageLongPress = (
    messageId: string,
    senderId: string,
    message: Message
  ) => {
    if (senderId !== currentUserId) return;

    if (message.isDeleted) return;

    if (message.type === "statusUpdate" || message.type === "rentRequest")
      return;

    setSelectedMessage(message);
    setShowMessageActions(true);
  };

  const handleMessageEdit = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditText(currentText);
    setShowMessageActions(false);
    setSelectedMessage(null);
  };

  const handleMessageDelete = async (messageId: string) => {
    if (!selectedMessage) return;

    const messageType = selectedMessage.type === "image" ? "image" : "message";
    const confirmText =
      messageType === "image"
        ? "Are you sure you want to delete this image? This cannot be undone."
        : "Are you sure you want to delete this message?";

    Alert.alert("Delete Message", confirmText, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const messageRef = doc(
              db,
              "chat",
              String(chatId),
              "messages",
              messageId
            );

            // Handle image deletion from storage
            if (selectedMessage.type === "image" && selectedMessage.imageUrl) {
              try {
                // Extract the file path from the URL
                const storage = getStorage();
                const fileUrl = new URL(selectedMessage.imageUrl);
                const filePath = decodeURIComponent(
                  fileUrl.pathname.split("/o/")[1].split("?")[0]
                );
                const imageRef = ref(storage, filePath);

                // Delete the image from storage
                await deleteObject(imageRef);
                console.log("Image deleted from storage successfully");
              } catch (storageError) {
                console.error(
                  "Error deleting image from storage:",
                  storageError
                );
                // Continue with message update even if storage deletion fails
              }
            }

            // Update the message document
            const updateData = {
              isDeleted: true,
              deletedAt: serverTimestamp(),
              text:
                messageType === "image"
                  ? "[Image deleted]"
                  : "[Message deleted]",
              ...(messageType === "image" && {
                imageUrl: null,
                imageWidth: null,
                imageHeight: null,
              }),
            };

            await updateDoc(messageRef, updateData);

            // Update chat's last message if this was the last message
            const lastMessageQuery = query(
              collection(db, "chat", String(chatId), "messages"),
              orderBy("createdAt", "desc"),
              limit(1)
            );

            const lastMessageSnap = await getDocs(lastMessageQuery);
            if (
              !lastMessageSnap.empty &&
              lastMessageSnap.docs[0].id === messageId
            ) {
              await updateDoc(doc(db, "chat", String(chatId)), {
                lastMessage:
                  messageType === "image"
                    ? "[Image deleted]"
                    : "[Message deleted]",
                lastMessageTime: serverTimestamp(),
              });
            }

            setShowMessageActions(false);
            setSelectedMessage(null);

            Toast.show({
              type: ALERT_TYPE.SUCCESS,
              title: "Success",
              textBody: `${
                messageType === "image" ? "Image" : "Message"
              } deleted successfully`,
            });
          } catch (error) {
            console.error("Error deleting message:", error);
            Toast.show({
              type: ALERT_TYPE.DANGER,
              title: "Error",
              textBody: `Failed to delete ${messageType}`,
            });
          }
        },
      },
    ]);
  };

  const handleSaveImage = async () => {
    if (!selectedMessage?.imageUrl) return;

    try {
      // Request permissions
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant photo library permissions to save images."
        );
        return;
      }

      // For Expo, you can use MediaLibrary
      // import * as MediaLibrary from 'expo-media-library';

      // Download and save logic would go here
      // This is a placeholder - you'll need to implement the actual save functionality

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Image saved to gallery",
      });

      setShowMessageActions(false);
      setSelectedMessage(null);
    } catch (error) {
      console.error("Error saving image:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to save image",
      });
    }
  };
  // Add image handling functions
  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant camera roll permissions to send images."
        );
        return;
      }

      // Remove allowsEditing to skip cropping
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Changed to false to remove cropping
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        // Add image to uploading state immediately
        setUploadingImages((prev) => [...prev, result.assets[0].uri]);

        try {
          await uploadAndSendImage(result.assets[0]);
        } catch (error) {
          console.error("Error uploading image:", error);
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Error",
            textBody: "Failed to upload image",
          });
        } finally {
          // Remove from uploading state
          setUploadingImages((prev) =>
            prev.filter((uri) => uri !== result.assets[0].uri)
          );
        }
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to pick image",
      });
    }
  };

  // const takePhoto = async () => {
  //   try {
  //     // Request permission
  //     const { status } = await ImagePicker.requestCameraPermissionsAsync();
  //     if (status !== "granted") {
  //       Alert.alert(
  //         "Permission needed",
  //         "Please grant camera permissions to take photos."
  //       );
  //       return;
  //     }

  //     // Launch camera
  //     const result = await ImagePicker.launchCameraAsync({
  //       allowsEditing: false,
  //       quality: 0.7,
  //       base64: false,
  //     });

  //     if (!result.canceled && result.assets[0]) {
  //       setIsLoading(true);
  //       await uploadAndSendImage(result.assets[0]);
  //     }
  //   } catch (error) {
  //     console.error("Error taking photo:", error);
  //     Toast.show({
  //       type: ALERT_TYPE.DANGER,
  //       title: "Error",
  //       textBody: "Failed to take photo",
  //     });
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const UploadingImageMessage = ({ uri }: { uri: string }) => {
    const maxWidth = Dimensions.get("window").width * 0.65;
    const [aspectRatio, setAspectRatio] = useState(1);

    useEffect(() => {
      Image.getSize(
        uri,
        (width, height) => {
          setAspectRatio(width / height);
        },
        () => {
          setAspectRatio(1);
        }
      );
    }, [uri]);

    const imageWidth = maxWidth;
    const imageHeight = imageWidth / aspectRatio;

    return (
      // <View className="items-end mb-2">
      //   <View className="relative rounded-xl overflow-hidden">
      //     <Image
      //       source={{ uri }}
      //       style={{
      //         width: imageWidth,
      //         height: imageHeight,
      //       }}
      //       className="rounded-xl opacity-50"
      //       resizeMode="cover"
      //     />
      //     <View className="absolute inset-0 bg-black/30 items-center justify-center">
      //       <ActivityIndicator color="white" size="large" />
      //     </View>
      //   </View>
      //   <Text className="text-xs text-gray-400 mt-1">Sending...</Text>
      // </View>
      null
    );
  };

  // const uploadAndSendImage = async (
  //   imageAsset: ImagePicker.ImagePickerAsset
  // ) => {
  //   try {
  //     if (!imageAsset.uri) {
  //       throw new Error("No image URI provided");
  //     }

  //     // Add image to uploading state
  //     setUploadingImages((prev) => [...prev, imageAsset.uri]);

  //     // Create a unique filename
  //     const filename = `chat_images/${chatId}/${Date.now()}_${Math.random()
  //       .toString(36)
  //       .substring(7)}.jpg`;

  //     // Convert image to blob
  //     const response = await fetch(imageAsset.uri);
  //     const blob = await response.blob();

  //     // Upload to Firebase Storage
  //     const imageRef = ref(storage, filename);
  //     await uploadBytes(imageRef, blob);
  //     const downloadURL = await getDownloadURL(imageRef);

  //     // Send image message
  //     await sendImageMessage(
  //       downloadURL,
  //       imageAsset.width || 300,
  //       imageAsset.height || 300
  //     );
  //   } catch (error) {
  //     console.error("Error uploading image:", error);
  //     Toast.show({
  //       type: ALERT_TYPE.DANGER,
  //       title: "Error",
  //       textBody: "Failed to upload image",
  //     });
  //   } finally {
  //     // Remove image from uploading state
  //     setUploadingImages((prev) =>
  //       prev.filter((uri) => uri !== imageAsset.uri)
  //     );
  //   }
  // };

  const sendImageMessage = async (
    imageUrl: string,
    width: number,
    height: number
  ) => {
    try {
      const chatRef = doc(db, "chat", String(chatId));
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        Alert.alert("Error", "Chat not found");
        return;
      }

      const chatData = chatSnap.data();
      const recipientId = chatData.participants.find(
        (id: string) => id !== currentUserId
      );

      const messageData = {
        senderId: currentUserId,
        text: "", // Empty text for image messages
        type: "image",
        imageUrl: imageUrl,
        imageWidth: width,
        imageHeight: height,
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      };

      // Add message to subcollection
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      await addDoc(messagesRef, messageData);

      // Update chat document
      const updateData = {
        lastMessage: "📸Sent a Photo",
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        [`unreadCounts.${recipientId}`]: increment(1),
      };

      await updateDoc(chatRef, updateData);
    } catch (error) {
      console.error("Error sending image message:", error);
      throw error;
    }
  };

  const uploadAndSendImage = async (
    imageAsset: ImagePicker.ImagePickerAsset
  ) => {
    try {
      if (!imageAsset.uri) {
        throw new Error("No image URI provided");
      }

      // Create a unique filename
      const filename = `chat_images/${chatId}/${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.jpg`;

      // Get image dimensions
      const { width, height } = await new Promise<{
        width: number;
        height: number;
      }>((resolve) => {
        Image.getSize(imageAsset.uri, (w, h) => {
          resolve({ width: w, height: h });
        });
      });

      // Calculate resize dimensions if needed (max width 1024px)
      const maxWidth = 1024;
      const aspectRatio = width / height;
      const targetWidth = Math.min(width, maxWidth);
      const targetHeight = targetWidth / aspectRatio;

      // Compress and resize image
      const compressedImage = await manipulateAsync(
        imageAsset.uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        {
          compress: 0.6,
          format: SaveFormat.JPEG,
        }
      );

      // Convert to blob and upload
      const response = await fetch(compressedImage.uri);
      const blob = await response.blob();

      const imageRef = ref(storage, filename);
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);

      // Send image message
      await sendImageMessage(downloadURL, targetWidth, targetHeight);
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleEditSubmit = async () => {
    if (!editingMessageId || !editText.trim()) return;

    try {
      const messageRef = doc(
        db,
        "chat",
        String(chatId),
        "messages",
        editingMessageId
      );

      await updateDoc(messageRef, {
        text: editText.trim(),
        isEdited: true,
        editedAt: serverTimestamp(),
      });

      setEditingMessageId(null);
      setEditText("");

      // Toast.show({
      //   type: ALERT_TYPE.SUCCESS,
      //   title: "Success",
      //   textBody: "Message edited successfully",
      // });
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to edit message",
      });
    }
  };

  const TypingIndicator = ({ isVisible }: { isVisible: boolean }) => {
    if (!isVisible) return null;

    return (
      <View className="flex-row justify-start mb-3">
        <Image
          source={{ uri: recipientImage }}
          className="w-8 h-8 rounded-full mr-2 mt-1"
        />
        <View className="bg-white rounded-2xl rounded-tl-none px-4 py-3 border border-gray-200">
          <View className="flex-row items-center space-x-1">
            <View className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <View
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            />
            <View
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
          </View>
        </View>
      </View>
    );
  };

  const shouldShowTimestamp = (
    currentMessage: Message,
    previousMessage: Message | null
  ): boolean => {
    if (!previousMessage) return true; // Always show for first message

    if (!currentMessage.createdAt || !previousMessage.createdAt) return false;

    const currentTime = currentMessage.createdAt.toDate();
    const previousTime = previousMessage.createdAt.toDate();

    // Show timestamp if:
    // 1. More than 5 minutes have passed
    // 2. Different senders
    // 3. Different days
    return (
      differenceInMinutes(currentTime, previousTime) > 5 ||
      currentMessage.senderId !== previousMessage.senderId ||
      !isSameDay(currentTime, previousTime)
    );
  };

  // Helper function to format day separators
  const formatDaySeparator = (timestamp: any): string => {
    if (!timestamp) return "";

    const date = timestamp.toDate();

    if (isToday(date)) {
      return "Today";
    } else if (isYesterday(date)) {
      return "Yesterday";
    } else {
      const now = new Date();
      const diffInDays = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffInDays < 7) {
        return format(date, "EEEE"); // "Monday"
      } else {
        return format(date, "MMMM d, yyyy"); // "January 15, 2024"
      }
    }
  };

  // Helper function to check if we should show day separator
  const shouldShowDaySeparator = (
    currentMessage: Message,
    previousMessage: Message | null
  ): boolean => {
    if (
      !previousMessage ||
      !currentMessage.createdAt ||
      !previousMessage.createdAt
    )
      return false;

    const currentDate = currentMessage.createdAt.toDate();
    const previousDate = previousMessage.createdAt.toDate();

    return !isSameDay(currentDate, previousDate);
  };

  // 2. Create a TimeIndicator component
  const TimeIndicator = ({ timestamp }: { timestamp: any }) => {
    return (
      <View className="flex-row justify-center my-2">
        <View className="bg-gray-200 px-3 py-1 rounded-full">
          <Text className="text-xs text-gray-600 font-pmedium">
            {formatTimestamp(timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  // 3. Create a DaySeparator component
  const DaySeparator = ({ timestamp }: { timestamp: any }) => {
    return (
      <View className="flex-row justify-center my-4">
        <View className="bg-gray-100 px-4 py-2 rounded-full border border-gray-200">
          <Text className="text-sm text-gray-700 font-pmedium">
            {formatDaySeparator(timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  // Initialize or fetch chat data
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const chatRef = doc(db, "chat", String(chatId));
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
          // New chat initialization
          const recipientRef = doc(db, "users", String(chatId));
          const recipientSnap = await getDoc(recipientRef);

          if (!recipientSnap.exists()) {
            Alert.alert("Error", "User not found");
            return;
          }

          const recipientData = recipientSnap.data();
          // Fix: Don't use chatData before it's initialized
          setRecipientImage(recipientData?.profileImage || "");
          setRecipientName({
            firstname: recipientData.firstname || "",
            lastname: recipientData.lastname || "",
            middlename: recipientData.middlename || "",
          });

          const newChatData = {
            participants: [currentUserId, String(chatId)],
            createdAt: serverTimestamp(),
            lastMessage: "",
            lastMessageTime: serverTimestamp(),
            lastSender: null,
          };

          await setDoc(chatRef, newChatData);
          console.log("New chat created");
        } else {
          // Existing chat logic...
          const chatData = chatSnap.data();
          if (chatData?.participants) {
            const otherUserId = chatData.participants.find(
              (uid: string) => uid !== currentUserId
            );

            if (otherUserId) {
              const userSnap = await getDoc(doc(db, "users", otherUserId));
              if (userSnap.exists()) {
                const userData = userSnap.data();
                setRecipientImage(userData.profileImage || "");
                setRecipientName({
                  firstname: userData.firstname || "",
                  lastname: userData.lastname || "",
                  middlename: userData.middlename || "",
                });
              }
            }
          }
        }

        setLoading(false);
      } catch (error: any) {
        console.error("Error initializing chat:", error);
        setLoading(false);
      }
    };

    initializeChat();
  }, [chatId, currentUserId]);
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!chatId || !currentUserId) return;

    const chatRef = doc(db, "chat", String(chatId));

    const unsubscribe = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setChatData({
          requesterId: data.requesterId,
          ownerId: data.ownerId,
          status: data.status,
          itemDetails: data.itemDetails,
        });

        const isOwner = currentUserId === data.ownerId;
        const hasOwnerResponded = data.hasOwnerResponded || false;

        // Updated logic: Disable messaging for cancelled or declined requests
        if (data.status === "cancelled" || data.status === "declined") {
          setCanSendMessage(false);
          return;
        }

        // Allow sending messages if owner, or if status is "accepted"
        const canSend =
          isOwner ||
          data.status === "accepted" ||
          (hasOwnerResponded &&
            data.status !== "declined" &&
            data.status !== "cancelled");

        setCanSendMessage(canSend);
      }
    });

    return () => unsubscribe();
  }, [chatId, currentUserId]);

  // Set header title
  useLayoutEffect(() => {
    if (recipientEmail) {
      navigation.setOptions({ title: recipientEmail });
    }
  }, [navigation, recipientEmail]);

  // Listen for messages
  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, "chat", String(chatId), "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(fetchedMessages);
    });

    // Clean up listener on unmount
    return () => unsubscribe();
  }, [chatId]);

  const sendMessage = async () => {
    if (newMessage.trim() === "") return;

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      const chatRef = doc(db, "chat", String(chatId));
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        Alert.alert("Error", "Chat not found");
        setNewMessage(messageText);
        return;
      }

      const chatData = chatSnap.data();
      const recipientId = chatData.participants.find(
        (id: string) => id !== currentUserId
      );

      const messageData = {
        senderId: currentUserId,
        text: messageText,
        type: "message",
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      };

      // Add message to subcollection
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      await addDoc(messagesRef, messageData);

      const updateData = {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        [`unreadCounts.${recipientId}`]: increment(1),
      };

      await updateDoc(chatRef, updateData);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      setNewMessage(messageText);
    }
  };

  useEffect(() => {
    if (!currentUserId || loading) return;

    const markMessagesAsRead = async () => {
      try {
        const chatRef = doc(db, "chat", String(chatId));
        const messagesRef = collection(db, "chat", String(chatId), "messages");

        // Query for unread messages not sent by current user (including images)
        const q = query(
          messagesRef,
          where("senderId", "!=", currentUserId),
          where("read", "==", false)
        );

        const unreadSnap = await getDocs(q);

        if (!unreadSnap.empty) {
          const batch = writeBatch(db);

          unreadSnap.docs.forEach((doc) => {
            batch.update(doc.ref, {
              read: true,
              readAt: serverTimestamp(),
            });
          });

          // Update chat document to reset unread count for current user
          batch.update(chatRef, {
            [`unreadCounts.${currentUserId}`]: 0,
            [`lastReadTimestamps.${currentUserId}`]: serverTimestamp(),
          });

          await batch.commit();
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    };

    // Mark messages as read when entering chat
    markMessagesAsRead();

    // Set up listener for new messages
    const messagesRef = collection(db, "chat", String(chatId), "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latestMessage = snapshot.docs[0].data();
        if (latestMessage.senderId !== currentUserId && !latestMessage.read) {
          markMessagesAsRead();
        }
      }
    });

    return () => unsubscribe();
  }, [chatId, currentUserId, loading]);

  const memoizedHandleAccept = useCallback(
    (requestId: string) => handleAcceptRequest(requestId),
    []
  );

  const memoizedHandleDecline = useCallback((requestId: string | string[]) => {
    // If single ID, convert to array
    const requestIds = Array.isArray(requestId) ? requestId : [requestId];
    // Process each request ID
    requestIds.forEach((id) => handleDeclineRequest(id));
  }, []);

  const memoizedHandleCancel = useCallback(
    (requestId: string) => handleCancelRequest(requestId),
    []
  );

  const handleSendLocation = async () => {
    // Implement location sharing
    Alert.alert("Send Location", "Location sharing will be implemented here");
  };

  const handleSendAgreement = () => {
    // Navigate to agreement form
    router.push("/agreement-form");
  };

  const handleViewRequests = () => {
    // Navigate to requests list
    router.push(`/requests/${chatId}`);
  };

  const handleSendVerdict = () => {
    // Navigate to verdict form
    router.push(`/verdict-form/${chatId}`);
  };

  const updateRentalStatus = async (newStatus: string, message?: string) => {
    try {
      const chatRef = doc(db, "chat", String(chatId));

      await updateDoc(chatRef, {
        status: newStatus,
        lastMessage: message || `Status updated to ${newStatus}`,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add status update message to chat
      if (message) {
        await addDoc(collection(db, "chat", String(chatId), "messages"), {
          type: "statusUpdate",
          text: message,
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          read: false,
          status: newStatus,
        });
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: `Status updated to ${newStatus}`,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update status",
      });
    }
  };

  // 3. Add these handler functions for status progression:
  const handlePaymentConfirmed = () => {
    updateRentalStatus("paid", "Payment confirmed by owner");
  };

  const handleItemPickedUp = () => {
    updateRentalStatus("pickedup", "Item picked up by renter");
  };

  const handleItemReturned = () => {
    updateRentalStatus("completed", "Item returned and rental completed");
  };

  const actionItems: ActionMenuItem[] = [
    {
      id: "camera",
      icon: icons.camera,
      label: "Camera",
      action: () => setShowCamera(true), // Update this line
      bgColor: "#2196F3",
      iconColor: "#FFF",
    },
    {
      id: "gallery",
      icon: icons.gallery, // Make sure you have an image/gallery icon
      label: "Gallery",
      action: pickImage,
      bgColor: "#1CCF10",
      iconColor: "#FFF",
    },

    // Add conditional status progression actions based on current status and user role
    ...(chatData?.status === "accepted" && currentUserId === chatData?.ownerId
      ? [
          {
            id: "payment",
            icon: icons.check,
            label: "Confirm Payment",
            action: handlePaymentConfirmed,
            bgColor: "#E8F5E8",
            iconColor: "#4CAF50",
          },
        ]
      : []),
    ...(chatData?.status === "paid" && currentUserId === chatData?.ownerId
      ? [
          {
            id: "pickup",
            icon: icons.handshake,
            label: "Item Picked Up",
            action: handleItemPickedUp,
            bgColor: "#E3F2FD",
            iconColor: "#2196F3",
          },
        ]
      : []),
    ...(chatData?.status === "pickedup" && currentUserId === chatData?.ownerId
      ? [
          {
            id: "return",
            icon: icons.refresh,
            label: "Item Returned",
            action: handleItemReturned,
            bgColor: "#F3E5F5",
            iconColor: "#9C27B0",
          },
        ]
      : []),
    {
      id: "2",
      icon: icons.arrowDown,
      label: "Agreement",
      action: handleSendAgreement,
      bgColor: "#E8EAF6",
      iconColor: "#3F51B5",
    },
    {
      id: "3",
      icon: icons.arrowDown,
      label: "Requests",
      action: handleViewRequests,
      bgColor: "#FFF3E0",
      iconColor: "#FF9800",
    },
  ];

  const handleAcceptRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      setIsLoading(true);

      // 1. Get the accepted request details
      const acceptedRequestRef = doc(db, "rentRequests", requestId);
      const acceptedRequestSnap = await getDoc(acceptedRequestRef);

      if (!acceptedRequestSnap.exists()) {
        throw new Error("Request not found");
      }

      const acceptedRequestData = acceptedRequestSnap.data();
      const itemId = acceptedRequestData.itemId;
      const acceptedRequesterId = acceptedRequestData.requesterId;

      // 2. Create batch for atomic operations
      const batch = writeBatch(db);

      // 3. Update the rent request status to accepted
      batch.update(acceptedRequestRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Update item status to "rented" (not "pickup")
      const itemRef = doc(db, "items", itemId);
      batch.update(itemRef, {
        itemStatus: "rented", // Changed from "pickup" to "rented"
        rentedTo: acceptedRequesterId,
        rentedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 5. Update current chat status to accepted
      const currentChatRef = doc(db, "chat", String(chatId));
      batch.update(currentChatRef, {
        status: "accepted",
        lastMessage: "Request accepted by owner",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true,
      });

      const currentChatMessagesRef = collection(
        db,
        "chat",
        String(chatId),
        "messages"
      );
      const currentChatRentRequestQuery = query(
        currentChatMessagesRef,
        where("rentRequestId", "==", requestId)
      );

      const currentChatRentRequestMessages = await getDocs(
        currentChatRentRequestQuery
      );
      currentChatRentRequestMessages.forEach((doc) => {
        batch.update(doc.ref, {
          status: "accepted",
          updatedAt: serverTimestamp(),
        });
      });

      // 7. Commit initial updates first
      await batch.commit();

      // 8. Handle OTHER pending requests for the same item (decline them)
      const otherPendingRequestsQuery = query(
        collection(db, "rentRequests"),
        where("itemId", "==", itemId),
        where("status", "==", "pending")
      );

      const otherPendingRequestsSnap = await getDocs(otherPendingRequestsQuery);
      const declinePromises: Promise<void>[] = [];

      otherPendingRequestsSnap.docs.forEach((requestDoc) => {
        if (requestDoc.id === requestId) return;

        const otherRequestData = requestDoc.data();
        const otherRequesterId = otherRequestData.requesterId;

        const declinePromise = (async () => {
          await updateDoc(requestDoc.ref, {
            status: "declined",
            declinedReason: `${acceptedRequestData.itemName} has been rented to another user`,
            declinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const otherChatQuery = query(
            collection(db, "chat"),
            where("requesterId", "==", requestDoc.ref),
            where("ownerId", "==", currentUserId),
            where("itemDetails.itemId", "==", itemId)
          );

          const otherChatSnap = await getDocs(otherChatQuery);

          if (!otherChatSnap.empty) {
            const otherChatDoc = otherChatSnap.docs[0];
            const otherChatId = otherChatDoc.id;

            // Update other chat status
            await updateDoc(otherChatDoc.ref, {
              status: "declined",
              lastMessage: "This item has been rented to another user",
              lastMessageTime: serverTimestamp(),
              hasOwnerResponded: true,
            });

            // Update rentRequest messages in that chat
            const otherChatMessagesRef = collection(
              db,
              "chat",
              otherChatId,
              "messages"
            );
            const otherRentRequestQuery = query(
              otherChatMessagesRef,
              where("type", "==", "rentRequest")
            );

            const otherRentRequestMessages = await getDocs(
              otherRentRequestQuery
            );
            const otherBatch = writeBatch(db);

            otherRentRequestMessages.docs.forEach((msgDoc) => {
              otherBatch.update(msgDoc.ref, {
                status: "declined",
                updatedAt: serverTimestamp(),
              });
            });

            // Add status update message
            const statusMessageRef = doc(otherChatMessagesRef);
            otherBatch.set(statusMessageRef, {
              type: "statusUpdate",
              text: "This item has been rented to another user",
              senderId: currentUserId,
              createdAt: serverTimestamp(),
              read: false,
              status: "declined",
            });

            await otherBatch.commit();

            // Send notifications to declined user
            await createInAppNotification(otherRequesterId, {
              type: "RENT_REQUEST_DECLINED",
              title: "Item No Longer Available",
              message: `${acceptedRequestData.itemName} has been rented to another user`,
              data: {
                route: "/chat",
                params: { id: otherChatId },
              },
            });

            // Send push notification if available
            try {
              const otherUserRef = doc(db, "users", otherRequesterId);
              const otherUserSnap = await getDoc(otherUserRef);
              if (otherUserSnap.exists()) {
                const otherUserData = otherUserSnap.data();
                if (otherUserData.pushToken) {
                  await sendPushNotification({
                    to: otherUserData.pushToken,
                    title: "Item No Longer Available",
                    body: `${acceptedRequestData.itemName} has been rented to another user`,
                    data: {
                      type: "RENT_REQUEST_DECLINED",
                      chatId: otherChatId,
                      itemId: itemId,
                    },
                  });
                }
              }
            } catch (pushError) {
              console.log(
                "Push notification failed for user:",
                otherRequesterId
              );
            }
          }
        })();

        declinePromises.push(declinePromise);
      });

      await Promise.allSettled(declinePromises);

      //Create simple rental document with only needed data
      const rentalData = {
        rentalId: `rental_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`,
        status: "active",
        rentRequestId: requestId,
        chatId: String(chatId),
        itemId: itemId,
        ownerId: currentUserId,
        renterId: acceptedRequesterId,
        itemName: acceptedRequestData.itemName,
        totalAmount: acceptedRequestData.totalPrice || 0,
        startDate: acceptedRequestData.startDate,
        endDate: acceptedRequestData.endDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const rentalRef = doc(collection(db, "rentals"));
      await setDoc(rentalRef, rentalData);

      await addDoc(currentChatMessagesRef, {
        type: "statusUpdate",
        text: "Request accepted by owner",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "accepted",
      });

      await createInAppNotification(acceptedRequesterId, {
        type: "RENT_REQUEST_ACCEPTED",
        title: "Request Accepted!",
        message: `Your rental request for ${acceptedRequestData.itemName} has been accepted`,
        data: {
          route: "/chat",
          params: { id: chatId },
        },
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success!",
        textBody: `Request accepted successfully!`,
      });
    } catch (error) {
      console.error("Error accepting request:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to accept request. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const RENTAL_STATUS = {
    PENDING: "pending",
    ACCEPTED: "accepted",
    PAID: "paid",
    PICKED_UP: "pickedup",
    ACTIVE: "active",
    COMPLETED: "completed",
    DECLINED: "declined",
    CANCELLED: "cancelled",
  } as const;

  useEffect(() => {
    if (!messages.length) return;

    const fetchRequestStatuses = async () => {
      const rentRequestMessages = messages.filter(
        (m) => m.type === "rentRequest" && m.rentRequestId
      );

      const statusUpdates: Record<string, string> = {};
      await Promise.all(
        rentRequestMessages.map(async (message) => {
          if (typeof message.rentRequestId === "string") {
            const requestRef = doc(db, "rentRequests", message.rentRequestId);
            const requestSnap = await getDoc(requestRef);
            if (requestSnap.exists()) {
              statusUpdates[message.rentRequestId] = requestSnap.data().status;
            }
          }
        })
      );

      setRequestStatuses(statusUpdates);
    };

    fetchRequestStatuses();
  }, [messages]);

  const handleDeclineRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      // Update chat metadata
      await updateDoc(doc(db, "chat", String(chatId)), {
        status: "declined",
        lastMessage: "Request declined by owner",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true,
      });

      // ADD THIS: Update ALL rent request messages in this chat to declined status
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const rentRequestQuery = query(
        messagesRef,
        where("type", "==", "rentRequest")
      );

      const rentRequestMessages = await getDocs(rentRequestQuery);
      const batch = writeBatch(db);

      // Update all rent request messages to declined status
      rentRequestMessages.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "declined",
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      // Update the rent request in the rentRequests collection (if it exists)
      if (requestId) {
        const rentRequestRef = doc(db, "rentRequests", requestId);
        await updateDoc(rentRequestRef, {
          status: "declined",
          updatedAt: serverTimestamp(),
        });
      }

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request declined by owner",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      // Get requester's data for notification
      const requestDoc = await getDoc(doc(db, "rentRequests", requestId));
      const requestData = requestDoc.data();
      const requesterId = requestData?.requesterId;

      if (requesterId) {
        // Create in-app notification for requester
        await createInAppNotification(requesterId, {
          type: "RENT_REQUEST_DECLINED",
          title: "Request Declined",
          message: `Your rental request for ${chatData?.itemDetails?.name} has been declined`,
          data: {
            route: "/chat",
            params: {
              id: chatId,
              requestId: requestId,
            },
          },
        });

        // Send push notification if available
        if (requestData?.pushTokens?.token) {
          await sendPushNotification({
            to: requestData.pushTokens.token,
            title: "Request Declined",
            body: `Your rental request for ${chatData?.itemDetails?.name} has been declined`,
            data: {
              type: "RENT_REQUEST_DECLINED",
              chatId: String(chatId),
              requestId,
            },
          });
        }
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request declined successfully",
      });
    } catch (error) {
      console.error("Error declining request:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to decline request",
      });
    }
  };
  const handleCancelRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      const chatRef = doc(db, "chat", String(chatId));
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        throw new Error("Chat not found");
      }

      const chatData = chatSnap.data();

      // Store current item details before cancellation
      const itemDetails = {
        name: chatData.itemDetails?.name,
        price: chatData.itemDetails?.price,
        image: chatData.itemDetails?.image,
        itemId: chatData.itemId,
      };

      // Update chat status but preserve item details
      await updateDoc(chatRef, {
        status: "cancelled",
        lastMessage: "Request cancelled by requester",
        lastMessageTime: serverTimestamp(),
        itemDetails: itemDetails, // Preserve item details
      });

      // IMPORTANT: Update ALL rent request messages in this chat
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const rentRequestQuery = query(
        messagesRef,
        where("type", "==", "rentRequest")
      );

      const rentRequestMessages = await getDocs(rentRequestQuery);
      const batch = writeBatch(db);

      // Update all rent request messages to cancelled status
      rentRequestMessages.docs.forEach((doc) => {
        batch.update(doc.ref, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request cancelled by requester",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "cancelled",
      });

      // Delete from rentRequests collection if it exists
      try {
        const requestRef = doc(db, "rentRequests", requestId);
        await deleteDoc(requestRef);
      } catch (deleteError) {
        console.log(
          "Request document may not exist in rentRequests collection"
        );
      }

      // Only create in-app notification for the current user
      await createInAppNotification(currentUserId, {
        type: "RENT_REQUEST_CANCELLED",
        title: "Request Cancelled",
        message: `You cancelled your rental request for ${chatData?.itemDetails?.name}`,
        data: {
          route: "/chat",
          params: {
            id: chatId,
            requestId: requestId,
          },
        },
      });

      //Update Plan
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
        }
      }

      // No push notification for cancel since it's user's own action

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request cancelled successfully",
      });
    } catch (error) {
      console.error("Error cancelling request:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to cancel request",
      });
    }
  };

  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        className="bg-white"
      >
        <LottieActivityIndicator size={100} color="#5C6EF6" />
        <Text className="text-gray-500 font-psemibold">Loading chat...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-gray-200"
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
    >
      <ChatHeader
        recipientName={recipientName}
        recipientImage={recipientImage}
        itemDetails={chatData?.itemDetails}
        status={chatData?.status}
        recipientId={
          (chatData?.ownerId === currentUserId
            ? chatData?.requesterId
            : chatData?.ownerId) || ""
        }
        onBack={() => router.back()}
        recipientStatus={{ isOnline: true, lastSeen: new Date() }}
        isOwner={currentUserId === chatData?.ownerId}
        showFullProgress={showFullProgress}
        onToggleProgress={() => setShowFullProgress(!showFullProgress)}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
        className="flex-1"
        style={{ flex: 1 }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted={false}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "flex-end",
            paddingVertical: 16,
            paddingHorizontal: 12,
          }}
          // Add automatic scrolling to bottom for new messages
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          onLayout={() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }}
          renderItem={({ item, index }) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const showTimestamp = shouldShowTimestamp(item, previousMessage);
            const showDaySeparator = shouldShowDaySeparator(
              item,
              previousMessage
            );
            const isCurrentUser = item.senderId === currentUserId;

            return (
              <View>
                {showDaySeparator && (
                  <DaySeparator timestamp={item.createdAt} />
                )}
                {showTimestamp && <TimeIndicator timestamp={item.createdAt} />}

                {item.type === "rentRequest" ? (
                  <RentRequestMessage
                    item={item}
                    isOwner={currentUserId === chatData?.ownerId}
                    onAccept={() => memoizedHandleAccept(item.rentRequestId!)}
                    onDecline={() => memoizedHandleDecline(item.rentRequestId!)}
                    onCancel={() => memoizedHandleCancel(item.rentRequestId!)}
                    chatData={chatData}
                    chatId={String(chatId)}
                  />
                ) : item.type === "statusUpdate" ? (
                  <View className="bg-gray-100 rounded-full py-2 px-4 self-center mb-3">
                    <Text className="text-gray-600 text-sm text-center">
                      {item.text}
                    </Text>
                  </View>
                ) : item.type === "image" ? (
                  <View
                    className={`flex-row mb-2 ${
                      isCurrentUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isCurrentUser && (
                      <Image
                        source={{ uri: recipientImage }}
                        className="w-8 h-8 rounded-full mr-2 mt-1"
                      />
                    )}
                    <ImageMessage
                      item={item}
                      isCurrentUser={isCurrentUser}
                      onLongPress={() =>
                        handleMessageLongPress(item.id, item.senderId, item)
                      }
                    />
                  </View>
                ) : (
                  // Regular message
                  <TouchableOpacity
                    onLongPress={() =>
                      handleMessageLongPress(item.id, item.senderId, item)
                    }
                    delayLongPress={300}
                    activeOpacity={0.7}
                    className={`flex-row mb-2 ${
                      isCurrentUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isCurrentUser && (
                      <Image
                        source={{ uri: recipientImage }}
                        className="w-8 h-8 rounded-full mr-2 mt-1"
                      />
                    )}
                    <View className="flex-col">
                      <View
                        className={`max-w-[90%] min-w-[20px] justify-center rounded-2xl px-4 py-3 ${
                          isCurrentUser
                            ? "bg-primary rounded-tr-none self-end"
                            : "bg-white rounded-tl-none border border-gray-200"
                        }  } ${
                          messageSelection.selectedMessages.includes(item.id)
                            ? "border-2 border-primary"
                            : ""
                        }`}
                      >
                        <Text
                          className={`${
                            isCurrentUser ? "text-white" : "text-gray-800"
                          } text-base`}
                        >
                          {item.isDeleted ? (
                            <Text
                              className={`text-base italic ${
                                isCurrentUser
                                  ? "text-white/70"
                                  : "text-gray-500"
                              }`}
                            >
                              [Message deleted]
                            </Text>
                          ) : (
                            item.text
                          )}
                        </Text>
                        {item.isEdited && (
                          <Text
                            className={`text-xs ${
                              isCurrentUser ? "text-white/70" : "text-gray-500"
                            }`}
                          >
                            (edited)
                          </Text>
                        )}
                      </View>

                      {/* Message metadata */}
                      <View
                        className={`flex-row items-center mt-1 px-1 ${
                          isCurrentUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        {isCurrentUser && (
                          <>
                            {item.read ? (
                              <Image
                                source={icons.doubleCheck}
                                className="w-3 h-3 mr-1"
                                tintColor="#4285F4"
                              />
                            ) : (
                              <Image
                                source={icons.singleCheck}
                                className="w-3 h-3 mr-1"
                                tintColor="#9CA3AF"
                              />
                            )}
                          </>
                        )}
                        <Text className="text-xs text-gray-400">
                          {item.createdAt
                            ? format(item.createdAt.toDate(), "h:mm a")
                            : ""}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          ListFooterComponent={() => (
            <View>
              {uploadingImages.map((uri, index) => (
                <UploadingImageMessage key={`uploading-${index}`} uri={uri} />
              ))}
            </View>
          )}
        />

        {/* Message Input */}
        <View className="flex-row px-2 pb-2  gap-2 ">
          {!canSendMessage ? (
            // Show appropriate message based on status and user role
            (() => {
              if (chatData?.status === "cancelled") {
                return null;
              }

              if (chatData?.status === "declined") {
                return null;
              }

              // For pending status without owner response
              const isOwner = currentUserId === chatData?.ownerId;
              if (!isOwner && chatData?.status === "pending") {
                return (
                  <View className="flex-1 bg-white rounded-full py-3 px-4">
                    <Text className="text-gray-500 text-center">
                      Waiting for owner to respond to your request...
                    </Text>
                  </View>
                );
              }

              return null;
            })()
          ) : (
            <View className="flex-1 flex-row items-end gap-2 p-2 bg-white rounded-3xl ">
              {editingMessageId && (
                <View className="items-end  justify-end">
                  <TouchableOpacity
                    onPress={() => {
                      setEditingMessageId(null);
                      setEditText("");
                    }}
                    className="w-10 h-10 bg-red-500 rounded-full items-center justify-center"
                  >
                    <Image
                      source={icons.close}
                      className="w-6 h-6"
                      tintColor="#ffffff"
                    />
                  </TouchableOpacity>
                </View>
              )}
              {!editingMessageId && (
                <TouchableOpacity
                  onPress={() => setShowActionMenu(true)}
                  className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center"
                >
                  <Image
                    source={icons.bigPlus}
                    className="w-4 h-4"
                    tintColor="#ffffff"
                  />
                </TouchableOpacity>
              )}

              <TextInput
                value={editingMessageId ? editText : newMessage}
                onChangeText={editingMessageId ? setEditText : setNewMessage}
                placeholder={
                  editingMessageId ? "Edit message..." : "Type a message..."
                }
                multiline
                className="flex-1 min-h-8 max-h-24"
                style={{ textAlignVertical: "top" }}
              />

              {(newMessage.trim() || (editingMessageId && editText.trim())) && (
                <TouchableOpacity
                  onPress={editingMessageId ? handleEditSubmit : sendMessage}
                  className="w-10 h-10 bg-primary rounded-full items-center justify-center"
                  disabled={
                    editingMessageId ? !editText.trim() : !newMessage.trim()
                  }
                >
                  <Image
                    source={editingMessageId ? icons.check : icons.plane}
                    className="w-4 h-4"
                    tintColor="white"
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <MessageActionsModal
          visible={showMessageActions}
          message={selectedMessage} // Add this line
          onClose={() => {
            setShowMessageActions(false);
            setSelectedMessage(null);
          }}
          onEdit={() => {
            if (selectedMessage) {
              handleMessageEdit(selectedMessage.id, selectedMessage.text);
            }
          }}
          onDelete={() => {
            if (selectedMessage) {
              handleMessageDelete(selectedMessage.id);
            }
          }}
        />

        <ActionMenu
          visible={showActionMenu}
          onClose={() => setShowActionMenu(false)}
          items={actionItems}
        />

        {/* Camera Modal */}
        {showCamera && (
          <Modal animationType="slide" visible={showCamera}>
            <ChatCamera
              onPhotoTaken={async (uri) => {
                setShowCamera(false);
                // setIsLoading(true);
                try {
                  await uploadAndSendImage({
                    uri,
                    width: 300,
                    height: 300,
                    type: "image",
                    fileName: "photo.jpg",
                    fileSize: 0,
                    base64: null,
                    duration: null,
                    exif: null,
                  });
                } catch (error) {
                  console.error("Error sending photo:", error);
                  Toast.show({
                    type: ALERT_TYPE.DANGER,
                    title: "Error",
                    textBody: "Failed to send photo",
                  });
                } finally {
                  // setIsLoading(false);
                }
              }}
              onClose={() => setShowCamera(false)}
            />
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
