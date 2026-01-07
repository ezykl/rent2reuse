import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  SafeAreaView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import dayjs from "dayjs";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import { db, auth } from "@/lib/firebaseConfig";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import Header from "@/components/Header";
import stringSimilarity from "string-similarity";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";

//typeScript
interface User {
  id: string;
  email?: string;
  profile?: string;
  profilePic?: string;
  [key: string]: any;
}

interface Chat {
  id: string;
  recipientId: string;
  recipientName: {
    firstname: string;
    lastname: string;
    middlename?: string;
  };
  recipientProfileImage: string;
  lastMessage: string;
  lastMessageTime: Date | null;
  isCurrentUserLastSender: boolean;
  isRentRequest?: boolean;
  requestStatus:
    | "pending"
    | "accepted"
    | "declined"
    | "cancelled"
    | "initial_payment_paid"
    | "assessment_submitted"
    | "pickedup"
    | "completed";
  itemDetails?: {
    id: string;
    name: string;
    price: number;
    image: string;
  };
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "cancelled"
    | "initial_payment_paid"
    | "assessment_submitted"
    | "pickedup"
    | "completed";
  unreadCounts: {
    [userId: string]: number;
  };
  lastSender: string;
  requesterId?: string;
  ownerId?: string;
}

interface SearchResult {
  isExistingChat: boolean;
  chatId?: string;
  userId: string;
  fullName: string;
  profilePic: string;
  lastMessage?: string;
  lastMessageTime?: Date | null;
  isCurrentUserLastSender?: boolean;
  itemDetails?: {
    id: string;
    name: string;
    price: number;
    image: string;
  };
  status?:
    | "pending"
    | "accepted"
    | "declined"
    | "cancelled"
    | "initial_payment_paid"
    | "assessment_submitted"
    | "pickedup"
    | "completed";
  isRentRequest?: boolean;
  unreadCounts?: {
    [userId: string]: number;
  };
}

type TabType = "all" | "sent" | "received" | "closed";

interface TabButtonProps {
  title: string;
  isActive: boolean;
  onPress: () => void;
  count?: number;
}

