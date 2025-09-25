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
  Alert,
  Image,
  Modal,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
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
import CustomImageViewer from "@/components/CustomImageViewer";
import { createInAppNotification } from "src/utils/notificationHelper";
import ChatDetailsModal from "@/components/chatModal/ChatDetailsModal";
import ChatHeader from "@/components/chatModal/ChatHeader";
import ImageMessage from "@/components/chatModal/ImageMessage";
import RentRequestMessage from "@/components/chatModal/RentRequestMessage";
import ActionMenu from "@/components/chatModal/ActionMenu";
import MessageActionsModal from "@/components/chatModal/MessageActionsModal";
import Message from "@/types/message";
import PaymentMessage from "@/components/chatModal/PaymentMessage";
import CustomAlert from "@/components/CustomAlert";

const formatTimestamp = (timestamp: any): string => {
  if (!timestamp) return "";

  const date = timestamp.toDate();

  if (isToday(date)) {
    return format(date, "h:mm a");
  } else if (isYesterday(date)) {
    return `Yesterday ${format(date, "h:mm a")}`;
  } else {
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays < 7) {
      return format(date, "EEE h:mm a");
    } else {
      return format(date, "MMM d, h:mm a");
    }
  }
};

interface ActionMenuItem {
  id: string;
  icon: any;
  label: string;
  action: () => void;
  bgColor: string;
  iconColor: string;
}

