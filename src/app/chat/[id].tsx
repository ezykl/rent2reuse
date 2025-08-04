import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
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

const ChatScreen = () => {
  const { id: chatId } = useLocalSearchParams();
  const navigation = useNavigation();
  const currentUserId = auth.currentUser?.uid;
  interface Message {
    id: string;
    senderId: string;
    text: string;
    createdAt: any;
    type?: "rentRequest";
    read: boolean;
    readAt: any;
    itemDetails?: {
      id: string;
      name: string;
      price: number;
      image: string;
    };
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientImage, setRecipientImage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [requestStatuses, setRequestStatuses] = useState<
    Record<string, string>
  >({});
  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();

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

  // Set header title
  useLayoutEffect(() => {
    if (recipientEmail) {
      navigation.setOptions({ title: recipientEmail });
    }
  }, [navigation, recipientEmail]);

  // Listen for messages
  useEffect(() => {
    if (loading) return;

    const messagesRef = collection(db, "chat", String(chatId), "messages");
    const q = query(
      messagesRef,
      orderBy("createdAt", "asc"),
      // Add limit to reduce BloomFilter errors
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      {
        // Add error handling for snapshot
        includeMetadataChanges: true,
      },
      (snapshot) => {
        if (!snapshot.metadata.hasPendingWrites) {
          const fetchedMessages = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Message[];
          setMessages(fetchedMessages);

          // Auto-scroll to bottom when new messages arrive
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      },
      (error) => {
        if (error.name === "BloomFilterError") {
          console.log("Ignoring BloomFilter error in message listener");
        } else {
          console.error("Error listening to messages:", error);
          Alert.alert("Error", "Failed to load messages");
        }
      }
    );

    return () => unsubscribe();
  }, [chatId, loading]);

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
        createdAt: serverTimestamp(),
        read: false, // Add this
        readAt: null, // Add this
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
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message");
      setNewMessage(messageText);
    }
  };

  // First, add the RentRequest interface
  interface RentRequest {
    id: string;
    itemId: string;
    itemName: string;
    price: number;
    requesterId: string;
    ownerId: string;
    status: "pending" | "accepted" | "rejected" | "completed";
    createdAt: any;
  }

  // Update the RentRequestMessage component
  const RentRequestMessage = ({ item }: { item: Message }) => {
    const requestStatus = requestStatuses[item.rentRequestId] || "pending";
    const [loading, setLoading] = useState(false);

    const getStatusColor = (status: string) => {
      switch (status) {
        case "pending":
          return {
            bg: "bg-yellow-50",
            text: "text-yellow-600",
            border: "border-yellow-200",
          };
        case "accepted":
          return {
            bg: "bg-green-50",
            text: "text-green-600",
            border: "border-green-200",
          };
        case "rejected":
          return {
            bg: "bg-red-50",
            text: "text-red-600",
            border: "border-red-200",
          };
        default:
          return {
            bg: "bg-gray-50",
            text: "text-gray-600",
            border: "border-gray-200",
          };
      }
    };

    const statusStyle = getStatusColor(requestStatus);

    const handleAction = async (action: "accept" | "reject") => {
      if (!item.rentRequestId || loading) return;

      setLoading(true);
      try {
        const requestRef = doc(db, "rentRequests", item.rentRequestId);

        // Update status in rentRequests collection
        await updateDoc(requestRef, {
          status: action === "accept" ? "accepted" : "rejected",
          updatedAt: serverTimestamp(),
        });

        // Add status update message in chat
        await addDoc(collection(db, "chat", String(chatId), "messages"), {
          type: "requestStatus",
          senderId: currentUserId,
          text: `Request ${action === "accept" ? "accepted" : "rejected"}`,
          rentRequestId: item.rentRequestId,
          createdAt: serverTimestamp(),
          read: false,
        });

        // If accepted, update item status
        if (action === "accept") {
          const itemRef = doc(db, "items", item.itemDetails.id);
          await updateDoc(itemRef, {
            status: "reserved",
            reservedBy: item.senderId,
            reservedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Error updating request:", error);
        Alert.alert("Error", "Failed to update request status");
      } finally {
        setLoading(false);
      }
    };

    return (
      <View
        className={`${statusStyle.bg} rounded-xl p-4 mb-3 border ${statusStyle.border}`}
      >
        <View className="flex-row items-start">
          {/* Left side - Image */}
          <View className="relative">
            <Image
              source={{ uri: item.itemDetails.image }}
              className="w-20 h-20 rounded-lg"
              resizeMode="cover"
            />
            <View
              className={`absolute -top-1 -right-1 px-2 py-1 rounded-full ${statusStyle.bg} border ${statusStyle.border}`}
            >
              <Text
                style={{ fontSize: 8 }}
                className={` font-pbold ${statusStyle.text}`}
              >
                {`${requestStatus}`.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Right side - Details */}
          <View className="flex-1 ml-4">
            <Text className="font-pbold text-base text-gray-900 mb-1">
              {item.itemDetails.name}
            </Text>
            <View className="flex-row items-center mb-2">
              <Text className="text-primary font-pmedium text-lg">
                ₱{item.itemDetails.price}
              </Text>
              <Text className="text-gray-500 text-sm ml-1">/day</Text>
            </View>

            {/* Action Buttons */}
            {requestStatus === "pending" && currentUserId !== item.senderId && (
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => handleAction("reject")}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-full bg-white border border-red-200"
                >
                  <Text className="text-red-600 font-pmedium text-center">
                    Decline
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleAction("accept")}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 rounded-full bg-primary"
                >
                  <Text className="text-white font-pmedium text-center">
                    Accept
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {requestStatus !== "pending" && (
              <TouchableOpacity
                onPress={() => router.push(`/items/${item.itemDetails.id}`)}
                className="px-4 py-2.5 rounded-full bg-white border border-primary"
              >
                <Text className="text-primary font-pmedium text-center">
                  View Details
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

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
      icon: icons.document,
      label: "Agreement",
      action: handleSendAgreement,
      bgColor: "#E8EAF6",
      iconColor: "#3F51B5",
    },
    {
      id: "3",
      icon: icons.request,
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
          const requestRef = doc(db, "rentRequests", message.rentRequestId);
          const requestSnap = await getDoc(requestRef);
          if (requestSnap.exists()) {
            statusUpdates[message.rentRequestId] = requestSnap.data().status;
          }
        })
      );

      setRequestStatuses(statusUpdates);
    };

    fetchRequestStatuses();
  }, [messages]);

  // First, create a separate component for the sticky header
  const StickyRentRequest = ({ messages }: { messages: Message[] }) => {
    const rentRequest = messages.find((m) => m.type === "rentRequest");
    return rentRequest ? <RentRequestMessage item={rentRequest} /> : null;
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
      >
        <FlatList
          ref={flatListRef}
          data={messages.filter((m) => m.type !== "rentRequest")} // Filter out rent request from main list
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingVertical: 16,
            paddingHorizontal: 12,
          }}
          ListHeaderComponent={() => <StickyRentRequest messages={messages} />}
          stickyHeaderIndices={[0]}
          renderItem={({ item }) => {
            if (item.type === "requestStatus") {
              return (
                <View className="bg-gray-100 rounded-full py-2 px-4 self-center mb-3">
                  <Text className="text-gray-600 text-sm text-center">
                    {item.text}
                  </Text>
                </View>
              );
            }

            return (
              <View
                className={`flex-row mb-3 ${
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
                <View
                  className={`max-w-[75%] rounded-2xl px-4 py-3 border border-gray-200 shadow-sm
                    ${
                      item.senderId === currentUserId
                        ? "bg-primary rounded-tr-none"
                        : "bg-white rounded-tl-none"
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
                {item.senderId === currentUserId && (
                  <View className="flex-row items-center ml-2">
                    {item.read ? (
                      <>
                        <Image
                          source={icons.doubleCheck}
                          className="w-4 h-4 tint-primary"
                        />
                        {item.readAt && (
                          <Text className="text-xs text-gray-400 ml-1">
                            {format(item.readAt.toDate(), "HH:mm")}
                          </Text>
                        )}
                      </>
                    ) : (
                      <Image
                        source={icons.singleCheck}
                        className="w-4 h-4 tint-gray-400"
                      />
                    )}
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
          <TouchableOpacity
            onPress={() => setShowActionMenu(true)}
            className="p-3 m-1 rounded-full bg-primary"
          >
            <Image
              source={icons.bigPlus}
              className="w-2 h-2 p-2"
              resizeMode="contain"
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
              className="flex-1 max-h-28  text-base"
              style={{ textAlignVertical: "top" }}
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!newMessage.trim()}
            className={`m-1 p-3 rounded-full justify-center w- ${
              newMessage.trim() ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <Image
              source={icons.plane}
              className="w-2 h-2 p-2 "
              resizeMode="contain"
              tintColor="white"
            />
          </TouchableOpacity>

          <ActionMenu
            visible={showActionMenu}
            onClose={() => setShowActionMenu(false)}
            items={actionItems}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
