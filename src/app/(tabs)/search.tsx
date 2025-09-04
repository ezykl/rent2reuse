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
  BackHandler,
} from "react-native";
import { useLocation } from "@/hooks/useLocation";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { icons, images } from "@/constant";
import { SafeAreaView } from "react-native-safe-area-context";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { R2R_MODEL } from "@/constant/api";
import { useItemSearch } from "@/hooks/useItemSearch";
import { useItemViews } from "@/hooks/useItemViews";
import { Item } from "@/types/item";
import ItemCard from "@/components/ItemCard";
import { useLoader } from "@/context/LoaderContext";
import useProfileCompletion from "@/hooks/useProfileCompletion";
import { SearchBar } from "@/components/SearchBar";
import Animated, { useSharedValue, withSpring } from "react-native-reanimated";
import { useSearchTransition } from "@/context/SearchTransitionContext";
import { LocationUtils } from "@/utils/locationUtils";

const { width } = Dimensions.get("window");

const Search = () => {
  const { openCamera, focusInput } = useLocalSearchParams();
  const { completionPercentage } = useProfileCompletion();
  const isProfileComplete = completionPercentage >= 100;
  const [searchQuery, setSearchQuery] = useState("");
  const { category } = useLocalSearchParams<{ category: string }>();
  const { isLoading, setIsLoading } = useLoader();
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    priceRange: { min: null as number | null, max: null as number | null },
    condition: [] as string[],
    location: [] as string[],
    radius: null as number | null,
    category: null as string | null,
  });
  const [showImagePicker, setShowImagePicker] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { startPosition, shouldAnimate, setShouldAnimate } =
    useSearchTransition();
  const translateY = useSharedValue(0);

  const { searchItems, popularItems: popularSearches } = useItemSearch();
  const { trackItemView } = useItemViews();

  const { userLocation, isLoading: locationLoading } = useLocation({
    autoStart: true,
    watchLocation: false,
  });

  // Define handleImageSelection in parent scope
  const handleImageSelection = async (type: "camera" | "gallery") => {
    try {
      let result;
      if (type === "camera") {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1,
        });
      }

      if (!result.canceled && result.assets?.[0]) {
        setShowImagePicker(false);
        handleImageProcess(result.assets[0].uri);
      } else {
        // Camera was closed without taking picture
        setShowImagePicker(false);
        // Clear the openCamera parameter
        router.setParams({ openCamera: "false" });
      }
    } catch (error) {
      // console.error("Image selection error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to select image. Please try again.",
      });
      // Also clear states on error
      setShowImagePicker(false);
      router.setParams({ openCamera: "false" });
    }
  };

  useEffect(() => {
    if (openCamera === "true") {
      // Set timeout to ensure component is mounted
      setTimeout(() => {
        setShowImagePicker(true);
        handleImageSelection("camera");
      }, 100);
    }
    // Clean up function to reset states when component unmounts or openCamera changes
    return () => {
      setShowImagePicker(false);
    };
  }, [openCamera]);

  // Update the useEffect for input focus
  useEffect(() => {
    const focusTimeout = setTimeout(() => {
      if (inputRef.current && focusInput === "true") {
        inputRef.current.focus();
      }
    }, 100);

    return () => {
      clearTimeout(focusTimeout);
      Keyboard.dismiss();
    };
  }, [focusInput]);

  // Handle animation when mounting
  useEffect(() => {
    if (shouldAnimate) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 90,
      });
      // Reset the animation flag after starting
      setShouldAnimate(false);
    }
  }, [shouldAnimate]);

  // Handle AI prediction result
  const handlePredictionResult = async (prediction: any) => {
    if (!prediction || !Array.isArray(prediction)) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Warning",
        textBody: "Could not identify the item. Please try again.",
      });
      return;
    }

    const topPrediction = prediction[0];
    const predictedItem = topPrediction["Predicted Item"];

    // Update search query state
    setSearchQuery(predictedItem);

    // Then perform search
    await handleSearch(predictedItem);
  };

  // Handle image processing
  const handleImageProcess = async (uri: string) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri,
        name: "image.jpg",
        type: "image/jpeg",
      } as any);

      const response = await fetch(R2R_MODEL, {
        method: "POST",
        body: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      const result = await response.json();
      await handlePredictionResult(result);
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to process image. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  // SearchBar component
  const SearchBarComponent = () => {
    const [localSearchQuery, setLocalSearchQuery] = useState(
      category || searchQuery
    );
    // showImagePicker and setShowImagePicker are now lifted to parent
    const [showImagePicker, setShowImagePicker] = useState(false);

    // Add this function to properly clear search and category
    const handleClear = () => {
      setLocalSearchQuery("");
      setSearchQuery("");
      setSearchResults([]);
      // Clear the category from router params
      router.setParams({ category: "" });
    };

    // Simplified handleTextChange - just update local state
    const handleTextChange = (text: string) => {
      setLocalSearchQuery(text);
    };

    // Handle search submission
    const handleSubmit = () => {
      if (localSearchQuery.trim()) {
        setSearchQuery(localSearchQuery);
        Keyboard.dismiss();
        handleSearch(localSearchQuery.trim());
      }
    };

    const handleImageSelection = async (type: "camera" | "gallery") => {
      try {
        let result;
        if (type === "camera") {
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
          });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
          });
        }

        if (!result.canceled && result.assets?.[0]) {
          setShowImagePicker(false);
          handleImageProcess(result.assets[0].uri);
        }
      } catch (error) {
        // console.error("Image selection error:", error);
        Toast.show({
          type: ALERT_TYPE.DANGER,
          title: "Error",
          textBody: "Failed to select image. Please try again.",
        });
      }
    };

    return (
      <View>
        <View className="mb-4 bg-white border-secondary-300 h-16 pl-4 flex-row w-full border rounded-xl items-center shadow-sm">
          {localSearchQuery ? undefined : (
            <Image
              source={icons.search}
              className="w-6 h-6"
              resizeMode="contain"
            />
          )}

          <TextInput
            ref={inputRef}
            value={localSearchQuery}
            onChangeText={handleTextChange}
            textAlignVertical="center"
            placeholder="What are you looking for?"
            placeholderTextColor="#A0AEC0"
            className="flex-1 text-secondary-400 text-base px-3  py-4 font-pregular "
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {localSearchQuery ? (
            <View className="flex-row items-center gap-2 ">
              <TouchableOpacity onPress={handleClear}>
                <Image source={icons.close} className="w-6 h-6" />
              </TouchableOpacity>
              {/* Updated filter button */}
              <TouchableOpacity
                onPress={() => setShowFilter(true)}
                className="relative  "
              >
                <Image
                  source={icons.filter}
                  className={`w-8 h-8 ${
                    hasActiveFilters(activeFilters) ? "tint-primary" : ""
                  }`}
                  resizeMode="contain"
                />
                {hasActiveFilters(activeFilters) && (
                  <View className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                className="bg-primary p-2 overflow-hidden rounded-r-xl  flex-row flex justify-center items-center"
              >
                <Image
                  source={icons.search}
                  className="w-6 h-6 tint-white m-3"
                  style={{ tintColor: "white" }}
                />
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-row items-center gap-2 mr-4">
              {/* Updated filter button */}
              <TouchableOpacity
                onPress={() => setShowFilter(true)}
                className="relative"
              >
                <Image
                  source={icons.filter}
                  className={`w-8 h-8 ${
                    hasActiveFilters(activeFilters) ? "tint-primary" : ""
                  }`}
                />
                {hasActiveFilters(activeFilters) && (
                  <View className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowImagePicker(true)}>
                <Image source={icons.searchAi} className="ml-2 w-6 h-6" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Image picker modal */}
        <Modal
          visible={showImagePicker}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowImagePicker(false);
            router.setParams({ openCamera: "false" });
          }}
        >
          <TouchableOpacity
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setShowImagePicker(false)}
          >
            <View className="bg-white rounded-t-3xl p-6">
              <Text className="text-xl font-psemibold text-center mb-6">
                Select Image Source
              </Text>
              <View className="flex-row justify-around mb-6">
                <TouchableOpacity
                  onPress={() => handleImageSelection("camera")}
                  className="items-center"
                >
                  <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-2">
                    <Image
                      source={icons.camera}
                      className="w-8 h-8"
                      tintColor={"#fff"}
                    />
                  </View>
                  <Text className="text-sm font-pmedium">Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleImageSelection("gallery")}
                  className="items-center"
                >
                  <View className="w-16 h-16 bg-blue-400 rounded-full items-center justify-center mb-2">
                    <Image
                      source={icons.gallery}
                      className="w-8 h-8 "
                      tintColor={"#fff"}
                    />
                  </View>
                  <Text className="text-sm font-pmedium">Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Filter modal */}
        <FilterModal />

        {/* Loading indicator */}
        {isLoading && (
          <View className="flex justify-center">
            <View className="bg-white p-4 rounded-xl"></View>
          </View>
        )}
      </View>
    );
  };

  // Filter modal component
  const FilterModal = () => {
    const [tempFilters, setTempFilters] = useState(activeFilters);
    const conditions = [
      "New",
      "Like New",
      "Very Good",
      "Good",
      "Fair",
      "Worn but Usable",
    ];

    const radiusOptions = [1, 5, 10, 25, 50];

    return (
      <Modal
        visible={showFilter}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilter(false)}
      >
        <View className="flex-1 bg-black/50">
          <View className="bg-white h-4/5 mt-auto rounded-t-3xl">
            {/* Header */}
            <View className="p-4 border-b border-gray-200">
              <View className="flex-row justify-between items-center">
                <TouchableOpacity onPress={() => setShowFilter(false)}>
                  <Text className="text-red-600 font-pregular">Cancel</Text>
                </TouchableOpacity>
                <Text className="text-lg font-psemibold">Filters</Text>
                <TouchableOpacity
                  onPress={() => {
                    setActiveFilters(tempFilters);
                    setShowFilter(false);
                    handleSearch();
                  }}
                >
                  <Text className="text-primary font-pregular">Apply</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="p-4">
              {/* Price Range */}
              <View className="mb-6">
                <Text className="text-base font-psemibold mb-4">
                  Price Range
                </Text>
                <View className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text className="text-sm text-gray-600 mb-2">
                      Min Price
                    </Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3"
                      keyboardType="numeric"
                      placeholder="0"
                      value={tempFilters.priceRange.min?.toString() || ""}
                      onChangeText={(value) => {
                        const numValue = value ? parseInt(value) : null;
                        setTempFilters((prev) => ({
                          ...prev,
                          priceRange: {
                            ...prev.priceRange,
                            min: numValue,
                          },
                        }));
                      }}
                    />
                  </View>
                  <Text className="text-gray-400">-</Text>
                  <View className="flex-1">
                    <Text className="text-sm text-gray-600 mb-2">
                      Max Price
                    </Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3"
                      keyboardType="numeric"
                      placeholder="Any"
                      value={tempFilters.priceRange.max?.toString() || ""}
                      onChangeText={(value) => {
                        const numValue = value ? parseInt(value) : null;
                        setTempFilters((prev) => ({
                          ...prev,
                          priceRange: {
                            ...prev.priceRange,
                            max: numValue,
                          },
                        }));
                      }}
                    />
                  </View>
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-base font-psemibold mb-4">
                  Distance from me
                </Text>
                {!userLocation ? (
                  <Text className="text-sm text-gray-500 italic">
                    Location permission required for distance filtering
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    <TouchableOpacity
                      className={`px-4 py-2 rounded-full border ${
                        tempFilters.radius === null
                          ? "bg-primary border-primary"
                          : "border-gray-300"
                      }`}
                      onPress={() => {
                        setTempFilters((prev) => ({
                          ...prev,
                          radius: null,
                        }));
                      }}
                    >
                      <Text
                        className={
                          tempFilters.radius === null
                            ? "text-white"
                            : "text-gray-600"
                        }
                      >
                        Any distance
                      </Text>
                    </TouchableOpacity>
                    {radiusOptions.map((radius) => (
                      <TouchableOpacity
                        key={radius}
                        className={`px-4 py-2 rounded-full border ${
                          tempFilters.radius === radius
                            ? "bg-primary border-primary"
                            : "border-gray-300"
                        }`}
                        onPress={() => {
                          setTempFilters((prev) => ({
                            ...prev,
                            radius: radius,
                          }));
                        }}
                      >
                        <Text
                          className={
                            tempFilters.radius === radius
                              ? "text-white"
                              : "text-gray-600"
                          }
                        >
                          Within {radius} km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Condition */}
              <View className="mb-6">
                <Text className="text-base font-psemibold mb-4">Condition</Text>
                <View className="flex-row flex-wrap gap-2">
                  {conditions.map((condition) => (
                    <TouchableOpacity
                      key={condition}
                      className={`px-4 py-2 rounded-full border ${
                        tempFilters.condition.includes(condition)
                          ? "bg-primary border-primary"
                          : "border-gray-300"
                      }`}
                      onPress={() => {
                        setTempFilters((prev) => ({
                          ...prev,
                          condition: prev.condition.includes(condition)
                            ? prev.condition.filter((c) => c !== condition)
                            : [...prev.condition, condition],
                        }));
                      }}
                    >
                      <Text
                        className={
                          tempFilters.condition.includes(condition)
                            ? "text-white"
                            : "text-gray-600"
                        }
                      >
                        {condition}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // Update handleSearch function
  const handleSearch = async (directQuery?: string) => {
    const queryToUse = directQuery || searchQuery;
    if (!queryToUse.trim()) return;

    setIsLoading(true);
    try {
      let results = await searchItems(queryToUse.trim(), false);

      // Filter for available items first
      results = results.filter(
        (item) =>
          item.itemStatus && item.itemStatus.toLowerCase() === "available"
      );

      // Apply other filters
      if (activeFilters) {
        results = results.filter((item) => {
          // Price range filter
          if (
            activeFilters.priceRange.min !== null &&
            item.itemPrice < activeFilters.priceRange.min
          ) {
            return false;
          }
          if (
            activeFilters.priceRange.max !== null &&
            item.itemPrice > activeFilters.priceRange.max
          ) {
            return false;
          }

          // Condition filter
          if (
            activeFilters.condition.length > 0 &&
            !activeFilters.condition.includes(item.itemCondition)
          ) {
            return false;
          }

          // Location filter
          if (
            activeFilters.location.length > 0 &&
            !activeFilters.location.includes(item.itemLocation.address)
          ) {
            return false;
          }

          if (
            activeFilters.radius !== null &&
            userLocation &&
            item.itemLocation
          ) {
            const distance = LocationUtils.Distance.calculateUserToItemDistance(
              userLocation,
              {
                latitude: item.itemLocation.latitude,
                longitude: item.itemLocation.longitude,
              }
            );

            if (distance && distance.kilometers > activeFilters.radius) {
              return false;
            }
          }

          if (activeFilters.category && activeFilters.category !== queryToUse) {
            return false;
          }

          return true;
        });
      }

      if (userLocation && results.length > 0) {
        results = results
          .map((item) => ({
            ...item,
            distanceResult:
              item.itemLocation?.latitude && item.itemLocation?.longitude
                ? LocationUtils.Distance.calculateUserToItemDistance(
                    userLocation,
                    {
                      latitude: item.itemLocation.latitude,
                      longitude: item.itemLocation.longitude,
                    }
                  )
                : null,
          }))
          .sort((a, b) => {
            // Items with no location go to end
            if (!a.distanceResult && !b.distanceResult) return 0;
            if (!a.distanceResult) return 1;
            if (!b.distanceResult) return -1;
            return a.distanceResult.kilometers - b.distanceResult.kilometers;
          });
      }

      setSearchResults(results);
    } catch (error) {
      // ... error handling
    } finally {
      setIsLoading(false);
    }
  };

  // Update popular search handler
  const handleCategorySearch = async (categoryName: string) => {
    setIsLoading(true);
    try {
      let results = await searchItems(categoryName, true);

      // Filter for available items only
      results = results.filter(
        (item) =>
          item.itemStatus && item.itemStatus.toLowerCase() === "available"
      );

      setSearchResults(results);
    } catch (error) {
      // console.error("Category search error:", error);
      setSearchResults([]);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to load category items. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add this near the top of your component

  // Add this effect to handle initial category search
  useEffect(() => {
    if (category) {
      setSearchQuery(category);
      handleCategorySearch(category);
    } else {
      // Clear search results when no category is selected
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [category]);

  // Add this helper function at the top of your component
  const hasActiveFilters = (filters: typeof activeFilters) => {
    return (
      filters.condition.length > 0 ||
      filters.location.length > 0 ||
      filters.priceRange.min !== null ||
      filters.priceRange.max !== null ||
      filters.radius !== null
    );
  };

  // Add this near your other useEffects
  useEffect(() => {
    const unsubscribe = () => {
      // Reset focus parameter when component unmounts or user navigates back
      if (focusInput === "true") {
        router.setParams({ focusInput: "false" });
      }
    };

    // Add listener for hardware back button
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        unsubscribe();
        return false; // Let the default back behavior continue
      }
    );

    // Cleanup on component unmount
    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, [focusInput]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-5 items-center w-full">
          <Animated.View
            style={[
              {
                transform: [{ translateY }],
              },
              { width: "100%" },
            ]}
          >
            <SearchBarComponent />
          </Animated.View>

          {/* Rest of content */}
          {isLoading ? (
            <View className="flex- bg-white " />
          ) : searchResults.length > 0 ? (
            // Show search results
            <View className="w-full mt-6">
              <Text className="text-secondary-400 text-lg font-psemibold mb-3">
                Search Results ({searchResults.length} available items)
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {searchResults.map((item) => (
                  <ItemCard
                    key={item.id}
                    title={item.itemName}
                    thumbnail={item.images}
                    description={isProfileComplete ? item.itemDesc : undefined}
                    price={isProfileComplete ? item.itemPrice : undefined}
                    status="available"
                    condition={
                      isProfileComplete ? item.itemCondition : undefined
                    }
                    itemLocation={
                      isProfileComplete ? item.itemLocation : undefined
                    }
                    owner={isProfileComplete ? item.owner : undefined}
                    showProtectionOverlay={!isProfileComplete}
                    userLocationProp={userLocation}
                    onPress={() => {
                      trackItemView(item.id);
                      if (!isProfileComplete) {
                        Toast.show({
                          type: ALERT_TYPE.WARNING,
                          title: "Complete Your Profile",
                          textBody:
                            "Please complete your profile to view item details.",
                        });
                      } else {
                        router.push(`/items/${item.id}`);
                      }
                    }}
                  />
                ))}
              </View>
            </View>
          ) : (
            // Only show popular searches if there are any
            popularSearches.length > 0 && (
              <View className="w-full mt-2">
                <Text className="text-secondary-400 text-lg font-psemibold mb-2">
                  Popular searches
                </Text>
                <View className="flex-row flex-wrap  gap-2">
                  {popularSearches.map((category, index) => (
                    <TouchableOpacity
                      key={index}
                      className="bg-gray-100 px-2 py-2 rounded-full mb-2"
                      onPress={async () => {
                        setIsLoading(true); // Start loading
                        try {
                          setSearchQuery(category);
                          // Get filtered results for available items
                          const results = await searchItems(category, true);
                          const availableResults = results.filter(
                            (item) =>
                              item.itemStatus &&
                              item.itemStatus.toLowerCase() === "available"
                          );
                          setSearchResults(availableResults);
                        } catch (error) {
                          // console.error("Popular search error:", error);
                          Toast.show({
                            type: ALERT_TYPE.DANGER,
                            title: "Error",
                            textBody: "Failed to load items. Please try again.",
                          });
                        } finally {
                          setIsLoading(false); // End loading
                        }
                      }}
                    >
                      <Text className="text-secondary-400 text-sm font-pregular">
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )
          )}

          {/* Show "No results found" when search is performed but no results */}
          {!isLoading && searchQuery && searchResults.length === 0 && (
            <View className="w-full mt-6 items-center">
              <Image
                source={images.empty}
                className="w-40 h-40 opacity-50"
                resizeMode="contain"
              />
              <Text className="text-secondary-300 text-lg font-psemibold mt-4">
                No results found
              </Text>
              <Text className="text-secondary-300 text-sm font-pregular text-center mt-2">
                Try adjusting your search to find what you're looking for
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Search;
