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
import RatingMessage from "@/components/chatModal/RatingMessage";
import ConditionalAssessmentMessage from "@/components/chatModal/ConditionalAssessmentMessage";
import * as FileSystem from "expo-file-system";
import { useMemo } from "react";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";
import OwnerConfirmationMessage from "@/components/chatModal/OwnerConfirmationMessage";
import { PickupAssessmentData } from "@/components/chatModal/PickupAssessmentModal";

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

type MessageType =
  | Message["type"]
  | "conditionalAssessment"
  | "ownerConfirmation"
  | "rentRequest"
  | "payment"
  | "statusUpdate"
  | "image"
  | "message";
import PaymentMessage from "@/components/chatModal/PaymentMessage";
import CustomAlert from "@/components/CustomAlert";
import { DatabaseHelper } from "@/utils/paypalHelper";
import { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } from "@env";
import PickupAssessmentModal from "@/components/chatModal/PickupAssessmentModal";

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

  const [showPickupAssessmentModal, setShowPickupAssessmentModal] =
    useState(false);
  const [pickupAssessmentData, setPickupAssessmentData] =
    useState<PickupAssessmentData | null>(null);

  const [assessmentSaved, setAssessmentSaved] = useState(false);

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
    initialPaymentSent?: boolean;
    fullPaymentSent?: boolean;
    initialPaymentStatus?: "pending" | "completed";
    fullPaymentStatus?: "pending" | "completed";
    ownerRatingSubmitted?: boolean;
    renterRatingSubmitted?: boolean;
    ownerRatedAt?: any;
    renterRatedAt?: any;
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
        console.log("Error fetching current user PayPal email:", error);
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
        console.log("Error listening to current user PayPal updates:", error);
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

  const handlePickupAssessmentSubmit = async (
    assessmentData: PickupAssessmentData // ✅ Use the correct aligned type
  ) => {
    try {
      setIsLoading(true);

      const messagesRef = collection(db, "chat", String(chatId), "messages");

      // ✅ Create assessment message with aligned data
      const assessmentMessage = await addDoc(messagesRef, {
        type: "conditionalAssessment",
        assessmentType: "pickup",
        assessment: {
          overallCondition: assessmentData.overallCondition,
          scratches: assessmentData.scratches,
          dents: assessmentData.dents,
          stains: assessmentData.stains,
          tears: assessmentData.tears,
          functioningIssues: assessmentData.functioningIssues,
          otherDamage: assessmentData.otherDamage,
          notes: assessmentData.notes,
          photos: assessmentData.photos,
          submittedAt: serverTimestamp(),
        },
        status: "submitted", // ✅ Changed from pending
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      // ✅ Update chat status
      const chatRef = doc(db, "chat", String(chatId));
      await updateDoc(chatRef, {
        renterPickupAssessmentSubmitted: true,
        renterPickupAssessmentMessageId: assessmentMessage.id,
        renterPickupAssessmentData: {
          overallCondition: assessmentData.overallCondition,
          scratches: assessmentData.scratches,
          dents: assessmentData.dents,
          stains: assessmentData.stains,
          tears: assessmentData.tears,
          functioningIssues: assessmentData.functioningIssues,
          otherDamage: assessmentData.otherDamage,
          notes: assessmentData.notes,
          photoCount: assessmentData.photos.length,
          photoUrls: assessmentData.photos,
          submittedAt: serverTimestamp(),
        },
        status: "assessment_submitted",
        lastMessage: "Renter submitted pickup inspection",
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add status message
      await addDoc(messagesRef, {
        type: "statusUpdate",
        text: "Renter completed pickup inspection with photos",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      setShowPickupAssessmentModal(false);

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Assessment Submitted",
        textBody: "Waiting for owner to confirm receipt",
      });
    } catch (error) {
      console.log("Error submitting pickup assessment:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit assessment",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          const downpaymentAmount = (totalPrice * downpaymentPercentage) / 100;
          amount = totalPrice - downpaymentAmount;
        } else {
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
        recipientPayPalEmail: currentUserPayPalEmail,
        recipientId: recipientId,
        usdAmount: DatabaseHelper.convertToUsd(amount),
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      };

      // Add message to subcollection
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      await addDoc(messagesRef, paymentMessageData);

      const chatRef = doc(db, "chat", String(chatId));
      const updateData = {
        lastMessage: `Payment request: ${
          paymentType === "initial" ? "Initial Payment" : "Full Payment"
        }`,
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        [`unreadCounts.${recipientId}`]: increment(1),

        ...(paymentType === "initial" && {
          initialPaymentSent: true,
          initialPaymentStatus: "pending",
        }),
        ...(paymentType === "full" && {
          fullPaymentSent: true,
          fullPaymentStatus: "pending",
        }),
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
      console.log("Error sending payment message:", error);
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
    if (!chatData?.itemDetails) {
      Alert.alert("Error", "Item details not found");
      return;
    }

    const downpaymentPercentage =
      chatData.itemDetails.downpaymentPercentage || 0;
    const totalPrice = chatData.itemDetails.totalPrice || 0;
    const downpaymentAmount = (totalPrice * downpaymentPercentage) / 100;

    Alert.alert(
      "Request Initial Payment",
      `Request ₱${downpaymentAmount.toLocaleString()} (${downpaymentPercentage}% down payment)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Request",
          style: "default",
          onPress: () => sendPaymentMessage("initial"),
        },
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
            console.log("Error deleting message:", error);
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
    if (!chatData?.itemDetails) {
      Alert.alert("Error", "Item details not found");
      return;
    }

    const downpaymentPercentage =
      chatData.itemDetails.downpaymentPercentage || 0;
    const totalPrice = chatData.itemDetails.totalPrice || 0;
    const downpaymentAmount = (totalPrice * downpaymentPercentage) / 100;
    const remainingAmount = totalPrice - downpaymentAmount;

    Alert.alert(
      "Request Full Payment",
      `Request remaining payment of ₱${remainingAmount.toLocaleString()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Request",
          style: "default",
          onPress: () => sendPaymentMessage("full"),
        },
      ]
    );
  };

  const getNextStepMessage = (): string => {
    const status = chatData?.status;
    const isOwner = currentUserId === chatData?.ownerId;

    if (status === "pending") {
      return "";
    }

    if (isOwner) {
      switch (status) {
        case "accepted":
          return "💰 Request initial payment if applicable...";
        case "initial_payment_paid":
          return "⏳ Waiting for renter to verify item condition...";
        case "assessment_submitted":
          return "✅ Confirm that renter has received the item";
        case "pickedup":
          return "📦 Request final payment and inspect returned item";
        case "completed":
          return "⭐ Send your verdict/review about the renter";
        default:
          return "";
      }
    } else {
      switch (status) {
        case "accepted":
          return "📋 Prepare for payment and verify item condition on pickup...";
        case "initial_payment_paid":
          return "📦 Verify item condition (photos required) - Required before pickup";
        case "assessment_submitted":
          return "⏳ Waiting for owner to confirm item receipt...";
        case "pickedup":
          return "🔄 Prepare item for return by the end date";
        case "completed":
          return "⭐ Send your verdict/review about the owner";
        default:
          return "";
      }
    }
  };

  // In [id].tsx - Add this new handler

  const handleItemReceived = async () => {
    try {
      setIsLoading(true);

      const chatRef = doc(db, "chat", String(chatId));
      const messagesRef = collection(db, "chat", String(chatId), "messages");

      // ✅ Change status to pickedup when owner confirms receipt
      await updateDoc(chatRef, {
        status: "pickedup",
        itemReceivedAt: serverTimestamp(),
        lastMessage: "Owner confirmed item received",
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Add status message
      await addDoc(messagesRef, {
        type: "statusUpdate",
        text: "Owner confirmed that item was received",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "pickedup",
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Confirmed",
        textBody: "Item receipt confirmed",
      });
    } catch (error) {
      console.log("Error confirming item receipt:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to confirm receipt",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add this for renter to prepare return
  const handlePrepareReturn = async () => {
    Alert.alert("Prepare Return", "Are you ready to return the item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Preparing Return",
        style: "default",
        onPress: async () => {
          try {
            setIsLoading(true);

            const messagesRef = collection(
              db,
              "chat",
              String(chatId),
              "messages"
            );

            // Add status message
            await addDoc(messagesRef, {
              type: "statusUpdate",
              text: "Renter is preparing item for return",
              senderId: currentUserId,
              createdAt: serverTimestamp(),
              read: false,
            });

            Toast.show({
              type: ALERT_TYPE.SUCCESS,
              title: "Return Prepared",
              textBody: "Item return has been initiated",
            });
          } catch (error) {
            console.log("Error preparing return:", error);
            Toast.show({
              type: ALERT_TYPE.DANGER,
              title: "Error",
              textBody: "Failed to prepare return",
            });
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleSubmitAssessment = async (
    assessmentType: "pickup" | "return",
    assessmentData: any
  ) => {
    try {
      setIsLoading(true);

      const messagesRef = collection(db, "chat", String(chatId), "messages");

      // ✅ Add assessment message to chat
      await addDoc(messagesRef, {
        type: "conditionalAssessment",
        assessmentType: assessmentType,
        assessment: assessmentData, // Save the entire assessment data
        status: "pending", // ✅ Pending owner confirmation
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      const chatRef = doc(db, "chat", String(chatId));

      if (assessmentType === "pickup") {
        // ✅ Update chat with assessment data
        await updateDoc(chatRef, {
          renterPickupAssessmentSubmitted: true,
          renterPickupAssessmentData: assessmentData,
          lastMessage: "Renter submitted pickup assessment",
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Add status message
        await addDoc(messagesRef, {
          type: "statusUpdate",
          text: "Renter submitted item condition assessment",
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          read: false,
        });

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Assessment Submitted",
          textBody: "Waiting for owner to review",
        });
      } else if (assessmentType === "return") {
        // Similar logic for return assessment
        await updateDoc(chatRef, {
          renterReturnAssessmentSubmitted: true,
          renterReturnAssessmentData: assessmentData,
          lastMessage: "Renter submitted return assessment",
          lastMessageTime: serverTimestamp(),
          status: "completed",
          updatedAt: serverTimestamp(),
        });

        await addDoc(messagesRef, {
          type: "statusUpdate",
          text: "Renter submitted return condition assessment",
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          read: false,
        });

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Return Assessment Submitted",
          textBody: "Rental completed successfully",
        });
      }

      setShowPickupAssessmentModal(false);
    } catch (error) {
      console.log("Error submitting assessment:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit assessment",
      });
    } finally {
      setIsLoading(false);
    }
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
      console.log("Error saving image:", error);
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
          console.log("Error uploading image:", error);
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
      console.log("Error picking image:", error);
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
      console.log("Error sending image message:", error);
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
      console.log("Error uploading image:", error);
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
        console.log("Error initializing chat:", error);
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
      console.log("Error sending message:", error);
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
        console.log("Error marking messages as read:", error);
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
        console.log("No requestId provided for decline");
        return;
      }
      await handleDeclineRequest(requestId);
    },
    [chatId, currentUserId]
  );

  const memoizedHandleAccept = useCallback(
    async (requestId: string) => {
      if (!requestId) {
        console.log("No requestId provided for accept");
        return;
      }
      await handleAcceptRequest(requestId);
    },
    [chatId, currentUserId]
  );

  const memoizedHandleCancel = useCallback(
    async (requestId: string) => {
      if (!requestId) {
        console.log("No requestId provided for cancel");
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
    if (!chatData) {
      Alert.alert("Error", "Chat data not available");
      return;
    }

    // Navigate with agreement data as params
    const agreementData = {
      chatId: String(chatId),
      isOwner: currentUserId === chatData.ownerId,
      itemDetails: chatData.itemDetails,
    };

    router.push({
      pathname: "/agreement-form", // ✅ Make sure this route exists
      params: {
        data: JSON.stringify(agreementData),
      },
    });
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
      console.log("Error updating status:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update status",
      });
    }
  };

  // 3. Add these handler functions for status progression:
  const handlePaymentConfirmed = async (paymentType: "initial" | "full") => {
    try {
      const chatRef = doc(db, "chat", String(chatId));

      const updateData = {
        status: "paid",
        lastMessage: `${
          paymentType === "initial" ? "Initial" : "Full"
        } payment confirmed`,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // ✅ MARK PAYMENT STATUS AS COMPLETED
        ...(paymentType === "initial" && {
          initialPaymentStatus: "completed",
        }),
        ...(paymentType === "full" && {
          fullPaymentStatus: "completed",
        }),
      };

      await updateDoc(chatRef, updateData);

      // Add status message
      await addDoc(collection(db, "chat", String(chatId), "messages"), {
        type: "statusUpdate",
        text: `${
          paymentType === "initial" ? "Initial" : "Full"
        } payment confirmed`,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "paid",
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Payment Confirmed",
        textBody: `${
          paymentType === "initial" ? "Initial" : "Full"
        } payment has been confirmed`,
      });
    } catch (error) {
      console.log("Error confirming payment:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to confirm payment",
      });
    }
  };

  const handleItemPickedUp = () => {
    updateRentalStatus("pickedup", "Item picked up by renter");
  };

  const handleItemReturned = () => {
    updateRentalStatus("completed", "Item returned and rental completed");
  };

  const handleInitiatePickupAssessment = () => {
    // Create an initial assessment message to start the inspection
    addDoc(collection(db, "chat", String(chatId), "messages"), {
      type: "conditionalAssessment",
      assessmentType: "pickup",
      status: "pending",
      senderId: currentUserId,
      createdAt: serverTimestamp(),
      read: false,
    });

    Toast.show({
      type: ALERT_TYPE.INFO,
      title: "Assessment Started",
      textBody: "Please inspect the item and complete the assessment",
    });
  };

  const handleInitiateReturnAssessment = () => {
    // Create an initial assessment message for return inspection
    addDoc(collection(db, "chat", String(chatId), "messages"), {
      type: "conditionalAssessment",
      assessmentType: "return",
      status: "pending",
      senderId: currentUserId,
      createdAt: serverTimestamp(),
      read: false,
    });

    Toast.show({
      type: ALERT_TYPE.INFO,
      title: "Assessment Started",
      textBody: "Please inspect the returned item and complete the assessment",
    });
  };

  const getAvailableActions = (): ActionMenuItem[] => {
    if (!chatData || !currentUserId) return [];

    const isOwner = currentUserId === chatData.ownerId;
    const status = chatData.status;
    const actions: ActionMenuItem[] = [];

    // ✅ HIDE ALL ACTIONS ON "pending" STATUS
    if (status === "pending") {
      return []; // No actions available
    }

    // OWNER ACTIONS
    if (isOwner) {
      switch (status) {
        case "accepted":
          // ✅ Check if there's a pending initial payment request
          const hasPendingInitialPayment = messages.some(
            (msg) =>
              msg.type === "payment" &&
              msg.paymentType === "initial" &&
              msg.status === "pending"
          );

          // ✅ Only show if there's a downpayment required AND no pending request
          if (
            chatData.itemDetails?.downpaymentPercentage &&
            chatData.itemDetails.downpaymentPercentage > 0 &&
            !chatData.initialPaymentSent &&
            !hasPendingInitialPayment
          ) {
            actions.push({
              id: "initial_payment",
              icon: icons.card,
              label: "Request Initial Payment",
              action: handleInitialPayment,
              bgColor: "#FFF3E0",
              iconColor: "#FF9800",
            });
          }
          // ✅ If pending payment exists, show info instead
          else if (hasPendingInitialPayment) {
            actions.push({
              id: "initial_payment_pending",
              icon: icons.clock,
              label: "Initial Payment Pending",
              action: () => {
                Alert.alert(
                  "Payment Pending",
                  "An initial payment request has already been sent. Waiting for renter's response..."
                );
              },
              bgColor: "#FEF3C7",
              iconColor: "#F59E0B",
            });
          }
          // ✅ If NO downpayment, owner can skip to assessment waiting
          else {
            actions.push({
              id: "awaiting_assessment",
              icon: icons.box,
              label: "Awaiting Renter Assessment",
              action: () => {
                Alert.alert(
                  "Assessment Pending",
                  "Waiting for renter to verify item condition..."
                );
              },
              bgColor: "#E3F2FD",
              iconColor: "#2196F3",
            });
          }
          break;

        case "initial_payment_paid":
          // ✅ Owner: Waiting for renter's conditional assessment
          actions.push({
            id: "awaiting_assessment",
            icon: icons.box,
            label: "Awaiting Renter Assessment",
            action: () => {
              Alert.alert(
                "Assessment Pending",
                "Waiting for renter to verify item condition..."
              );
            },
            bgColor: "#E3F2FD",
            iconColor: "#2196F3",
          });
          break;

        case "assessment_submitted":
          // ✅ Owner: Confirm item received
          actions.push({
            id: "item_received",
            icon: icons.check,
            label: "Confirm Item Received",
            action: handleItemReceived,
            bgColor: "#E8F5E9",
            iconColor: "#4CAF50",
          });
          break;

        case "pickedup":
          // ✅ Check for pending full payment
          const hasPendingFullPayment = messages.some(
            (msg) =>
              msg.type === "payment" &&
              msg.paymentType === "full" &&
              msg.status === "pending"
          );

          // ✅ Only show full payment if no pending request
          if (!chatData.fullPaymentSent && !hasPendingFullPayment) {
            actions.push({
              id: "full_payment",
              icon: icons.card,
              label: "Request Full Payment",
              action: handleFullPayment,
              bgColor: "#FFF3E0",
              iconColor: "#FF9800",
            });
          }
          // ✅ If pending payment exists, show info instead
          else if (hasPendingFullPayment) {
            actions.push({
              id: "full_payment_pending",
              icon: icons.clock,
              label: "Full Payment Pending",
              action: () => {
                Alert.alert(
                  "Payment Pending",
                  "A full payment request has already been sent. Waiting for renter's response..."
                );
              },
              bgColor: "#FEF3C7",
              iconColor: "#F59E0B",
            });
          }

          // Always show return inspection
          actions.push({
            id: "return_inspection",
            icon: icons.box,
            label: "Inspect Returned Item",
            action: handleInitiateReturnAssessment,
            bgColor: "#E8F5E9",
            iconColor: "#4CAF50",
          });
          break;

        case "completed":
          // ✅ Check if owner has submitted rating
          if (!chatData.ownerRatingSubmitted) {
            actions.push({
              id: "leave_rating",
              icon: icons.star,
              label: "Leave Rating",
              action: handleInitiateRating,
              bgColor: "#FEF3C7",
              iconColor: "#F59E0B",
            });
          } else {
            actions.push({
              id: "rating_submitted",
              icon: icons.check,
              label: "Rating Submitted",
              action: () => {
                Alert.alert(
                  "Rating Submitted",
                  "You have already submitted your rating for this rental"
                );
              },
              bgColor: "#D1FAE5",
              iconColor: "#10B981",
            });
          }
          break;
      }
    }
    // RENTER ACTIONS
    else {
      switch (status) {
        case "accepted":
          // ✅ Always show assessment on accepted (even if no downpayment)
          actions.push({
            id: "pickup_assessment",
            icon: icons.box,
            label: "Verify Item Condition",
            action: () => setShowPickupAssessmentModal(true),
            bgColor: "#E3F2FD",
            iconColor: "#2196F3",
          });
          break;

        case "initial_payment_paid":
          // ✅ Renter: MUST submit conditional assessment if initial payment paid
          actions.push({
            id: "pickup_assessment",
            icon: icons.box,
            label: "Verify Item Condition (Required)",
            action: () => setShowPickupAssessmentModal(true),
            bgColor: "#FED7AA", // Orange = Required
            iconColor: "#D97706",
          });
          break;

        case "assessment_submitted":
          // ✅ Renter: Waiting for owner to confirm receipt
          actions.push({
            id: "awaiting_confirmation",
            icon: icons.clock,
            label: "Awaiting Owner Confirmation",
            action: () => {
              Alert.alert(
                "Waiting",
                "Waiting for owner to confirm item receipt..."
              );
            },
            bgColor: "#FEF3C7",
            iconColor: "#F59E0B",
          });
          break;

        case "pickedup":
          // ✅ Renter: Prepare return
          actions.push({
            id: "prepare_return",
            icon: icons.refresh,
            label: "Prepare Item Return",
            action: handlePrepareReturn,
            bgColor: "#F3E5F5",
            iconColor: "#9C27B0",
          });
          break;

        case "completed":
          // ✅ Check if renter has submitted rating
          if (!chatData.renterRatingSubmitted) {
            actions.push({
              id: "leave_rating",
              icon: icons.star,
              label: "Leave Rating",
              action: handleInitiateRating,
              bgColor: "#FEF3C7",
              iconColor: "#F59E0B",
            });
          } else {
            actions.push({
              id: "rating_submitted",
              icon: icons.check,
              label: "Rating Submitted",
              action: () => {
                Alert.alert(
                  "Rating Submitted",
                  "You have already submitted your rating for this rental"
                );
              },
              bgColor: "#D1FAE5",
              iconColor: "#10B981",
            });
          }
          break;
      }
    }

    return actions;
  };

  const handleInitiateRating = () => {
    // Create an initial rating message to start the rating process
    addDoc(collection(db, "chat", String(chatId), "messages"), {
      type: "rating",
      status: "pending",
      senderId: currentUserId,
      createdAt: serverTimestamp(),
      read: false,
    });

    Toast.show({
      type: ALERT_TYPE.INFO,
      title: "Rating Started",
      textBody: "Please share your rating for this rental",
    });
  };

  const handleSubmitRating = async (ratingData: any) => {
    try {
      setIsLoading(true);

      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const isOwner = currentUserId === chatData?.ownerId;

      // ✅ Add rating message to chat
      await addDoc(messagesRef, {
        type: "rating",
        rating: ratingData.rating,
        review: ratingData.review,
        categories: ratingData.categories,
        status: "submitted",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      const chatRef = doc(db, "chat", String(chatId));

      // ✅ Update chat with rating data
      const updateData = {
        lastMessage: `${isOwner ? "Owner" : "Renter"} submitted a rating`,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(isOwner && {
          ownerRatingSubmitted: true,
          ownerRating: ratingData.rating,
          ownerReview: ratingData.review,
          ownerCategories: ratingData.categories,
          ownerRatedAt: serverTimestamp(),
        }),
        ...(!isOwner && {
          renterRatingSubmitted: true,
          renterRating: ratingData.rating,
          renterReview: ratingData.review,
          renterCategories: ratingData.categories,
          renterRatedAt: serverTimestamp(),
        }),
      };

      await updateDoc(chatRef, updateData);

      // Add status message
      await addDoc(messagesRef, {
        type: "statusUpdate",
        text: `${isOwner ? "Owner" : "Renter"} submitted a rating (${
          ratingData.rating
        }⭐)`,
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Rating Submitted",
        textBody: "Thank you for your feedback!",
      });
    } catch (error) {
      console.log("Error submitting rating:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit rating",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId?: string) => {
    if (!requestId) {
      console.log("No requestId provided");
      return;
    }

    try {
      setIsLoading(true);

      // Get the rent request details
      const acceptedRequestRef = doc(db, "rentRequests", requestId);
      const acceptedRequestSnap = await getDoc(acceptedRequestRef);

      if (!acceptedRequestSnap.exists()) {
        throw new Error("Request not found");
      }

      const acceptedRequestData = acceptedRequestSnap.data();
      const recipientId = chatData?.requesterId; // The renter

      // ✅ FILTER OUT UNDEFINED VALUES
      const rentRequestDetails = {
        startDate: acceptedRequestData.startDate,
        endDate: acceptedRequestData.endDate,
        rentalDays: acceptedRequestData.rentalDays,
        pickupTime: acceptedRequestData.pickupTime,
        ...(acceptedRequestData.itemLocation && {
          itemLocation: acceptedRequestData.itemLocation,
        }),
        ...(acceptedRequestData.itemId && {
          itemId: acceptedRequestData.itemId,
        }),
        ...(acceptedRequestData.itemName && {
          itemName: acceptedRequestData.itemName,
        }),
        ...(acceptedRequestData.totalPrice && {
          totalPrice: acceptedRequestData.totalPrice,
        }),
      };

      // 1. Create confirmation message instead of accepting directly
      const confirmationMessageData = {
        type: "ownerConfirmation",
        senderId: currentUserId,
        confirmationRequestId: requestId,
        itemDetails: {
          name: acceptedRequestData.itemName,
          image: acceptedRequestData.itemImage,
          price: acceptedRequestData.totalPrice,
          downpaymentPercentage: acceptedRequestData.downpaymentPercentage || 0,
        },
        rentRequestDetails: rentRequestDetails, // ✅ USE FILTERED DATA
        status: "pending", // pending until renter confirms
        createdAt: serverTimestamp(),
        read: false,
        readAt: null,
      };

      // 2. Add confirmation message to chat
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      await addDoc(messagesRef, confirmationMessageData);

      // 3. Update chat last message
      const chatRef = doc(db, "chat", String(chatId));
      await updateDoc(chatRef, {
        lastMessage: "Owner sent confirmation request",
        lastMessageTime: serverTimestamp(),
        lastSender: currentUserId,
        [`unreadCounts.${recipientId}`]: increment(1),
      });

      // 4. Create in-app notification for renter
      if (recipientId) {
        await createInAppNotification(recipientId, {
          type: "OWNER_CONFIRMATION_REQUESTED",
          title: "Confirm Rental",
          message: `${recipientName.firstname} confirmed your request. Please confirm to proceed.`,
          data: {
            route: "/chat",
            params: { id: String(chatId), requestId: requestId },
          },
        });
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Confirmation Sent",
        textBody: "Confirmation request sent to renter",
      });
    } catch (error) {
      console.log("Error sending confirmation:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to send confirmation request",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenterConfirmation = async (
    confirmationRequestId: string,
    confirmed: boolean
  ) => {
    if (!confirmationRequestId) {
      console.log("No confirmation request ID provided");
      return;
    }

    try {
      setIsLoading(true);

      if (!confirmed) {
        // RENTER DECLINED CONFIRMATION - Simple decline without extra logic
        const messagesRef = collection(db, "chat", String(chatId), "messages");

        // Find and update the confirmation message
        const confirmationQuery = query(
          messagesRef,
          where("type", "==", "ownerConfirmation"),
          where("confirmationRequestId", "==", confirmationRequestId)
        );

        const confirmationMessages = await getDocs(confirmationQuery);

        if (!confirmationMessages.empty) {
          await updateDoc(confirmationMessages.docs[0].ref, {
            status: "declined",
            updatedAt: serverTimestamp(),
          });
        }

        // Update chat status to declined
        const chatRef = doc(db, "chat", String(chatId));
        await updateDoc(chatRef, {
          status: "declined",
          lastMessage: "Renter declined confirmation",
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Add status message
        await addDoc(messagesRef, {
          type: "statusUpdate",
          text: "Renter declined confirmation",
          senderId: currentUserId,
          createdAt: serverTimestamp(),
          read: false,
        });

        // ============================================
        // DELETE FROM RENT REQUESTS (like cancel logic)
        // ============================================
        try {
          const requestRef = doc(db, "rentRequests", confirmationRequestId);
          const requestSnap = await getDoc(requestRef);

          if (requestSnap.exists()) {
            await deleteDoc(requestRef);
            console.log(
              "Successfully deleted from rentRequests collection on decline"
            );
          }
        } catch (deleteError) {
          console.log(
            "Error deleting from rentRequests on decline:",
            deleteError
          );
          // Don't fail the whole operation
        }

        // ============================================
        // UPDATE USER'S PLAN (rent usage) - like cancel
        // ============================================
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
                  `Updated user plan on decline: rentUsed decreased to ${newRentUsed}`
                );
              }
            }
          }
        } catch (planError) {
          console.log("Error updating user plan on decline:", planError);
          // Don't fail the whole operation
        }

        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Declined",
          textBody: "Confirmation declined",
        });
        return;
      }

      // ============================================
      // RENTER CONFIRMED - Execute acceptance logic
      // ============================================

      const acceptedRequestRef = doc(db, "rentRequests", confirmationRequestId);
      const acceptedRequestSnap = await getDoc(acceptedRequestRef);

      if (!acceptedRequestSnap.exists()) {
        throw new Error("Request not found");
      }

      const acceptedRequestData = acceptedRequestSnap.data();
      const itemId = acceptedRequestData.itemId;
      const acceptedRequesterId = acceptedRequestData.requesterId;

      // 1. Create the first batch for the accepted request
      const acceptedBatch = writeBatch(db);

      // Update the accepted rent request
      acceptedBatch.update(acceptedRequestRef, {
        status: "accepted",
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        confirmedByRenter: true,
        renterConfirmedAt: serverTimestamp(),
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
        lastMessage: "Rental confirmed by both parties",
        lastMessageTime: serverTimestamp(),
        hasOwnerResponded: true,
        hasRenterConfirmed: true,
        updatedAt: serverTimestamp(),
      });

      // Update confirmation message to accepted
      const messagesRef = collection(db, "chat", String(chatId), "messages");
      const confirmationQuery = query(
        messagesRef,
        where("type", "==", "ownerConfirmation"),
        where("confirmationRequestId", "==", confirmationRequestId)
      );

      const confirmationMessages = await getDocs(confirmationQuery);

      if (!confirmationMessages.empty) {
        acceptedBatch.update(confirmationMessages.docs[0].ref, {
          status: "accepted",
          updatedAt: serverTimestamp(),
          renterConfirmedAt: serverTimestamp(),
        });
      }

      await acceptedBatch.commit();

      // 2. Add status update message
      await addDoc(messagesRef, {
        type: "statusUpdate",
        text: "Rental confirmed by renter",
        senderId: currentUserId,
        createdAt: serverTimestamp(),
        read: false,
        status: "accepted",
      });

      // ========================================================
      // 3. HANDLE OTHER PENDING CONFIRMATIONS FOR SAME ITEM
      // ========================================================
      // Get all OTHER chats with pending confirmations for same item
      const allChatsRef = collection(db, "chat");
      const otherChatsQuery = query(
        allChatsRef,
        where("itemId", "==", itemId),
        where("status", "==", "pending")
      );

      const otherChatsSnap = await getDocs(otherChatsQuery);

      const declineOtherConfirmationsPromises = otherChatsSnap.docs.map(
        async (otherChatDoc) => {
          if (otherChatDoc.id === String(chatId)) return; // Skip current chat

          try {
            const otherChatData = otherChatDoc.data();
            const otherChatId = otherChatDoc.id;
            const otherOwnerId = otherChatData.ownerId;
            const otherRequesterId = otherChatData.requesterId;

            // Get all confirmation messages in that chat
            const otherMessagesRef = collection(
              db,
              "chat",
              otherChatId,
              "messages"
            );
            const otherConfirmationQuery = query(
              otherMessagesRef,
              where("type", "==", "ownerConfirmation"),
              where("status", "==", "pending")
            );

            const otherConfirmations = await getDocs(otherConfirmationQuery);

            // Decline all pending confirmations
            const declineBatch = writeBatch(db);

            otherConfirmations.docs.forEach((confirmMsg) => {
              declineBatch.update(confirmMsg.ref, {
                status: "declined",
                declinedReason: "Item was rented to another user",
                updatedAt: serverTimestamp(),
              });
            });

            // Update the OTHER chat to declined
            const otherChatRef = doc(db, "chat", otherChatId);
            declineBatch.update(otherChatRef, {
              status: "declined",
              lastMessage: "This item has been rented to another user",
              lastMessageTime: serverTimestamp(),
              hasOwnerResponded: true,
              updatedAt: serverTimestamp(),
            });

            await declineBatch.commit();

            // Add status message to other chat
            await addDoc(otherMessagesRef, {
              type: "statusUpdate",
              text: "This item has been rented to another user",
              senderId: currentUserId,
              createdAt: serverTimestamp(),
              read: false,
              status: "declined",
            });

            // Send notification to other renter
            try {
              await createInAppNotification(otherRequesterId, {
                type: "CONFIRMATION_DECLINED",
                title: "Item No Longer Available",
                message: `${acceptedRequestData.itemName} has been rented to another user`,
                data: {
                  route: "/chat",
                  params: { id: otherChatId },
                },
              });
            } catch (notificationError) {
              console.log("Error notifying other renter:", notificationError);
            }

            // Send notification to other owner
            try {
              await createInAppNotification(otherOwnerId, {
                type: "CONFIRMATION_DECLINED",
                title: "Item Rented",
                message: `Your confirmation for ${acceptedRequestData.itemName} was declined as the item was rented to another user`,
                data: {
                  route: "/chat",
                  params: { id: otherChatId },
                },
              });
            } catch (notificationError) {
              console.log("Error notifying other owner:", notificationError);
            }
          } catch (error) {
            console.log("Error declining other confirmation:", error);
            // Don't fail the whole operation for this error
          }
        }
      );

      await Promise.allSettled(declineOtherConfirmationsPromises);

      // 4. Handle other pending RENT REQUESTS for same item
      try {
        const otherPendingRequestsQuery = query(
          collection(db, "rentRequests"),
          where("itemId", "==", itemId),
          where("status", "==", "pending")
        );

        const otherPendingRequestsSnap = await getDocs(
          otherPendingRequestsQuery
        );

        const declinePromises = otherPendingRequestsSnap.docs.map(
          async (requestDoc) => {
            try {
              const requestData = requestDoc.data();
              const otherChatId = requestData.chatId;
              const otherRequesterId = requestData.requesterId;

              const declineBatch = writeBatch(db);

              declineBatch.update(requestDoc.ref, {
                status: "declined",
                updatedAt: serverTimestamp(),
              });

              const otherChatRef = doc(db, "chat", otherChatId);
              declineBatch.update(otherChatRef, {
                status: "declined",
                lastMessage: "This item has been rented to another user",
                lastMessageTime: serverTimestamp(),
                hasOwnerResponded: true,
                updatedAt: serverTimestamp(),
              });

              await declineBatch.commit();

              const otherChatMessagesRef = collection(
                db,
                "chat",
                otherChatId,
                "messages"
              );

              // Add status message
              await addDoc(otherChatMessagesRef, {
                type: "statusUpdate",
                text: "This item has been rented to another user",
                senderId: currentUserId,
                createdAt: serverTimestamp(),
                read: false,
                status: "declined",
              });

              try {
                await createInAppNotification(otherRequesterId, {
                  type: "RENT_REQUEST_DECLINED",
                  title: "Item No Longer Available",
                  message: `${acceptedRequestData.itemName} has been rented to another user`,
                  data: {
                    route: "/chat",
                    params: { id: otherChatId },
                  },
                });
              } catch (notificationError) {
                console.log(
                  "Error sending decline notification:",
                  notificationError
                );
              }
            } catch (error) {
              console.log(`Error declining request:`, error);
            }
          }
        );

        await Promise.allSettled(declinePromises);
      } catch (error) {
        console.log("Error handling other pending requests:", error);
        // Don't fail the whole operation
      }

      // 5. Create rental document
      try {
        const rentalData = {
          rentalId: `rental_${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}`,
          status: "active",
          rentRequestId: confirmationRequestId,
          chatId: String(chatId),
          itemId: itemId,
          ownerId: chatData?.ownerId,
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
      } catch (rentalError) {
        console.log("Error creating rental document:", rentalError);
        // Don't fail the whole operation
      }

      // 6. Create notification for owner
      try {
        await createInAppNotification(chatData?.ownerId || "", {
          type: "RENT_REQUEST_CONFIRMED",
          title: "Request Confirmed!",
          message: `Your rental request for ${acceptedRequestData.itemName} has been confirmed`,
          data: {
            route: "/chat",
            params: { id: String(chatId) },
          },
        });
      } catch (notificationError) {
        console.log("Error notifying owner:", notificationError);
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Confirmed!",
        textBody: "Rental confirmed successfully!",
      });
    } catch (error) {
      console.log("Error confirming rental:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to confirm rental",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const RENTAL_STATUS = {
    PENDING: "pending",
    ACCEPTED: "accepted",
    INITIAL_PAYMENT_PAID: "initial_payment_paid",
    ASSESSMENT_SUBMITTED: "assessment_submitted",
    PICKEDUP: "pickedup",
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
      console.log("No requestId provided for decline");
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
          console.log("Error sending decline notification:", notificationError);
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

  const handleCancelPaymentRequest = async (paymentMessageId: string) => {
    try {
      Alert.alert(
        "Cancel Payment Request",
        "Are you sure you want to cancel this payment request? The renter will be able to send a new request.",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              try {
                setIsLoading(true);

                const messageRef = doc(
                  db,
                  "chat",
                  String(chatId),
                  "messages",
                  paymentMessageId
                );

                // Update payment message status to cancelled
                await updateDoc(messageRef, {
                  status: "cancelled",
                  cancelledAt: serverTimestamp(),
                });

                // Add status message
                await addDoc(
                  collection(db, "chat", String(chatId), "messages"),
                  {
                    type: "statusUpdate",
                    text: "Payment request cancelled by owner",
                    senderId: currentUserId,
                    createdAt: serverTimestamp(),
                    read: false,
                  }
                );

                Toast.show({
                  type: ALERT_TYPE.SUCCESS,
                  title: "Cancelled",
                  textBody: "Payment request cancelled",
                });
              } catch (error) {
                console.log("Error cancelling payment request:", error);
                Toast.show({
                  type: ALERT_TYPE.DANGER,
                  title: "Error",
                  textBody: "Failed to cancel payment request",
                });
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.log("Error in handleCancelPaymentRequest:", error);
    }
  };

  const handleCancelRequest = async (requestId?: string) => {
    if (!requestId) {
      console.log("No requestId provided for cancel");
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
        console.log("Error deleting from rentRequests:", deleteError);
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
        console.log("Error updating user plan:", planError);
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
        console.log("Error creating cancel notification:", notificationError);
        // Don't fail the whole operation for notification errors
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Request cancelled successfully",
      });
    } catch (error: any) {
      console.log("Error cancelling request:", error);
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

      {chatData?.status &&
        chatData.status !== "declined" &&
        chatData.status !== "cancelled" &&
        chatData.status !== "pending" && ( // ✅ Hide on pending
          <View className="bg-blue-50 px-4 py-3 m-2 rounded-xl">
            <Text className="text-center text-sm text-blue-700 font-pmedium">
              {getNextStepMessage()}
            </Text>
          </View>
        )}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 70}
        className="flex-1"
        style={{ flex: 1 }}
      >
        {showScrollToBottom && (
          <View className="absolute z-20 bottom-20 right-4">
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

                {item.type === "conditionalAssessment" ? (
                  <ConditionalAssessmentMessage
                    item={item}
                    isCurrentUser={isCurrentUser}
                    onSubmit={(assessmentData) => {
                      const assessmentType = (item.assessmentType ||
                        "pickup") as "pickup" | "return";
                      handleSubmitAssessment(assessmentType, assessmentData);
                    }}
                    isLoading={loading}
                    chatId={String(chatId)}
                    assessmentType={
                      (item.assessmentType || "pickup") as "pickup" | "return"
                    }
                    isOwner={currentUserId === chatData?.ownerId} // ✅ ADD THIS
                  />
                ) : item.type === "ownerConfirmation" ? (
                  <OwnerConfirmationMessage
                    item={item}
                    isCurrentUser={isCurrentUser}
                    onConfirm={() =>
                      handleRenterConfirmation(
                        item.confirmationRequestId!,
                        true
                      )
                    }
                    onDecline={() =>
                      handleRenterConfirmation(
                        item.confirmationRequestId!,
                        false
                      )
                    }
                    isLoading={loading}
                    chatId={String(chatId)}
                    rentRequestDetails={item.rentRequestDetails}
                  />
                ) : item.type === "rentRequest" ? (
                  <RentRequestMessage
                    item={item}
                    isOwner={currentUserId === chatData?.ownerId}
                    onAccept={() => memoizedHandleAccept(item.rentRequestId!)}
                    onCancel={() => memoizedHandleCancel(item.rentRequestId!)}
                    chatData={chatData}
                    chatId={String(chatId)}
                    messages={messages}
                  />
                ) : item.type === "rating" ? (
                  <RatingMessage
                    item={item}
                    isCurrentUser={isCurrentUser}
                    onSubmitRating={handleSubmitRating}
                    isLoading={loading}
                    chatId={String(chatId)}
                    isOwner={currentUserId === chatData?.ownerId}
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
                        (item.status as
                          | "pending"
                          | "pending_approval"
                          | "paid"
                          | "failed"
                          | "cancelled") || "pending",
                      createdAt: item.createdAt,
                      recipientPayPalEmail: item.recipientPayPalEmail,
                      paypalOrderId: item.paypalOrderId,
                      paypalApprovalUrl: item.paypalApprovalUrl,
                      paypalCaptureId: item.paypalCaptureId,
                      transactionId: item.transactionId,
                      paidAt: item.paidAt,
                      sentAt: item.sentAt,
                      confirmedByOwner: item.confirmedByOwner,
                      paymentId: item.paymentId,
                      usdAmount: item.usdAmount,
                    }}
                    isCurrentUser={isCurrentUser}
                    isOwner={currentUserId === chatData?.ownerId}
                    chatId={String(chatId)}
                    currentUserId={currentUserId}
                    itemDetails={chatData?.itemDetails}
                    clientId={PAYPAL_CLIENT_ID}
                    clientSecret={PAYPAL_CLIENT_SECRET}
                    onCancelPayment={handleCancelPaymentRequest} // ✅ ADD THIS
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

        {/* Message Input */}
        {chatData?.status !== "declined" &&
          chatData?.status !== "cancelled" && (
            <View className="flex-row px-2 pb-2 gap-2">
              <View className="flex-1 flex-row items-end gap-2 p-2 bg-white rounded-3xl">
                {editingMessageId && (
                  <View className="items-end justify-end">
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

                {!editingMessageId && getAvailableActions().length > 0 && (
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
                  <View className="flex-row">
                    <TouchableOpacity
                      onPress={() => setShowCamera(true)}
                      className="w-10 h-10 items-center justify-center"
                    >
                      <Image
                        source={icons.camera}
                        className="w-5 h-5"
                        tintColor="#9CA3AF"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickImage}
                      className="w-10 h-10 items-center justify-center"
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
            </View>
          )}

        {/* Show unavailable message if chat is declined or cancelled */}
        {(chatData?.status === "declined" ||
          chatData?.status === "cancelled") && (
          <View className="flex-row px-4 py-4 bg-red-50 border-t border-red-200">
            <Image
              source={icons.close}
              className="w-5 h-5 mr-3"
              tintColor="#DC2626"
            />
            <Text className="flex-1 text-red-700 font-pmedium text-sm">
              This chat is{" "}
              {chatData?.status === "declined" ? "declined" : "cancelled"} and
              is no longer available
            </Text>
          </View>
        )}
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
          items={getAvailableActions()}
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
                  console.log("Error sending photo:", error);
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
        <PickupAssessmentModal
          visible={showPickupAssessmentModal}
          itemName={chatData?.itemDetails?.name || "Item"}
          onClose={() => setShowPickupAssessmentModal(false)}
          onSubmit={handlePickupAssessmentSubmit}
          initialData={pickupAssessmentData || undefined}
          chatId={String(chatId)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
