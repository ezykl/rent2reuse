import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  StyleSheet,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { icons, images } from "@/constant";
import LargeButton from "@/components/LargeButton";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  increment,
  writeBatch,
  addDoc,
} from "firebase/firestore";
import { db, storage } from "@/lib/firebaseConfig";
import { TOOL_CATEGORIES } from "@/constant/tool-categories";
import { Image as ExpoImage } from "expo-image";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useLoader } from "@/context/LoaderContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { generateDescriptionTemplate } from "@/constant/item-specifications";
import { getToolCategory } from "@/constant/tool-categories";
import { Item as ListingData } from "@/types/item";
import stringSimilarity from "string-similarity";
import { useProhibitedChecker } from "../../utils/useProhibitedChecker";
import LottieView from "lottie-react-native";
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";
import { MAP_TILER_API_KEY } from "@env";
import { createInAppNotification } from "src/utils/notificationHelper";

const EditListing = () => {
  const { id } = useLocalSearchParams();
  const { setIsLoading: setGlobalLoading } = useLoader();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [imageStates, setImageStates] = useState<
    Map<
      string,
      {
        status: "local" | "uploading" | "uploaded" | "failed";
        uri: string;
        uploadProgress?: number;
      }
    >
  >(new Map());

  const [hasChanges, setHasChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState<
    typeof formData | null
  >(null);
  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const insets = useSafeAreaInsets();

  const ITEM_CONDITIONS = [
    { value: "Brand New", details: "Never been used, in original packaging" },
    { value: "Like New", details: "Barely used, no visible wear" },
    { value: "Very Good", details: "Minimal wear, fully functional" },
    { value: "Good", details: "Normal wear but works perfectly" },
    { value: "Fair", details: "Visible wear but functions well" },
    { value: "Worn but Usable", details: "Heavy use but still functional" },
  ];

  // Add title validation state
  const [titleValidation, setTitleValidation] = useState({
    isValid: true,
    message: "",
    similarity: 1,
  });

  // Update the form state
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    price: "",
    minimumDays: "",
    condition: "",
    location: {
      latitude: 0,
      longitude: 0,
      address: "",
      radius: 0,
    },
    images: [] as string[],
    enableDownpayment: false,
    downpaymentPercentage: "",
    enableAI: false,
  });

  const [errors, setErrors] = useState({
    title: "",
    category: "",
    price: "",
    minimumDays: "",
    description: "",
    condition: "",
    images: "",
  });

  // Add new state for original values
  const [originalData, setOriginalData] = useState({
    title: "",
    category: "",
    firstImage: "",
  });

  useEffect(() => {
    fetchListingDetails();
  }, [id]);

  // Add useEffect for similarity check initialization
  useEffect(() => {
    // Initialize similarity check when original data is set
    if (originalData.title && formData.title && formData.enableAI) {
      checkTitleSimilarityRealTime(formData.title);
    }
  }, [originalData.title, formData.enableAI]);

  useEffect(() => {
    if (initialFormData) {
      const hasFormChanges = checkForChanges(formData, initialFormData);
      setHasChanges(hasFormChanges);
    }
  }, [formData, initialFormData]);

  const checkForChanges = (currentData: any, initialData: any) => {
    if (!initialData) return false;

    // Check basic form fields
    const basicFieldsChanged =
      currentData.title !== initialData.title ||
      currentData.category !== initialData.category ||
      currentData.description !== initialData.description ||
      currentData.price !== initialData.price ||
      currentData.minimumDays !== initialData.minimumDays ||
      currentData.condition !== initialData.condition ||
      currentData.enableDownpayment !== initialData.enableDownpayment ||
      currentData.downpaymentPercentage !== initialData.downpaymentPercentage;

    if (basicFieldsChanged) return true;

    // Check for image changes (including pending uploads)
    const hasLocalImages = currentData.images.some((uri: string) =>
      isLocalImage(uri)
    );
    const hasFailedUploads = Array.from(imageStates.values()).some(
      (state) => state.status === "failed"
    );
    const imageCountChanged =
      currentData.images.length !== initialData.images.length;
    const imageUrlsChanged =
      JSON.stringify(currentData.images) !== JSON.stringify(initialData.images);

    return (
      hasLocalImages ||
      hasFailedUploads ||
      imageCountChanged ||
      imageUrlsChanged
    );
  };

  const fetchListingDetails = async () => {
    setGlobalLoading(true);
    try {
      const docRef = doc(db, "items", id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        const initialData = {
          title: data.itemName || "",
          category: data.itemCategory || "",
          description: data.itemDesc || "",
          price: data.itemPrice?.toString() || "",
          minimumDays: data.itemMinRentDuration?.toString() || "",
          condition: data.itemCondition || "",
          location: data.itemLocation || "",
          images: data.images || [],
          enableDownpayment: data.downpaymentPercentage ? true : false,
          downpaymentPercentage: data.downpaymentPercentage?.toString() || "",
          enableAI: data.enableAI || false,
        };

        // Store original data if AI is enabled
        if (data.enableAI) {
          setOriginalData({
            title: data.itemName,
            category: data.itemCategory,
            firstImage: data.images[0],
          });
        }

        setFormData(initialData);
        setInitialFormData(initialData);
      }
    } catch (error) {
      console.error("Error fetching listing:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to load listing details",
      });
    } finally {
      setGlobalLoading(false);
      setIsLoading(false);
    }
  };

  // Real-time similarity check function
  const checkTitleSimilarityRealTime = (newTitle: string) => {
    if (!formData.enableAI || !originalData.title) {
      setTitleValidation({ isValid: true, message: "", similarity: 1 });
      return;
    }

    // Don't validate if title is too short
    if (newTitle.length <= 3) {
      setTitleValidation({ isValid: true, message: "", similarity: 1 });
      return;
    }

    // Calculate similarity
    const similarity = stringSimilarity.compareTwoStrings(
      newTitle.toLowerCase().trim(),
      originalData.title.toLowerCase().trim()
    );

    // Set validation state based on similarity
    if (similarity < 0.3) {
      setTitleValidation({
        isValid: false,
        message:
          "Title is very different from AI-identified name. This may affect searchability.",
        similarity: similarity,
      });
    } else if (similarity < 0.5) {
      setTitleValidation({
        isValid: false,
        message: "Title differs significantly from AI-identified name.",
        similarity: similarity,
      });
    } else {
      setTitleValidation({
        isValid: true,
        message: "",
        similarity: similarity,
      });
    }
  };

  // Similarity meter component
  const SimilarityMeter = ({
    similarity,
    isVisible,
  }: {
    similarity: number;
    isVisible: boolean;
  }) => {
    if (!isVisible) return null;

    const percentage = Math.round(similarity * 100);
    const getColorClass = (sim: number) => {
      if (sim >= 0.7) return "bg-green-500";
      if (sim >= 0.5) return "bg-yellow-500";
      if (sim >= 0.3) return "bg-orange-500";
      return "bg-red-500";
    };

    return (
      <View className="mt-2">
        {similarity === 1 ? null : similarity >= 0.5 ? (
          <Text className="text-sm text-primary">Title accepted.</Text>
        ) : null}

        {/* <View className="flex-row justify-between items-center mb-1">
          <Text className="text-xs text-gray-600">Similarity to original</Text>
          <Text className="text-xs text-gray-600">{percentage}%</Text>
        </View>
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View
            className={`h-full ${getColorClass(similarity)}`}
            style={{ width: `${percentage}%` }}
          />
        </View> */}
      </View>
    );
  };

  // Helper function to create circle polygon for radius display
  const createCirclePolygon = (
    center: [number, number],
    radiusInMeters: number,
    points: number = 64
  ) => {
    const coords: number[][] = [];
    const distanceX =
      radiusInMeters / (111320 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = radiusInMeters / 110540;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]);

    return {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
      properties: {},
    };
  };

  const validateForm = () => {
    const newErrors = {
      title: "",
      category: "",
      price: "",
      minimumDays: "",
      description: "",
      condition: "",
      images: "",
    };

    let isValid = true;

    if (!formData.title.trim()) {
      newErrors.title = "Item name is required";
      isValid = false;
    }

    if (!formData.category) {
      newErrors.category = "Category is required";
      isValid = false;
    }

    if (
      !formData.price ||
      isNaN(Number(formData.price)) ||
      Number(formData.price) <= 0
    ) {
      newErrors.price = "Price must be greater than 0";
      isValid = false;
    }

    if (
      !formData.minimumDays ||
      isNaN(Number(formData.minimumDays)) ||
      Number(formData.minimumDays) <= 0
    ) {
      newErrors.minimumDays = "Minimum days must be greater than 0";
      isValid = false;
    }

    if (!formData.description.trim() || formData.description.length < 20) {
      newErrors.description = "Description must be at least 20 characters";
      isValid = false;
    }

    if (!formData.condition) {
      newErrors.condition = "Condition is required";
      isValid = false;
    }

    if (formData.images.length === 0) {
      newErrors.images = "At least one image is required";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const updateRelatedChats = async (itemId: string, updatedItemData: any) => {
    try {
      // 1. Query all chats that reference this item
      const chatsQuery = query(
        collection(db, "chat"),
        where("itemId", "==", itemId),
        where("status", "==", "pending")
      );

      const chatsSnapshot = await getDocs(chatsQuery);

      if (chatsSnapshot.empty) {
        console.log("No related chats found for this item");
        return;
      }

      // 2. Process each chat
      const chatUpdatePromises = chatsSnapshot.docs.map(async (chatDoc) => {
        const chatData = chatDoc.data();
        const chatId = chatDoc.id;

        try {
          const batch = writeBatch(db);

          const rentalDays = chatData.itemDetails?.rentalDays ?? 0;
          const oldPrice = chatData.itemDetails?.price ?? 0;
          const newPrice = updatedItemData.itemPrice;
          const totalPrice = rentalDays * newPrice;
          const requesterId = chatData.requesterId;
          const ownerId = chatData.ownerId;

          const lastMessage =
            oldPrice !== newPrice
              ? "Item price updated by owner"
              : "Item details updated by owner";

          batch.update(chatDoc.ref, {
            itemDetails: {
              ...chatData.itemDetails,
              name: updatedItemData.itemName,
              image: updatedItemData.images[0],
              price: newPrice,
              ...(updatedItemData.enableDownpayment
                ? {
                    downpaymentPercentage: Number(
                      updatedItemData.downpaymentPercentage
                    ),
                  }
                : { downpaymentPercentage: null }),
              totalPrice,
              rentalDays,
            },
            [`unreadCounts.${requesterId}`]: increment(1),
            lastMessage,
            lastMessageTime: serverTimestamp(),
            lastSender: ownerId,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();

          // 3. Add system message to chat
          const messagesRef = collection(db, "chat", chatId, "messages");
          await addDoc(messagesRef, {
            type: "statusUpdate",
            text: "Item details have been updated by the owner",
            senderId: ownerId,
            createdAt: serverTimestamp(),
            read: false,
          });

          // 4. Update rent request messages in this chat
          // const rentRequestQuery = query(
          //   messagesRef,
          //   where("type", "==", "rentRequest")
          // );

          // const rentRequestMessages = await getDocs(rentRequestQuery);

          // if (!rentRequestMessages.empty) {
          //   const messagesBatch = writeBatch(db);

          //   rentRequestMessages.forEach((msgDoc) => {
          //     messagesBatch.update(msgDoc.ref, {
          //       itemName: updatedItemData.itemName,
          //       itemPrice: updatedItemData.itemPrice,
          //       itemCondition: updatedItemData.itemCondition,
          //       itemDesc: updatedItemData.itemDesc,
          //       itemMinRentDuration: updatedItemData.itemMinRentDuration,
          //       updatedAt: serverTimestamp(),
          //     });
          //   });

          //   await messagesBatch.commit();
          // }

          // 5. Send notification to the renter
          if (requesterId !== ownerId) {
            await createInAppNotification(requesterId, {
              type: "ITEM_UPDATED",
              title: "Item Updated",
              message: `${updatedItemData.itemName} details have been updated by the owner`,
              data: {
                route: "/chat",
                params: { id: chatId },
              },
            });
          }

          console.log(`Successfully updated chat: ${chatId}`);
        } catch (error) {
          console.error(`Error updating chat ${chatId}:`, error);
        }
      });

      await Promise.allSettled(chatUpdatePromises);
      console.log("All related chats processed");
    } catch (error) {
      console.error("Error updating related chats:", error);
    }
  };

  const updateRelatedRentRequests = async (
    itemId: string,
    updatedItemData: any
  ) => {
    try {
      // Query all pending rent requests for this item
      const rentRequestsQuery = query(
        collection(db, "rentRequests"),
        where("itemId", "==", itemId),
        where("status", "==", "pending")
      );

      const rentRequestsSnapshot = await getDocs(rentRequestsQuery);

      if (rentRequestsSnapshot.empty) {
        console.log("No pending rent requests found for this item");
        return;
      }

      const batch = writeBatch(db);

      rentRequestsSnapshot.forEach((requestDoc) => {
        const requestData = requestDoc.data();

        const rentalDays = requestData.rentalDays ?? 0;
        const oldPrice = requestData.itemDetails?.price ?? 0;
        const newPrice = updatedItemData.itemPrice;
        const totalPrice = rentalDays * newPrice;
        const requesterId = requestData.requesterId;
        const ownerId = requestData.ownerId;

        batch.update(requestDoc.ref, {
          itemName: updatedItemData.itemName,
          itemPrice: updatedItemData.itemPrice,
          itemCategory: updatedItemData.itemCategory,
          totalPrice: totalPrice,
          itemCondition: updatedItemData.itemCondition,
          itemDesc: updatedItemData.itemDesc,
          itemMinRentDuration: updatedItemData.itemMinRentDuration,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      console.log("All related rent requests updated");
    } catch (error) {
      console.error("Error updating related rent requests:", error);
    }
  };

  // Basic field comparisons
  type FormData = {
    title: string;
    category: string;
    description: string;
    price: number;
    minimumDays: number;
    condition: string;
    enableAI: boolean;
    enableDownpayment: boolean;
    downpaymentPercentage?: number;
    images: string[];
  };

  // function detectFieldChanges(
  //   currentData: FormData,
  //   initialData: FormData,
  //   originalData: { firstImage: string }
  // ) {
  //   const changes: Record<string, any> = {};

  //   // 🔑 Mappings between form field names and Firebase keys
  //   const fieldMappings: Record<
  //     keyof Omit<
  //       FormData,
  //       "images" | "enableDownpayment" | "downpaymentPercentage"
  //     >,
  //     string
  //   > = {
  //     title: "itemName",
  //     category: "itemCategory",
  //     description: "itemDesc",
  //     price: "itemPrice",
  //     minimumDays: "itemMinRentDuration",
  //     condition: "itemCondition",
  //     enableAI: "enableAI",
  //   };

  //   // 🔄 Compare mapped fields
  //   (Object.keys(fieldMappings) as Array<keyof typeof fieldMappings>).forEach(
  //     (formKey) => {
  //       const firebaseKey = fieldMappings[formKey];
  //       const currentValue =
  //         formKey === "price" || formKey === "minimumDays"
  //           ? Number(currentData[formKey])
  //           : currentData[formKey];
  //       const initialValue =
  //         formKey === "price" || formKey === "minimumDays"
  //           ? Number(initialData[formKey])
  //           : initialData[formKey];

  //       if (currentValue !== initialValue) {
  //         changes[firebaseKey] = currentValue;
  //       }
  //     }
  //   );

  //   // 💰 Handle downpayment
  //   if (currentData.enableDownpayment !== initialData.enableDownpayment) {
  //     changes.downpaymentPercentage = currentData.enableDownpayment
  //       ? Number(currentData.downpaymentPercentage)
  //       : null;
  //   } else if (
  //     currentData.enableDownpayment &&
  //     Number(currentData.downpaymentPercentage) !==
  //       Number(initialData.downpaymentPercentage)
  //   ) {
  //     changes.downpaymentPercentage = Number(currentData.downpaymentPercentage);
  //   }

  //   const currentImages = currentData.enableAI
  //     ? [originalData.firstImage, ...currentData.images.slice(1)]
  //     : currentData.images;

  //   if (JSON.stringify(currentImages) !== JSON.stringify(initialData.images)) {
  //     changes.images = currentImages;
  //   }

  //   return {
  //     hasChanges: Object.keys(changes).length > 0,
  //     changes,
  //     changedFields: Object.keys(changes),
  //   };
  // }

  const handleUpdate = async () => {
    if (!validateForm()) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Validation Error",
        textBody: "Please check all required fields",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const docRef = doc(db, "items", id as string);

      // Build update object with only changed fields
      const updateData: any = {};
      let hasActualChanges = false;

      // Check each field for changes and add only modified ones
      if (formData.title !== initialFormData?.title) {
        updateData.itemName = formData.title;
        hasActualChanges = true;
      }

      if (formData.category !== initialFormData?.category) {
        updateData.itemCategory = formData.category;
        hasActualChanges = true;
      }

      if (formData.description !== initialFormData?.description) {
        updateData.itemDesc = formData.description;
        hasActualChanges = true;
      }

      if (Number(formData.price) !== Number(initialFormData?.price)) {
        updateData.itemPrice = Number(formData.price);
        hasActualChanges = true;
      }

      if (
        Number(formData.minimumDays) !== Number(initialFormData?.minimumDays)
      ) {
        updateData.itemMinRentDuration = Number(formData.minimumDays);
        hasActualChanges = true;
      }

      if (formData.condition !== initialFormData?.condition) {
        updateData.itemCondition = formData.condition;
        hasActualChanges = true;
      }

      if (formData.enableAI !== initialFormData?.enableAI) {
        updateData.enableAI = formData.enableAI;
        hasActualChanges = true;
      }

      // Handle downpayment changes
      if (formData.enableDownpayment !== initialFormData?.enableDownpayment) {
        if (formData.enableDownpayment) {
          updateData.downpaymentPercentage = Number(
            formData.downpaymentPercentage
          );
        } else {
          updateData.downpaymentPercentage = null;
        }
        hasActualChanges = true;
      } else if (
        formData.enableDownpayment &&
        Number(formData.downpaymentPercentage) !==
          Number(initialFormData?.downpaymentPercentage)
      ) {
        updateData.downpaymentPercentage = Number(
          formData.downpaymentPercentage
        );
        hasActualChanges = true;
      }

      // Handle images - this is more complex due to uploads
      const currentImages = formData.enableAI
        ? [originalData.firstImage, ...formData.images.slice(1)]
        : formData.images;

      if (
        JSON.stringify(currentImages) !==
        JSON.stringify(initialFormData?.images)
      ) {
        updateData.images = currentImages;
        hasActualChanges = true;
      }

      // If no changes detected, don't proceed
      if (!hasActualChanges) {
        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "No Changes",
          textBody: "No changes detected to update",
        });
        setIsSubmitting(false);
        return;
      }

      // Always add updatedAt timestamp for any update
      updateData.updatedAt = serverTimestamp();

      // Perform the update with only changed fields
      await updateDoc(docRef, updateData);

      // Create full data object for related updates (chats/requests need complete data)
      const completeUpdatedData = {
        itemName: formData.title,
        itemCategory: formData.category,
        itemDesc: formData.description,
        itemPrice: Number(formData.price),
        itemMinRentDuration: Number(formData.minimumDays),
        itemCondition: formData.condition,
        enableAI: formData.enableAI,
        ...(formData.enableDownpayment
          ? { downpaymentPercentage: Number(formData.downpaymentPercentage) }
          : { downpaymentPercentage: null }),
        images: currentImages,
      };

      // Update related chats and requests with complete data
      await Promise.all([
        updateRelatedChats(id as string, completeUpdatedData),
        updateRelatedRentRequests(id as string, completeUpdatedData),
      ]);

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Listing updated successfully",
      });

      // Update initial form data to reflect the changes
      setInitialFormData({ ...formData });
      setHasChanges(false);

      router.back();
    } catch (error) {
      console.error("Error updating listing:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to update listing",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCamera = async () => {
    // Check image limit first
    if (formData.images.length >= 5) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Limit Reached",
        textBody: "You can only add up to 5 images",
      });
      return;
    }

    // Check and request camera permissions
    if (!permission) {
      // Still loading permissions
      return;
    }

    if (!permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Permission Required",
          textBody: "Camera permission is required to take photos",
        });
        return;
      }
    }

    setShowCamera(true);
  };

  const captureImage = async () => {
    if (!cameraRef.current) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Camera Error",
        textBody: "Camera not ready. Please try again.",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        const newIndex = formData.images.length;
        const imageKey = `${newIndex}-${photo.uri}`;

        // 1. Add local image to form data immediately (will be replaced after upload)
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, photo.uri], // Local URI initially
        }));

        // 2. Set initial state as local
        setImageStates((prev) =>
          new Map(prev).set(imageKey, {
            status: "local",
            uri: photo.uri,
          })
        );

        // 3. Close camera immediately
        setShowCamera(false);
        setIsSubmitting(false);

        // 4. Start upload process in background (this will replace the local URI)
        setTimeout(() => uploadImageInBackground(photo.uri, newIndex), 100);
      }
    } catch (error) {
      console.error("Camera capture error:", error);
      setIsSubmitting(false);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Camera Error",
        textBody: "Failed to capture image. Please try again.",
      });
    }
  };
  const uploadImageInBackground = async (
    localUri: string,
    imageIndex: number
  ) => {
    const imageKey = `${imageIndex}-${localUri}`;

    try {
      // 1. Update status to uploading
      setImageStates((prev) =>
        new Map(prev).set(imageKey, {
          status: "uploading",
          uri: localUri,
        })
      );

      // 2. Perform upload to Firebase
      const uploadedUrl = await uploadImage(localUri);

      // 3. CRITICAL: Update form data with Firebase URL
      setFormData((prev) => ({
        ...prev,
        images: prev.images.map(
          (img, idx) => (idx === imageIndex ? uploadedUrl : img) // Replace local URI with Firebase URL
        ),
      }));

      // 4. Update image states - use Firebase URL as new key
      setImageStates((prev) => {
        const newMap = new Map(prev);
        // Remove the old local URI key
        newMap.delete(imageKey);
        // Add new Firebase URL key
        newMap.set(`${imageIndex}-${uploadedUrl}`, {
          status: "uploaded",
          uri: uploadedUrl,
        });
        return newMap;
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Background upload error:", error);

      // Keep local URI but mark as failed
      setImageStates((prev) =>
        new Map(prev).set(imageKey, {
          status: "failed",
          uri: localUri,
        })
      );

      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Upload Failed",
        textBody: "Image upload failed. Tap to retry or remove the image.",
      });
    }
  };

  const removeImage = (index: number) => {
    const uri = formData.images[index];
    const imageStatus = getImageStatus(uri, index);

    // Don't allow removal while uploading
    if (imageStatus.status === "uploading") {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Please Wait",
        textBody: "Image is still uploading. Please wait before removing.",
      });
      return;
    }

    // Prevent removal of first image if AI is enabled
    if (formData.enableAI && index === 0) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Cannot Remove",
        textBody: "The first image cannot be removed for AI-identified items",
      });
      return;
    }

    Alert.alert("Remove Image", "Are you sure you want to remove this image?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          // Remove from form data
          setFormData((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
          }));

          // Clean up image states
          setImageStates((prev) => {
            const newMap = new Map();
            prev.forEach((state, key) => {
              const [keyIndex] = key.split("-");
              const idx = parseInt(keyIndex);
              if (idx < index) {
                // Keep indices below removed index
                newMap.set(key, state);
              } else if (idx > index) {
                // Adjust indices above removed index
                const newKey = `${idx - 1}-${state.uri}`;
                newMap.set(newKey, state);
              }
              // Skip the removed index
            });
            return newMap;
          });

          // Toast.show({
          //   type: ALERT_TYPE.SUCCESS,
          //   title: "Success",
          //   textBody: "Image removed successfully",
          // });
        },
      },
    ]);
  };

  const uploadImage = async (uri: string) => {
    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error("Failed to fetch image");
      }

      const blob = await response.blob();
      const timestamp = Date.now();
      const imageRef = ref(storage, `items/${id}/image_${timestamp}.jpg`);

      const uploadResult = await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      return downloadURL;
    } catch (error) {
      console.error("Upload error:", error);
      throw new Error("Failed to upload image");
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#5C6EF6" />
      </View>
    );
  }

  const isLocalImage = (uri: string) => {
    if (!uri) return false;

    const localPatterns = [
      "file://",
      "ph://", // iOS Photos
      "content://", // Android
      "data:image/", // Base64
      "/data/user/", // Android local
      "/storage/", // Android storage
    ];

    const isLocal =
      localPatterns.some((pattern) => uri.startsWith(pattern)) ||
      (!uri.startsWith("https://") && !uri.startsWith("http://"));

    return isLocal;
  };

  const getImageStatus = (uri: string, index: number) => {
    // Try to find status with current URI
    const currentKey = `${index}-${uri}`;
    const currentStatus = imageStates.get(currentKey);

    if (currentStatus) {
      return currentStatus;
    }

    // If not found, check if this is a Firebase URL (uploaded)
    if (uri.startsWith("https://firebasestorage.googleapis.com")) {
      return {
        status: "uploaded" as const,
        uri,
      };
    }

    // If it's a local image without status, mark as local
    if (isLocalImage(uri)) {
      return {
        status: "local" as const,
        uri,
      };
    }

    // Default to uploaded for any other case
    return {
      status: "uploaded" as const,
      uri,
    };
  };

  return (
    <>
      <SafeAreaView
        className="flex-1 bg-white"
        style={{ paddingTop: insets.top }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
          <TouchableOpacity
            onPress={() => router.back()}
            className="items-center justify-center"
          >
            <Image
              source={icons.leftArrow}
              className="w-8 h-8"
              tintColor="#6B7280"
            />
          </TouchableOpacity>
          <View className="flex-1 items-center">
            <Text className="text-xl font-pbold text-gray-800">Edit Item</Text>
          </View>
          <View className="w-8" />
        </View>

        <ScrollView className="p-5 gap-5 ">
          {/* Form Content */}
          <View
            className="space-y-4"
            style={{ paddingBottom: insets.bottom + 40 }}
          >
            {/* Images Section */}
            <View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-secondary-400 font-pmedium">
                  Images ({formData.images.length}/5)
                </Text>
                <View className="flex-row items-center">
                  {/* {formData.images.some(isLocalImage) && (
                    <Text className="text-xs text-blue-600 mr-2">
                      • Unsaved changes
                    </Text>
                  )} */}
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {formData.images.map((uri, index) => {
                  const imageStatus = getImageStatus(uri, index);
                  const isUploading = imageStatus.status === "uploading";
                  const isFailed = imageStatus.status === "failed";
                  const isLocal = imageStatus.status === "local";

                  return (
                    <View
                      key={`${index}-${uri}`}
                      className="relative w-24 h-24 mr-2"
                    >
                      {/* Main Image - Using Expo Image with built-in loading states */}
                      <ExpoImage
                        source={{ uri }}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: 12,
                          backgroundColor: "#f3f4f6", // gray-200 equivalent
                        }}
                        contentFit="cover"
                        transition={200} // Smooth transition
                        placeholder="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e5e7eb'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='14' font-family='system-ui'%3ELoading...%3C/text%3E%3C/svg%3E"
                        cachePolicy="memory-disk" // Better caching
                      />

                      {/* Upload Status Overlays */}
                      {isUploading && (
                        <View className="absolute inset-0 bg-black/50 rounded-xl items-center justify-center">
                          <ActivityIndicator size="small" color="white" />
                          <Text className="text-white text-xs font-pmedium mt-1">
                            Uploading...
                          </Text>
                        </View>
                      )}

                      {/* Processing Status for Local Images */}
                      {isLocal && !isUploading && (
                        <View className="absolute inset-0 bg-blue-500/80 rounded-xl items-center justify-center">
                          <ActivityIndicator size="small" color="white" />
                          <Text className="text-white text-xs font-pmedium mt-1">
                            Processing...
                          </Text>
                        </View>
                      )}

                      {/* Failed Upload Overlay */}
                      {isFailed && (
                        <TouchableOpacity
                          onPress={() => uploadImageInBackground(uri, index)}
                          className="absolute inset-0 bg-red-500/80 rounded-xl items-center justify-center"
                        >
                          <Image
                            source={icons.refresh}
                            className="w-4 h-4 mb-1"
                            tintColor="white"
                          />
                          <Text className="text-white text-xs font-pmedium">
                            Retry
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Status Badges - Keep existing commented code as requested */}
                      {/* {isLocal && !isUploading && (
        <View className="absolute top-1 left-1 bg-blue-500 rounded px-1 py-0.5">
          <Text className="text-white text-xs font-pmedium">
            NEW
          </Text>
        </View>
      )} */}

                      {/* AI badge for first image */}
                      {formData.enableAI &&
                        index === 0 &&
                        !isLocal &&
                        !isUploading && (
                          <Image
                            source={icons.aiImage}
                            className="w-5 h-5 absolute bottom-2 left-2"
                            tintColor="white"
                          />
                        )}

                      {/* Remove button */}
                      <TouchableOpacity
                        onPress={() => removeImage(index)}
                        disabled={isUploading || isLocal}
                        className={`absolute top-1 right-1 rounded-full p-1 ${
                          isUploading || isLocal
                            ? "bg-gray-400"
                            : formData.enableAI && index === 0
                            ? "bg-gray-400"
                            : isFailed
                            ? "bg-red-600"
                            : "bg-red-500"
                        }`}
                      >
                        <Image
                          source={icons.close}
                          className="w-4 h-4"
                          tintColor="white"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                {/* Add photo button */}
                {formData.images.length < 5 && (
                  <TouchableOpacity
                    onPress={openCamera}
                    className="w-24 h-24 bg-gray-100 rounded-xl items-center justify-center border-2 border-dashed border-gray-300"
                  >
                    <Image
                      source={icons.camera}
                      className="w-6 h-6"
                      tintColor="#666"
                    />
                    <Text className="text-xs mt-1 text-gray-600">
                      Add Photo
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              {errors.images ? (
                <Text className="text-red-500 text-xs mt-2">
                  {errors.images}
                </Text>
              ) : null}
            </View>

            {/* Title Input with Real-time Validation */}
            <View className="mt-2">
              <Text className="text-secondary-400 text-lg font-pmedium mb-2">
                Item Name
              </Text>
              <TextInput
                value={formData.title}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, title: text }));
                  // Real-time similarity check
                  checkTitleSimilarityRealTime(text);
                }}
                placeholder="Enter item name"
                className={`border font-pregular text-base rounded-xl p-3 ${
                  formData.enableAI && !titleValidation.isValid
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200"
                }`}
              />

              {/* Show similarity warning if AI is enabled and title is invalid */}
              {formData.enableAI && !titleValidation.isValid && (
                <View className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <View className="flex-row items-start">
                    <View className="flex-1">
                      <Text className="text-orange-700 font-pmedium text-sm">
                        Title Similarity Warning
                      </Text>
                      <Text className="text-orange-600 font-pregular text-xs mt-1">
                        {titleValidation.message}
                      </Text>
                      {/* <Text className="text-orange-500 font-pregular text-xs mt-1">
                      Original: "{originalData.title}"
                    </Text>
                    <Text className="text-orange-500 font-pregular text-xs">
                      Similarity: {Math.round(titleValidation.similarity * 100)}
                      %
                    </Text> */}
                    </View>
                  </View>

                  {/* Quick action buttons */}
                  <View className="flex-row gap-2 mt-3">
                    <TouchableOpacity
                      onPress={() => {
                        setFormData((prev) => ({
                          ...prev,
                          title: originalData.title,
                        }));
                        setTitleValidation({
                          isValid: true,
                          message: "",
                          similarity: 1,
                        });
                      }}
                      className="flex-1 bg-orange-100 rounded-lg py-2"
                    >
                      <Text className="text-orange-700 font-pmedium text-center text-base">
                        Use Original
                      </Text>
                    </TouchableOpacity>
                    {titleValidation.similarity > 0.3 ? (
                      <TouchableOpacity
                        onPress={() => {
                          setTitleValidation({
                            isValid: true,
                            message: "",
                            similarity: titleValidation.similarity,
                          });
                        }}
                        className="flex-1 bg-white border border-gray-200 rounded-lg py-2"
                      >
                        <Text className="text-gray-700 font-pmedium text-center text-base">
                          Keep Current
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Similarity meter */}
              {formData.enableAI && (
                <SimilarityMeter
                  similarity={titleValidation.similarity}
                  isVisible={formData.title.length > 3}
                />
              )}

              {/* Regular validation error */}
              {errors.title ? (
                <Text className="text-red-500 text-xs mt-1">
                  {errors.title}
                </Text>
              ) : null}
            </View>

            {/* Category Selection */}
            <View className="mt-2">
              <Text className="text-secondary-400 text-lg font-pmedium mb-2 ">
                Category
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (formData.enableAI) {
                    Toast.show({
                      type: ALERT_TYPE.INFO,
                      title: "Category Locked",
                      textBody:
                        "Category cannot be changed for AI-identified items",
                    });
                    return;
                  }
                  setShowCategoryDropdown(true);
                }}
                className={`border border-gray-200 rounded-xl p-3 ${
                  formData.enableAI ? "bg-gray-100" : ""
                }`}
              >
                <Text
                  className={`font-pregular text-base ${
                    formData.enableAI ? "text-gray-400" : ""
                  }`}
                >
                  {formData.category || "Select category"}
                </Text>
              </TouchableOpacity>

              {errors.category ? (
                <Text className="text-red-500 text-xs mt-1">
                  {errors.category}
                </Text>
              ) : null}
            </View>

            <View className="flex-row justify-between gap-4 mt-2">
              <View className="flex-1">
                <Text className="text-secondary-400 text-lg font-pmedium  mb-2">
                  Price per Day
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl">
                  <Text className="rounded-xl p-3 pr-0 font-pregular text-base">
                    ₱
                  </Text>
                  <TextInput
                    value={formData.price}
                    onChangeText={(text) => {
                      const numValue = parseFloat(text);
                      if (text === "" || (numValue > 0 && !isNaN(numValue))) {
                        setFormData((prev) => ({ ...prev, price: text }));
                      }
                    }}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    className="flex-1 p-3 font-pregular text-base"
                  />
                </View>
                {errors.price ? (
                  <Text className="text-red-500 text-xs mt-1">
                    {errors.price}
                  </Text>
                ) : null}
              </View>

              <View className="flex-1">
                <Text className="text-secondary-400 text-lg font-pmedium  mb-2">
                  Min. Rental Days
                </Text>
                <TextInput
                  value={formData.minimumDays}
                  onChangeText={(text) => {
                    const numValue = parseInt(text);
                    if (text === "" || (numValue > 0 && !isNaN(numValue))) {
                      setFormData((prev) => ({ ...prev, minimumDays: text }));
                    }
                  }}
                  placeholder="Enter days"
                  keyboardType="number-pad"
                  className="border border-gray-200 rounded-xl p-3"
                />
                {errors.minimumDays ? (
                  <Text className="text-red-500 text-xs mt-1">
                    {errors.minimumDays}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Condition Selection */}
            <View className="my-2">
              <Text className="text-secondary-400 font-pmedium text-lg">
                Item Condition
              </Text>
              <TouchableOpacity
                onPress={() => setShowConditionDropdown(true)}
                className="border border-gray-200 rounded-xl p-3"
              >
                <Text>{formData.condition || "Select condition"}</Text>
              </TouchableOpacity>
              {errors.condition ? (
                <Text className="text-red-500 text-xs mt-1">
                  {errors.condition}
                </Text>
              ) : null}
            </View>

            {/* Description Input */}
            <View className="my-2">
              <Text className="text-secondary-400 text-lg font-pmedium ">
                Description
              </Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) =>
                  setFormData((prev) => ({ ...prev, description: text }))
                }
                placeholder="Describe your item (min. 20 characters)"
                multiline
                numberOfLines={4}
                className="border border-gray-200 rounded-xl p-3 h-32 text-base"
                textAlignVertical="top"
              />
              {errors.description ? (
                <Text className="text-red-500 text-xs mt-1">
                  {errors.description}
                </Text>
              ) : null}
            </View>

            {/* Add Payment Settings Section */}
            <View className="my-2">
              <Text className="text-secondary-400 text-lg font-pmedium ">
                Payment Options
              </Text>

              <View className="bg-gray-50 rounded-xl p-4 ">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-secondary-400 font-pmedium">
                      Downpayment Requirement
                    </Text>
                    <Text className="text-secondary-300 font-pregular text-xs">
                      Secures rental and must be paid at pickup
                    </Text>
                  </View>
                  <Switch
                    value={formData.enableDownpayment}
                    onValueChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        enableDownpayment: value,
                        downpaymentPercentage: value
                          ? prev.downpaymentPercentage || "30"
                          : "",
                      }));
                    }}
                    trackColor={{ false: "#767577", true: "#5C6EF6" }}
                    thumbColor={
                      formData.enableDownpayment ? "#ffffff" : "#f4f3f4"
                    }
                  />
                </View>

                {formData.enableDownpayment && (
                  <View>
                    {/* Percentage Input */}

                    {/* Quick Select Buttons */}
                    <View className="flex-row gap-2">
                      {["10", "20", "30", "40", "50"].map((percentage) => (
                        <TouchableOpacity
                          key={percentage}
                          onPress={() => {
                            setFormData((prev) => ({
                              ...prev,
                              downpaymentPercentage: percentage,
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg border ${
                            formData.downpaymentPercentage === percentage
                              ? "bg-primary border-primary"
                              : "bg-white border-gray-300"
                          }`}
                        >
                          <Text
                            className={`font-pmedium ${
                              formData.downpaymentPercentage === percentage
                                ? "text-white"
                                : "text-secondary-400"
                            }`}
                          >
                            {percentage}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Location Display - Static Map */}
            {formData.location &&
              formData.location.latitude &&
              formData.location.longitude && (
                <View className="my-2">
                  <View className="flex-row items-center ">
                    <Text className="text-secondary-400 font-pmedium">
                      Location
                    </Text>
                    <Text className="text-secondary-300 font-pregular text-xs ml-2">
                      (Pickup location cannot be changed)
                    </Text>
                  </View>

                  {/* Static Map Container */}
                  <View className="relative">
                    <View className="h-48 rounded-s-xloverflow-hidden border border-gray-200">
                      <MapView
                        style={{ flex: 1 }}
                        rotateEnabled={false}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        attributionEnabled={false}
                        compassViewPosition={3}
                        mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAP_TILER_API_KEY}`}
                      >
                        <Camera
                          defaultSettings={{
                            centerCoordinate: [
                              formData.location.longitude,
                              formData.location.latitude,
                            ],
                            zoomLevel: 15,
                          }}
                        />

                        {/* Radius circle if available */}
                        {formData.location.radius && (
                          <ShapeSource
                            id="pickup-radius"
                            shape={createCirclePolygon(
                              [
                                formData.location.longitude,
                                formData.location.latitude,
                              ],
                              formData.location.radius
                            )}
                          >
                            <FillLayer
                              id="pickup-radius-fill"
                              style={{
                                fillColor: "rgba(33, 150, 243, 0.15)",
                                fillOutlineColor: "#2196F3",
                              }}
                            />
                          </ShapeSource>
                        )}

                        {/* Location marker */}
                        <MarkerView
                          coordinate={[
                            formData.location.longitude,
                            formData.location.latitude,
                          ]}
                          anchor={{ x: 0.5, y: 1 }}
                        >
                          <View>
                            <Image
                              source={require("@/assets/images/marker-home.png")}
                              style={{ width: 32, height: 40 }}
                              resizeMode="contain"
                            />
                          </View>
                        </MarkerView>
                      </MapView>
                    </View>

                    {/* Location Info Card */}
                    <View className="p-3 bg-gray-100 rounded-b-xl">
                      <Text className="text-secondary-400 font-pmedium text-sm">
                        {formData.location.address}
                      </Text>
                      {formData.location.radius && (
                        <Text className="text-gray-500 text-xs mt-1">
                          Pickup radius:{" "}
                          {formData.location.radius >= 1000
                            ? `${formData.location.radius / 1000}km`
                            : `${formData.location.radius}m`}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

            {/* Update Button */}
          </View>
        </ScrollView>

        <View className="p-4">
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={isSubmitting || !hasChanges}
            className={`w-full py-4 rounded-xl items-center justify-center ${
              isSubmitting
                ? "bg-gray-400"
                : !hasChanges
                ? "bg-gray-300"
                : "bg-primary"
            }`}
            style={{
              opacity: isSubmitting || !hasChanges ? 0.6 : 1,
            }}
          >
            <Text
              className={`text-lg font-psemibold ${
                !hasChanges ? "text-gray-500" : "text-white"
              }`}
            >
              {isSubmitting
                ? "Updating..."
                : !hasChanges
                ? "No changes detected"
                : "Update Listing"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Dropdown Modal */}
        <Modal
          visible={showCategoryDropdown}
          animationType="fade"
          transparent={true}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-5">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-psemibold">Select Category</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryDropdown(false)}
                >
                  <Image source={icons.close} className="w-6 h-6" />
                </TouchableOpacity>
              </View>
              <ScrollView className="max-h-96">
                {TOOL_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    onPress={() => {
                      setFormData((prev) => ({ ...prev, category }));
                      setShowCategoryDropdown(false);
                    }}
                    className={`py-3 border-b border-gray-100 flex-row justify-between items-center ${
                      formData.category === category ? "bg-primary/5" : ""
                    }`}
                  >
                    <Text
                      className={`text-base ${
                        formData.category === category
                          ? "text-primary font-psemibold"
                          : ""
                      }`}
                    >
                      {category}
                    </Text>
                    {formData.category === category && (
                      <Image
                        source={icons.singleCheck}
                        className="w-5 h-5 mr-5"
                        tintColor="#5C6EF6"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Condition Dropdown Modal */}
        <Modal
          visible={showConditionDropdown}
          animationType="slide"
          transparent={true}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-5">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-psemibold">Select Condition</Text>
                <TouchableOpacity
                  onPress={() => setShowConditionDropdown(false)}
                >
                  <Image source={icons.close} className="w-6 h-6" />
                </TouchableOpacity>
              </View>
              <ScrollView className="max-h-96">
                {ITEM_CONDITIONS.map((condition) => (
                  <TouchableOpacity
                    key={condition.value}
                    onPress={() => {
                      setFormData((prev) => ({
                        ...prev,
                        condition: condition.value,
                      }));
                      setShowConditionDropdown(false);
                    }}
                    className={`py-3 border-b border-gray-100 ${
                      formData.condition === condition.value
                        ? "bg-primary/5"
                        : ""
                    }`}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <Text
                          className={`text-base ${
                            formData.condition === condition.value
                              ? "text-primary font-psemibold"
                              : "font-pmedium"
                          }`}
                        >
                          {condition.value}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-1">
                          {condition.details}
                        </Text>
                      </View>
                      {formData.condition === condition.value && (
                        <Image
                          source={icons.singleCheck}
                          className="w-5 h-5 mr-5"
                          tintColor="#5C6EF6"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={StyleSheet.absoluteFillObject}>
          {permission?.granted ? (
            <CameraView
              ref={cameraRef}
              facing={facing}
              style={StyleSheet.absoluteFillObject}
              mode="picture"
            >
              {/* Header with close and flip camera buttons */}
              <View
                className="absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-4 py-2"
                style={{
                  paddingTop: insets.top + 10,
                }}
              >
                <TouchableOpacity
                  onPress={() => setShowCamera(false)}
                  className="bg-black/60 p-3 rounded-full"
                >
                  <Image
                    source={icons.close}
                    className="w-6 h-6"
                    tintColor="white"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setFacing(facing === "back" ? "front" : "back")
                  }
                  className="bg-black/60 p-3 rounded-full"
                >
                  <Image
                    source={icons.refresh} // or use a flip camera icon
                    className="w-6 h-6"
                    tintColor="white"
                  />
                </TouchableOpacity>
              </View>

              {/* Capture button */}
              <View
                className="absolute bottom-0 left-0 right-0 flex-row justify-center items-center pb-10"
                style={{
                  paddingBottom: insets.bottom + 30,
                }}
              >
                <TouchableOpacity
                  onPress={captureImage}
                  disabled={isSubmitting}
                  className="items-center justify-center"
                >
                  <View
                    className={`w-20 h-20 rounded-full ${
                      isSubmitting ? "bg-gray-400" : "bg-white"
                    } items-center justify-center`}
                  >
                    <View className="w-16 h-16 rounded-full border-4 border-primary" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Loading overlay */}
              {isSubmitting && (
                <View className="absolute inset-0 bg-black/30 items-center justify-center">
                  <View className="bg-white/0 rounded-lg p-4 items-center">
                    <LottieView
                      source={require("../../assets/lottie/RR.json")}
                      autoPlay
                      loop
                      style={{ width: 100, height: 100 }}
                    />
                    <Text className="text-white mt-2">Uploading image...</Text>
                  </View>
                </View>
              )}
            </CameraView>
          ) : (
            <View className="flex-1 items-center justify-center bg-black">
              <Text className="text-white text-center mb-4">
                Camera permission required
              </Text>
              <TouchableOpacity
                onPress={requestPermission}
                className="bg-primary px-6 py-3 rounded-lg"
              >
                <Text className="text-white font-pmedium">
                  Grant Permission
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};

export default EditListing;