const TabButton = ({ title, isActive, onPress, count }: TabButtonProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={` px-4 py-3 min-w-24 rounded-full border ${
        isActive ? "bg-primary border-primary" : "bg-white border-gray-200"
      }`}
    >
      <View className="flex-row justify-center item-center ">
        <Text
          className={`${
            isActive ? "text-white font-pmedium" : "text-gray-600 font-pmedium"
          } text-sm`}
        >
          {title}
        </Text>
        {count !== undefined && (
          <Text
            className={`ml-1 text-sm font-pmedium  ${
              isActive ? "text-white/80" : "text-gray-400"
            }`}
          >
            ({count})
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const ChatList = () => {
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [chats, setChats] = useState<Chat[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    // when focused, start a 4s timer
    setTimeout(() => {
      inputRef.current?.blur();
      Keyboard.dismiss();
    }, 4000);
  };

  // Fixed filtering logic
  const getFilteredChats = (
    chats: Chat[],
    tab: TabType,
    userId: string | null
  ) => {
    if (!userId) return [];

    return chats.filter((chat) => {
      // Check if this is a rent request (has itemDetails)
      const isRentRequest = !!chat.itemDetails;

      switch (tab) {
        case "all":
          if (
            isRentRequest &&
            ["declined", "cancelled"].includes(chat.status)
          ) {
            return false;
          }
          return true;
        case "sent":
          return (
            isRentRequest &&
            chat.requesterId === userId &&
            !["declined", "cancelled"].includes(chat.status)
          );
        case "received":
          return (
            isRentRequest &&
            chat.ownerId === userId &&
            !["declined", "cancelled"].includes(chat.status)
          );
        case "closed":
          // Show declined/cancelled requests where user is involved
          return (
            isRentRequest &&
            (chat.requesterId === userId || chat.ownerId === userId) &&
            ["declined", "cancelled"].includes(chat.status)
          );
        default:
          return false;
      }
    });
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const userId = user.uid;
      setCurrentUserId(userId);

      // loadAllUsers(userId);
      const unsubscribeChats = loadExistingChats(userId);

      // Return cleanup function for both auth and chat listeners
      return () => {
        unsubscribeChats();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  const loadAllUsers = async (currentUserId: string) => {
    try {
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      if (usersSnapshot.empty) {
        setAllUsers([]);
        return;
      }

      const usersData: User[] = usersSnapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as User)
        )
        .filter((user) => user.id !== currentUserId && user.email);

      setAllUsers(usersData);
    } catch (error) {
      console.log("Error loading users:", error);
      Alert.alert("Error", "Failed to load users for search");
    }
  };

  const loadExistingChats = (userId: string) => {
    try {
      const chatsRef = collection(db, "chat");
      const q = query(
        chatsRef,
        where("participants", "array-contains", userId),
        orderBy("lastMessageTime", "desc")
      );

      // ✅ CHANGE: Use onSnapshot for real-time updates instead of getDocs
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        try {
          const chatList = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const chatData = docSnap.data();
              const chatId = docSnap.id;

              // ✅ FIX: Get recipientId safely and handle missing data
              const recipientId =
                chatData.participants?.find((id: string) => id !== userId) ||
                chatData.requesterId ||
                chatData.ownerId; // Fallback to requesterId or ownerId

              if (!recipientId) {
                console.log("Warning: No recipient ID found for chat:", chatId);
                return null; // Skip this chat
              }

              let recipient = null;
              try {
                const userDoc = await getDoc(doc(db, "users", recipientId));
                recipient = userDoc.exists() ? userDoc.data() : null;
              } catch (error) {
                console.log(
                  "Error fetching recipient for chat:",
                  chatId,
                  error
                );
              }

              if (!recipient) {
                console.log(
                  "Warning: Recipient not found for chat:",
                  chatId,
                  "recipientId:",
                  recipientId
                );
                // Return a default recipient object instead of failing
                recipient = {
                  firstname: "Unknown",
                  lastname: "User",
                  profileImage: "https://via.placeholder.com/50",
                };
              }

              return {
                id: chatId,
                recipientId,
                recipientName: {
                  firstname: recipient?.firstname || "Unknown",
                  lastname: recipient?.lastname || "User",
                  middlename: recipient?.middlename || "",
                },
                recipientProfileImage:
                  recipient?.profileImage || "https://via.placeholder.com/50",
                lastMessage: chatData.lastMessage || "No messages yet",
                lastMessageTime: chatData.lastMessageTime?.toDate() || null,
                isCurrentUserLastSender: chatData.lastSender === userId,
                lastSender: chatData.lastSender,
                unreadCounts: chatData.unreadCounts || {},
                isRentRequest: !!chatData.itemDetails,
                requestStatus: chatData.status || "pending",
                itemDetails: chatData.itemDetails || null,
                status: chatData.status || "pending",
                requesterId: chatData.requesterId,
                ownerId: chatData.ownerId,
              } as Chat;
            })
          );

          // ✅ Filter out null values (skipped chats)
          const validChatList = chatList.filter(
            (chat) => chat !== null
          ) as Chat[];

          setChats(validChatList);
          setLoading(false);
        } catch (error) {
          console.log("Error processing chat snapshot:", error);
          setLoading(false);
        }
      });

      // Return unsubscribe function for cleanup
      return unsubscribe;
    } catch (error) {
      console.log("Error setting up chat listener:", error);
      setLoading(false);
      return () => {}; // Return empty unsubscribe function
    }
  };

  const getTabCount = (tabType: TabType, searchQuery: string = "") => {
    if (!searchQuery.trim()) {
      // No search - use default filtering
      return getFilteredChats(chats, tabType, currentUserId).length;
    }

    // With search - filter matching chats first, then apply tab filter
    const searchLower = searchQuery.toLowerCase().trim();

    const matchingChats = chats.filter((chat) => {
      // Search by recipient name
      const fullName = formatFullName(chat.recipientName).toLowerCase();
      const firstName = chat.recipientName.firstname.toLowerCase();
      const lastName = chat.recipientName.lastname.toLowerCase();

      // Search by item name if it's a rent request
      const itemName = chat.itemDetails?.name?.toLowerCase() || "";

      // Direct string matching
      const nameMatch =
        fullName.includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower);

      const itemMatch = itemName.includes(searchLower);

      // String similarity matching (threshold of 0.6 for good matches)
      const nameSimilarity = Math.max(
        stringSimilarity.compareTwoStrings(searchLower, fullName),
        stringSimilarity.compareTwoStrings(searchLower, firstName),
        stringSimilarity.compareTwoStrings(searchLower, lastName)
      );

      const itemSimilarity = itemName
        ? stringSimilarity.compareTwoStrings(searchLower, itemName)
        : 0;

      return (
        nameMatch || itemMatch || nameSimilarity > 0.6 || itemSimilarity > 0.6
      );
    });

    // Apply tab filtering to matching chats
    const filteredResults = getFilteredChats(
      matchingChats,
      tabType,
      currentUserId
    );

    // For "all" tab, also count new users when searching
    if (tabType === "all") {
      const existingChatUserIds = new Set(
        matchingChats.map((chat) => chat.recipientId)
      );

      const matchingNewUsers = allUsers.filter((user) => {
        if (existingChatUserIds.has(user.id)) return false;

        const fullName = formatFullName({
          firstname: user.firstname || "",
          lastname: user.lastname || "",
          middlename: user.middlename,
        }).toLowerCase();
        const firstName = (user.firstname || "").toLowerCase();
        const lastName = (user.lastname || "").toLowerCase();

        // Direct string matching
        const nameMatch =
          fullName.includes(searchLower) ||
          firstName.includes(searchLower) ||
          lastName.includes(searchLower);

        // String similarity matching
        const nameSimilarity = Math.max(
          stringSimilarity.compareTwoStrings(searchLower, fullName),
          stringSimilarity.compareTwoStrings(searchLower, firstName),
          stringSimilarity.compareTwoStrings(searchLower, lastName)
        );

        return nameMatch || nameSimilarity > 0.6;
      });

      return filteredResults.length;
    }

    return filteredResults.length;
  };

  const formatFullName = (name: {
    firstname: string;
    lastname: string;
    middlename?: string;
  }) => {
    const middleInitial = name.middlename
      ? ` ${name.middlename.charAt(0)}.`
      : "";
    return `${name.firstname}${middleInitial} ${name.lastname}`;
  };

  useEffect(() => {
    if (!search || search.trim() === "") {
      setSearchResults([]);
      return;
    }

    const searchLower = search.toLowerCase().trim();

    const matchingChats = chats.filter((chat) => {
      const fullName = formatFullName(chat.recipientName).toLowerCase();
      const firstName = chat.recipientName.firstname.toLowerCase();
      const lastName = chat.recipientName.lastname.toLowerCase();

      const itemName = chat.itemDetails?.name?.toLowerCase() || "";

      const nameMatch =
        fullName.includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower);

      const itemMatch = itemName.includes(searchLower);

      const nameSimilarity = Math.max(
        stringSimilarity.compareTwoStrings(searchLower, fullName),
        stringSimilarity.compareTwoStrings(searchLower, firstName),
        stringSimilarity.compareTwoStrings(searchLower, lastName)
      );

      const itemSimilarity = itemName
        ? stringSimilarity.compareTwoStrings(searchLower, itemName)
        : 0;

      return (
        nameMatch || itemMatch || nameSimilarity > 0.6 || itemSimilarity > 0.6
      );
    });

    const filteredMatchingChats = getFilteredChats(
      matchingChats,
      activeTab,
      currentUserId
    );

    const chatResults: SearchResult[] = filteredMatchingChats.map((chat) => ({
      isExistingChat: true,
      chatId: chat.id,
      userId: chat.recipientId,
      fullName: formatFullName(chat.recipientName),
      profilePic: chat.recipientProfileImage,
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime,
      isCurrentUserLastSender: chat.isCurrentUserLastSender,
      itemDetails: chat.itemDetails,
      status: chat.status,
      isRentRequest: chat.isRentRequest,
      unreadCounts: chat.unreadCounts,
    }));

    let matchingUsers: SearchResult[] = [];
    if (activeTab === "all") {
      // Get existing chat user IDs to avoid duplicates
      const existingChatUserIds = new Set(
        matchingChats.map((chat) => chat.recipientId)
      );

      // Search for new users (users not in existing chats)
      matchingUsers = allUsers
        .filter((user) => {
          if (existingChatUserIds.has(user.id)) return false;

          const fullName = formatFullName({
            firstname: user.firstname || "",
            lastname: user.lastname || "",
            middlename: user.middlename,
          }).toLowerCase();
          const firstName = (user.firstname || "").toLowerCase();
          const lastName = (user.lastname || "").toLowerCase();

          // Direct string matching
          const nameMatch =
            fullName.includes(searchLower) ||
            firstName.includes(searchLower) ||
            lastName.includes(searchLower);

          // String similarity matching
          const nameSimilarity = Math.max(
            stringSimilarity.compareTwoStrings(searchLower, fullName),
            stringSimilarity.compareTwoStrings(searchLower, firstName),
            stringSimilarity.compareTwoStrings(searchLower, lastName)
          );

          return nameMatch || nameSimilarity > 0.6;
        })
        .map((user) => ({
          isExistingChat: false,
          userId: user.id,
          fullName: formatFullName({
            firstname: user.firstname || "",
            lastname: user.lastname || "",
            middlename: user.middlename,
          }),
          profilePic: user.profileImage || "https://via.placeholder.com/50",
        }));
    }

    // Combine results with existing chats first
    setSearchResults([...chatResults]);
  }, [search, chats, allUsers, activeTab, currentUserId]);

  const getStatusLabel = (status: string): string => {
    const statusLabels: Record<string, string> = {
      pending: "Pending",
      accepted: "Accepted",
      initial_payment_paid: "Payment Received",
      assessment_submitted: "Item Verified",
      pickedup: "In Progress",
      completed: "Completed",
      declined: "Declined",
      cancelled: "Cancelled",
    };

    return (
      statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)
    );
  };

  const handleLongPress = (chatId: string) => {
    if (activeTab !== "closed") return;
    setIsSelectMode(true);
    setSelectedChats([chatId]);
  };

  const handleSelect = (chatId: string) => {
    if (selectedChats.includes(chatId)) {
      setSelectedChats(selectedChats.filter((id) => id !== chatId));
      if (selectedChats.length === 1) {
        setIsSelectMode(false);
      }
    } else {
      setSelectedChats([...selectedChats, chatId]);
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const batch = writeBatch(db);

      // Delete chats and their messages
      for (const chatId of selectedChats) {
        // Delete chat document
        batch.delete(doc(db, "chat", chatId));

        // Get chat messages
        const messagesRef = collection(db, "chat", chatId, "messages");
        const messagesSnap = await getDocs(messagesRef);
        messagesSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Delete associated rent request
        const chat = chats.find((c) => c.id === chatId);
        if (chat?.itemDetails?.id) {
          batch.delete(doc(db, "rentRequests", chat.itemDetails.id));
        }
      }

      await batch.commit();

      // Reset selection mode
      setSelectedChats([]);
      setIsSelectMode(false);

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Selected conversations deleted successfully",
      });
    } catch (error) {
      console.log("Error deleting chats:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to delete conversations",
      });
    }
  };

  const handleDeleteAll = () => {
    Alert.alert(
      "Delete All Closed Chats",
      "Are you sure you want to delete all closed conversations? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            const closedChats = getFilteredChats(
              chats,
              "closed",
              currentUserId
            );
            setSelectedChats(closedChats.map((chat) => chat.id));
            await handleDeleteSelected();
          },
        },
      ]
    );
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const unreadCount = item.unreadCounts?.[currentUserId ?? ""] || 0;
    const hasUnreadMessages = !item.isCurrentUserLastSender && unreadCount > 0;
    const isUserSender = currentUserId === item.requesterId;
    const isUserReceiver = currentUserId === item.ownerId;
    const isSelected = selectedChats.includes(item.id);
    const isClosed = ["declined", "cancelled"].includes(item.status);

    return (
      <TouchableOpacity
        className={`flex-row items-center px-4 py-4 my-1 bg-white rounded-2xl shadow-sm border ${
          isSelected ? "border-primary" : "border-gray-50"
        }`}
        onPress={() => {
          if (isSelectMode && activeTab === "closed") {
            handleSelect(item.id);
          } else {
            router.push(`/chat/${item.id}`);
          }
        }}
        onLongPress={() => isClosed && handleLongPress(item.id)}
        delayLongPress={500}
      >
        <View className="relative">
          <Image
            source={{
              uri:
                item.isRentRequest && item.itemDetails?.image
                  ? item.itemDetails.image
                  : item.recipientProfileImage,
            }}
            className="w-14 h-14 rounded-full bg-gray-200"
            style={
              item.isRentRequest ? { borderRadius: 12 } : { borderRadius: 28 }
            }
          />

          {/* Request Direction Indicator */}
          {item.isRentRequest && (
            <View
              className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full items-center justify-center ${
                isUserSender ? "bg-blue-500" : "bg-green-500"
              }`}
            >
              <Image
                source={icons.leftArrow}
                className={`w-5 h-5 ${
                  isUserSender ? "rotate-90" : "-rotate-90"
                }`}
                tintColor="#fff"
              />
            </View>
          )}

          {/* Unread Badge */}
          {hasUnreadMessages && (
            <View className="absolute -top-1 -right-1 bg-red-500 min-w-[20px] h-5 rounded-full items-center justify-center z-10">
              <Text className="text-white text-xs font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-1 ml-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className={`text-base ${
                  hasUnreadMessages
                    ? "font-bold text-gray-900"
                    : "font-regular text-gray-800"
                }`}
                numberOfLines={1}
              >
                {formatFullName(item.recipientName)}
                {item.itemDetails?.name && (
                  <>
                    <Text className="text-gray-400"> • </Text>
                    <Text
                      className={
                        item.status === "declined" ||
                        item.status === "cancelled"
                          ? "text-red-500"
                          : "text-primary"
                      }
                    >
                      {item.itemDetails.name}
                    </Text>
                  </>
                )}
              </Text>
            </View>

            {item.lastMessageTime && (
              <Text
                className={`text-xs ${
                  hasUnreadMessages ? "font-bold text-primary" : "text-gray-500"
                }`}
              >
                {" "}
                {item.lastMessageTime?.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            )}
          </View>

          <View className="flex-row items-center">
            <Text
              className={`text-sm flex-1 ${
                hasUnreadMessages ? "font-bold text-gray-900" : "text-gray-500"
              }`}
              numberOfLines={1}
            >
              {item.isCurrentUserLastSender && (
                <Text className="text-gray-400">You: </Text>
              )}
              {item.lastMessage}
            </Text>

            {/* Request Status Badge */}
            {item.isRentRequest && (
              <View
                className={`ml-2 px-2 py-1 rounded-full ${
                  item.status === "pending"
                    ? "bg-yellow-100"
                    : item.status === "accepted"
                    ? "bg-green-100"
                    : item.status === "initial_payment_paid" // ✅ ADD THIS
                    ? "bg-blue-100"
                    : item.status === "assessment_submitted" // ✅ ADD THIS
                    ? "bg-purple-100"
                    : item.status === "pickedup" // ✅ ADD THIS
                    ? "bg-indigo-100"
                    : item.status === "completed" // ✅ ADD THIS
                    ? "bg-teal-100"
                    : item.status === "declined" || item.status === "cancelled"
                    ? "bg-red-100"
                    : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    item.status === "pending"
                      ? "text-yellow-800"
                      : item.status === "accepted"
                      ? "text-green-800"
                      : item.status === "initial_payment_paid" // ✅ ADD THIS
                      ? "text-blue-800"
                      : item.status === "assessment_submitted" // ✅ ADD THIS
                      ? "text-purple-800"
                      : item.status === "pickedup" // ✅ ADD THIS
                      ? "text-indigo-800"
                      : item.status === "completed" // ✅ ADD THIS
                      ? "text-teal-800"
                      : item.status === "declined" ||
                        item.status === "cancelled"
                      ? "text-red-800"
                      : "text-gray-800"
                  }`}
                >
                  {getStatusLabel(item.status)} {/* ✅ USE HELPER FUNCTION */}
                </Text>
              </View>
            )}
          </View>
        </View>

        {isSelectMode && activeTab === "closed" && (
          <View className="absolute right-2 top-2">
            <View
              className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                isSelected ? "bg-primary border-primary" : "border-gray-300"
              }`}
            >
              {isSelected && (
                <Image
                  source={icons.check}
                  className="w-4 h-4"
                  tintColor="#fff"
                />
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-2xl font-bold text-secondary-900">
        {isSelectMode
          ? `Selected ${selectedChats.length} ${
              selectedChats.length === 1 ? "chat" : "chats"
            }`
          : "Messages"}
      </Text>
      {activeTab === "closed" &&
        (isSelectMode ? (
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => {
                setIsSelectMode(false);
                setSelectedChats([]);
              }}
              className="mr-4 items-center px-4 py-2  "
            >
              <Text className="text-gray-500 font-pmedium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              className="bg-red-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-pbold">Delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <></>
          // <TouchableOpacity
          //   onPress={handleDeleteAll}
          //   className="bg-red-500 px-4 py-2 rounded-lg"
          // >
          //   <Text className="text-white font-pbold">Delete All</Text>
          // </TouchableOpacity>
        ))}
    </View>
  );

  const renderChatList = () => {
    if (search.trim() !== "") {
      if (searchResults.length === 0) {
        return (
          <View className="flex-1 items-center">
            <LottieView
              source={require("../../assets/lottie/BoxOpen.json")}
              autoPlay
              loop={false}
              speed={0.5}
              style={{ width: 200, height: 200, marginTop: 100 }}
            />

            <Text className="text-gray-500 -m-8">
              No results found for "{search}"
            </Text>
          </View>
        );
      }

      return (
        <FlatList
          data={searchResults}
          keyExtractor={(item) =>
            item.isExistingChat
              ? item.chatId ?? `chat-${item.userId}`
              : `new-${item.userId}`
          }
          renderItem={({ item }) => {
            if (item.isExistingChat) {
              // Render existing chat using the same design as default chat items
              const unreadCount = item.unreadCounts?.[currentUserId ?? ""] || 0;
              const hasUnreadMessages =
                !item.isCurrentUserLastSender && unreadCount > 0;
              const isUserSender = currentUserId === item.userId; // Adjust based on your logic
              const isUserReceiver = !isUserSender;

              return (
                <TouchableOpacity
                  className="flex-row items-center px-4 py-4 my-1 bg-white rounded-2xl shadow-sm border border-gray-50"
                  onPress={() => router.push(`/chat/${item.chatId}`)}
                >
                  <View className="relative">
                    <Image
                      source={{
                        uri:
                          item.isRentRequest && item.itemDetails?.image
                            ? item.itemDetails.image
                            : item.profilePic,
                      }}
                      className="w-14 h-14 rounded-full bg-gray-200"
                      style={
                        item.isRentRequest
                          ? { borderRadius: 12 }
                          : { borderRadius: 28 }
                      }
                    />

                    {/* Request Direction Indicator */}
                    {item.isRentRequest && (
                      <View
                        className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full items-center justify-center ${
                          isUserSender ? "bg-blue-500" : "bg-green-500"
                        }`}
                      >
                        <Image
                          source={icons.leftArrow}
                          className={`w-5 h-5 ${
                            isUserSender ? "rotate-90" : "-rotate-90"
                          }`}
                          tintColor="#fff"
                        />
                      </View>
                    )}

                    {/* Unread Badge */}
                    {hasUnreadMessages && (
                      <View className="absolute -top-1 -right-1 bg-red-500 min-w-[20px] h-5 rounded-full items-center justify-center z-10">
                        <Text className="text-white text-xs font-bold">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`text-base ${
                            hasUnreadMessages
                              ? "font-bold text-gray-900"
                              : "font-regular text-gray-800"
                          }`}
                          numberOfLines={1}
                        >
                          {item.fullName}
                          {item.itemDetails?.name && (
                            <>
                              <Text className="text-gray-400"> • </Text>
                              <Text
                                className={
                                  item.status === "declined" ||
                                  item.status === "cancelled"
                                    ? "text-red-500"
                                    : "text-primary"
                                }
                              >
                                {item.itemDetails.name}
                              </Text>
                            </>
                          )}
                        </Text>
                      </View>

                      {item.lastMessageTime && (
                        <Text
                          className={`text-xs ${
                            hasUnreadMessages
                              ? "font-bold text-primary"
                              : "text-gray-500"
                          }`}
                        >
                          {item.lastMessageTime.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      )}
                    </View>

                    <View className="flex-row items-center">
                      <Text
                        className={`text-sm flex-1 ${
                          hasUnreadMessages
                            ? "font-bold text-gray-900"
                            : "text-gray-500"
                        }`}
                        numberOfLines={1}
                      >
                        {item.isCurrentUserLastSender && (
                          <Text className="text-gray-400">You: </Text>
                        )}
                        {item.lastMessage}
                      </Text>

                      {item.isRentRequest && item.status && (
                        <View
                          className={`ml-2 px-2 py-1 rounded-full ${
                            item.status === "pending"
                              ? "bg-yellow-100"
                              : item.status === "accepted"
                              ? "bg-green-100"
                              : item.status === "initial_payment_paid" // ✅ ADD THIS
                              ? "bg-blue-100"
                              : item.status === "assessment_submitted" // ✅ ADD THIS
                              ? "bg-purple-100"
                              : item.status === "pickedup" // ✅ ADD THIS
                              ? "bg-indigo-100"
                              : item.status === "completed" // ✅ ADD THIS
                              ? "bg-teal-100"
                              : item.status === "declined" ||
                                item.status === "cancelled"
                              ? "bg-red-100"
                              : "bg-gray-100"
                          }`}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              item.status === "pending"
                                ? "text-yellow-800"
                                : item.status === "accepted"
                                ? "text-green-800"
                                : item.status === "initial_payment_paid" // ✅ ADD THIS
                                ? "text-blue-800"
                                : item.status === "assessment_submitted" // ✅ ADD THIS
                                ? "text-purple-800"
                                : item.status === "pickedup" // ✅ ADD THIS
                                ? "text-indigo-800"
                                : item.status === "completed" // ✅ ADD THIS
                                ? "text-teal-800"
                                : item.status === "declined" ||
                                  item.status === "cancelled"
                                ? "text-red-800"
                                : "text-gray-800"
                            }`}
                          >
                            {getStatusLabel(item.status)}{" "}
                            {/* ✅ USE HELPER FUNCTION */}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            } else {
              // Render new user option
              return (
                // <TouchableOpacity
                //   className="flex-row items-center px-4 py-4 my-1 bg-white rounded-2xl shadow-sm border border-gray-50"
                //   onPress={() => createNewChat(item.userId)}
                // >
                //   <Image
                //     source={{ uri: item.profilePic }}
                //     className="w-14 h-14 rounded-full bg-gray-200"
                //   />
                //   <View className="flex-1 ml-4">
                //     <Text className="text-base font-regular text-gray-800">
                //       {item.fullName}
                //     </Text>
                //     <Text className="text-sm text-blue-500">
                //       Start new conversation
                //     </Text>
                //   </View>
                // </TouchableOpacity>
                <></>
              );
            }
          }}
          contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      );
    }

    // Rest of the function remains the same...
    const filteredChats = getFilteredChats(chats, activeTab, currentUserId);

    if (filteredChats.length === 0) {
      return (
        <View className="flex-1 items-center">
          <LottieView
            source={require("../../assets/lottie/BoxOpen.json")}
            autoPlay
            loop={false}
            speed={0.5}
            style={{ width: 200, height: 200, marginTop: 100 }}
          />
          <Text className="text-gray-500 -m-8">
            No {activeTab === "all" ? "messages" : `${activeTab} requests`}
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        contentContainerStyle={{
          paddingBottom: 120,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      className="flex-1 bg-white px-4"
      style={{ paddingTop: insets.top }}
    >
      <Header />
      {renderHeader()}
      {/* Search Bar */}

      <View className="py-2">
        <View className="flex-row items-center bg-white rounded-xl border border-secondary-300 h-16 px-4">
          <Image
            source={icons.search}
            className="w-6 h-6"
            resizeMode="contain"
          />
          <TextInput
            placeholder="Search conversations..."
            placeholderTextColor="#A0AEC0"
            className="flex-1 text-secondary-400 text-base px-3 py-4 font-pregular"
            ref={inputRef}
            value={search}
            onChangeText={setSearch}
            onFocus={handleFocus}
          />
        </View>
      </View>

      {/* Tabs */}
      <View className="py-2">
        <View className="flex-row justify-between">
          {[
            { key: "all" as TabType, label: "All" },
            { key: "sent" as TabType, label: "Sent" },
            { key: "received" as TabType, label: "Received" },
            { key: "closed" as TabType, label: "Closed" },
          ].map((tab) => (
            <TabButton
              key={tab.key}
              title={tab.label}
              isActive={activeTab === tab.key}
              onPress={() => setActiveTab(tab.key)}
              count={getTabCount(tab.key, search)}
            />
          ))}
        </View>
      </View>
      {/* Chat List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LottieActivityIndicator size={100} color="#5C6EF6" />
        </View>
      ) : (
        renderChatList()
      )}
    </SafeAreaView>
  );
};

export default ChatList;
