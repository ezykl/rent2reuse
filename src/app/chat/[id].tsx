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
} from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { icons } from "@/constant";
import { format } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

const ChatHeader = ({
  recipientEmail,
  recipientImage,
  recipientStatus,
  onBack,
}: {
  recipientEmail: string;
  recipientImage?: string;
  recipientStatus?: any;
  onBack: () => void;
}) => {
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
        <Image source={icons.leftArrow} className="w-6 h-6" />
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
        <Text className="text-base font-semibold">
          {recipientEmail.split("@")[0]}
        </Text>
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
}: {
  item: Message;
  isOwner: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [rentRequestData, setRentRequestData] = useState<any>(null);
  const [itemData, setItemData] = useState<any>(null);
  const isSender = item.senderId === auth.currentUser?.uid;

  // Fetch rentRequest and item data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch rent request data

        if (item.rentRequestId && requestDataCache.has(item.rentRequestId)) {
          const cachedData = requestDataCache.get(item.rentRequestId);
          setRentRequestData(cachedData.requestData);
          setItemData(cachedData.itemData);
          return;
        }
        if (item.rentRequestId) {
          const rentRequestRef = doc(db, "rentRequests", item.rentRequestId);
          const rentRequestSnap = await getDoc(rentRequestRef);

          if (rentRequestSnap.exists()) {
            const requestData = rentRequestSnap.data();
            setRentRequestData(requestData);

            if (requestData.itemId) {
              const itemRef = doc(db, "items", requestData.itemId);
              const itemSnap = await getDoc(itemRef);

              if (itemSnap.exists()) {
                const itemData = itemSnap.data();
                setItemData(itemData);

                // Cache the data
                requestDataCache.set(item.rentRequestId, {
                  requestData,
                  itemData,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching request data:", error);
      }
    };

    fetchData();
  }, [item.rentRequestId]);

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

  return (
    <View className={`flex- mb-3 ${isSender ? "pl-8" : "pr-8"}`}>
      <View
        className={`p-4 shadow-sm flex-1 ${
          isSender
            ? "bg-white rounded-xl rounded-br-none border border-primary"
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

              {itemData && (
                <View>
                  <Text
                    className={`text-xs font-pbold uppercase ${
                      isSender ? "text-gray-400" : "text-gray-400"
                    }`}
                  >
                    Item Details
                  </Text>
                  <Text
                    className={`text-sm mt-1 ${
                      isSender ? "text-gray-700" : "text-gray-700"
                    }`}
                  >
                    Category: {itemData.category}
                  </Text>
                  <Text
                    className={`text-sm ${
                      isSender ? "text-gray-700" : "text-gray-700"
                    }`}
                  >
                    Condition: {itemData.condition}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {rentRequestData.status === "pending" && (
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
  const [recipientEmail, setRecipientEmail] = useState("");
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
  } | null>(null);

  if (!currentUserId || !chatId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error: Missing user ID or chat ID</Text>
      </View>
    );
  }

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
          setRecipientEmail(recipientData.email);
          setRecipientImage(recipientData.profileImage || ""); // Set profile image for new chat

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
                setRecipientEmail(userData.email);
                setRecipientImage(userData.profileImage || ""); // Set profile image for existing chat
              }
            }
          }
        }

        setLoading(false);
      } catch (error: any) {
        console.error("Error initializing chat:", error);
        // Specifically handle BloomFilter errors
        if (error.name === "BloomFilterError") {
          console.log("Ignoring BloomFilter error - continuing operation");
        } else {
          Alert.alert("Error", "Failed to load chat");
        }
        setLoading(false);
      }
    };

    initializeChat();
  }, [chatId, currentUserId]);

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
        });

        const isOwner = currentUserId === data.ownerId;
        const hasRentRequest = data.hasRentRequest;

        // Owner can always send messages, requester needs valid request
        setCanSendMessage(isOwner || data.status === "accepted");
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

      // Update chat metadata
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        unreadCount: increment(1), // Add this to track unread messages
      });

      // Scroll to bottom after sending

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
      const requestRef = doc(db, "rentRequests", requestId);
      await updateDoc(requestRef, {
        status: "accepted",
        updatedAt: serverTimestamp(),
      });

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request accepted",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const handleDeclineRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      const requestRef = doc(db, "rentRequests", requestId);
      await updateDoc(requestRef, {
        status: "declined",
        updatedAt: serverTimestamp(),
      });

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request declined",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (error) {
      console.error("Error declining request:", error);
    }
  };

  const handleCancelRequest = async (requestId?: string) => {
    if (!requestId) return;

    try {
      const requestRef = doc(db, "rentRequests", requestId);
      await updateDoc(requestRef, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });

      // Add status update message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request cancelled by requester",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Request Cancelled",
        textBody: "Your request has been cancelled successfully",
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
        recipientEmail={recipientEmail}
        recipientImage={recipientImage}
        onBack={() => router.back()}
        recipientStatus={{ isOnline: true, lastSeen: new Date() }} // Dummy data for testing
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
          renderItem={({ item }) => {
            if (item.type === "rentRequest") {
              // Update how we determine if user is owner
              const isOwner = currentUserId === chatData?.ownerId;
              return (
                <RentRequestMessage
                  item={item}
                  isOwner={isOwner}
                  onAccept={() => memoizedHandleAccept(item.rentRequestId!)}
                  onDecline={() => memoizedHandleDecline(item.rentRequestId!)}
                  onCancel={() => memoizedHandleCancel(item.rentRequestId!)}
                />
              );
            }

            if (item.type === "statusUpdate") {
              return (
                <View className="bg-gray-100 rounded-full py-2 px-4 self-center mb-3">
                  <Text className="text-gray-600 text-sm text-center">
                    {item.text}
                  </Text>
                </View>
              );
            }

            const isSender = item.senderId === currentUserId;
            return (
              <View
                className={`flex-row mb-3 ${
                  isSender ? "justify-end" : "justify-start"
                }`}
              >
                {!isSender && (
                  <Image
                    source={{ uri: recipientImage }}
                    className="w-8 h-8 rounded-full mr-2 mt-1"
                  />
                )}
                <View
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    isSender
                      ? "bg-primary rounded-tr-none"
                      : "bg-white rounded-tl-none border border-gray-200"
                  }`}
                >
                  <Text className={isSender ? "text-white" : "text-gray-800"}>
                    {item.text}
                  </Text>
                </View>
              </View>
            );

            // return (
            //   <View
            //     className={`flex-row mb-3 ${
            //       item.senderId === currentUserId
            //         ? "justify-end"
            //         : "justify-start"
            //     }`}
            //   >
            //     {item.senderId !== currentUserId && (
            //       <Image
            //         source={{ uri: recipientImage }}
            //         className="w-8 h-8 rounded-full mr-2 mt-1"
            //       />
            //     )}
            //     <View
            //       className={`max-w-[75%] rounded-2xl px-4 py-3 border border-gray-200 shadow-sm
            //         ${
            //           item.senderId === currentUserId
            //             ? "bg-primary rounded-tr-none"
            //             : "bg-white rounded-tl-none"
            //         }`}
            //     >
            //       <Text
            //         className={`${
            //           item.senderId === currentUserId
            //             ? "text-white"
            //             : "text-gray-800"
            //         } text-base`}
            //       >
            //         {item.text}
            //       </Text>
            //     </View>
            //     {item.senderId === currentUserId && (
            //       <View className="flex-row items-center ml-2">
            //         {item.read ? (
            //           <>
            //             <Image
            //               source={icons.doubleCheck}
            //               className="w-4 h-4 tint-primary"
            //             />
            //             {item.readAt && (
            //               <Text className="text-xs text-gray-400 ml-1">
            //                 {format(item.readAt.toDate(), "HH:mm")}
            //               </Text>
            //             )}
            //           </>
            //         ) : (
            //           <Image
            //             source={icons.singleCheck}
            //             className="w-4 h-4 tint-gray-400"
            //           />
            //         )}
            //       </View>
            //     )}
            //   </View>
            // );
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
            <View className="flex-1 bg-gray-100 rounded-full py-3 px-4">
              <Text className="text-gray-500 text-center">
                Waiting for owner to respond to your request...
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setShowActionMenu(true)}
                className="p-3 rounded-full bg-primary"
              >
                <Image
                  source={icons.bigPlus}
                  className="w-5 h-5" // Updated size
                  tintColor="white"
                />
              </TouchableOpacity>
              <View className="flex-1 bg-gray-100 rounded-full py-3 px-4">
                <TextInput
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type a message..."
                  multiline
                  maxLength={1000}
                  className="flex-1 max-h-28 text-base"
                />
              </View>
              <TouchableOpacity
                onPress={sendMessage}
                disabled={!newMessage.trim()}
                className={`p-3 rounded-full justify-center ${
                  newMessage.trim() ? "bg-primary" : "bg-gray-300"
                }`}
              >
                <Image
                  source={icons.plane}
                  className="w-5 h-5" // Updated size
                  tintColor="white"
                />
              </TouchableOpacity>
            </>
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
