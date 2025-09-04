import {
  View,
  Text,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Modal,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image as Imagex,
} from "react-native";
import React, { useState, useEffect, useCallback } from "react";
import Carousel from "react-native-reanimated-carousel";
import { icons, images } from "../../constant";
import Header from "@/components/Header";
import Category from "@/components/Category";
import ItemCard from "@/components/ItemCard";
import { router } from "expo-router";
import { db } from "@/lib/firebaseConfig";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useLocation } from "../../hooks/useLocation";

import {
  getDocs,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { useLoader } from "@/context/LoaderContext";
import useProfileCompletion from "@/hooks/useProfileCompletion";
import { useItems } from "@/hooks/useItems";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchBar } from "@/components/SearchBar";

const { width } = Dimensions.get("window");

const Home = () => {
  // Update the useItems hook destructuring to include refreshItems
  const {
    items: recentItems,
    loading: recentLoading,
    refreshItems,
  } = useItems("recent");

  const locationHook = useLocation({
    autoStart: true,
    watchLocation: false,
  });

  const [refreshing, setRefreshing] = useState(false);
  const { isLoading, setIsLoading } = useLoader();
  const insets = useSafeAreaInsets();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isFetchingAnnouncement, setIsFetchingAnnouncement] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [modalKey, setModalKey] = useState(0); // NEW: Force modal re-render
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementItem | null>(null);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [askedLocation, setAskedLocation] = useState(false);
  const [locationServicesEnabled, setLocationServicesEnabled] = useState<
    boolean | null
  >(null);

  const { completionPercentage } = useProfileCompletion();

  const isProfileComplete = completionPercentage >= 100;

  const showProfileProtectionAlert = useCallback(() => {
    setModalKey((prev) => prev + 1); 
    setShowProfileAlert(true);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setIsFetchingAnnouncement(true);
    try {
      // Refresh announcements
      const q = query(
        collection(db, "announcements"),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const activeAnnouncements = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          isActive: doc.data().isActive || false,
          title: doc.data().title || "",
          message: doc.data().message?.replace(/"/g, "") || "",
          imageUrl: doc.data().imageUrl || null,
        }))
        .filter((ann) => ann.isActive);
      setAnnouncements(activeAnnouncements);

      // Refresh items using the exposed refreshItems function
      await refreshItems();
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
      setIsFetchingAnnouncement(false);
    }
  }, [refreshItems]);

  useEffect(() => {
    // Only show alert automatically if profile is incomplete (existing behavior)
    if (completionPercentage < 100) {
      setModalKey((prev) => prev + 1); // Force modal re-render
      setShowProfileAlert(true);
    }
  }, [completionPercentage]);

  useEffect(() => {
    const checkLocationSettings = async () => {
      try {
        // First check if location services are enabled on the device
        const enabled = await Location.hasServicesEnabledAsync();
        setLocationServicesEnabled(enabled);

        if (enabled) {
          // Check current permission status
          const { status } = await Location.getForegroundPermissionsAsync();

          if (status !== "granted" && !askedLocation) {
            // Request permission using native dialog
            const { status: newStatus } =
              await Location.requestForegroundPermissionsAsync();
            setAskedLocation(true);

            if (newStatus === "granted") {
              // Permission granted - you can now use location services
              console.log("Location permission granted");
              // Optionally get current location to verify it works
              try {
                const location = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                console.log("Current location:", location);
              } catch (error) {
                console.error("Error getting location:", error);
              }
            } else {
              console.log("Location permission denied");
            }
          }
        } else {
          // Location services are disabled at the system level
          console.log("Location services are disabled on the device");
        }
      } catch (error) {
        console.error("Error checking location settings:", error);
      }
    };

    // Only check location settings once when component mounts
    if (locationServicesEnabled === null && !askedLocation) {
      checkLocationSettings();
    }
  }, [askedLocation, locationServicesEnabled]);

  useEffect(() => {
    setIsLoading(true);
    const q = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeAnnouncements = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          isActive: doc.data().isActive || false,
          title: doc.data().title || "",
          message: doc.data().message?.replace(/"/g, "") || "",
          imageUrl: doc.data().imageUrl || null,
        }))
        .filter((ann) => ann.isActive);

      setAnnouncements(activeAnnouncements);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleItemPress = useCallback(
    (itemId: string) => {
      if (isProfileComplete) {
        router.push(`/items/${itemId}`);
      } else {
        showProfileProtectionAlert();
      }
    },
    [isProfileComplete, showProfileProtectionAlert]
  );

  // The search press handler remains the same
  const handleSearchPress = useCallback(() => {
    router.push({
      pathname: "/search",
      params: { focusInput: "true" },
    });
  }, []);

  // Add camera press handler
  const handleCameraPress = useCallback(() => {
    router.push({
      pathname: "/search",
      params: { openCamera: "true" },
    });
  }, []);

  interface AnnouncementItem {
    id: string;
    isActive: boolean;
    title: string;
    message: string;
    imageUrl: string | null;
  }

  // FIXED: Better loading state handling
  if (recentLoading) {
    return (
      <SafeAreaView className="bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0000ff" />
          <Text className="mt-4 text-gray-500">Loading items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  interface ItemType {
    id: string;
    itemName: string;
    images: string[];
    itemDesc: string;
    itemPrice: number;
    itemStatus: string;
    itemCondition: string;
    enableAI: boolean;
    itemLocation?: {
      latitude: number;
      longitude: number;
      address?: string; //
    };
    owner: {
      id: string;
      fullname: string;
    };
  }

  const renderItemCard = ({ item }: { item: ItemType }) => {
    if (!item) return null;

    const locationData =
      item.itemLocation && typeof item.itemLocation === "object"
        ? {
            latitude: item.itemLocation.latitude,
            longitude: item.itemLocation.longitude,
          }
        : null;

    return (
      <ItemCard
        title={item.itemName}
        thumbnail={item.images}
        description={isProfileComplete ? item.itemDesc : undefined}
        price={isProfileComplete ? item.itemPrice : undefined}
        status={isProfileComplete ? item.itemStatus : undefined}
        condition={isProfileComplete ? item.itemCondition : undefined}
        itemLocation={
          isProfileComplete && locationData ? locationData : undefined
        }
        owner={isProfileComplete ? item.owner : undefined}
        showProtectionOverlay={!isProfileComplete}
        enableAI={item.enableAI}
        onPress={() => handleItemPress(item.id)}
        userLocationProp={locationHook.userLocation}
        isLocationLoading={locationHook.isLoading}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white h-full px-4">
      <View
        style={{
          paddingBottom: insets.bottom + 25,
          paddingTop: insets.top,
        }}
      >
        <Header />

        <FlatList<ItemType>
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#4BD07F"]} // Use your primary color
              tintColor="#56D07F"
            />
          }
          data={recentItems}
          key={2}
          numColumns={2}
          columnWrapperStyle={{
            gap: 8,
            justifyContent: "space-between",
            paddingHorizontal: 0,
          }}
          contentContainerStyle={{
            paddingBottom: 20,
            gap: 8,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={renderItemCard}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={() => (
            <>
              {/* Search Bar */}
              <SearchBar
                onPress={handleSearchPress}
                onCameraPress={handleCameraPress}
              />

              {/* Profile Completion Alert */}
              {!isProfileComplete && (
                <View className=" mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  {/* Progress Header with Toggle */}

                  <TouchableOpacity
                    onPress={() => setShowFullDetails(!showFullDetails)}
                    className="flex-row items-center justify-between mb-3"
                  >
                    <View className="flex-row items-center flex-1">
                      <Imagex source={icons.danger} className="w-5 h-5 mr-2" />
                      <Text className="text-yellow-800 font-pbold flex-1">
                        Complete Your Profile
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-yellow-800 font-pbold mr-2">
                        {completionPercentage}%
                      </Text>

                      <Imagex
                        source={
                          showFullDetails ? icons.arrowDown : icons.arrowRight
                        }
                        className="w-4 h-4"
                        tintColor="#92400E"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Progress Bar */}
                  <View className="bg-yellow-200 rounded-full h-2 mb-3">
                    <View
                      className="bg-yellow-500 h-2 rounded-full"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </View>

                  {/* Expandable Content */}
                  {showFullDetails && (
                    <>
                      {/* Benefits List */}
                      <View className="mb-4">
                        <View className="flex-row items-center mb-2">
                          <Imagex
                            source={icons.verified}
                            className="w-4 h-4 mr-2"
                          />
                          <Text className="text-yellow-800 text-sm">
                            Get Verified Badge
                          </Text>
                        </View>
                        <View className="flex-row items-center mb-2">
                          <Imagex
                            source={icons.bronzePlan}
                            className="w-4 h-4 mr-2"
                          />
                          <Text className="text-yellow-800 text-sm">
                            Free Bronze Plan Access
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <Imagex
                            source={icons.eye}
                            className="w-4 h-4 mr-2"
                            tintColor="#92400E"
                          />
                          <Text className="text-yellow-800 text-sm">
                            View Full Item Details
                          </Text>
                        </View>
                      </View>

                      {/* Complete Profile Button */}
                      <TouchableOpacity
                        onPress={() => router.push("/profile")}
                        className="bg-yellow-600 py-3 rounded-lg"
                      >
                        <Text className="text-white text-center font-pbold">
                          Complete Profile Now
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Announcements Carousel */}

              {Array.isArray(announcements) && announcements.length > 0 && (
                <View className="mt-4">
                  <Text className="text-2xl text-secondary-400 font-psemibold mb-2">
                    Latest News
                  </Text>

                  <Carousel
                    loop
                    width={width - 32}
                    height={180}
                    autoPlay={true}
                    data={announcements}
                    scrollAnimationDuration={1000}
                    autoPlayInterval={3000}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => router.push(`/announcement/${item.id}`)}
                        className="flex-1 bg-white rounded-xl overflow-hidden border border-gray-100"
                      >
                        {item.imageUrl ? (
                          <Image
                            source={{ uri: item.imageUrl }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                            transition={300}
                            cachePolicy="memory-disk"
                            recyclingKey={`announcement-${item.id}-${
                              refreshing ? Date.now() : ""
                            }`}
                            onError={(error) => {
                              console.error("Image loading error:", error);
                            }}
                          />
                        ) : (
                          <View className="flex-1 justify-center p-4 bg-primary">
                            <Text className="text-xl font-pbold text-white text-center mb-2">
                              {item.title}
                            </Text>
                            <Text
                              className="text-white text-center"
                              numberOfLines={2}
                            >
                              {item.message}
                            </Text>
                          </View>
                        )}
                        <View className="absolute bottom-0 left-0 right-0 bg-black/50 p-3">
                          <Text
                            className="text-white font-pbold text-center"
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}

              <Category />
              <Text className="text-2xl text-secondary-400 font-psemibold mt-10 mb-2">
                Recently Added
              </Text>
            </>
          )}
        />
      </View>
    </SafeAreaView>
  );
};

export default Home;
