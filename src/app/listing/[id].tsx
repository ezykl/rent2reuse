import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import React, { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons, images } from "@/constant";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import Carousel from "react-native-reanimated-carousel";
import { LinearGradient } from "expo-linear-gradient";
import { Item } from "@/types/item";

const { width } = Dimensions.get("window");

const ListingDetail = () => {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  useEffect(() => {
    const fetchItem = async () => {
      try {
        const docRef = doc(db, "items", id as string);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setItem({
            id: docSnap.id,
            itemName: data.itemName || "",
            itemPrice: data.itemPrice || 0,
            itemDesc: data.itemDesc || "",
            itemCondition: data.itemCondition || "",
            itemCategory: data.itemCategory || "",
            itemMinRentDuration: data.itemMinRentDuration || 0,
            itemLocation: data.itemLocation || "",
            itemStatus: data.itemStatus || "Available",
            images: Array.isArray(data.images) ? data.images : [],
          } as Item);
        } else {
          Alert.alert("Error", "Item not found");
          router.back();
        }
      } catch (error) {
        Alert.alert("Error", "Failed to load item details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [id]);

  const handleEdit = () => {
    // Verify item status before allowing edit
    if (!isItemAvailable()) {
      Alert.alert(
        "Cannot Edit",
        "This item can only be edited when its status is 'Available'."
      );
      return;
    }
    router.push(`/edit-listing/${id}`);
  };

  const handleDelete = async () => {
    // Verify item status before allowing delete
    if (!isItemAvailable()) {
      Alert.alert(
        "Cannot Delete",
        "This item can only be deleted when its status is 'Available'."
      );
      return;
    }

    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "items", id as string));
            Alert.alert("Success", "Item deleted successfully");
            router.back();
          } catch (error) {
            Alert.alert("Error", "Failed to delete item");
          }
        },
      },
    ]);
  };

  // Helper function to check if the item is available
  const isItemAvailable = () => {
    const status = item?.itemStatus?.toLowerCase();
    return status === "available";
  };

  // Function to handle image carousel navigation
  const nextImage = () => {
    if (item?.images && item.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % item.images!.length);
    }
  };

  const prevImage = () => {
    if (item?.images && item.images.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? item.images!.length - 1 : prev - 1
      );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#5C6EF6" />
      </View>
    );
  }

  return (
    <View
      className="absolute inset-0 bg-white"
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
          <Text className="text-xl font-pbold text-gray-800">Manage Item</Text>
        </View>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Image Section */}
        <View>
          <View className="h-[370px] relative mb-4">
            {item && item.images && item.images.length > 0 ? (
              <>
                <Carousel
                  loop={false}
                  width={width}
                  height={384}
                  autoPlay={false}
                  data={item.images}
                  scrollAnimationDuration={500}
                  onSnapToItem={(index) => {
                    setCurrentImageIndex(index);
                  }}
                  renderItem={({ item: imageUrl, index }) => (
                    <View className="flex-1 items-center justify-center p-2">
                      <View className="w-full h-full relative">
                        <Image
                          source={{ uri: imageUrl as string }}
                          className="w-full h-full rounded-2xl"
                          resizeMode="cover"
                        />
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.7)"]}
                          start={{ x: 0.5, y: 0 }}
                          end={{ x: 0.5, y: 1 }}
                          className="absolute bottom-0 left-0 right-0 h-32 rounded-b-3xl p-4"
                          style={{ borderRadius: 16 }}
                        />
                      </View>
                    </View>
                  )}
                />

                {/* Price and Title */}
                <View className="absolute bottom-0 left-6 right-6">
                  <View className="rounded-xl pb-2">
                    <Text
                      className="text-white text-2xl font-bold mb-1"
                      numberOfLines={1}
                    >
                      {item.itemName}
                    </Text>
                    <View className="flex-row items-baseline">
                      <Text className="text-3xl font-bold text-primary">
                        ₱{item?.itemPrice ?? ""}
                      </Text>
                      <Text className="text-white text-base ml-1">/day</Text>
                    </View>
                  </View>
                </View>

                {/* Image Counter */}
                <View className="absolute top-6 right-6 bg-black/50 px-3 py-1 rounded-full">
                  <Text className="text-white text-sm font-medium">
                    {currentImageIndex + 1}/{item.images.length}
                  </Text>
                </View>
              </>
            ) : (
              <View className="flex-1 items-center justify-center">
                <View className="w-24 h-24 bg-gray-200 rounded-2xl items-center justify-center mb-3">
                  <Image
                    source={images.thumbnail}
                    className="w-12 h-12 opacity-40"
                  />
                </View>
                <Text className="text-gray-400 text-base">
                  No images available
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Details Section */}
        <View className="px-4">
          {/* Item Details */}
          <View className="space-y-2">
            {/* Title */}
            <DetailRow label="Item Name" value={item?.itemName} />

            {/* Category */}
            <DetailRow label="Category" value={item?.itemCategory} />

            {/* Price and Duration Row */}
            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-secondary-400 font-pmedium mb-2">
                  Price per Day
                </Text>
                <View className="flex-row items-center border border-gray-200 rounded-xl p-3">
                  <Text className="font-pregular text-base text-gray-800">
                    ₱{item?.itemPrice}
                  </Text>
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-secondary-400 font-pmedium mb-2">
                  Min. Rental Days
                </Text>
                <View className="border border-gray-200 rounded-xl p-3">
                  <Text className="font-pregular text-base text-gray-800">
                    {item?.itemMinRentDuration} days
                  </Text>
                </View>
              </View>
            </View>

            {/* Condition */}
            <DetailRow label="Item Condition" value={item?.itemCondition} />

            {/* Description */}
            <DetailRow
              label="Description"
              value={item?.itemDesc}
              isMultiline={true}
            />

            {/* Location */}
            {/* <DetailRow
              isMultiline={true}
              label="Location"
              value={item?.itemLocation}
            /> */}

            {/* Status */}
            <DetailRow label="Status" value={item?.itemStatus} />
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <SafeAreaView edges={["bottom"]}>
        <View className="bg-white border-t border-gray-100 px-4 py-4">
          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={handleEdit}
              className={`flex-1 rounded-xl py-4 ${
                isItemAvailable() ? "bg-primary" : "bg-gray-300"
              }`}
            >
              <Text className="text-white text-center font-pbold">
                Edit Listing
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDelete}
              className={`flex-1 rounded-xl py-4 ${
                isItemAvailable() ? "bg-red-500" : "bg-gray-300"
              }`}
            >
              <Text className="text-white text-center font-pbold">Delete</Text>
            </TouchableOpacity>
          </View>

          {!isItemAvailable() && (
            <Text className="text-orange-700 text-center text-sm mt-3">
              Edit and delete actions are only available when the item status is
              "Available"
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

// Update the DetailRow component
const DetailRow = ({
  label,
  value,
  isMultiline = false,
}: {
  label: string;
  value?: string;
  isMultiline?: boolean;
}) => (
  <View className="mb-4">
    <Text className="text-secondary-400 font-pmedium mb-2">{label}</Text>
    <View
      className={`border border-gray-200 rounded-xl p-3 ${
        isMultiline ? "min-h-[120px]" : ""
      }`}
    >
      <Text
        className="font-pregular text-base text-gray-800"
        numberOfLines={isMultiline ? undefined : 1}
      >
        {value || "Not specified"}
      </Text>
    </View>
  </View>
);

export default ListingDetail;
