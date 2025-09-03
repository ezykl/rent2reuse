import React, { useEffect, useState } from "react";
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  requestStatus: "pending" | "accepted" | "declined" | "cancelled";
  itemDetails?: {
    id: string;
    name: string;
    price: number;
    image: string;
  };
  status: "pending" | "accepted" | "declined" | "cancelled";
  unreadCounts: {
    [userId: string]: number;
  };
  lastSender: string;
  // Add missing properties from your Firestore structure
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
      className={`mr-3 px-4 py-2.5 rounded-full border ${
        isActive ? "bg-primary border-primary" : "bg-white border-gray-200"
      }`}
    >
      <View className="flex-row items-center">
        <Text
          className={`${
            isActive ? "text-white font-pbold" : "text-gray-600 font-pmedium"
          } text-sm`}
        >
          {title}
        </Text>
        {count !== undefined && (
          <Text
            className={`ml-1 text-xs ${
              isActive ? "text-white/80" : "text-gray-400"
            } font-pmedium`}
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

      loadAllUsers(userId);
      loadExistingChats(userId);
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
      console.error("Error loading users:", error);
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

      const unsubscribeChats = onSnapshot(q, async (snapshot) => {
        if (snapshot.empty) {
          setChats([]);
          setLoading(false);
          return;
        }

        const chatList = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const chatData = docSnap.data();
            const chatId = docSnap.id;

            const recipientId = chatData.participants.find(
              (id: string) => id !== userId
            );
            const userDoc = await getDoc(doc(db, "users", recipientId));
            const recipient = userDoc.exists() ? userDoc.data() : null;

            return {
              id: chatId,
              recipientId,
              recipientName: {
                firstname: recipient?.firstname || "",
                lastname: recipient?.lastname || "",
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

        setChats(chatList);
        setLoading(false);
      });

      return unsubscribeChats;
    } catch (error) {
      console.error("Error setting up chat query:", error);
      setLoading(false);
    }
  };

  const createNewChat = async (userId: string) => {
    try {
      router.push(`/chat/${userId}`);
    } catch (error) {
      console.error("Error creating new chat:", error);
      Alert.alert("Error", "Failed to create new chat");
    }
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
    const searchLower = search.toLowerCase();

    const matchingChats = chats.filter((chat) => {
      const fullName = formatFullName(chat.recipientName).toLowerCase();
      const firstName = chat.recipientName.firstname.toLowerCase();
      const lastName = chat.recipientName.lastname.toLowerCase();

      return (
        fullName.includes(searchLower) ||
        firstName.includes(searchLower) ||
        lastName.includes(searchLower)
      );
    });

    const existingChatUserIds = new Set(
      matchingChats.map((chat) => chat.recipientId)
    );

    const matchingUsers: SearchResult[] = allUsers
      .filter((user) => {
        if (existingChatUserIds.has(user.id)) return false;

        const fullName = formatFullName({
          firstname: user.firstname || "",
          lastname: user.lastname || "",
          middlename: user.middlename,
        }).toLowerCase();
        const firstName = (user.firstname || "").toLowerCase();
        const lastName = (user.lastname || "").toLowerCase();

        return (
          fullName.includes(searchLower) ||
          firstName.includes(searchLower) ||
          lastName.includes(searchLower)
        );
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

    const combinedResults: SearchResult[] = [
      ...matchingChats.map((chat) => ({
        isExistingChat: true,
        chatId: chat.id,
        userId: chat.recipientId,
        fullName: formatFullName(chat.recipientName),
        profilePic: chat.recipientProfileImage,
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        isCurrentUserLastSender: chat.isCurrentUserLastSender,
      })),
      ...matchingUsers,
    ];

    setSearchResults(combinedResults);
  }, [search, chats, allUsers]);

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
      console.error("Error deleting chats:", error);
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
    const isUserSender = currentUserId === item.requesterId; // User sent the request
    const isUserReceiver = currentUserId === item.ownerId; // User received the request
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
              // <View className="gap-2 flex-row">
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
                {/*
                </Text>
                <Text className="text-xs text-gray-500"> */}
                {/* {dayjs(item.lastMessageTime).fromNow()} */}
              </Text>
              // </View>
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
                      : item.status === "declined" ||
                        item.status === "cancelled"
                      ? "text-red-800"
                      : "text-gray-800"
                  }`}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
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
          // <TouchableOpacity
          <></>
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
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-500">No users found</Text>
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
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center px-4 py-4 border-b border-gray-200"
              onPress={() => {
                if (item.isExistingChat) {
                  router.push(`/chat/${item.chatId}`);
                } else {
                  createNewChat(item.userId);
                }
              }}
            >
              <Image
                source={{ uri: item.profilePic }}
                className="w-12 h-12 rounded-full mr-4"
              />
              <View className="flex-1">
                <Text className="text-lg font-semibold">
                  {item.fullName || "Unknown User"}
                </Text>
                {item.isExistingChat ? (
                  <Text
                    className={`text-gray-500 ${
                      item.isCurrentUserLastSender ? "font-bold" : ""
                    }`}
                  >
                    {item.isCurrentUserLastSender ? "You: " : ""}
                    {item.lastMessage}
                  </Text>
                ) : (
                  <Text className="text-blue-500">Start new conversation</Text>
                )}
              </View>
              {item.isExistingChat && item.lastMessageTime && (
                <Text className="text-gray-400 text-sm">
                  {item.lastMessageTime.toLocaleTimeString()}
                </Text>
              )}
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
        />
      );
    }

    const filteredChats = getFilteredChats(chats, activeTab, currentUserId);

    if (filteredChats.length === 0) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Image
            source={icons.emptyBox}
            className="w-16 h-16 mb-4"
            tintColor="#9CA3AF"
          />
          <Text className="text-gray-500 text-center">
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
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 h-12 py-2">
          <Image
            source={require("@/assets/icons/search.png")}
            className="w-5 h-5 tint-gray-400"
          />
          <TextInput
            placeholder="Search conversations..."
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-2 text-base font-regular text-gray-800"
          />
        </View>
      </View>

      {/* Tabs */}
      <View className="py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 2 }}
        >
          <View className="flex-row">
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
                count={getFilteredChats(chats, tab.key, currentUserId).length}
              />
            ))}
          </View>
        </ScrollView>
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
