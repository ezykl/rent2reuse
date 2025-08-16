import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
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
} from "react-native";
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

// First fix the ChatHeader props interface
interface ChatHeaderProps {
  recipientName: {
    firstname: string;
    lastname: string;
    middlename?: string;
  };
  recipientImage?: string;
  recipientStatus?: any;
  onBack: () => void;
}

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
const ChatHeader = ({
  recipientName,
  recipientImage,
  recipientStatus,
  onBack,
}: ChatHeaderProps) => {
  // Format full name helper function
  const formatFullName = () => {
    const middleInitial = recipientName.middlename
      ? ` ${recipientName.middlename.charAt(0)}.`
      : "";
    return `${recipientName.firstname}${middleInitial} ${recipientName.lastname}`;
  };
  console.log("Formatted Full Name:", formatFullName()); // Debug log

  const getStatusText = (status: any) => {
    if (status?.isOnline) return "Online";
    if (status?.lastSeen) {
      const lastSeenDate = status.lastSeen.toDate();
      const now = new Date();
      const diffMinutes = Math.floor(
        (now.getTime() - lastSeenDate.getTime()) / 1000 / 60
      );

      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
      return "Offline";
    }
    return "Offline";
  };

  return (
    <View className="flex-row items-center p-4 bg-white border-b border-gray-100">
      <TouchableOpacity onPress={onBack} className="mr-3">
        <Image
          source={icons.leftArrow}
          className="w-8 h-8"
          tintColor="#6B7280"
        />
      </TouchableOpacity>
      <View className="relative">
        <Image
          source={{ uri: recipientImage || "https://via.placeholder.com/40" }}
          className="w-10 h-10 rounded-full bg-gray-200"
        />
        <View
          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
            recipientStatus?.isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
        />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold">{formatFullName()}</Text>
        <Text className="text-xs text-gray-500">
          {getStatusText(recipientStatus)}
        </Text>
      </View>
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
        className="flex-1 bg-black/10 px-3 justify-center items-center"
      >
        <View className=" absolute bottom-0 mb-2 w-full py-4 bg-white rounded-2xl shadow-lg">
          <View className="flex-row flex-wrap justify-center">
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
  status: string;
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  type?: "message" | "rentRequest" | "statusUpdate";
  read: boolean;
  readAt: any;
  rentRequestId?: string;
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

const RentRequestMessage = ({
  item,
  isOwner,
  onAccept,
  onDecline,
  onCancel,
  chatData, // Add chatData prop
}: {
  item: Message;
  isOwner: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  chatData?: any;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [rentRequestData, setRentRequestData] = useState<any>(null);
  const isSender = item.senderId === auth.currentUser?.uid;

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (item.rentRequestId && requestDataCache.has(item.rentRequestId)) {
          const cachedData = requestDataCache.get(item.rentRequestId);
          setRentRequestData(cachedData);
          return;
        }

        // If request is cancelled, use chat data as fallback
        if (chatData?.status === "cancelled") {
          const fallbackData = {
            itemName: chatData.itemDetails?.name,
            itemImage: chatData.itemDetails?.image,
            totalPrice: chatData.itemDetails?.price,
            status: "cancelled",
            // Add other necessary fields from chatData
          };
          setRentRequestData(fallbackData);
          return;
        }

        // Try to fetch from rentRequests collection
        if (item.rentRequestId) {
          const rentRequestRef = doc(db, "rentRequests", item.rentRequestId);
          const rentRequestSnap = await getDoc(rentRequestRef);

          if (rentRequestSnap.exists()) {
            const requestData = rentRequestSnap.data();
            setRentRequestData(requestData);
            requestDataCache.set(item.rentRequestId, requestData);
          } else {
            // If request document doesn't exist, fall back to chat data
            const fallbackData = {
              itemName: chatData.itemDetails?.name,
              itemImage: chatData.itemDetails?.image,
              totalPrice: chatData.itemDetails?.price,
              status: chatData.status,
              // Add other necessary fields from chatData
            };
            setRentRequestData(fallbackData);
          }
        }
      } catch (error) {
        console.error("Error fetching request data:", error);
        // Fall back to chat data on error
        if (chatData) {
          const fallbackData = {
            itemName: chatData.itemDetails?.name,
            itemImage: chatData.itemDetails?.image,
            totalPrice: chatData.itemDetails?.price,
            status: chatData.status,
          };
          setRentRequestData(fallbackData);
        }
      }
    };

    fetchData();
  }, [item.rentRequestId, chatData]);

  // Format date helper function
  const formatDate = (date: any) => {
    if (!date) return "";
    return format(date.toDate(), "MMM d, yyyy");
  };

  if (!rentRequestData) {
    return (
      <View className="bg-white rounded-xl p-4 mb-3">
        <Text className="text-gray-500">Loading request details...</Text>
      </View>
    );
  }

  // Helper function to get status badge style
  const getStatusBadge = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "approved":
      case "accepted":
        return "bg-primary text-green-600";
      case "declined":
      case "rejected":
        return "bg-red-100 text-red-600";
      case "cancelled":
        return "bg-gray-100 text-gray-600";
      case "pending":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-gray-100 text-gray-600"; // Default style for undefined or unknown status
    }
  };

  const getStatusDisplay = () => {
    switch (rentRequestData.status.toLowerCase()) {
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
        {/* Status Badge */}
        <View
          className={`absolute top-4 right-4 px-2 py-1 rounded-full ${getStatusBadge(
            rentRequestData.status
          )}`}
        >
          <Text
            className={`text-xs font-pmedium capitalize ${isSender ? "" : ""}`}
          >
            {rentRequestData.status || "pending"}
          </Text>
        </View>

        <Text
          className={`text-sm font-pmedium mb-2 ${
            isSender ? "text-gray-500" : "text-gray-500"
          }`}
        >
          {isSender ? "Your Request" : "Rental Request"}
        </Text>

        {/* Basic Info */}
        <View className="flex-row items-start gap-3">
          <Image
            source={{ uri: rentRequestData.itemImage }}
            className="w-16 h-16 rounded-lg"
            resizeMode="cover"
          />
          <View className="flex-1">
            <Text
              className={`font-pbold text-base mb-1 ${
                isSender ? "text-gray-900" : "text-gray-900"
              }`}
            >
              {rentRequestData.itemName}
            </Text>
            <Text
              className={`text-sm ${
                isSender ? "text-gray-600" : "text-gray-600"
              }`}
            >
              {formatDate(rentRequestData.startDate)} -{" "}
              {formatDate(rentRequestData.endDate)}
            </Text>
            <Text
              className={`font-pmedium mt-1 ${
                isSender ? "text-primary" : "text-primary"
              }`}
            >
              ₱
              {Math.round(
                rentRequestData.totalPrice / rentRequestData.rentalDays
              )}
              /day
            </Text>
          </View>
        </View>

        <View>
          <Text
            className={`text-xs font-pbold uppercase ${
              isSender ? "text-gray-400" : "text-gray-400"
            }`}
          >
            Message
          </Text>
          <Text
            className={`text-sm mt-1 ${
              isSender ? "text-gray-700" : "text-gray-700"
            }`}
          >
            {rentRequestData.message}
          </Text>
        </View>

        {/* Show More/Less Button */}
        <TouchableOpacity
          onPress={() => setShowDetails(!showDetails)}
          className="mt-3 py-2 flex-row items-center justify-center"
        >
          <Text
            className={`text-sm font-pmedium mr-1 ${
              isSender ? "text-blue-500" : "text-blue-500"
            }`}
          >
            {showDetails ? "Show less" : "Show details"}
          </Text>

          <Image
            source={icons.arrowDown}
            className={`w-4 h-4 ${showDetails ? "rotate-180" : ""}`}
            tintColor={isSender ? "#5C6EF6" : "#5C6EF6"}
          />
        </TouchableOpacity>

        {/* Detailed Info */}
        {showDetails && (
          <View
            className={`mt-3 pt-3 ${
              isSender ? "border-t border-gray-100" : "border-t border-gray-100"
            }`}
          >
            <View className="space-y-3">
              <View>
                <Text
                  className={`text-xs font-pbold uppercase ${
                    isSender ? "text-gray-400" : "text-gray-400"
                  }`}
                >
                  Rental Period
                </Text>
                <Text
                  className={`text-sm mt-1 ${
                    isSender ? "text-gray-700" : "text-gray-700"
                  }`}
                >
                  {rentRequestData.rentalDays} days
                </Text>
              </View>

              <View>
                <Text
                  className={`text-xs font-pbold uppercase ${
                    isSender ? "text-gray-400" : "text-gray-400"
                  }`}
                >
                  Total Amount
                </Text>
                <Text
                  className={`text-sm mt-1 ${
                    isSender ? "text-gray-700" : "text-gray-700"
                  }`}
                >
                  ₱{rentRequestData.totalPrice.toLocaleString()}
                </Text>
              </View>

              <View>
                <Text
                  className={`text-xs font-pbold uppercase ${
                    isSender ? "text-gray-400" : "text-gray-400"
                  }`}
                >
                  Pickup Time
                </Text>
                <Text
                  className={`text-sm mt-1 ${
                    isSender ? "text-gray-700" : "text-gray-700"
                  }`}
                >
                  {Math.floor(rentRequestData.pickupTime / 60)}:
                  {(rentRequestData.pickupTime % 60)
                    .toString()
                    .padStart(2, "0")}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Status Display */}
        {getStatusDisplay()}

        {/* Only show action buttons if status is pending */}
        {rentRequestData.status === "pending" && (
          /* Action Buttons */
          <>
            {isOwner ? (
              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity
                  onPress={onAccept}
                  className="flex-1 bg-primary py-3 rounded-xl"
                >
                  <Text className="text-white font-pbold text-center">
                    ACCEPT
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onDecline}
                  className="flex-1 bg-red-500 py-3 rounded-xl"
                >
                  <Text className="text-white font-pbold text-center">
                    DECLINE
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="mt-4">
                <TouchableOpacity
                  onPress={onCancel}
                  className={`py-3 rounded-xl ${
                    isSender ? "bg-red-400" : "bg-white"
                  }`}
                >
                  <Text
                    className={`font-pbold text-center ${
                      isSender ? "text-white" : "text-gray-600"
                    }`}
                  >
                    CANCEL REQUEST
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        {/* Show accepted status message when accepted */}
        {rentRequestData.status === "accepted" && (
          <View className="bg-green-50 p-4 rounded-lg mt-4">
            <Text className="text-green-600 text-center font-pmedium">
              ✓ Request accepted! You can now chat freely.
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

const requestDataCache = new Map();

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
  const [canSendMessage, setCanSendMessage] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

  const [chatData, setChatData] = useState<{
    requesterId: string;
    ownerId: string;
    status: string;
    itemDetails?: {
      name?: string;
      price?: number;
      image?: string;
      itemId?: string;
    };
  } | null>(null);

  if (!currentUserId || !chatId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error: Missing user ID or chat ID</Text>
      </View>
    );
  }

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
          setRecipientImage(recipientData.profileImage || "");
          setRecipientName({
            firstname: recipientData.firstname || "", // Changed from firstName
            lastname: recipientData.lastname || "", // Changed from lastName
            middlename: recipientData.middlename || "", // Changed from middleName
          });

          // Create new chat document
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
          // Existing chat - fetch recipient data
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
                  firstname: userData.firstname || "", // Changed from firstName
                  lastname: userData.lastname || "", // Changed from lastName
                  middlename: userData.middlename || "", // Changed from middleName
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
    const q = query(messagesRef, orderBy("createdAt", "desc")); // Change to desc

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];
        setMessages(fetchedMessages.reverse()); // Reverse the array for correct display
      },
      (error) => {
        console.error("Error fetching messages:", error);
      }
    );

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

      const messageData = {
        senderId: currentUserId,
        text: messageText,
        type: "message", // Add message type
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      };

      // Add message to subcollection
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      await addDoc(messagesRef, messageData);

      const updateData: any = {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        unreadCount: increment(1),
      };

      const isOwner = currentUserId === chatData?.ownerId;
      if (isOwner) {
        updateData.hasOwnerResponded = true;
      }

      await updateDoc(chatRef, updateData);

      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      setNewMessage(messageText);
    }
  };

  // Update the RentRequestMessage component to use rentRequestDetails

  // Add this near your other useEffect hooks
  useEffect(() => {
    if (!currentUserId || loading) return;

    const markMessagesAsRead = async () => {
      try {
        const messagesRef = collection(db, "chat", String(chatId), "messages");
        // More efficient query
        const q = query(
          messagesRef,
          where("senderId", "!=", currentUserId),
          where("read", "==", false),
          orderBy("senderId"), // Add this to match the composite index
          orderBy("__name__") // Add this to match the composite index
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

          await batch.commit();

          // Reset unread count in chat document
          const chatRef = doc(db, "chat", String(chatId));
          await updateDoc(chatRef, { unreadCount: 0 });
        }
      } catch (error: any) {
        if (error.code === "failed-precondition") {
          console.log("Waiting for index to build...");
          // Optionally show user-friendly message
          // Alert.alert('Notice', 'Message read status will be available soon');
        } else {
          console.error("Error marking messages as read:", error);
        }
      }
    };

    // Call immediately when entering chat
    markMessagesAsRead();

    // Also set up listener for new messages
    const messagesRef = collection(db, "chat", String(chatId), "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latestMessage = snapshot.docs[0];
        if (
          latestMessage.data().senderId !== currentUserId &&
          !latestMessage.data().read
        ) {
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

  const memoizedHandleDecline = useCallback(
    (requestId: string) => handleDeclineRequest(requestId),
    []
  );

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

  const actionItems: ActionMenuItem[] = [
    {
      id: "1",
      icon: icons.location,
      label: "Location",
      action: handleSendLocation,
      bgColor: "#E0F2F1",
      iconColor: "#009688",
    },
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
    {
      id: "4",
      icon: icons.check,
      label: "Verdict",
      action: handleSendVerdict,
      bgColor: "#F3E5F5",
      iconColor: "#9C27B0",
    },
  ];

  // Add this useEffect in ChatScreen
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

  const handleAcceptRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      // Update chat metadata
      await updateDoc(doc(db, "chat", String(chatId)), {
        status: "accepted",
        lastMessage: "Request accepted by owner",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true, // Mark that owner has responded
      });

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request accepted by owner",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      const rentRequestRef = doc(db, "rentRequests", requestId);
      await updateDoc(rentRequestRef, {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request accepted successfully",
      });
    } catch (error) {
      console.error("Error accepting request:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to accept request",
      });
    }
  };

  const handleDeclineRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      // Update chat metadata
      await updateDoc(doc(db, "chat", String(chatId)), {
        status: "declined",
        lastMessage: "Request declined by owner",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true, // Mark that owner has responded
      });

      // Update the rent request in the rentRequests collection
      const rentRequestRef = doc(db, "rentRequests", requestId);
      await updateDoc(rentRequestRef, {
        status: "declined",
        updatedAt: serverTimestamp(),
      });

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request declined by owner",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

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

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request cancelled by requester",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "cancelled",
        // itemDetails: itemDetails,
      });

      // Update the rent request message if it exists
      const messagesRef = collection(db, "chat", String(chatId), "messages");
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

      // Delete from rentRequests collection
      const requestRef = doc(db, "rentRequests", requestId);
      await deleteDoc(requestRef);

      // Disable messaging
      setCanSendMessage(false);

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
      className="flex-1 bg-gray-50"
      style={{ paddingBottom: insets.bottom, paddingTop: insets.top }}
    >
      <ChatHeader
        recipientName={recipientName}
        recipientImage={recipientImage}
        onBack={() => router.back()}
        recipientStatus={{ isOnline: true, lastSeen: new Date() }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
        className="flex-1"
        style={{ flex: 1 }} // Add this
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted={false} // Change to false
          keyExtractor={(item) => item.id}
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

            return (
              <View>
                {/* Day Separator */}
                {showDaySeparator && (
                  <DaySeparator timestamp={item.createdAt} />
                )}

                {/* Time Indicator */}
                {showTimestamp && <TimeIndicator timestamp={item.createdAt} />}

                {/* Message Content */}
                {item.type === "rentRequest" ? (
                  <RentRequestMessage
                    item={item}
                    isOwner={currentUserId === chatData?.ownerId}
                    onAccept={() => memoizedHandleAccept(item.rentRequestId!)}
                    onDecline={() => memoizedHandleDecline(item.rentRequestId!)}
                    onCancel={() => memoizedHandleCancel(item.rentRequestId!)}
                    chatData={chatData}
                  />
                ) : item.type === "statusUpdate" ? (
                  <View className="bg-gray-100 rounded-full py-2 px-4 self-center mb-3">
                    <Text className="text-gray-600 text-sm text-center">
                      {item.text}
                    </Text>
                  </View>
                ) : (
                  // Regular message with enhanced timestamp
                  <View
                    className={`flex-row mb-2 ${
                      item.senderId === currentUserId
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {item.senderId !== currentUserId && (
                      <Image
                        source={{ uri: recipientImage }}
                        className="w-8 h-8 rounded-full mr-2 mt-1"
                      />
                    )}
                    <View className="flex-col">
                      <View
                        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                          item.senderId === currentUserId
                            ? "bg-primary rounded-tr-none self-end"
                            : "bg-white rounded-tl-none border border-gray-200"
                        }`}
                      >
                        <Text
                          className={`${
                            item.senderId === currentUserId
                              ? "text-white"
                              : "text-gray-800"
                          } text-base`}
                        >
                          {item.text}
                        </Text>
                      </View>

                      {/* Message status and mini time for sender's messages */}
                      {item.senderId === currentUserId && (
                        <View className="flex-row items-center justify-end mt-1 px-1">
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
                          <Text className="text-xs text-gray-400">
                            {item.createdAt
                              ? format(item.createdAt.toDate(), "h:mm a")
                              : ""}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View className="flex-1 justify-center items-center pt-12">
              <Text className="text-gray-500">
                No messages yet. Start the conversation!
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS !== "web"}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />

        {/* Message Input */}
        <View className="flex-row p-2 bg-white border-t border-gray-100 gap-2">
          {!canSendMessage ? (
            // Show appropriate message based on status and user role
            (() => {
              if (chatData?.status === "cancelled") {
                return (
                  <View className="flex-1 bg-gray-100 rounded-full py-3 px-4">
                    <Text className="text-gray-500 text-center">
                      Request has been cancelled.
                    </Text>
                  </View>
                );
              }

              if (chatData?.status === "declined") {
                return (
                  <View className="flex-1 bg-red-100 rounded-full py-3 px-4">
                    <Text className="text-red-600 text-center">
                      Request has been declined.
                    </Text>
                  </View>
                );
              }

              // For pending status without owner response
              const isOwner = currentUserId === chatData?.ownerId;
              if (!isOwner && chatData?.status === "pending") {
                return (
                  <View className="flex-1 bg-gray-100 rounded-full py-3 px-4">
                    <Text className="text-gray-500 text-center">
                      Waiting for owner to respond to your request...
                    </Text>
                  </View>
                );
              }

              return null;
            })()
          ) : (
            <View className="flex-1 flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setShowActionMenu(true)}
                className="w-12 h-12 bg-gray-200 rounded-full items-center justify-center"
              >
                <Image
                  source={icons.bigPlus}
                  className="w-6 h-6"
                  tintColor="#6B7280"
                />
              </TouchableOpacity>

              <TextInput
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Type a message..."
                multiline
                className="flex-1 bg-gray-100 rounded-full p-5 max-h-24"
                style={{ textAlignVertical: "top" }}
              />
              <TouchableOpacity
                onPress={sendMessage}
                className="w-12 h-12 bg-primary rounded-full items-center justify-center"
                disabled={newMessage.trim() === ""}
              >
                <Image
                  source={icons.plane}
                  className="w-6 h-6"
                  tintColor="white"
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ActionMenu
          visible={showActionMenu}
          onClose={() => setShowActionMenu(false)}
          items={actionItems}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
