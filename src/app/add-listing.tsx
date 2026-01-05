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
import { TOOL_CATEGORIES } from "@/constant/tool-categories";
import {
  getToolCategory,
  isToolProhibited,
  getCategoryStatus,
} from "@/constant/tool-categories";
import { get } from "react-native/Libraries/TurboModule/TurboModuleRegistry";
import { R2R_MODEL } from "@/constant/api";
import { useLoader } from "@/context/LoaderContext";
import { useProhibitedChecker } from "../utils/useProhibitedChecker";
import { OPEN_CAGE_API_KEY, MAP_TILER_API_KEY } from "@env";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { checkAndUpdateLimits } from "@/utils/planLimits";
import { generateDescriptionTemplate } from "@/constant/item-specifications";
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";

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

const API_URL = R2R_MODEL;

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
  const [useAI, setUseAI] = useState(false);
  const [userLocation, setUserLocation] = useState("");
  const { isProhibited, validateClassification, isAllowedClass } =
    useProhibitedChecker();

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

  type ConditionType =
    | "Brand New"
    | "Like New"
    | "Very Good"
    | "Good"
    | "Fair"
    | "Worn but Usable";

  const getConditionWeight = (condition: string): number => {
    const weights: Record<ConditionType, number> = {
      "Brand New": 1,
      "Like New": 0.9,
      "Very Good": 0.8,
      Good: 0.7,
      Fair: 0.6,
      "Worn but Usable": 0.5,
    };
    return weights[condition as ConditionType] || 0.7;
  };

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
    setError(null);
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
          setShowCamera(false);

          // Automatically classify image after capture
          try {
            setIsLoading(true);
            setApiPrediction(null);
            const apiResult = await predictImage(photo.uri);

            if (!apiResult) {
              Toast.show({
                type: ALERT_TYPE.DANGER,
                title: "Error",
                textBody: "Failed to analyze image. Please try again.",
              });
            }
          } catch (err) {
            console.log("Classification Error:", err);
            Toast.show({
              type: ALERT_TYPE.DANGER,
              title: "Error",
              textBody: "Failed to analyze image. Please try again.",
            });
          } finally {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.log("Camera Error:", error);
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

      if (Array.isArray(result)) {
        setApiPrediction(result);
      } else {
        setApiPrediction([result]);
      }

      return result;
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes("Network request failed")
      ) {
        setError(
          "API is currently unavailable. Please check your internet connection and try again."
        );
        return null;
      } else {
        setError(
          "Image was not recognized. Please try again with a clearer image."
        );
        return null;
      }
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
      console.log("Classification Error:", err);
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

  const isItemProhibited = (itemName: string, category?: string): boolean => {
    // Check 1: Exact item name match in tool-categories
    const categoryStatus = getCategoryStatus(itemName);
    if (categoryStatus === "prohibited") {
      console.log(`❌ Prohibited by exact match: ${itemName}`);
      return true;
    }

    // Check 2: Use keyword-based checker
    const keywordCheck = isProhibited(itemName);
    if (keywordCheck.prohibited) {
      console.log(
        `❌ Prohibited by keyword: ${itemName} (matched: ${keywordCheck.matchedKeywords})`
      );
      return true;
    }

    // Check 3: If category is provided, check if it's in prohibited categories
    if (category) {
      const isProhibitedCategory =
        category.toLowerCase() === "prohibited" ||
        category.toLowerCase() === "unknown";
      if (isProhibitedCategory) {
        console.log(`❌ Prohibited by category: ${category}`);
        return true;
      }

      // Also check if category itself is prohibited
      const categoryKeywordCheck = isProhibited(category);
      if (categoryKeywordCheck.prohibited) {
        console.log(`❌ Prohibited category: ${category}`);
        return true;
      }
    }

    console.log(`✓ Item allowed: ${itemName}`);
    return false;
  };

  interface PredictionItem {
    label?: string;
    category?: string;
    probability?: number;
    "Predicted Item"?: string;
    Category?: string;
    Confidence?: string;
  }

  const renderResultItem = (item: PredictionItem, index: number) => {
    const label = item.label || item["Predicted Item"] || "";
    const category = item.category || item["Category"] || "";
    const confidence = item.probability
      ? `${(item.probability * 100).toFixed(1)}%`
      : item["Confidence"] || "";

    // USE THE NEW INTEGRATED CHECKER
    const isProhibitedItem = isItemProhibited(label, category);

    return (
      <TouchableOpacity
        key={index}
        className={`flex-row items-center justify-between bg-white p-4 rounded-xl mb-2 shadow-sm border ${
          isProhibitedItem ? "border-red-200 bg-red-50" : "border-gray-100"
        }`}
        onPress={() => {
          if (isProhibitedItem) {
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
          setUseAI(true);
          setSelectedItem(item.label ? item : { ...item, label, category });
          setShowManualModal(true);
        }}
      >
        <View className="flex-row items-center flex-1">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
              isProhibitedItem ? "bg-red-200" : "bg-primary/10"
            }`}
          >
            <Text
              className={`font-psemibold ${
                isProhibitedItem ? "text-red-600" : "text-primary"
              }`}
            >
              {index + 1}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className={`text-lg font-psemibold ${
                isProhibitedItem ? "text-red-600" : "text-secondary-400"
              }`}
            >
              {label}
            </Text>
            {category ? (
              <Text
                className={`text-sm font-pregular ${
                  isProhibitedItem ? "text-red-500" : "text-secondary-300"
                }`}
              >
                {category}
              </Text>
            ) : null}
          </View>
        </View>
        {/* <Text
          className={`font-pregular ml-2 ${
            isProhibitedItem ? "text-red-500" : "text-secondary-300"
          }`}
        >
          {confidence}
        </Text> */}
      </TouchableOpacity>
    );
  };
  const extractActualContent = (description: string): string => {
    const lines = description.split("\n");
    const contentLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;

      const isTemplateLabel =
        /^(Brand|Model|Type|Features|Specifications|Included|Additional Notes|Power|Capacity|Voltage|Battery|Speed|Safety):\s*$/i.test(
          trimmed
        );
      return !isTemplateLabel;
    });

    return contentLines.join(" ").trim();
  };

  interface ManualListingModalProps {
    visible: boolean;
    onClose: () => void;
    initialData: PredictionItem | null;
    useAI?: boolean;
    initialImage?: string;
  }

  const ManualListingModal = ({
    visible,
    onClose,
    initialData,
    useAI,
    initialImage,
  }: ManualListingModalProps) => {
    const [aiImages, setAiImages] = useState<string[]>(
      initialImage ? [initialImage] : []
    );

    const getInitialDescription = () => {
      if (useAI && initialData?.label) {
        const itemName = initialData.label;
        const category = getToolCategory(itemName) || "";
        return generateDescriptionTemplate(itemName, category);
      }
      return "";
    };

    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
      title: initialData?.label || "",
      category: getToolCategory(initialData?.label?.toString() ?? "") || "",
      description: getInitialDescription(),
      price: "",
      minimumDays: "",
      condition: "",
      location: {
        latitude: 0,
        longitude: 0,
        address: "",
        radius: 0,
      },
      owner: { id: "", fullname: "" },
      securityDepositPercentage: "",
      enableSecurityDeposit: false,
    });

    const titleSearch = initialData?.label || "";

    const [errors, setErrors] = useState({
      title: "",
      category: "",
      price: "",
      minimumDays: "",
      description: "",
      condition: "",
      images: "",
      securityDepositPercentage: "",
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [images, setImages] = useState<string[]>([]);
    const [showCamera, setShowCamera] = useState(false);
    const cameraRef = useRef<CameraView | null>(null);
    const [permission] = useCameraPermissions();
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const [suggestedPrices, setSuggestedPrices] = useState<{
      low?: number;
      mid?: number;
      high?: number;
    } | null>(null);
    const [showNoMarketData, setShowNoMarketData] = useState(false);

    const currentUser = auth.currentUser;

    useEffect(() => {
      if (initialImage && visible && useAI) {
        setImages([initialImage]);
      }
    }, [initialImage, visible]);

    useEffect(() => {
      const fetchUserLocation = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;

          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists() && userDoc.data().location?.address) {
            setFormData((prev) => ({
              ...prev,
              location: userDoc.data().location,
            }));
          }
        } catch (error) {
          console.log("Error fetching location:", error);
        }
      };

      fetchUserLocation();
    }, []);

    // Validation for Step 1 (Basic Info)

    const validateStep1Accepted = () => {
      const newErrors = {
        title: "",
        category: "",
        price: "",
        minimumDays: "",
        description: "",
        condition: "",
        images: "",
        securityDepositPercentage: "",
      };

      let isValid = true;

      // Check product title using BOTH systems
      if (isItemProhibited(formData.title)) {
        newErrors.title = `Product title contains prohibited item`;
        isValid = false;
      }

      // Extract and check description content
      const actualContent = extractActualContent(formData.description);
      if (actualContent.length > 5) {
        const descCheck = isProhibited(actualContent);
        if (descCheck.prohibited) {
          newErrors.description = `Description contains prohibited content: ${descCheck.category}`;
          isValid = false;
        }
      }

      setErrors(newErrors);
      return isValid;
    };

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

    const validateStep1 = () => {
      const newErrors = {
        title: "",
        category: "",
        price: "",
        minimumDays: "",
        description: "",
        condition: "",
        images: "",
        securityDepositPercentage: "",
      };
      let isValid = true;

      // Title validation
      if (!formData.title.trim()) {
        newErrors.title = "Item name is required";
        isValid = false;
      }

      // Images validation
      if (images.length === 0) {
        newErrors.images = "At least one image is required";
        isValid = false;
      }

      // Category validation
      if (!formData.category) {
        newErrors.category = "Category is required";
        isValid = false;
      }

      // Condition validation
      if (!formData.condition) {
        newErrors.condition = "Item condition is required";
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

      setErrors(newErrors);
      return isValid;
    };

    // Validation for Step 2 (Details & Images)
    const validateStep2 = () => {
      const newErrors = {
        title: "",
        category: "",
        price: "",
        minimumDays: "",
        description: "",
        condition: "",
        images: "",
        securityDepositPercentage: "",
      };
      let isValid = true;

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
      const securityDepositError = validateField(
        "securityDepositPercentage",
        formData.securityDepositPercentage
      );
      if (securityDepositError) {
        newErrors.securityDepositPercentage = securityDepositError;
        isValid = false;
      }

      setErrors(newErrors);
      return isValid;
    };

    // Handle Step 1 Continue
    const handleStep1Continue = async () => {
      if (!validateStep1()) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Incomplete Information",
          textBody:
            "Some required fields are missing. Please complete all mandatory fields.",
        });
        return;
      }

      if (!validateStep1Accepted()) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Item Not Allowed",
          textBody: "This item is prohibited and cannot be listed.",
        });
        return;
      }

      try {
        // Query items with matching name only
        const q = query(
          collection(db, "items"),

          where("itemName", "==", titleSearch.trim())
          //  where("itemName", "==", formData.title.trim())
        );

        const snap = await getDocs(q);

        if (snap.empty) {
          setShowNoMarketData(true);
          setCurrentStep(2);
          return;
        }

        // Get all prices and sort them
        const prices = snap.docs
          .map((doc) => ({
            price: doc.data().itemPrice,
            condition: doc.data().itemCondition,
          }))
          .filter((item) => typeof item.price === "number");

        if (prices.length === 0) {
          setShowNoMarketData(true);
          setCurrentStep(2);
          return;
        }

        // Calculate base price (average of all prices)
        const basePrice =
          prices.reduce((sum, item) => sum + item.price, 0) / prices.length;

        // Apply condition-based adjustment
        const conditionWeight = getConditionWeight(formData.condition);

        // Calculate suggested prices with condition adjustment
        const suggestedPrices = {
          low: Math.round(basePrice * conditionWeight * 0.8), // 20% below adjusted base
          mid: Math.round(basePrice * conditionWeight),
          high: Math.round(basePrice * conditionWeight * 1.2), // 20% above adjusted base
        };

        if (useAI) {
          setSuggestedPrices(suggestedPrices);
          setShowNoMarketData(false);
        }
        setCurrentStep(2);
      } catch (error) {
        console.log("Error calculating price suggestions:", error);
        if (useAI) {
          setShowNoMarketData(true);
        }
        setCurrentStep(2);
      }
    };

    // Handle Step 2 Back
    const handleStep2Back = () => {
      //Back to Step 1 with confirmation
      Alert.alert(
        "Go Back",
        "Are you sure you want to go back? Unsaved changes will be lost.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes", onPress: () => setCurrentStep(1) },
        ]
      );
      //setCurrentStep(1);
    };

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
        console.log("Camera Error:", error);
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

          quality: 1,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
          setImages((prev) => [...prev, result.assets[0].uri]);
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

    const removeImage = (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      handleImageChange(newImages);
    };

    const handleSumbitAlert = () => {
      Alert.alert(
        "Submit Listing",
        "Are you sure you want to submit this listing?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes", onPress: () => handleSubmit() },
        ]
      );
    };

    // Final submit function
    const handleSubmit = async () => {
      setIsLoading(true);

      Alert.alert(
        "Submit Listing",
        "Are you sure you want to submit this listing?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {
              return;
            },
          },
          {
            text: "Yes",
            onPress: () => {
              if (!validateStep2()) {
                Toast.show({
                  type: ALERT_TYPE.DANGER,
                  title: "Validation Error",
                  textBody: "Please complete all required fields",
                });
                setIsLoading(false);
                return;
              }
            },
          },
        ]
      );

      if (!validateStep2()) {
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Validation Error",
          textBody: "Please complete all required fields",
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

        setIsSubmitting(true);

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
          const location = userData?.location || {};

          const nameParts = [];
          if (firstName) nameParts.push(firstName);
          if (middleName) nameParts.push(`${middleName.charAt(0)}.`);
          if (lastName) nameParts.push(lastName);

          fullname = nameParts.join(" ") || "Unknown User";
        }

        // Create the listing document
        const ownerDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const userData = ownerDoc.data();

        const listingData = {
          itemName: formData.title,
          itemCategory: formData.category,
          itemDesc: formData.description,
          itemPrice: Number(formData.price),
          itemMinRentDuration: Number(formData.minimumDays),
          itemCondition: formData.condition,
          itemLocation: {
            address: userData?.location?.address || "",
            latitude: userData?.location?.latitude || 0,
            longitude: userData?.location?.longitude || 0,
            radius: userData?.location?.radius || 0,
          },
          owner: {
            id: auth.currentUser?.uid,
            fullname: fullname,
          },
          createdAt: serverTimestamp(),
          itemStatus: "Available",
          ...(formData.enableSecurityDeposit && {
            securityDepositPercentage: Number(
              formData.securityDepositPercentage
            ),
          }),
          enableAI: useAI,
        };

        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Uploading",
          textBody: "Creating your listing...",
        });

        const docRef = await addDoc(collection(db, "items"), listingData);

        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Uploading",
          textBody: "Uploading images...",
        });

        const imageUrls = await uploadImages(images, docRef.id);

        await updateDoc(doc(db, "items", docRef.id), {
          images: imageUrls,
        });

        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Success",
          textBody: "Item listed successfully",
        });

        onClose();
        router.push("/(tabs)/tools");
      } catch (error) {
        console.log("Error creating listing:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to create listing. Please try again.",
        });
      } finally {
        setIsSubmitting(false);
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

        case "securityDepositPercentage":
          if (formData.enableSecurityDeposit && !value)
            return "Security deposit percentage is required when enabled";
          if (
            formData.enableSecurityDeposit &&
            (isNaN(Number(value)) || Number(value) <= 0 || Number(value) > 100)
          )
            return "Please enter a valid percentage (1-100)";
          if (formData.enableSecurityDeposit && Number(value) < 10)
            return "Minimum security deposit is 10%";
          return "";

        default:
          return "";
      }
    };

    // Reset to step 1 when modal closes and reopens
    useEffect(() => {
      if (visible) {
        setCurrentStep(1);
      } else {
        setImages([]);
      }
    }, [visible]);

    // Step 1: Basic Information
    const renderStep1 = () => (
      <ScrollView className="p-4">
        <View className="w-full mb-4 bg-blue-400/10 p-2 rounded-xl border border-blue-300">
          <Text className="text-blue-500 text-xs font-pmedium">
            Step 1 of 2: Add photos, item name, category, condition and
            description
          </Text>
        </View>

        <View className="space-y-4">
          {/* Images Section */}
          <View>
            <Text className="text-secondary-400 font-pmedium mt-2">
              Images ({images.length}/5) *
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="rounded-xl mb-1"
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
                <>
                  <TouchableOpacity
                    onPress={openCamera}
                    className={`w-24 h-24 rounded-xl bg-gray-100 border items-center justify-center mr-2 ${
                      errors.images ? "border-red-500" : "border-gray-200"
                    }`}
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

                  {/* <TouchableOpacity
                    onPress={pickImage}
                    className={`w-24 h-24 rounded-xl bg-gray-100 border items-center justify-center ${
                      errors.images ? "border-red-500" : "border-gray-200"
                    }`}
                  >
                    <Image
                      source={icons.gallery}
                      className="w-5 h-5 mb-2"
                      tintColor="#666"
                    />
                    <Text className="text-secondary-400 font-pregular text-xs text-center">
                      Upload
                    </Text>
                  </TouchableOpacity> */}
                </>
              )}
            </ScrollView>
            {errors.images ? (
              <Text className="text-red-500 text-xs mt-1">{errors.images}</Text>
            ) : (
              <Text className="text-secondary-300 font-pregular text-xs mt-2">
                Take up to 5 photos. First photo will be the cover image.
              </Text>
            )}
          </View>

          {/* Item Name */}
          <View>
            <Text className="text-secondary-400 font-pmedium mt-2">
              Item Name *
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
              <Text className="text-red-500 text-xs mt-1">{errors.title}</Text>
            ) : null}
          </View>

          {/* Category Selection */}
          <View>
            <Text className="text-secondary-400 font-pmedium mt-2">
              Category *
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
          {/* Condition Section */}
          <View>
            <Text className="text-secondary-400 font-pmedium mt-2">
              Item Condition *
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row gap-x-2"
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
                    errors.condition
                      ? "border-red-500"
                      : formData.condition === condition.value
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
                  ITEM_CONDITIONS.find((c) => c.value === formData.condition)
                    ?.details
                }
              </Text>
            ) : (
              <Text className="text-secondary-300 font-pregular text-xs mt-2">
                Please select the condition of your item
              </Text>
            )}
          </View>

          {/* Description */}
          <View>
            <Text className="text-secondary-400 font-pmedium mt-2">
              Description/Note*
            </Text>
            <Text className="text-secondary-300 font-pregular text-xs mb-2">
              Be specific and include important details renters should know.
            </Text>
            <TextInput
              value={formData.description}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, description: text }));
                setErrors((prev) => ({
                  ...prev,
                  description: validateField("description", text),
                }));
              }}
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
        </View>

        {/* Continue Button */}
        <LargeButton
          title="Continue"
          handlePress={handleStep1Continue}
          containerStyles="mt-6"
        />
        <View className="h-20" />
      </ScrollView>
    );

    // Step 2: Details and Images
    const renderStep2 = () => (
      <ScrollView className="p-4">
        <View className="w-full mb-4 bg-green-400/10 p-2 rounded-xl border border-green-300">
          <Text className="text-green-600 text-xs font-pmedium">
            Step 2 of 2: Enter pricing details and payment requirements for your
            item.
          </Text>
        </View>

        {useAI && (
          <>
            {showNoMarketData ? (
              <View className="bg-yellow-50 border border-yellow-400 p-3 rounded-xl mb-4">
                <Text className="text-yellow-700 font-pmedium">
                  No market data found for this item and condition. Please set a
                  price you think is fair.
                </Text>
              </View>
            ) : suggestedPrices ? (
              <View className="bg-blue-50 border border-blue-400 p-3 rounded-xl mb-4">
                <Text className="text-blue-700 font-psemibold mb-2">
                  Market Price Suggestions
                </Text>
                <View className="flex-row justify-between">
                  <TouchableOpacity
                    className="flex-1 items-center mx-1 bg-blue-100 rounded-lg p-2"
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        price: suggestedPrices.low?.toString() ?? "",
                      }))
                    }
                  >
                    <Text className="text-blue-700 font-pbold">Low</Text>
                    <Text className="text-lg font-psemibold">
                      ₱{suggestedPrices.low}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center mx-1 bg-blue-100 rounded-lg p-2"
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        price: suggestedPrices.mid?.toString() ?? "",
                      }))
                    }
                  >
                    <Text className="text-blue-700 font-pbold">Mid</Text>
                    <Text className="text-lg font-psemibold">
                      ₱{suggestedPrices.mid}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 items-center mx-1 bg-blue-100 rounded-lg p-2"
                    onPress={() =>
                      setFormData((prev) => ({
                        ...prev,
                        price: suggestedPrices.high?.toString() ?? "",
                      }))
                    }
                  >
                    <Text className="text-blue-700 font-pbold">High</Text>
                    <Text className="text-lg font-psemibold">
                      ₱{suggestedPrices.high}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-xs text-blue-500 mt-2 text-center">
                  Tap a suggestion to autofill your price.
                </Text>
              </View>
            ) : null}
          </>
        )}

        <View className="space-y-4">
          {/* Price and Minimum Days */}
          <View className="flex-row justify-between gap-4 mt-2">
            <View className="flex-1">
              <Text className="text-secondary-400 font-pmedium mt-2">
                Rate Per Day (₱) *
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

            <View className="flex-1">
              <Text className="text-secondary-400 font-pmedium mt-2">
                Min. Rental Day/s *
              </Text>
              <TextInput
                value={formData.minimumDays}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, minimumDays: text }));
                  setErrors((prev) => ({
                    ...prev,
                    minimumDays: validateField("minimumDays", text),
                  }));
                }}
                className={`font-pregular bg-gray-100 border rounded-xl p-3 ${
                  errors.minimumDays ? "border-red-500" : "border-gray-200"
                }`}
                keyboardType="numeric"
                placeholder="Min. rental days"
              />
              {errors.minimumDays ? (
                <Text className="text-red-500 text-xs mt-1">
                  {errors.minimumDays}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="mt-6">
            <Text className="text-secondary-400 font-psemibold text-lg mb-3">
              Payment Options
            </Text>

            {/* Rental Security Deposit */}
            <View className="bg-gray-50 rounded-xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-secondary-400 font-pmedium">
                    Require Security Deposit
                  </Text>
                  <Text className="text-secondary-300 font-pregular text-xs">
                    Protects your item and is refunded after safe return at end
                    of rental
                  </Text>
                </View>
                <Switch
                  value={formData.enableSecurityDeposit}
                  onValueChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      enableSecurityDeposit: value,
                      securityDepositPercentage: value
                        ? prev.securityDepositPercentage || "30"
                        : "",
                    }));
                    if (!value) {
                      setErrors((prev) => ({
                        ...prev,
                        securityDepositPercentage: "",
                      }));
                    }
                  }}
                  trackColor={{ false: "#767577", true: "#4BD07F" }}
                  thumbColor={
                    formData.enableSecurityDeposit ? "#ffffff" : "#f4f3f4"
                  }
                />
              </View>

              {formData.enableSecurityDeposit && (
                <View>
                  {/* Percentage Input */}
                  <View className="mb-3">
                    <Text className="text-secondary-400 font-pmedium mb-2">
                      Security Deposit Amount
                    </Text>
                    <View className="flex-row gap-2 mb-2">
                      {/* Quick Select Buttons */}
                      {["10", "20", "30", "40", "50"].map((percentage) => (
                        <TouchableOpacity
                          key={percentage}
                          onPress={() => {
                            setFormData((prev) => ({
                              ...prev,
                              securityDepositPercentage: percentage,
                            }));
                            setErrors((prev) => ({
                              ...prev,
                              securityDepositPercentage: validateField(
                                "securityDepositPercentage",
                                percentage
                              ),
                            }));
                          }}
                          className={`px-3 py-2 rounded-lg border ${
                            formData.securityDepositPercentage === percentage
                              ? "bg-primary border-primary"
                              : "bg-white border-gray-300"
                          }`}
                        >
                          <Text
                            className={`font-pmedium ${
                              formData.securityDepositPercentage === percentage
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

                  {/* Payment Example */}
                  {formData.securityDepositPercentage &&
                    formData.price &&
                    formData.minimumDays && (
                      <View className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <Text className="text-blue-700 font-psemibold mb-3">
                          Payment Breakdown Example
                        </Text>
                        <Text className="text-blue-600 font-pregular text-sm">
                          For {formData.minimumDays} day(s) rental:
                        </Text>
                        <View className="mt-2 space-y-2">
                          <View className="flex-row justify-between">
                            <Text className="text-blue-600 font-pregular text-sm">
                              • Daily Rate × Days:
                            </Text>
                            <Text className="text-blue-700 font-psemibold text-sm">
                              ₱
                              {(
                                Number(formData.price) *
                                Number(formData.minimumDays)
                              ).toLocaleString()}
                            </Text>
                          </View>
                          <View className="border-t border-blue-300 my-2" />
                          <View className="flex-row justify-between">
                            <Text className="text-blue-600 font-pregular text-sm">
                              Security Deposit (
                              {formData.securityDepositPercentage}% of rental):
                            </Text>
                            <Text className="text-blue-700 font-psemibold text-sm">
                              ₱
                              {Math.round(
                                (Number(formData.price) *
                                  Number(formData.minimumDays) *
                                  Number(formData.securityDepositPercentage)) /
                                  100
                              ).toLocaleString()}
                            </Text>
                          </View>
                          <View className="border-t border-blue-300 my-2" />
                          <View className="flex-row justify-between bg-blue-100 p-2 rounded">
                            <Text className="text-blue-700 font-psemibold text-sm">
                              Total Amount Due at Pickup:
                            </Text>
                            <Text className="text-blue-700 font-pbold text-sm">
                              ₱
                              {(
                                Number(formData.price) *
                                  Number(formData.minimumDays) +
                                Math.round(
                                  (Number(formData.price) *
                                    Number(formData.minimumDays) *
                                    Number(
                                      formData.securityDepositPercentage
                                    )) /
                                    100
                                )
                              ).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-blue-500 font-pregular text-xs mt-3">
                          ℹ️ Security deposit is refundable upon safe return of
                          the item in agreed condition
                        </Text>
                      </View>
                    )}
                </View>
              )}
            </View>

            {/* Benefits Info Box */}
            <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl mr-2">💡</Text>
                <Text className="text-green-700 font-psemibold">
                  Why require a security deposit?
                </Text>
              </View>
              <Text className="text-green-600 font-pregular text-sm mb-1">
                • Ensures serious renters only
              </Text>
              <Text className="text-green-600 font-pregular text-sm mb-1">
                • Protects against damage or loss
              </Text>
              <Text className="text-green-600 font-pregular text-sm">
                • Fully refundable after safe return
              </Text>
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
                    (Pickup location cannot be changed here)
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
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-3 mt-6">
          <TouchableOpacity
            onPress={handleStep2Back}
            className="flex-1 bg-gray-200 py-3 rounded-xl items-center justify-center"
          >
            <Text className="text-gray-700 font-psemibold text-xl">Back</Text>
          </TouchableOpacity>
          <View className="flex-1">
            <LargeButton
              title={isSubmitting ? "Creating Listing..." : "Create Listing"}
              handlePress={handleSubmit}
              disabled={isSubmitting}
              containerStyles={`${isSubmitting ? "bg-gray-400" : ""}`}
            />
          </View>
        </View>
        <View className="h-20" />
      </ScrollView>
    );

    return visible ? (
      <>
        <SafeAreaView
          style={{
            flex: 1,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          className="bg-white"
        >
          {/* Header with Progress */}
          <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
            <View className="w-7" />
            <View className="items-center">
              <Text className="text-xl font-psemibold">Create Listing</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Image source={icons.close} className="w-7 h-7" />
            </TouchableOpacity>
          </View>
          {/* Progress Indicator */}
          <View className="flex-row justify-center items-center mt-2 mb-2">
            <React.Fragment>
              <View
                className={`rounded-full flex items-center justify-center ${
                  1 <= currentStep
                    ? "bg-primary w-7 h-7"
                    : "bg-gray-300 w-6 h-6"
                }`}
              >
                <Text
                  className={`text-sm ${
                    1 <= currentStep
                      ? "text-white font-pbold"
                      : "text-gray-600 font-pregular"
                  }`}
                >
                  1
                </Text>
              </View>
              <View
                className={`w-20 h-1 mx-1 ${
                  1 < currentStep ? "bg-primary" : "bg-gray-300"
                }`}
              />
              <View
                className={`rounded-full flex items-center justify-center ${
                  2 <= currentStep
                    ? "bg-primary w-7 h-7"
                    : "bg-gray-300 w-6 h-6"
                }`}
              >
                <Text
                  className={`text-sm ${
                    2 <= currentStep
                      ? "text-white font-pbold"
                      : "text-gray-600 font-pregular"
                  }`}
                >
                  2
                </Text>
              </View>
            </React.Fragment>
          </View>

          {/* Render current step */}
          {currentStep === 1 ? renderStep1() : renderStep2()}
        </SafeAreaView>

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
                      setErrors((prev) => ({
                        ...prev,
                        category: "",
                      }));
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

        {/* Render camera modal */}
        {renderCameraModal()}
      </>
    ) : null;
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
                className="w-8 h-8"
                tintColor="#6B7280"
              />
            </TouchableOpacity>
            <Text className="text-xl font-pbold text-gray-800">List Item</Text>
            <View className="w-8" />
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
                  {isLoading ? (
                    <View className="absolute inset-0 bg-black/50 rounded-xl items-center justify-center">
                      <ActivityIndicator size="large" color="#5C6EF6" />
                      <Text className="text-white mt-4 font-pmedium">
                        Analyzing image...
                      </Text>
                    </View>
                  ) : (
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
                  )}
                </View>
              )}

              {/* Classification Results */}
              {isLoading ? null : (
                // <View className="items-center justify-center py-8">
                //   <ActivityIndicator size="large" color="#5C6EF6" />
                //   <Text className="text-secondary-300 mt-4 font-pregular">
                //     Analyzing your image...
                //   </Text>
                // </View>
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
              {error && (
                <View className="flex-row gap-3">
                  <LargeButton
                    title="Retry Identification"
                    handlePress={() => {
                      if (imageUri) {
                        classifyImage();
                      }
                    }}
                    isLoading={isLoading}
                    containerStyles="flex-1"
                    textStyles="text-white"
                  />
                </View>
              )}
            </View>
          )}
          {!imageUri && (
            <LargeButton
              title="Use Manual Listing"
              handlePress={() => {
                setUseAI(false);
                setSelectedItem(null);
                setShowManualModal(true);
              }}
              containerStyles="flex-1 bg-red-400 w-full mt-4"
              textStyles="text-white"
            />
          )}
        </View>
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={cameraVisible} animationType="slide">
        <View className="flex-1 bg-black/20">
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

              <View className="flex-1 items-center bg-black/60 rounded-full py-2 px-2 mx-4">
                <Text className="text-white font-pbold text-xl">
                  Capture to Analyze
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
                  className="bg-blue-400/60 rounded-full p-2 self-end"
                >
                  <Text className="text-2xl">💡</Text>
                </TouchableOpacity>
              )}

              {/* Expanded Tips Box */}
              {expanded && (
                <View className="bg-blue-300/50 rounded-xl px-5 py-3 border border-blue-600">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-pbold text-white text-lg">
                      Camera Tips
                    </Text>
                    <TouchableOpacity onPress={() => setExpanded(false)}>
                      <Image
                        source={icons.close}
                        className="w-8 h-8"
                        tintColor="red"
                      />
                    </TouchableOpacity>
                  </View>

                  {[
                    "Use bright, even lighting",
                    "Use a clear, plain background",
                    "Make sure the full item is visible",
                    "Hold your phone steady",
                  ].map((tip, idx) => (
                    <View key={idx} className="flex-row items-start mb-1">
                      <Image
                        source={icons.check}
                        className="w-4 h-4 mr-2"
                        tintColor="#fff"
                      />
                      <Text
                        key={idx}
                        className="text-white text-sm font-pmedium mb-0.5"
                      >
                        {tip}
                      </Text>
                    </View>
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
        onClose={() =>
          Alert.alert(
            "Discard Listing",
            "Are you sure you want to discard this listing?",
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Discard",
                style: "destructive",
                onPress: () => setShowManualModal(false),
              },
            ]
          )
        }
        initialData={selectedItem}
        useAI={useAI}
        initialImage={imageUri || undefined}
      />
    </SafeAreaView>
  );
};

export default AddListing;