interface MessageSelection {
  isSelecting: boolean;
  selectedMessages: string[];
}

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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [recipientImage, setRecipientImage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [requestStatuses, setRequestStatuses] = useState<
    Record<string, string>
  >({});

  const [showPayPalAlert, setShowPayPalAlert] = useState(false);
  const [pendingPaymentType, setPendingPaymentType] = useState<
    "initial" | "full" | null
  >(null);
  const [currentUserPayPalEmail, setCurrentUserPayPalEmail] = useState("");
  const [isCheckingPayPal, setIsCheckingPayPal] = useState(false);

  const [showMessageActions, setShowMessageActions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [canSendMessage, setCanSendMessage] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();
  const [uploadingMessages, setUploadingMessages] = useState<
    Array<{
      id: string;
      uri: string;
      timestamp: number;
    }>
  >([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [selection, setSelection] = useState<MessageSelection>({
    isSelecting: false,
    selectedMessages: [],
  });
  const { setIsLoading } = useLoader();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [fullscreenImageVisible, setFullscreenImageVisible] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
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
      startDate?: any;
      rentalDays?: any;
      endDate?: any;
      pickupTime?: number;
    };
  } | null>(null);

  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length > 0, loading]);

  useEffect(() => {
    const fetchCurrentUserPayPalEmail = async () => {
      if (!currentUserId) return;

      try {
        setIsCheckingPayPal(true);
        const currentUserRef = doc(db, "users", currentUserId);
        const currentUserSnap = await getDoc(currentUserRef);

        if (currentUserSnap.exists()) {
          const currentUserData = currentUserSnap.data();
          setCurrentUserPayPalEmail(currentUserData.paypalEmail || "");
        }
      } catch (error) {
        console.error("Error fetching current user PayPal email:", error);
        setCurrentUserPayPalEmail("");
      } finally {
        setIsCheckingPayPal(false);
      }
    };

    fetchCurrentUserPayPalEmail();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    // Set up real-time listener for current user's document
    const currentUserRef = doc(db, "users", currentUserId);

    const unsubscribe = onSnapshot(
      currentUserRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const currentUserData = docSnap.data();
          setCurrentUserPayPalEmail(currentUserData.paypalEmail || "");
        }
      },
      (error) => {
        console.error("Error listening to current user PayPal updates:", error);
      }
    );

    return () => unsubscribe();
  }, [currentUserId]);

  useEffect(() => {
    if (
      !isUserScrolling &&
      !showScrollToBottom &&
      messages.length > 0 &&
      !loading
    ) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length, isUserScrolling, showScrollToBottom, loading]);

  if (!currentUserId || !chatId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error: Missing user ID or chat ID</Text>
      </View>
    );
  }
  const handleImagePress = (selectedImageUrl: string) => {
    const imageMessages = messages.filter(
      (msg) => msg.type === "image" && msg.imageUrl && !msg.isDeleted
    );

    const imageUrls = imageMessages.map((msg) => msg.imageUrl!);

    const selectedIndex = imageUrls.findIndex(
      (url) => url === selectedImageUrl
    );

    // Set up the image viewer
    setFullscreenImages(imageUrls);
    setFullscreenImageIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setFullscreenImageVisible(true);
  };
  const handleMessageLongPress = (
    messageId: string,
    senderId: string,
    message: Message
  ) => {
    // Don't allow long press on deleted messages
    if (message.isDeleted) return;

    // Don't allow long press on system messages
    if (message.type === "statusUpdate" || message.type === "rentRequest")
      return;

    // For text messages: only allow if current user sent it
    if (message.type === "message" || !message.type) {
      if (senderId !== currentUserId) return;
    }
    setSelectedMessage(message);
    setShowMessageActions(true);
  };

  const handleMessageEdit = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditText(currentText);
    setShowMessageActions(false);
    setSelectedMessage(null);
  };

  const sendPaymentMessage = async (paymentType: "initial" | "full") => {
    if (!chatData || !chatData.itemDetails) {
      Alert.alert("Error", "Item details not found");
      return;
    }

    try {
      // Check if current user (owner) has PayPal email set up
      if (!currentUserPayPalEmail || currentUserPayPalEmail.trim() === "") {
        // Show custom alert to redirect to payment options
        setPendingPaymentType(paymentType);
        setShowPayPalAlert(true);
        return;
      }

      const { totalPrice, downpaymentPercentage = 0 } = chatData.itemDetails;

      if (!totalPrice) {
        Alert.alert("Error", "Total price not available");
        return;
      }

      // Calculate payment amount
      let amount: number;
      if (paymentType === "initial") {
        if (downpaymentPercentage === 0) {
          Alert.alert("Error", "No downpayment required for this item");
          return;
        }
        amount = (totalPrice * downpaymentPercentage) / 100;
      } else {
        // Full payment
        if (downpaymentPercentage > 0) {
          // Calculate remaining amount after downpayment
          const downpaymentAmount = (totalPrice * downpaymentPercentage) / 100;
          amount = totalPrice - downpaymentAmount;
        } else {
          // Full amount if no downpayment
          amount = totalPrice;
        }
      }

      // Get recipient (renter) ID
      const recipientId =
        chatData.ownerId === currentUserId
          ? chatData.requesterId
          : chatData.ownerId;

      const paymentMessageData = {
        senderId: currentUserId,
        type: "payment",
        paymentType: paymentType,
        amount: amount,
        totalAmount: totalPrice,
        downpaymentPercentage: downpaymentPercentage,
        status: "pending",
        ownerPayPalEmail: currentUserPayPalEmail, // Owner's PayPal email (current user)
        recipientId: recipientId, // The renter who will receive the payment request
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      };

      // Add message to subcollection
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      await addDoc(messagesRef, paymentMessageData);

      // Update chat document
      const chatRef = doc(db, "chat", String(chatId));
      const updateData = {
        lastMessage: `Payment request: ${
          paymentType === "initial" ? "Initial Payment" : "Full Payment"
        }`,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        [`unreadCounts.${recipientId}`]: increment(1),
      };

      await updateDoc(chatRef, updateData);

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Payment Request Sent",
        textBody: `${
          paymentType === "initial" ? "Initial" : "Full"
        } payment request sent successfully`,
      });
    } catch (error) {
      console.error("Error sending payment message:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to send payment request",
      });
    }
  };

  const handlePayPalAlertAction = (action: "setup" | "cancel") => {
    setShowPayPalAlert(false);
    if (action === "setup") {
      // Navigate to payment options screen
      router.push("/payment-options");
    }
    // Reset pending payment type
    setPendingPaymentType(null);
  };

  const handleInitialPayment = () => {
    Alert.alert(
      "Send Initial Payment Request",
      `Send an initial payment request to the renter?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => sendPaymentMessage("initial") },
      ]
    );
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
              } catch (storageError) {
                Toast.show({
                  type: ALERT_TYPE.DANGER,
                  title: "Error",
                  textBody: `Error deleting image from storage.`,
                });
              }
            }

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

  const handleFullPayment = () => {
    Alert.alert(
      "Send Full Payment Request",
      `Send a full payment request to the renter?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: () => sendPaymentMessage("full") },
      ]
    );
  };

  const handleSaveImage = async () => {
    if (!selectedMessage?.imageUrl) return;

    try {
      // Check if we're on Android
      if (Platform.OS !== "android") {
        Alert.alert(
          "Not Supported",
          "This feature is currently only available on Android devices."
        );
        return;
      }

      // Request storage permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant storage permissions to save images."
        );
        return;
      }

      // Show loading state
      setShowMessageActions(false);
      setSelectedMessage(null);

      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Saving Image",
        textBody: "Downloading image...",
      });

      // Create filename with timestamp
      const timestamp = Date.now();
      const filename = `rent2reuse_chat_${timestamp}.jpg`;

      // Download image to temporary location first
      const tempUri = FileSystem.documentDirectory + filename;
      const downloadResult = await FileSystem.downloadAsync(
        selectedMessage.imageUrl,
        tempUri
      );

      if (downloadResult.status !== 200) {
        throw new Error("Failed to download image");
      }

      // Create the asset in media library
      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

      // Try to create/get the rent2reuse album in Pictures
      let album;
      try {
        // First, try to get existing album
        album = await MediaLibrary.getAlbumAsync("rent2reuse/chat");

        if (!album) {
          // Create new album in Pictures directory
          album = await MediaLibrary.createAlbumAsync(
            "rent2reuse",
            asset,
            false
          );
        } else {
          // Add to existing album
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      } catch (albumError) {
        console.log("Album creation/access failed:", albumError);
      }

      try {
        await FileSystem.deleteAsync(downloadResult.uri);
      } catch (cleanupError) {
        console.log("Could not clean up temporary file");
      }

      try {
        await MediaLibrary.getAssetsAsync({
          first: 1,
          mediaType: "photo",
          sortBy: "creationTime",
        });
      } catch (scanError) {
        console.log(
          "Media scan trigger failed, but image should still be saved"
        );
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Image Saved",
        textBody: album
          ? "Image saved to Pictures/rent2reuse folder"
          : "Image saved to gallery",
      });
    } catch (error) {
      console.error("Error saving image:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody:
          "Failed to save image. Please check your storage permissions.",
      });
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const uploadId = `upload_${Date.now()}_${Math.random()
          .toString(36)
          .substring(7)}`;

        // Add to uploading state immediately
        setUploadingMessages((prev) => [
          ...prev,
          {
            id: uploadId,
            uri: result.assets[0].uri,
            timestamp: Date.now(),
          },
        ]);

        try {
          await uploadAndSendImage(result.assets[0], uploadId);
        } catch (error) {
          console.error("Error uploading image:", error);
          // Remove from uploading state on error
          setUploadingMessages((prev) =>
            prev.filter((msg) => msg.id !== uploadId)
          );
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Error",
            textBody: "Failed to upload image",
          });
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

  const UploadingImageMessage = ({
    uploadData,
  }: {
    uploadData: { id: string; uri: string; timestamp: number };
  }) => {
    const maxWidth = Dimensions.get("window").width * 0.65;
    const maxHeight = 300;
    const [aspectRatio, setAspectRatio] = useState(1);
    const [imageLoaded, setImageLoaded] = useState(false);

    useEffect(() => {
      Image.getSize(
        uploadData.uri,
        (width, height) => {
          setAspectRatio(width / height);
          setImageLoaded(true);
        },
        () => {
          setAspectRatio(1);
          setImageLoaded(true);
        }
      );
    }, [uploadData.uri]);

    const imageWidth = maxWidth;
    const calculatedHeight = maxWidth / aspectRatio;
    const imageHeight = Math.min(calculatedHeight, maxHeight);

    return (
      <View className="flex-row justify-end mb-2">
        <View className="flex-col">
          <View className="rounded-xl overflow-hidden bg-gray-200 relative">
            {imageLoaded && (
              <Image
                source={{ uri: uploadData.uri }}
                style={{
                  width: imageWidth,
                  height: imageHeight,
                }}
                className="rounded-xl"
                resizeMode="cover"
              />
            )}

            {/* Upload overlay */}
            <View className="absolute inset-0 bg-black/40 items-center justify-center rounded-xl">
              <View className="bg-white/90 px-4 py-2 rounded-full flex-row items-center">
                <ActivityIndicator color="#5C6EF6" size="small" />
                <Text className="text-gray-800 text-sm font-medium ml-2">
                  Uploading...
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-row items-center mt-1 px-1 justify-end">
            <Text className="text-xs text-gray-400">Sending...</Text>
          </View>
        </View>
      </View>
    );
  };

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
    imageAsset: ImagePicker.ImagePickerAsset,
    uploadId: string
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

      // Remove from uploading state after successful upload
      setUploadingMessages((prev) => prev.filter((msg) => msg.id !== uploadId));
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error; // Re-throw so pickImage can handle it
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

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const chatRef = doc(db, "chat", String(chatId));
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
          const recipientRef = doc(db, "users", String(chatId));
          const recipientSnap = await getDoc(recipientRef);

          if (!recipientSnap.exists()) {
            Alert.alert("Error", "User not found");
            return;
          }

          const recipientData = recipientSnap.data();

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
    }, 60000);

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

        if (data.status === "cancelled" || data.status === "declined") {
          setCanSendMessage(false);
          return;
        }

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

  useLayoutEffect(() => {
    if (recipientEmail) {
      navigation.setOptions({ title: recipientEmail });
    }
  }, [navigation, recipientEmail]);

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

    markMessagesAsRead();

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

  const memoizedHandleDecline = useCallback(
    async (requestId: string) => {
      if (!requestId) {
        console.error("No requestId provided for decline");
        return;
      }
      await handleDeclineRequest(requestId);
    },
    [chatId, currentUserId]
  );

  const memoizedHandleAccept = useCallback(
    async (requestId: string) => {
      if (!requestId) {
        console.error("No requestId provided for accept");
        return;
      }
      await handleAcceptRequest(requestId);
    },
    [chatId, currentUserId]
  );

  const memoizedHandleCancel = useCallback(
    async (requestId: string) => {
      if (!requestId) {
        console.error("No requestId provided for cancel");
        return;
      }
      await handleCancelRequest(requestId);
    },
    [chatId, currentUserId]
  );

  const handleSendLocation = async () => {
    Alert.alert("Send Location", "Location sharing will be implemented here");
  };

  const handleSendAgreement = () => {
    router.push("/agreement-form");
  };

  const handleViewRequests = () => {
    router.push(`/requests/${chatId}`);
  };

  const handleSendVerdict = () => {
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

    // ADD THESE PAYMENT BUTTONS - Only show if current user is owner
    ...(currentUserId === chatData?.ownerId
      ? [
          // Initial Payment button - only show if downpayment percentage > 0
          ...(chatData?.itemDetails?.downpaymentPercentage &&
          chatData.itemDetails.downpaymentPercentage > 0
            ? [
                {
                  id: "initial_payment",
                  icon: icons.card, // Make sure you have a wallet icon
                  label: "Request Initial Payment",
                  action: handleInitialPayment,
                  bgColor: "#FFF3E0",
                  iconColor: "#FF9800",
                },
              ]
            : []),
          // Full Payment button - always available for owners
          {
            id: "full_payment",
            icon: icons.card, // Make sure you have a credit card icon
            label: "Request Full Payment",
            action: handleFullPayment,
            bgColor: "#E8F5E8",
            iconColor: "#4CAF50",
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
    if (!requestId) {
      console.error("No requestId provided");
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get the accepted request details first
      const acceptedRequestRef = doc(db, "rentRequests", requestId);
      const acceptedRequestSnap = await getDoc(acceptedRequestRef);

      if (!acceptedRequestSnap.exists()) {
        throw new Error("Request not found");
      }

      const acceptedRequestData = acceptedRequestSnap.data();
      const itemId = acceptedRequestData.itemId;
      const acceptedRequesterId = acceptedRequestData.requesterId;

      // 2. Create the first batch for the accepted request
      const acceptedBatch = writeBatch(db);

      // Update the accepted rent request
      acceptedBatch.update(acceptedRequestRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update item status
      const itemRef = doc(db, "items", itemId);
      acceptedBatch.update(itemRef, {
        itemStatus: "rented",
        rentedTo: acceptedRequesterId,
        rentedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update current chat status
      const currentChatRef = doc(db, "chat", String(chatId));
      acceptedBatch.update(currentChatRef, {
        status: "accepted",
        lastMessage: "Request accepted by owner",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true,
      });

      // Update rent request messages in current chat
      const currentChatMessagesRef = collection(
        db,
        "chat",
        String(chatId),
        "messages"
      );
      const currentChatRentRequestQuery = query(
        currentChatMessagesRef,
        where("type", "==", "rentRequest")
      );

      const currentChatRentRequestMessages = await getDocs(
        currentChatRentRequestQuery
      );

      if (!currentChatRentRequestMessages.empty) {
        const messageDoc = currentChatRentRequestMessages.docs[0];
        acceptedBatch.update(messageDoc.ref, {
          status: "accepted",
          updatedAt: serverTimestamp(),
        });
      }

      await acceptedBatch.commit();

      // 3. Add status update message to current chat
      await addDoc(currentChatMessagesRef, {
        type: "statusUpdate",
        text: "Request accepted by owner",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "accepted",
      });

      // 4. Handle other pending requests (decline them)
      const otherPendingRequestsQuery = query(
        collection(db, "rentRequests"),
        where("itemId", "==", itemId),
        where("status", "==", "pending"),
        where("chatId", "!=", String(chatId))
      );

      const otherPendingRequestsSnap = await getDocs(otherPendingRequestsQuery);

      // Process other requests in parallel with proper error handling
      const declinePromises = otherPendingRequestsSnap.docs.map(
        async (requestDoc) => {
          try {
            const requestData = requestDoc.data();
            const otherChatId = requestData.chatId;
            const otherRequesterId = requestData.requesterId;

            // Create a separate batch for each other request
            const declineBatch = writeBatch(db);

            // 1. Decline the rent request
            declineBatch.update(requestDoc.ref, {
              status: "declined",
              updatedAt: serverTimestamp(),
            });

            // 2. Update the other chat status
            const otherChatRef = doc(db, "chat", otherChatId);
            declineBatch.update(otherChatRef, {
              status: "declined",
              lastMessage: "This item has been rented to another user",
              lastMessageTime: serverTimestamp(),
              hasOwnerResponded: true,
            });

            // Commit the decline batch
            await declineBatch.commit();

            // 3. Handle messages in the other chat separately
            const otherChatMessagesRef = collection(
              db,
              "chat",
              otherChatId,
              "messages"
            );

            // Update rent request messages
            const otherRentRequestQuery = query(
              otherChatMessagesRef,
              where("type", "==", "rentRequest")
            );

            const otherRentRequestMessages = await getDocs(
              otherRentRequestQuery
            );

            if (!otherRentRequestMessages.empty) {
              const messageBatch = writeBatch(db);

              otherRentRequestMessages.docs.forEach((msgDoc) => {
                messageBatch.update(msgDoc.ref, {
                  status: "declined",
                  updatedAt: serverTimestamp(),
                });
              });

              // Add status update message
              const statusMessageRef = doc(otherChatMessagesRef);
              messageBatch.set(statusMessageRef, {
                type: "statusUpdate",
                text: "This item has been rented to another user",
                senderId: currentUserId,
                createdAt: serverTimestamp(),
                read: false,
                status: "declined",
              });

              await messageBatch.commit();
            }

            // 4. Create notification for declined user
            await createInAppNotification(otherRequesterId, {
              type: "RENT_REQUEST_DECLINED",
              title: "Item No Longer Available",
              message: `${acceptedRequestData.itemName} has been rented to another user`,
              data: {
                route: "/chat",
                params: { id: otherChatId },
              },
            });

            console.log(
              `Successfully declined request for chat: ${otherChatId}`
            );
          } catch (error) {
            console.error(
              `Error declining request for chat ${requestDoc.data().chatId}:`,
              error
            );
            // Don't throw here, just log the error so other declines can continue
          }
        }
      );

      // Wait for all decline operations to complete
      const declineResults = await Promise.allSettled(declinePromises);

      // Log any failures but don't stop the process
      declineResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Failed to decline request ${index}:`, result.reason);
        }
      });

      // 5. Create rental document
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

      // 6. Create notification for accepted user
      await createInAppNotification(acceptedRequesterId, {
        type: "RENT_REQUEST_ACCEPTED",
        title: "Request Accepted!",
        message: `Your rental request for ${acceptedRequestData.itemName} has been accepted`,
        data: {
          route: "/chat",
          params: { id: String(chatId) },
        },
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success!",
        textBody: "Request accepted successfully!",
      });
    } catch (error) {
      console.log("Error accepting request:", error);
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
    if (!requestId) {
      console.error("No requestId provided for decline");
      return;
    }

    try {
      setIsLoading(true);

      const declineBatch = writeBatch(db);

      const chatRef = doc(db, "chat", String(chatId));
      declineBatch.update(chatRef, {
        status: "declined",
        lastMessage: "Request declined by owner",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true,
      });

      try {
        const rentRequestRef = doc(db, "rentRequests", requestId);
        const rentRequestSnap = await getDoc(rentRequestRef);

        if (rentRequestSnap.exists()) {
          declineBatch.update(rentRequestRef, {
            status: "declined",
            declinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.log(
          "Rent request document may not exist in rentRequests collection:",
          error
        );
      }

      // 4. Update ALL rent request messages in this chat to declined status
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const rentRequestQuery = query(
        messagesRef,
        where("type", "==", "rentRequest")
      );

      const rentRequestMessages = await getDocs(rentRequestQuery);

      rentRequestMessages.docs.forEach((messageDoc) => {
        declineBatch.update(messageDoc.ref, {
          status: "declined",
          updatedAt: serverTimestamp(),
        });
      });

      // 5. Commit the batch
      await declineBatch.commit();

      // 6. Add status update message (separate operation to avoid batch size limits)
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request declined by owner",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "declined",
      });

      // 7. Get requester's data for notification
      let requestData = null;
      let requesterId = null;

      try {
        const requestDoc = await getDoc(doc(db, "rentRequests", requestId));
        if (requestDoc.exists()) {
          requestData = requestDoc.data();
          requesterId = requestData?.requesterId;
        } else {
          // Fallback: get requester from chat data
          const chatDoc = await getDoc(chatRef);
          if (chatDoc.exists()) {
            const chatData = chatDoc.data();
            requesterId = chatData.requesterId;
          }
        }
      } catch (error) {
        console.log("Could not get request data for notification:", error);
      }

      // 8. Create in-app notification for requester if we have the requesterId
      if (requesterId) {
        try {
          await createInAppNotification(requesterId, {
            type: "RENT_REQUEST_DECLINED",
            title: "Request Declined",
            message: `Your rental request for ${
              chatData?.itemDetails?.name || "the item"
            } has been declined`,
            data: {
              route: "/chat",
              params: {
                id: String(chatId),
                requestId: requestId,
              },
            },
          });

          // Send push notification if available
          if (requestData?.pushTokens?.token) {
            await sendPushNotification({
              to: requestData.pushTokens.token,
              title: "Request Declined",
              body: `Your rental request for ${
                chatData?.itemDetails?.name || "the item"
              } has been declined`,
              data: {
                type: "RENT_REQUEST_DECLINED",
                chatId: String(chatId),
                requestId,
              },
            });
          }
        } catch (notificationError) {
          console.error(
            "Error sending decline notification:",
            notificationError
          );
          // Don't fail the whole operation for notification errors
        }
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request declined successfully",
      });
    } catch (error) {
      console.log("Error declining request:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRequest = async (requestId?: string) => {
    if (!requestId) {
      console.error("No requestId provided for cancel");
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get current chat data first
      const chatRef = doc(db, "chat", String(chatId));
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        throw new Error("Chat not found");
      }

      const currentChatData = chatSnap.data();

      // Store current item details before cancellation
      const itemDetails = {
        name: currentChatData.itemDetails?.name,
        price: currentChatData.itemDetails?.price,
        image: currentChatData.itemDetails?.image,
        itemId: currentChatData.itemId,
      };

      // 2. Create batch for cancel operations
      const cancelBatch = writeBatch(db);

      // Update chat status but preserve item details
      cancelBatch.update(chatRef, {
        status: "cancelled",
        lastMessage: "Request cancelled by requester",
        lastMessageTime: serverTimestamp(),
        itemDetails: itemDetails, // Preserve item details
        updatedAt: serverTimestamp(),
      });

      // 3. Update ALL rent request messages in this chat
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const rentRequestQuery = query(
        messagesRef,
        where("type", "==", "rentRequest")
      );

      const rentRequestMessages = await getDocs(rentRequestQuery);

      rentRequestMessages.docs.forEach((messageDoc) => {
        cancelBatch.update(messageDoc.ref, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        });
      });

      // 4. Commit the batch
      await cancelBatch.commit();

      // 5. Add status update message (separate operation)
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: "Request cancelled by requester",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "cancelled",
      });

      // 6. Delete from rentRequests collection if it exists (separate operation)
      try {
        const requestRef = doc(db, "rentRequests", requestId);
        const requestSnap = await getDoc(requestRef);

        if (requestSnap.exists()) {
          await deleteDoc(requestRef);
          console.log("Successfully deleted from rentRequests collection");
        } else {
          console.log(
            "Request document doesn't exist in rentRequests collection"
          );
        }
      } catch (deleteError) {
        console.error("Error deleting from rentRequests:", deleteError);
        // Don't fail the whole operation for this error
      }

      // 7. Update user's plan (rent usage)
      try {
        if (auth.currentUser) {
          const userRef = doc(db, "users", auth.currentUser.uid);
          const userDoc = await getDoc(userRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const currentPlan = userData.currentPlan;

            if (currentPlan && typeof currentPlan.rentUsed === "number") {
              const newRentUsed = Math.max(0, currentPlan.rentUsed - 1);

              await updateDoc(userRef, {
                "currentPlan.rentUsed": newRentUsed,
                "currentPlan.updatedAt": new Date(),
              });

              console.log(
                `Updated user plan: rentUsed decreased to ${newRentUsed}`
              );
            }
          }
        }
      } catch (planError) {
        console.error("Error updating user plan:", planError);
        // Don't fail the whole operation for plan update errors
      }

      // 8. Create in-app notification for the current user
      try {
        await createInAppNotification(currentUserId, {
          type: "RENT_REQUEST_CANCELLED",
          title: "Request Cancelled",
          message: `You cancelled your rental request for ${
            currentChatData?.itemDetails?.name || "the item"
          }`,
          data: {
            route: "/chat",
            params: {
              id: String(chatId),
              requestId: requestId,
            },
          },
        });
      } catch (notificationError) {
        console.error("Error creating cancel notification:", notificationError);
        // Don't fail the whole operation for notification errors
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request cancelled successfully",
      });
    } catch (error: any) {
      console.error("Error cancelling request:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: error.message || "Failed to cancel request",
      });
    } finally {
      setIsLoading(false);
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
      <CustomImageViewer
        images={fullscreenImages}
        visible={fullscreenImageVisible}
        imageIndex={fullscreenImageIndex}
        onRequestClose={() => {
          setFullscreenImageVisible(false);
          setFullscreenImageIndex(0);
          setFullscreenImages([]);
        }}
        onImageIndexChange={(index) => {
          setFullscreenImageIndex(index);
        }}
      />
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
        onShowDetails={() => setShowDetailsModal(true)} // Add this line
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
            minHeight: "100%",
            paddingVertical: 16,
            paddingHorizontal: 12,
          }}
          onLayout={() => {
            if (messages.length > 0 && !loading) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }, 50);
            }
          }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              event.nativeEvent;
            const distanceFromBottom =
              contentSize.height - (contentOffset.y + layoutMeasurement.height);

            if (distanceFromBottom > 100) {
              setShowScrollToBottom(true);
            } else {
              setShowScrollToBottom(false);
            }

            setIsUserScrolling(true);
          }}
          onScrollBeginDrag={() => {
            setIsUserScrolling(true);
          }}
          onScrollEndDrag={() => {
            setTimeout(() => setIsUserScrolling(false), 100);
          }}
          onMomentumScrollEnd={() => {
            setTimeout(() => setIsUserScrolling(false), 100);
          }}
          scrollEventThrottle={16}
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
                    onCancel={() => memoizedHandleCancel(item.rentRequestId!)}
                    chatData={chatData}
                    chatId={String(chatId)}
                  />
                ) : item.type === "payment" ? (
                  // Type guard to ensure item has all required payment properties
                  <PaymentMessage
                    item={{
                      id: item.id,
                      senderId: item.senderId,
                      type: "payment",
                      paymentType: item.paymentType as "initial" | "full",
                      amount: item.amount as number,
                      totalAmount: item.totalAmount as number,
                      downpaymentPercentage: item.downpaymentPercentage,
                      status:
                        (item.status as "pending" | "paid" | "failed") ||
                        "pending",
                      createdAt: item.createdAt,
                      confirmedByOwner: item.confirmedByOwner,
                    }}
                    isCurrentUser={isCurrentUser}
                    isOwner={currentUserId === chatData?.ownerId}
                    chatId={String(chatId)}
                    currentUserId={currentUserId}
                    itemDetails={chatData?.itemDetails}
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
                      onImagePress={() => handleImagePress(item.imageUrl || "")}
                    />
                  </View>
                ) : (
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
          ListFooterComponent={() => (
            <View>
              {uploadingMessages.map((uploadData) => (
                <UploadingImageMessage
                  key={uploadData.id}
                  uploadData={uploadData}
                />
              ))}
            </View>
          )}
        />

        {showScrollToBottom && (
          <View className="absolute bottom-20 right-4">
            <TouchableOpacity
              onPress={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
                setShowScrollToBottom(false);
              }}
              className="w-12 h-12 bg-primary rounded-full items-center justify-center shadow-lg"
              style={{
                shadowColor: "#000",
                shadowOffset: {
                  width: 0,
                  height: 2,
                },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
              }}
            >
              <Image
                source={icons.arrowDown}
                className="w-6 h-6"
                tintColor="white"
              />
            </TouchableOpacity>
          </View>
        )}
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

              {newMessage.trim() || (editingMessageId && editText.trim()) ? (
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
              ) : (
                <View className="flex-row ">
                  <TouchableOpacity
                    onPress={() => setShowCamera(true)}
                    className="w-10 h-10  items-center justify-center"
                  >
                    <Image
                      source={icons.camera}
                      className="w-5 h-5"
                      tintColor="#9CA3AF"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickImage}
                    className="w-10 h-10  items-center justify-center"
                  >
                    <Image
                      source={icons.gallery}
                      className="w-5 h-5"
                      tintColor="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
        <MessageActionsModal
          visible={showMessageActions}
          message={selectedMessage}
          currentUserId={currentUserId} // Add this line
          onClose={() => {
            setShowMessageActions(false);
            setSelectedMessage(null);
          }}
          onEdit={() => {
            if (selectedMessage) {
              handleMessageEdit(selectedMessage.id, selectedMessage.text);
            }
          }}
          onSave={handleSaveImage}
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
        <ChatDetailsModal
          visible={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          chatData={chatData}
          recipientName={recipientName}
          recipientImage={recipientImage}
          recipientId={
            (chatData?.ownerId === currentUserId
              ? chatData?.requesterId
              : chatData?.ownerId) || ""
          }
          messages={messages}
          isOwner={currentUserId === chatData?.ownerId}
          currentUserId={currentUserId}
        />
        {/* Camera Modal */}
        {showCamera && (
          <Modal animationType="slide" visible={showCamera}>
            <ChatCamera
              onPhotoTaken={async (uri) => {
                setShowCamera(false);
                const uploadId = `camera_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(7)}`;
                setUploadingMessages((prev) => [
                  ...prev,
                  {
                    id: uploadId,
                    uri,
                    timestamp: Date.now(),
                  },
                ]);

                try {
                  await uploadAndSendImage(
                    {
                      uri,
                      width: 300,
                      height: 300,
                      type: "image",
                      fileName: "photo.jpg",
                      fileSize: 0,
                      base64: null,
                      duration: null,
                      exif: null,
                    },
                    uploadId
                  );
                } catch (error) {
                  console.error("Error sending photo:", error);
                  // Remove from uploading state on error
                  setUploadingMessages((prev) =>
                    prev.filter((msg) => msg.id !== uploadId)
                  );
                  Toast.show({
                    type: ALERT_TYPE.DANGER,
                    title: "Error",
                    textBody: "Failed to send photo",
                  });
                }
              }}
              onClose={() => setShowCamera(false)}
            />
          </Modal>
        )}

        <CustomAlert
          visible={showPayPalAlert}
          title="PayPal Setup Required"
          message="The recipient needs to set up their PayPal email to receive payments. Please ask them to configure their payment options first."
          buttons={[
            {
              text: "Cancel",
              type: "cancel",
              onPress: () => handlePayPalAlertAction("cancel"),
            },
            {
              text: "Setup Payment Options",
              type: "default",
              onPress: () => handlePayPalAlertAction("setup"),
            },
          ]}
          onClose={() => setShowPayPalAlert(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
