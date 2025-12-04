import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { formatDistance, set } from "date-fns";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons, images } from "@/constant";
import { Item } from "@/types/item";
import { useLoader } from "@/context/LoaderContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ItemCard from "@/components/ItemCard";
import { useLocation } from "@/hooks/useLocation";
import LottieView from "lottie-react-native";
import { useAuth } from "@/context/AuthContext";

interface UserProfile {
  id: string;
  firstname: string;
  middlename?: string;
  lastname: string;
  email: string;
  profileImage?: string;
  averageRating?: number;
  totalRatings?: number;
  createdAt: any;
  location?: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
}

export default function UserProfile() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get("window");
  const { isLoading, setIsLoading } = useLoader();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const locationHook = useLocation({
    autoStart: true,
    watchLocation: false,
  });
  // Fetch user profile and items
  useEffect(() => {
    const fetchUserProfileAndItems = async () => {
      try {
        setIsLoading(true);

        // Fetch user profile
        const userDoc = await getDoc(doc(db, "users", id as string));
        if (userDoc.exists()) {
          setUserProfile({
            id: userDoc.id,
            ...userDoc.data(),
          } as UserProfile);
        }

        // Fetch user's items
        const itemsQuery = query(
          collection(db, "items"),
          where("owner.id", "==", id)
        );
        const itemsSnap = await getDocs(itemsQuery);
        const items = itemsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Item[];
        setUserItems(items);
      } catch (error) {
        console.log("Error fetching user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchUserProfileAndItems();
    }
  }, [id]);

  const getInitials = (name: string) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "?";
  };

  const handleItemPress = useCallback((itemId: string) => {
    router.push(`/items/${itemId}`);
  }, []);

  const formatFirestoreDate = (firestoreTimestamp: any) => {
    try {
      if (!firestoreTimestamp) return "recently";

      if (
        firestoreTimestamp.toDate &&
        typeof firestoreTimestamp.toDate === "function"
      ) {
        const date = firestoreTimestamp.toDate();
        return formatDistance(date, new Date(), { addSuffix: true });
      }

      if (typeof firestoreTimestamp === "string") {
        const date = new Date(firestoreTimestamp);
        if (!isNaN(date.getTime())) {
          return formatDistance(date, new Date(), { addSuffix: true });
        }
      }

      return "recently";
    } catch (error) {
      console.log("Error formatting Firestore date:", error);
      return "recently";
    }
  };

  const renderItemCard = ({ item }: { item: Item }) => {
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
        description={item.itemDesc}
        price={item.itemPrice}
        status={item.itemStatus}
        condition={item.itemCondition}
        itemLocation={locationData ? locationData : undefined}
        owner={item.owner}
        enableAI={item.enableAI}
        onPress={() => handleItemPress(item.id)}
        userLocationProp={locationHook.userLocation}
        isLocationLoading={locationHook.isLoading}
      />
    );
  };

  // Render stars for rating
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      stars.push(
        <Text
          key={i}
          className={`text-sm ${
            i < fullStars
              ? "text-yellow-500"
              : i === fullStars && hasHalfStar
              ? "text-yellow-500"
              : "text-gray-300"
          }`}
        >
          {i < fullStars ? "★" : i === fullStars && hasHalfStar ? "☆" : "★"}
        </Text>
      );
    }
    return stars;
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top + 10 }}
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
          <Text className="text-xl font-pbold text-gray-800">User Details</Text>
        </View>
        <View className="flex-row items-center">
          {/* Edit/Report button */}
          {user?.uid === id ? (
            // Edit button for own profile
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              className="mr-3"
            >
              <Image
                source={icons.edit} // Make sure you have this icon
                className="w-6 h-6"
                tintColor="#3B82F6"
              />
            </TouchableOpacity>
          ) : (
            // Report button for other users
            <TouchableOpacity
              onPress={() => router.push(`/report/${userProfile?.id}`)}
              className="mr-3"
            >
              <Image
                source={icons.report}
                className="w-6 h-6"
                tintColor="#EF4444"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={userItems}
        renderItem={renderItemCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between",
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View className="p-4">
            {/* Profile Section */}
            <View className="items-center mb-6">
              <View className="w-24 h-24 rounded-full bg-gray-100  overflow-hidden">
                {userProfile?.profileImage ? (
                  <Image
                    source={{ uri: userProfile.profileImage }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full bg-primary justify-center items-center">
                    <Text className="font-pbold text-2xl text-white">
                      {getInitials(userProfile?.firstname || "")}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="mt-2 font-pbold text-xl text-gray-900 ">
                {userProfile?.firstname}{" "}
                {userProfile?.middlename &&
                  ` ${getInitials(userProfile.middlename)}.`}{" "}
                {userProfile?.lastname}
              </Text>
              <Text className="text-gray-500 text-sm ">
                Joined {formatFirestoreDate(userProfile?.createdAt)}
              </Text>

              <View className="flex-row items-center bg-blue-50 px-2 py-1 rounded-full">
                <Image
                  source={icons.verified}
                  className="w-4 h-4"
                  resizeMode="contain"
                />
                <Text className="text-xs font-pmedium text-blue-600 ml-1">
                  Verified
                </Text>
              </View>

              {userProfile?.averageRating ? (
                <View className="flex-row items-center mb-2">
                  <View className="flex-row mr-2">
                    {renderStars(userProfile.averageRating)}
                  </View>
                  <Text className="text-gray-600">
                    ({userProfile.totalRatings} reviews)
                  </Text>
                </View>
              ) : (
                <Text className="text-gray-500 mb-2">No ratings yet</Text>
              )}
              {userProfile?.location?.address && (
                <View className=" gap-4 px-6 flex-row items-center">
                  <Image
                    source={icons.location}
                    className="w-6 h-6"
                    tintColor="#6B7280"
                  />
                  <Text className="text-gray-600">
                    {userProfile.location.address}
                  </Text>
                </View>
              )}
            </View>

            {/* Items Section Header */}
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-pbold text-gray-900">
                Listed Items ({userItems.length})
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center">
            <LottieView
              source={require("../../assets/lottie/BoxOpen.json")}
              autoPlay
              loop={false}
              speed={0.5}
              style={{ width: 200, height: 200, marginTop: 40 }}
            />
            <Text className="text-gray-500 -mt-8">
              This user hasn't listed any items yet
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
