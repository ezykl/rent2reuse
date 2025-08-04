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
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { icons } from "@/constant";
import LargeButton from "@/components/LargeButton";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebaseConfig";
import { TOOL_CATEGORIES } from "@/constant/tool-categories";
import { CameraView } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useLoader } from "@/context/LoaderContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    price: "",
    minimumDays: "",
    condition: "",
    location: "",
    images: [] as string[],
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
        setFormData({
          title: data.itemName || "",
          category: data.itemCategory || "",
          description: data.itemDesc || "",
          price: data.itemPrice?.toString() || "",
          minimumDays: data.itemMinRentDuration?.toString() || "",
          condition: data.itemCondition || "",
          location: data.itemLocation || "",
          images: data.images || [],
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

      // Update the document
      await updateDoc(docRef, {
        itemName: formData.title,
        itemCategory: formData.category,
        itemDesc: formData.description,
        itemPrice: Number(formData.price),
        itemMinRentDuration: Number(formData.minimumDays),
        itemCondition: formData.condition,
        itemLocation: formData.location,
        updatedAt: new Date(),
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
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
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
            <Text className="text-secondary-400 font-pmedium mb-2">
              Item Name
            </Text>
            <TextInput
              value={formData.title}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, title: text }))
              }
              placeholder="Enter item name"
              className="border font-pregular text-base border-gray-200 rounded-xl p-3"
            />
            {errors.title ? (
              <Text className="text-red-500 text-xs mt-1">{errors.title}</Text>
            ) : null}
          </View>

          {/* Category Selection */}
          <View className="mt-2">
            <Text className="text-secondary-400 font-pmedium mb-2 ">
              Category
            </Text>
            <TouchableOpacity
              onPress={() => setShowCategoryDropdown(true)}
              className="border border-gray-200 rounded-xl p-3"
            >
              <Text className="font-pregular text-base">
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
              <Text className="text-secondary-400 font-pmedium mb-2">
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
              <Text className="text-secondary-400 font-pmedium mb-2">
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
            <Text className="text-secondary-400 font-pmedium">
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
            <Text className="text-secondary-400 font-pmedium">Description</Text>
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

          {/* Location Input */}
          <View className="my-2">
            <Text className="text-secondary-400 font-pmedium">Location</Text>
            <View className="border border-gray-200 rounded-xl p-3">
              <Text className="font-pregular text-base">
                {formData.location || "No location set"}
              </Text>
            </View>
          </View>

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
        animationType="slide"
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
