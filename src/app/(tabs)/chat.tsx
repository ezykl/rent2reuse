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
} from "firebase/firestore";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import { db, auth } from "@/lib/firebaseConfig";
import { router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

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
  requestStatus: "pending" | "accepted" | "rejected" | "cancelled";
  itemDetails?: {
    id: string;
    name: string;
    price: number;
    image: string;
  };
  unreadCount: number;
  lastMessageRead: boolean;
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

// Add these UI components at the top
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_WIDTH = (SCREEN_WIDTH - 32) / 3; // 32 is the total horizontal padding (16 * 2)

const TabButton = ({
  title,
  isActive,
  onPress,
}: {
  title: string;
  isActive: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(0.85);
  const backgroundColor = useSharedValue("rgba(243, 244, 246, 0.5)");

  // Handle animation changes in useEffect
  useEffect(() => {
    scale.value = withSpring(isActive ? 0.95 : 0.85, {
      damping: 10,
      stiffness: 100,
    });
    backgroundColor.value = withTiming(
      isActive ? "#4BD07F" : "rgba(243, 244, 246, 0.5)",
      { duration: 150 }
    );
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      backgroundColor: backgroundColor.value,
      borderRadius: 9999,
      width: TAB_WIDTH - 8, // Subtract 8 for the gap between tabs
      zIndex: 10,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity onPress={onPress} className="py-2.5">
        <Text
          className={`${
            isActive ? "text-white font-bold" : "text-gray-500"
          } text-center text-sm`}
        >
          {title}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Update the ChatList component
const ChatList = () => {
  // Add new state for tabs
  const [activeTab, setActiveTab] = useState<
    "requests" | "proposed" | "closed"
  >("requests");
  const [chats, setChats] = useState<Chat[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const userId = user.uid;
      setCurrentUserId(userId);

      //Load all users for search functionality
      loadAllUsers(userId);

      //Load existing chats
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
        .filter((user) => user.id !== currentUserId && user.email); // Filter out users without email

      setAllUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      Alert.alert("Error", "Failed to load users for search");
    }
  };

  // Update the loadExistingChats function
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

            // Get recipient info
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
              unreadCount: chatData.unreadCount || 0,
              lastMessageRead: chatData.lastMessageRead || false,
              isRentRequest: chatData.isRentRequest || false,
              requestStatus: chatData.requestStatus || "pending",
              itemDetails: chatData.itemDetails || null,
            } as Chat;
          })
        );

        // Sort chats by lastMessageTime
        const sortedChats = chatList
          .filter((chat): chat is Chat => chat !== null)
          .sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
          });

        setChats(sortedChats);
        setLoading(false);
      });

      return unsubscribeChats;
    } catch (error) {
      console.error("Error setting up chat query:", error);
      setLoading(false);
    }
  };

  //start a new chat with a user
  const createNewChat = async (userId: string) => {
    try {
      router.push(`/chat/${userId}`);
    } catch (error) {
      console.error("Error creating new chat:", error);
      Alert.alert("Error", "Failed to create new chat");
    }
  };

  // Add this helper function at the top with your other interfaces
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

  // Update the search useEffect
  useEffect(() => {
    if (!search || search.trim() === "") {
      setSearchResults([]);
      return;
    }
    const searchLower = search.toLowerCase();

    // Search in existing chats
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

    // Get IDs of users we already have chats with
    const existingChatUserIds = new Set(
      matchingChats.map((chat) => chat.recipientId)
    );

    // Search in all users who don't have existing chats
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

    // Combine existing chats and new users
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

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      className="flex-row items-center px-6 py-4 mb-2 mx-2 bg-white rounded-2xl shadow-sm border border-gray-50"
      onPress={() => router.push(`/chat/${item.id}`)}
    >
      <View className="relative">
        <Image
          source={{ uri: item.recipientProfileImage }}
          className="w-14 h-14 rounded-full bg-gray-200"
        />
        {item.unreadCount > 0 && (
          <View className="absolute -top-1 -right-1 bg-primary w-5 h-5 rounded-full items-center justify-center">
            <Text className="text-white text-xs font-bold">
              {item.unreadCount}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-1 ml-4">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-base font-bold text-gray-900">
            {formatFullName(item.recipientName)} • {item.itemDetails?.name}
          </Text>
          {item.lastMessageTime && (
            <Text className="text-xs text-gray-500">
              {item.lastMessageTime?.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
        </View>

        {item.isRentRequest && (
          <View className="flex-row items-center mb-1">
            <Text className="text-sm font-medium text-primary">
              {item.itemDetails?.name}
            </Text>
            <Text className="text-sm text-gray-600 ml-2">
              ₱{item.itemDetails?.price}
            </Text>
          </View>
        )}

        <Text className="text-sm text-gray-500" numberOfLines={1}>
          {item.isCurrentUserLastSender ? "You: " : ""}
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderChatList = () => {
    //show search results
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
              className="flex-row items-center border-b border-gray-200"
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
        />
      );
    }

    //show existing chats or the Chat List
    if (chats.length === 0) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">No messages yet</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        ListHeaderComponent={() => (
          <View className="mb-2">
            <Text className="text-sm font-medium text-gray-500 mb-1">
              {chats.filter((chat) => chat.isRentRequest).length} Active Rent
              Requests
            </Text>
          </View>
        )}
        contentContainerStyle={{
          paddingBottom: 120, // Add bottom padding to prevent overlap
          flexGrow: 1, // Ensure list takes full height
        }}
      />
    );
  };

  return (
    <View className="flex-1 mt-6 bg-white p-4">
      {/* Header */}
      <View className=" pt-6 pb-2">
        <Text className="text-2xl font-bold text-secondary-900">Messages</Text>
      </View>

      {/* Search Bar */}
      <View className=" py-2">
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
      <View className="bg-gray-100 rounded-3xl">
        <View className="flex-row justify-between px-1 py-1">
          <TabButton
            title="Requests"
            isActive={activeTab === "requests"}
            onPress={() => setActiveTab("requests")}
          />
          <TabButton
            title="Proposed"
            isActive={activeTab === "proposed"}
            onPress={() => setActiveTab("proposed")}
          />
          <TabButton
            title="Closed"
            isActive={activeTab === "closed"}
            onPress={() => setActiveTab("closed")}
          />
        </View>
      </View>

      {/* Chat List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <LottieActivityIndicator size={100} color="#5C6EF6" />
        </View>
      ) : (
        <FlatList
          data={chats.filter((chat) => {
            // For regular chats (non-rent requests), only show in "requests" tab
            if (!chat.isRentRequest) {
              return activeTab === "requests";
            }

            // For rent requests, filter by status
            switch (activeTab) {
              case "requests":
                return chat.requestStatus === "pending";
              case "proposed":
                return chat.requestStatus === "accepted";
              case "closed":
                // Show both rejected and cancelled requests in closed tab
                return ["rejected", "cancelled"].includes(chat.requestStatus);
              default:
                return false;
            }
          })}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingBottom: 120,
            flexGrow: 1,
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="flex-row items-center px-4 py-4 my-1 bg-white rounded-2xl shadow-sm border border-gray-50"
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <View className="relative">
                <Image
                  // Show item image for rent requests, fallback to profile image
                  source={{
                    uri: item.isRentRequest
                      ? item.itemDetails?.image
                      : item.itemDetails?.image,
                  }}
                  className="w-14 h-14 rounded-2xl bg-gray-200"
                  // Add specific styling for item images
                  style={
                    item.isRentRequest
                      ? { borderRadius: 12 }
                      : { borderRadius: 28 }
                  }
                />
                {/* Update status indicators to include cancelled state */}
                <View className="absolute bottom-0 right-0">
                  {item.isRentRequest ? (
                    <View
                      className={`w-4 h-4 rounded-full border-2 border-white ${
                        item.requestStatus === "pending"
                          ? "bg-yellow-500"
                          : item.requestStatus === "accepted"
                          ? "bg-green-500"
                          : item.requestStatus === "cancelled"
                          ? "bg-gray-500"
                          : "bg-red-500"
                      }`}
                    />
                  ) : !item.isCurrentUserLastSender && item.unreadCount > 0 ? (
                    <View className="bg-primary w-5 h-5 rounded-full items-center justify-center">
                      <Text className="text-white text-xs font-bold">
                        {item.unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View className="flex-1 ml-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text
                      className={`text-base ${
                        !item.isCurrentUserLastSender && item.unreadCount > 0
                          ? "font-bold text-gray-900"
                          : "font-medium text-gray-800"
                      }`}
                      numberOfLines={1}
                    >
                      {formatFullName(item.recipientName)} •{" "}
                      {item.itemDetails?.name}
                      {item.isRentRequest && item.itemDetails?.name && (
                        <>
                          <Text className="text-gray-400"> • </Text>
                          <Text className="text-primary font-medium">
                            {item.itemDetails.name}
                          </Text>
                        </>
                      )}
                    </Text>
                  </View>

                  <View className="flex-row items-center ml-2">
                    {/* Read indicator - Only show for messages you sent */}
                    {item.isCurrentUserLastSender && (
                      <Image
                        source={
                          item.lastMessageRead
                            ? require("@/assets/icons/double-check.png")
                            : require("@/assets/icons/single-check.png")
                        }
                        className={`w-4 h-4 mr-1 ${
                          item.lastMessageRead
                            ? "tint-primary"
                            : "tint-gray-400"
                        }`}
                      />
                    )}
                    {/* Time */}
                    {item.lastMessageTime && (
                      <Text
                        className={`text-xs ${
                          !item.isCurrentUserLastSender && item.unreadCount > 0
                            ? "font-semibold text-primary"
                            : "text-gray-500"
                        }`}
                      >
                        {item.lastMessageTime?.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Remove the separate item details section since it's now in the title */}
                <Text
                  className={`text-sm ${
                    item.unreadCount > 0
                      ? "font-medium text-gray-900"
                      : "text-gray-500"
                  }`}
                  numberOfLines={1}
                >
                  {item.isCurrentUserLastSender && (
                    <Text className="text-gray-400">You: </Text>
                  )}
                  {item.lastMessage}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() => (
            <View className="flex-1 items-center justify-center p-4">
              <Text className="text-gray-500 text-center">
                No {activeTab} messages
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default ChatList;
