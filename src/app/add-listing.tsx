import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Image,
  Text,
  Alert,
  TextInput,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
  Dimensions,
  Modal,
  StyleSheet,
  Switch,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import LargeButton from "../components/LargeButton";
import { router, useLocalSearchParams } from "expo-router";
import { icons, images } from "@/constant";
import { SafeAreaView } from "react-native-safe-area-context";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { getToolCategory, TOOL_CATEGORIES } from "@/constant/tool-categories";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import { API__URL } from "@/constant/api";
import { useLoader } from "@/context/LoaderContext";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { checkAndUpdateLimits } from "@/utils/planLimits";

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "transparent",
    flexDirection: "row",
    margin: 20,
    position: "absolute",
    bottom: 10,
    justifyContent: "center",
    width: "90%",
    alignSelf: "center",
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: "white",
    alignSelf: "center",
    backgroundColor: "rgba(140, 140, 140, 0.3)",
  },
});

const API_URL = API__URL; // Update with your API URL

const AddListing = () => {
  const { openCamera: openCameraParam } = useLocalSearchParams();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [classification, setClassification] = useState([]);
  const [error, setError] = useState<string | null>(null);
  const { isLoading, setIsLoading } = useLoader();
  const [showCamera, setShowCamera] = useState(true);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [apiPrediction, setApiPrediction] = useState<any[] | null>(null);
  const inputRef = useRef<TextInput>(null);
  const cameraRef = useRef<CameraView>(null);
  const [useAI, setUseAI] = useState(true);
  const [userLocation, setUserLocation] = useState("");

  const [showManualModal, setShowManualModal] = useState(false);
  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PredictionItem | null>(null);
  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });

  useEffect(() => {
    if (openCameraParam === "true") {
      // Set timeout to ensure component is mounted
      setTimeout(() => {
        setCameraVisible(true);
      }, 100);
    }
  }, [openCameraParam]);

  const ITEM_CONDITIONS = [
    {
      value: "Brand New",
      details:
        "Rental item has never been used and is in its original packaging.",
    },
    {
      value: "Like New",
      details: "Barely used rental item with no visible signs of wear.",
    },
    {
      value: "Very Good",
      details:
        "Gently used rental item, fully functional with minimal cosmetic wear.",
    },
    {
      value: "Good",
      details: "Rental item shows normal signs of use but is fully functional.",
    },
    {
      value: "Fair",
      details:
        "Rental item has visible wear and tear but still functions as intended.",
    },
    {
      value: "Worn but Usable",
      details:
        "Rental item is heavily used and may have limitations, but is still usable.",
    },
  ];

  const [expanded, setExpanded] = useState(true);
  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);

    return () => {
      clearTimeout(focusTimeout);
      Keyboard.dismiss();
    };
  }, []);

  // Open camera to capture image
  const openCamera = async () => {
    if (isLoading) return;

    if (!permission) {
      return;
    }

    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Camera permission is required. Please grant it."
      );
      requestPermission();
      return;
    }

    setCameraVisible(true);
  };

  // Capture image and handle prediction
  const capturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
        });
        if (photo) {
          setCameraVisible(false);
          setImageUri(photo.uri);
        }
        setShowCamera(false);
      } catch (error) {
        console.error("Camera Error:", error);
        Alert.alert("Error", "Failed to capture image");
      }
    }
  };

  // Toggle camera facing direction
  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  // Predict image using API
  const predictImage = async (uri: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("image", {
        uri,
        name: "image.jpg",
        type: "image/jpeg",
      } as any);

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const result = await response.json();
      console.log("API Prediction:", result);

      if (Array.isArray(result)) {
        setApiPrediction(result);
      } else {
        setApiPrediction([result]);
      }

      return result;
    } catch (error) {
      console.error("API Error:", error);
      setError(
        "Image was not recognized. Please try again with a clearer image."
      );
      return null;
    }
  };

  // Classify image using local model
  const classifyImage = async () => {
    if (!imageUri) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Warning",
        textBody: "Please select an image first.",
      });
      return;
    }

    setIsLoading(true);
    setApiPrediction(null);

    try {
      const apiResult = await predictImage(imageUri);
      if (!apiResult) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody:
            "Failed to get prediction from API. Please try again later.",
        });
      }
    } catch (err) {
      console.error("Classification Error:", err);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to analyze image. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearImage = () => {
    setImageUri(null);
    setClassification([]);
    setShowCamera(true);
    handleBackToCamera();
  };

  const handleBackToCamera = () => {
    setApiPrediction(null);
    setShowCamera(true);
    setImageUri(null);
    setClassification([]);
  };

  const renderCameraView = () => (
    <View className="items-center justify-center border border-primary  bg-gray-100 rounded-xl h-64 w-full mb-4">
      <View className="flex-row justify-center space-x-4">
        <TouchableOpacity
          onPress={openCamera}
          className="items-center justify-center p-4"
        >
          <View className="bg-primary/10 w-16 h-16 rounded-full items-center justify-center mb-2">
            <Image
              source={images.logoSmall}
              className="w-8 h-8"
              resizeMode="contain"
            />
          </View>
          <Text className="text-secondary-400 text-sm text-center font-psemibold">
            Click Here to {"\n"} Take Photo (Use AI)
          </Text>
          <Text className="text-secondary-300 text-xs font-pregular text-center mt-1">
            Hold camera steady to capture clear images for better AI analysis
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  interface PredictionItem {
    label?: string;
    category?: string;
    probability?: number;
    "Predicted Item"?: string;
    Category?: string;
    Confidence?: string;
  }

  const renderResultItem = (item: PredictionItem, index: number) => {
    // Handle different result formats (API vs local model)
    const label = item.label || item["Predicted Item"] || "";
    const category = item.category || item["Category"] || "";
    const confidence = item.probability
      ? `${(item.probability * 100).toFixed(1)}%`
      : item["Confidence"] || "";

    const isProhibited = category?.toLowerCase() === "prohibited";
    const isUnknow = category?.toLowerCase() === "unknown";

    return (
      <TouchableOpacity
        key={index}
        className={`flex-row items-center justify-between bg-white p-4 rounded-xl mb-2 shadow-sm border ${
          isProhibited || isUnknow
            ? "border-red-200 bg-red-50"
            : "border-gray-100"
        }`}
        onPress={() => {
          if (isProhibited) {
            Toast.show({
              type: ALERT_TYPE.WARNING,
              title: "Prohibited Item",
              textBody: "This item is not allowed for listing on our platform.",
            });
            return;
          }

          // For accepted items, update the listing form and show modal
          setListingForm((prev) => ({
            ...prev,
            title: label,
            category: category,
          }));
          setSelectedItem(item.label ? item : { ...item, label, category });

          setShowManualModal(true);
        }}
      >
        <View className="flex-row items-center flex-1">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              isProhibited ? "bg-red-200" : "bg-primary/10"
            }`}
          >
            <Text
              className={`font-psemibold ${
                isProhibited ? "text-red-600" : "text-primary"
              }`}
            >
              {index + 1}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className={`text-lg font-psemibold ${
                isProhibited ? "text-red-600" : "text-secondary-400"
              }`}
            >
              {label}
            </Text>
            {category ? (
              <Text
                className={`text-sm font-pregular ${
                  isProhibited ? "text-red-500" : "text-secondary-300"
                }`}
              >
                {category}
              </Text>
            ) : null}
          </View>
        </View>
        <Text
          className={`font-pregular ml-2 ${
            isProhibited ? "text-red-500" : "text-secondary-300"
          }`}
        >
          {confidence}
        </Text>
      </TouchableOpacity>
    );
  };

  interface ManualListingModalProps {
    visible: boolean;
    onClose: () => void;
    initialData: PredictionItem | null;
  }

  const ManualListingModal = ({
    visible,
    onClose,
    initialData,
  }: ManualListingModalProps) => {
    const [formData, setFormData] = useState({
      title: initialData?.label || "",
      category: getToolCategory(initialData?.label?.toString() ?? "") || "",
      description: "",
      price: "",
      minimumDays: "",
      condition: "",
      location: userLocation || "",
      owner: { id: "", fullname: "" },
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

    const [isSubmitting, setIsSubmitting] = useState(false); // Add at the top of ManualListingModal

    // Add validation function
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

      // Title validation
      if (!formData.title.trim()) {
        newErrors.title = "Item name is required";
        isValid = false;
      }

      // Category validation
      if (!formData.category) {
        newErrors.category = "Category is required";
        isValid = false;
      }

      // Price validation
      if (!formData.price) {
        newErrors.price = "Rate is required";
        isValid = false;
      } else if (isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
        newErrors.price = "Please enter a valid price";
        isValid = false;
      }

      // Minimum days validation
      if (!formData.minimumDays) {
        newErrors.minimumDays = "Minimum rental duration is required";
        isValid = false;
      } else if (
        isNaN(Number(formData.minimumDays)) ||
        Number(formData.minimumDays) < 1
      ) {
        newErrors.minimumDays = "Minimum duration must be at least 1 day";
        isValid = false;
      }

      // Description validation
      if (!formData.description.trim()) {
        newErrors.description = "Description is required";
        isValid = false;
      } else if (formData.description.length < 20) {
        newErrors.description = "Description must be at least 20 characters";
        isValid = false;
      }

      // Condition validation
      if (!formData.condition) {
        newErrors.condition = "Item condition is required";
        isValid = false;
      }

      // Images validation
      if (images.length === 0) {
        newErrors.images = "At least one image is required";
        isValid = false;
      }

      setErrors(newErrors);
      return isValid;
    };
    const [images, setImages] = useState<string[]>([]);
    const [showCamera, setShowCamera] = useState(false);
    const cameraRef = useRef<CameraView | null>(null);
    const [permission] = useCameraPermissions();
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const currentUser = auth.currentUser; // Assuming you have AuthContext setup

    useEffect(() => {
      const fetchUserLocation = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;

          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().location?.address) {
            setFormData((prev) => ({
              ...prev,
              location: userDoc.data().location.address,
            }));
          }
        } catch (error) {
          console.error("Error fetching location:", error);
        }
      };

      fetchUserLocation();
    }, []);

    // Update image handlers
    const handleImageChange = (newImages: string[]) => {
      setImages(newImages);
      setErrors((prev) => ({
        ...prev,
        images: validateField("images", newImages),
      }));
    };

    // Add camera capture function
    const captureImage = async () => {
      if (!cameraRef.current) return;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1,
        });
        if (!photo) return;
        const newImages = [...images, photo.uri];
        handleImageChange(newImages);
        setShowCamera(false);
      } catch (error) {
        console.error("Camera Error:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to capture image",
        });
      }
    };

    // Add camera open function
    const openCamera = async () => {
      if (images.length >= 5) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Limit Reached",
          textBody: "You can only add up to 5 images",
        });
        return;
      }

      if (!permission?.granted) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Permission Required",
          textBody: "Camera permission is required to take photos",
        });
        return;
      }

      setShowCamera(true);
    };

    const pickImage = async () => {
      if (images.length >= 5) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Limit Reached",
          textBody: "You can only upload up to 5 images",
        });
        return;
      }

      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
          setImages((prev) => [...prev, result.assets[0].uri]);
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

    const removeImage = (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      handleImageChange(newImages);
    };

    // Add this before the return statement
    const handleSubmit = async () => {
      setIsLoading(true);
      if (!validateForm()) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Validation Error",
          textBody: "Please check all required fields",
        });
        setIsLoading(false);
        return;
      }

      try {
        const limitCheck = await checkAndUpdateLimits(
          auth.currentUser!.uid,
          "list"
        );

        if (!limitCheck.success) {
          Alert.alert("Limit Reached", limitCheck.message);
          setIsLoading(false);
          return;
        }

        setIsSubmitting(true); // Start loading

        if (!auth.currentUser?.uid) {
          throw new Error("User not authenticated");
        }
        const userRef = doc(db, "users", auth.currentUser.uid);
        const userDoc = await getDoc(userRef);

        let fullname = "Unknown User";
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const firstName = userData?.firstname || "";
          const middleName = userData?.middlename || "";
          const lastName = userData?.lastname || "";

          const nameParts = [];
          if (firstName) nameParts.push(firstName);
          if (middleName) nameParts.push(`${middleName.charAt(0)}.`);
          if (lastName) nameParts.push(lastName);

          fullname = nameParts.join(" ") || "Unknown User";
        }

        // Create the listing document
        const listingData = {
          itemName: formData.title,
          itemCategory: formData.category,
          itemDesc: formData.description,
          itemPrice: Number(formData.price),
          itemMinRentDuration: Number(formData.minimumDays),
          itemCondition: formData.condition,
          itemLocation: formData.location,
          owner: {
            id: auth.currentUser?.uid,
            fullname: fullname,
          },
          createdAt: serverTimestamp(),
          itemStatus: "Available",
        };

        // Show uploading toast
        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Uploading",
          textBody: "Creating your listing...",
        });

        // Add document to Firestore
        const docRef = await addDoc(collection(db, "items"), listingData);

        // Update toast for image upload
        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Uploading",
          textBody: "Uploading images...",
        });

        // Upload images and get URLs
        const imageUrls = await uploadImages(images, docRef.id);

        // Update document with image URLs
        await updateDoc(doc(db, "items", docRef.id), {
          images: imageUrls,
        });

        // Success toast
        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Success",
          textBody: "Item listed successfully",
        });

        // Close modal and navigate
        onClose();
        router.push("/(tabs)/tools");
      } catch (error) {
        console.error("Error creating listing:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to create listing. Please try again.",
        });
      } finally {
        setIsSubmitting(false); // End loading
        setIsLoading(false);
      }
    };

    const uploadImages = async (images: string[], itemId: string) => {
      const imageUrls = [];

      for (const [index, uri] of images.entries()) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const imageRef = ref(storage, `items/${itemId}/image${index + 1}.jpg`);

        await uploadBytes(imageRef, blob);
        const downloadUrl = await getDownloadURL(imageRef);
        imageUrls.push(downloadUrl);
      }

      return imageUrls;
    };

    const renderCameraModal = () => (
      <Modal visible={showCamera} animationType="slide">
        <View className="flex-1 bg-black">
          <CameraView ref={cameraRef} className="flex-1" style={{ flex: 1 }}>
            <View className="absolute top-0 left-0 right-0 z-20 pt-12 pb-4 px-4">
              <TouchableOpacity
                onPress={() => setShowCamera(false)}
                className="bg-black/60 p-3 rounded-full self-start"
              >
                <Image
                  source={icons.close}
                  className="w-6 h-6"
                  tintColor="white"
                />
              </TouchableOpacity>
            </View>

            <View className="absolute bottom-10 left-0 right-0">
              <TouchableOpacity
                onPress={captureImage}
                className="w-20 h-20 rounded-full bg-white self-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                }}
              >
                <View className="w-16 h-16 rounded-full border-4 border-primary bg-transparent m-2" />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>
    );

    // Add this function inside ManualListingModal
    const validateField = (name: string, value: any) => {
      switch (name) {
        case "title":
          return !value.trim() ? "Item name is required" : "";

        case "category":
          return !value ? "Category is required" : "";

        case "price":
          if (!value) return "Rate is required";
          if (isNaN(Number(value)) || Number(value) <= 0)
            return "Please enter a valid price";
          return "";

        case "minimumDays":
          if (!value) return "Minimum rental duration is required";
          if (isNaN(Number(value)) || Number(value) < 1)
            return "Minimum duration must be at least 1 day";
          return "";

        case "description":
          if (!value.trim()) return "Description is required";
          if (value.length < 20)
            return "Description must be at least 20 characters";
          return "";

        case "condition":
          return !value ? "Item condition is required" : "";

        case "images":
          return value.length === 0 ? "At least one image is required" : "";

        default:
          return "";
      }
    };

    return (
      <Modal visible={visible} animationType="none">
        <SafeAreaView className="flex-1 bg-white">
          <ScrollView className="p-5">
            <View className="flex-row justify-between items-center">
              <Text className="text-xl font-psemibold ">Create Listing</Text>
              <TouchableOpacity onPress={onClose}>
                <Image
                  source={icons.close}
                  className="w-6 h-6"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View className="w-full mb-4 bg-blue-400/10 p-4 rounded-xl border border-blue-300">
                <Text className="text-blue-500 text-sm font-pmedium">
                  Note: Please ensure all rental item information is accurate
                  and complete. Reliable data helps renters make informed
                  decisions and reduces booking disputes. Double-check item
                  descriptions, condition, availability dates, and pricing
                  before listing.
                </Text>
              </View>
              <View className="space-y-4">
                {/* Image Section */}
                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Images ({images.length}/5)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className={`border rounded-xl  mb-1 ${
                      errors.images ? "border-red-500" : "border-transparent"
                    }`}
                  >
                    {images.map((uri, index) => (
                      <View
                        key={index}
                        className="relative w-24 h-24 rounded-xl overflow-hidden mr-2"
                      >
                        <Image
                          source={{ uri }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          onPress={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 rounded-full p-1"
                        >
                          <Image
                            source={icons.close}
                            className="w-4 h-4"
                            tintColor="white"
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {images.length < 5 && (
                      <TouchableOpacity
                        onPress={openCamera}
                        className="w-24 h-24 rounded-xl bg-gray-100 border-gray-200 border items-center justify-center mr-2"
                      >
                        <Image
                          source={icons.camera}
                          className="w-5 h-5 mb-2"
                          tintColor="#666"
                        />
                        <Text className="text-secondary-400 font-pregular text-xs text-center">
                          Take Photo
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                  {errors.images ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.images}
                    </Text>
                  ) : (
                    <Text className="text-secondary-300 font-pregular text-xs mt-2">
                      Take up to 5 photos. First photo will be the cover image.
                    </Text>
                  )}
                </View>
                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Item Name
                  </Text>
                  <TextInput
                    value={formData.title}
                    onChangeText={(text) => {
                      setFormData((prev) => ({ ...prev, title: text }));
                      setErrors((prev) => ({
                        ...prev,
                        title: validateField("title", text),
                      }));
                    }}
                    className={`font-pregular bg-gray-100 border rounded-xl p-3 ${
                      errors.title ? "border-red-500" : "border-gray-200"
                    }`}
                    placeholder="Enter item name"
                  />
                  {errors.title ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.title}
                    </Text>
                  ) : null}
                </View>
                {/* Category Selection */}
                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Category
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowCategoryDropdown(true)}
                    className={`font-pregular bg-gray-100 border rounded-xl p-3 flex-row justify-between items-center ${
                      errors.category ? "border-red-500" : "border-gray-200"
                    }`}
                  >
                    <Text
                      className={
                        formData.category
                          ? "text-black font-pregular"
                          : "text-gray-600 font-pregular"
                      }
                    >
                      {formData.category || "Select category"}
                    </Text>
                    <Image
                      source={icons.arrowDown}
                      className="w-4 h-4"
                      tintColor="#666"
                    />
                  </TouchableOpacity>
                  {errors.category ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.category}
                    </Text>
                  ) : null}
                </View>

                {/* Category Dropdown Modal */}
                <Modal
                  visible={showCategoryDropdown}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowCategoryDropdown(false)}
                >
                  <TouchableOpacity
                    className="flex-1 bg-black/50"
                    activeOpacity={1}
                    onPress={() => setShowCategoryDropdown(false)}
                  >
                    <View className="bg-white rounded-t-3xl mt-auto">
                      <View className="p-4 border-b border-gray-200">
                        <Text className="text-lg font-psemibold text-center">
                          Select Category
                        </Text>
                      </View>
                      <ScrollView className="max-h-[50vh]">
                        {TOOL_CATEGORIES.map((category) => (
                          <TouchableOpacity
                            key={category}
                            className="p-4 border-b border-gray-100"
                            onPress={() => {
                              setFormData((prev) => ({ ...prev, category }));
                              setShowCategoryDropdown(false);
                            }}
                          >
                            <Text
                              className={`text-base ${
                                formData.category === category
                                  ? "text-primary font-psemibold"
                                  : "text-secondary-400 font-pregular"
                              }`}
                            >
                              {category}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>

                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Rate Per Day (₱)
                  </Text>
                  <TextInput
                    value={formData.price}
                    onChangeText={(text) => {
                      setFormData((prev) => ({ ...prev, price: text }));
                      setErrors((prev) => ({
                        ...prev,
                        price: validateField("price", text),
                      }));
                    }}
                    className={`font-pregular bg-gray-100 border rounded-xl p-3 ${
                      errors.price ? "border-red-500" : "border-gray-200"
                    }`}
                    keyboardType="numeric"
                    placeholder="Enter price"
                  />
                  {errors.price ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.price}
                    </Text>
                  ) : null}
                </View>

                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Minimum Rental Duration
                  </Text>
                  <TextInput
                    value={formData.minimumDays}
                    onChangeText={(text) =>
                      setFormData((prev) => ({ ...prev, minimumDays: text }))
                    }
                    className={`font-pregular bg-gray-100 border rounded-xl p-3 ${
                      errors.minimumDays ? "border-red-500" : "border-gray-200"
                    }`}
                    keyboardType="numeric"
                    placeholder="Enter minimum rental duration in days"
                  />
                  {errors.minimumDays ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.minimumDays}
                    </Text>
                  ) : null}
                </View>

                {/* Description and Price Section */}
                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Description
                  </Text>
                  <Text className="text-secondary-300 font-pregular text-xs mb-2">
                    Be specific and include important details renters should
                    know.
                  </Text>
                  <TextInput
                    value={formData.description}
                    onChangeText={(text) =>
                      setFormData((prev) => ({ ...prev, description: text }))
                    }
                    className={`font-pregular bg-gray-100 border h-[100] rounded-xl p-3 ${
                      errors.description ? "border-red-500" : "border-gray-200"
                    }`}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    placeholder="Include general details, purpose, brand/model, inclusions/exclusion, and any special features."
                  />
                  {errors.description ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.description}
                    </Text>
                  ) : null}
                </View>

                {/* Condition Section */}
                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Item Condition
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className={`flex-row gap-x-2 ${
                      errors.condition ? "border border-red-500 rounded-xl" : ""
                    }`}
                  >
                    {ITEM_CONDITIONS.map((condition, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          const newCondition = condition.value;
                          setFormData((prev) => ({
                            ...prev,
                            condition: newCondition,
                          }));
                          setErrors((prev) => ({
                            ...prev,
                            condition: validateField("condition", newCondition),
                          }));
                        }}
                        className={`mr-2 px-4 py-2 rounded-xl border ${
                          formData.condition === condition.value
                            ? "bg-primary border-primary"
                            : "bg-gray-100 border-gray-200"
                        }`}
                      >
                        <Text
                          className={`font-pmedium ${
                            formData.condition === condition.value
                              ? "text-white"
                              : "text-secondary-400"
                          }`}
                        >
                          {condition.value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {errors.condition ? (
                    <Text className="text-red-500 text-xs mt-1">
                      {errors.condition}
                    </Text>
                  ) : formData.condition ? (
                    <Text className="text-secondary-300 font-pregular text-sm mb-2">
                      {
                        ITEM_CONDITIONS.find(
                          (c) => c.value === formData.condition
                        )?.details
                      }
                    </Text>
                  ) : (
                    <Text className="text-secondary-300 font-pregular text-xs mt-2">
                      Please select the condition of your item
                    </Text>
                  )}
                </View>

                {/* Location Section */}
                <View>
                  <Text className="text-secondary-400 font-pmedium mt-2">
                    Pickup Location
                  </Text>
                  <View className="bg-gray-100 border-gray-200 border rounded-xl p-3">
                    <Text className="font-pregular text-black">
                      {formData.location || "Loading address..."}
                    </Text>
                  </View>
                  <Text className="text-secondary-300 font-pregular text-xs mt-2 italic">
                    This is your default pickup location. You can change this in
                    your profile settings.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View className="my-4">
              <LargeButton
                title={isSubmitting ? "Creating Listing..." : "Create Listing"}
                handlePress={handleSubmit}
                disabled={isSubmitting}
                containerStyles={`${isSubmitting ? "bg-gray-400" : ""}`}
              />
              {isSubmitting && (
                <View className="absolute right-0 left-0 top-0 bottom-0 items-center justify-center">
                  <ActivityIndicator color="#ffffff" />
                </View>
              )}
              <View className="h-[20]"></View>
            </View>
          </ScrollView>
        </SafeAreaView>

        {/* Render camera modal here */}
        {renderCameraModal()}
      </Modal>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: -20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-5 items-center w-full">
          {/* Header */}
          <View className="w-full flex-row items-center justify-between mb-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Image
                source={icons.leftArrow}
                className="w-6 h-6"
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text className="text-secondary-400 text-xl font-psemibold">
              List Item
            </Text>
            <View className="w-6" />
          </View>

          <View className="w-full mb-4 bg-orange-400/10 p-4 rounded-xl border border-orange-300">
            <Text className="text-orange-500 text-sm font-pmedium">
              Note: This AI model (Version 01) is currently trained to classify
              100+ common item types. It may not recognize all items accurately,
              especially rare or unusual ones.
            </Text>
          </View>

          {showCamera ? (
            renderCameraView()
          ) : (
            <View className="w-full">
              {/* Image Preview */}
              {imageUri && (
                <View className="relative mb-4 items-center">
                  <Image
                    source={{ uri: imageUri }}
                    className="w-full h-64 rounded-xl"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    className="absolute top-2 right-2 bg-white rounded-full p-2"
                    onPress={handleClearImage}
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Classification Results */}
              {isLoading ? (
                <View className="items-center justify-center py-8">
                  <ActivityIndicator size="large" color="#5C6EF6" />
                  <Text className="text-secondary-300 mt-4 font-pregular">
                    Analyzing your image...
                  </Text>
                </View>
              ) : (
                <>
                  {apiPrediction && apiPrediction.length > 0 ? (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Text className="text-secondary-400 text-base font-psemibold">
                          Based on the image, we detected:
                        </Text>
                        <View className="bg-green-100 rounded-full px-2 py-1 ml-2">
                          <Text className="text-green-700 text-xs font-psemibold">
                            AI-Enabled
                          </Text>
                        </View>
                      </View>
                      {apiPrediction.map((item, index) =>
                        renderResultItem(item, index)
                      )}
                    </View>
                  ) : classification.length > 0 ? (
                    <View className="mb-4">
                      <View className="flex-row items-center mb-2">
                        <Text className="text-secondary-400 text-lg font-psemibold">
                          We found these items:
                        </Text>
                        <View className="bg-blue-100 rounded-full px-2 py-1 ml-2">
                          <Text className="text-blue-700 text-xs font-psemibold">
                            Local
                          </Text>
                        </View>
                      </View>
                      {classification.map((item, index) =>
                        renderResultItem(item, index)
                      )}
                    </View>
                  ) : error ? (
                    <View className="p-4 bg-red-50 rounded-xl mb-4">
                      <Text className="text-red-500">{error}</Text>
                    </View>
                  ) : null}
                </>
              )}

              {/* Actions */}
              <View className="flex-row gap-3">
                <LargeButton
                  title="Identify Image"
                  handlePress={classifyImage}
                  isLoading={isLoading}
                  containerStyles="flex-1"
                  textStyles="text-white"
                  disabled={isLoading || !imageUri}
                />
              </View>
            </View>
          )}

          <LargeButton
            title="Use Manual Listing"
            handlePress={() => setShowManualModal(true)}
            containerStyles="flex-1 bg-red-400 w-full mt-4"
            textStyles="text-white"
          />
        </View>
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide">
        <View className="flex-1  bg-black/20">
          <View className="absolute top-0 left-0 right-0 z-20 pt-4 pb-4">
            <View className="flex-row justify-between items-center px-6">
              <TouchableOpacity
                onPress={() => setCameraVisible(false)}
                className="bg-black/60 p-3 rounded-full"
              >
                <Image
                  source={icons.close}
                  className="w-6 h-6"
                  tintColor="red"
                />
              </TouchableOpacity>

              <View className="flex-1 items-center">
                <Text className="text-white font-pbold text-xl">
                  Capture to Identify
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setFacing((current) =>
                    current === "back" ? "front" : "back"
                  )
                }
                className="bg-black/60 p-3 rounded-full"
              >
                <Image
                  source={icons.refresh}
                  className="w-6 h-6"
                  tintColor="white"
                />
              </TouchableOpacity>
            </View>

            {/*TIP BOX*/}
            <View className="mx-6 mt-2">
              {/* Tappable Icon Only */}
              {!expanded && (
                <TouchableOpacity
                  onPress={() => setExpanded(true)}
                  className="bg-blue-400/60 rounded-full p-3 self-start"
                >
                  <Text className="text-2xl">💡</Text>
                </TouchableOpacity>
              )}

              {/* Expanded Tips Box */}
              {expanded && (
                <View className="bg-blue-400/60 rounded-xl px-5 py-3">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-pbold text-white text-lg">
                      Camera Tips
                    </Text>
                    <TouchableOpacity onPress={() => setExpanded(false)}>
                      <Text className="text-red-600 text-lg">✖</Text>
                    </TouchableOpacity>
                  </View>

                  {[
                    "✔ Use bright, even lighting",
                    "✔ Center the item in the frame",
                    "✔ Use a clear, plain background",
                    "✔ Make sure the full item is visible",
                    "✔ Hold your phone steady",
                  ].map((tip, idx) => (
                    <Text
                      key={idx}
                      className="text-white text-sm font-pmedium mb-0.5"
                    >
                      {tip}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
          <CameraView
            ref={cameraRef}
            className="flex-1"
            style={{ flex: 1 }}
            facing={facing}
          >
            <View style={styles.cameraContainer}>
              {/* ID Type indicator */}

              <TouchableOpacity
                onPress={capturePhoto}
                className="w-20 h-20 rounded-full bg-white items-center justify-center mb-4"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                }}
              >
                <View className="w-16 h-16 rounded-full border-4 border-primary bg-transparent" />
                <View className="absolute w-14 h-14 rounded-full bg-primary" />
              </TouchableOpacity>
            </View>
          </CameraView>
        </View>
      </Modal>

      {/* Manual Listing Modal */}
      <ManualListingModal
        visible={showManualModal}
        onClose={() => setShowManualModal(false)}
        initialData={selectedItem}
      />
    </SafeAreaView>
  );
};

export default AddListing;
