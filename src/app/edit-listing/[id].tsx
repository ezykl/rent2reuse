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
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { icons } from "@/constant";
import LargeButton from "@/components/LargeButton";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "@/lib/firebaseConfig";
import { TOOL_CATEGORIES } from "@/constant/tool-categories";
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useLoader } from "@/context/LoaderContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { generateDescriptionTemplate } from "@/constant/item-specifications";
import { getToolCategory } from "@/constant/tool-categories";
import { Item as ListingData } from "@/types/item";
import stringSimilarity from "string-similarity";
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";

// Update the interface to include all fields
// interface ListingData extends Item {
//   itemName: string;
//   itemCategory: string;
//   itemDesc: string;
//   itemPrice: number;
//   itemMinRentDuration: number;
//   itemCondition: string;
//   itemLocation: string;
//   images: string[];
//   paymentSettings?: {
//     downpayment?: {
//       percentage: number;
//       timing: "reservation" | "pickup";
//     };
//   };
//   owner: {
//     id: string;
//     fullname: string;
//   };
// }

const EditListing = () => {
  const { id } = useLocalSearchParams();
  const { setIsLoading: setGlobalLoading } = useLoader();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const cameraRef = useRef<CameraView>(null);

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

  const fetchListingDetails = async () => {
    setGlobalLoading(true);
    try {
      const docRef = doc(db, "items", id as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();

        // Store original data if AI is enabled
        if (data.enableAI) {
          setOriginalData({
            title: data.itemName,
            category: data.itemCategory,
            firstImage: data.images[0],
          });
        }

        setFormData({
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
        });
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

      // Update document with new structure
      await updateDoc(docRef, {
        itemName: formData.title,
        itemCategory: formData.category,
        itemDesc: formData.description,
        itemPrice: Number(formData.price),
        itemMinRentDuration: Number(formData.minimumDays),
        itemCondition: formData.condition,
        enableAI: formData.enableAI,
        // Only include downpaymentPercentage if enabled
        ...(formData.enableDownpayment
          ? { downpaymentPercentage: Number(formData.downpaymentPercentage) }
          : { downpaymentPercentage: null }),
        updatedAt: serverTimestamp(),
        // Make sure first image remains if AI enabled
        images: formData.enableAI
          ? [originalData.firstImage, ...formData.images.slice(1)]
          : formData.images,
      });

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "Listing updated successfully",
      });

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

  // Image handling functions
  const openCamera = async () => {
    if (formData.images.length >= 5) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Limit Reached",
        textBody: "You can only add up to 5 images",
      });
      return;
    }
    setShowCamera(true);
  };

  const captureImage = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync();
      if (photo) {
        const imageUrl = await uploadImage(photo.uri);
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, imageUrl],
        }));
      }
      setShowCamera(false);
    } catch (error) {
      console.error("Camera Error:", error);
    }
  };

  const uploadImage = async (uri: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const imageRef = ref(storage, `items/${id}/image${Date.now()}.jpg`);
    await uploadBytes(imageRef, blob);
    return await getDownloadURL(imageRef);
  };

  const removeImage = (index: number) => {
    if (formData.enableAI && index === 0) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Cannot Remove",
        textBody: "The first image cannot be removed for AI-identified items",
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // Add title similarity check
  const checkTitleSimilarity = (newTitle: string) => {
    if (!formData.enableAI) return true;

    // Only check similarity if newTitle has more than 5 characters
    if (newTitle.length <= 5) return true;

    const similarity = stringSimilarity.compareTwoStrings(
      newTitle.toLowerCase(),
      originalData.title.toLowerCase()
    );

    if (similarity < 0.5) {
      Alert.alert(
        "Warning",
        "The new title is significantly different from the AI-identified title. This might affect item searchability.",
        [
          {
            text: "Keep Original",
            onPress: () => {
              setFormData((prev) => ({ ...prev, title: originalData.title }));
            },
          },
          { text: "Use New", style: "destructive" },
        ]
      );
    }
    return true;
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#5C6EF6" />
      </View>
    );
  }

  return (
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
            <Text className="text-secondary-400 font-pmedium">
              Images ({formData.images.length}/5)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {formData.images.map((uri, index) => (
                <View key={index} className="relative w-24 h-24 mr-2">
                  <Image
                    source={{ uri }}
                    className="w-full h-full rounded-xl"
                  />
                  <TouchableOpacity
                    onPress={() => removeImage(index)}
                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1"
                  >
                    <Image
                      source={icons.close}
                      className="w-4 h-4"
                      tintColor="white"
                    />
                  </TouchableOpacity>
                </View>
              ))}
              {formData.images.length < 5 && (
                <TouchableOpacity
                  onPress={openCamera}
                  className="w-24 h-24 bg-gray-100 rounded-xl items-center justify-center"
                >
                  <Image
                    source={icons.camera}
                    className="w-6 h-6"
                    tintColor="#666"
                  />
                  <Text className="text-xs mt-1">Add Photo</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Title Input */}
          <View className="mt-2">
            <Text className="text-secondary-400 text-lg font-pmedium mb-2">
              Item Name
            </Text>
            <TextInput
              value={formData.title}
              onChangeText={(text) => {
                checkTitleSimilarity(text);
                setFormData((prev) => ({ ...prev, title: text }));
              }}
              // editable={!formData.enableAI}
              placeholder="Enter item name"
              className="border font-pregular text-base border-gray-200 rounded-xl p-3"
            />

            {errors.title ? (
              <Text className="text-red-500 text-xs mt-1">{errors.title}</Text>
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

                  {/* Custom Percentage Input */}
                  {/* <TextInput
                      value={formData.downpaymentPercentage}
                      onChangeText={(text) => {
                        const numValue = parseInt(text);
                        if (text === "" || (numValue > 0 && numValue <= 100)) {
                          setFormData((prev) => ({
                            ...prev,
                            downpaymentPercentage: text,
                          }));
                        }
                      }}
                      className="font-pregular bg-white border rounded-xl p-3 border-gray-200"
                      keyboardType="numeric"
                      placeholder="Enter percentage (10-100)"
                    />
                    <Text className="text-secondary-300 font-pregular text-xs mt-1">
                      Minimum 10%, Maximum 100%
                    </Text> */}
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
                      mapStyle="https://api.maptiler.com/maps/streets-v2/style.json?key=JsHqOp9SqKGMUgYiibdt"
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
          <LargeButton
            title={isSubmitting ? "Updating..." : "Update Listing"}
            handlePress={handleUpdate}
            disabled={isSubmitting}
            textStyles="text-white font-psemibold"
            containerStyles={isSubmitting ? "bg-gray-400" : ""}
          />
        </View>
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <View className="flex-1 bg-black">
          <CameraView ref={cameraRef} className="flex-1">
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
            <TouchableOpacity
              onPress={captureImage}
              className="absolute bottom-10 self-center"
            >
              <View className="w-20 h-20 rounded-full bg-white items-center justify-center">
                <View className="w-16 h-16 rounded-full border-4 border-primary" />
              </View>
            </TouchableOpacity>
          </CameraView>
        </View>
      </Modal>

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
              <TouchableOpacity onPress={() => setShowCategoryDropdown(false)}>
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
              <TouchableOpacity onPress={() => setShowConditionDropdown(false)}>
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
                    formData.condition === condition.value ? "bg-primary/5" : ""
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
  );
};

export default EditListing;
