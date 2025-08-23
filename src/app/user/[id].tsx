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
import { useState, useEffect } from "react";
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
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get("window");
  const { isLoading, setIsLoading } = useLoader();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userItems, setUserItems] = useState<Item[]>([]);

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
        console.error("Error fetching user data:", error);
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

  const formatFirestoreDate = (firestoreTimestamp: any) => {
    try {
      if (!firestoreTimestamp) return "recently";

      // Firestore Timestamps have a .toDate() method
      if (
        firestoreTimestamp.toDate &&
        typeof firestoreTimestamp.toDate === "function"
      ) {
        const date = firestoreTimestamp.toDate();
        return formatDistance(date, new Date(), { addSuffix: true });
      }

      // Fallback for string dates (shouldn't happen with proper Firestore usage)
      if (typeof firestoreTimestamp === "string") {
        const date = new Date(firestoreTimestamp);
        if (!isNaN(date.getTime())) {
          return formatDistance(date, new Date(), { addSuffix: true });
        }
      }

      return "recently";
    } catch (error) {
      console.error("Error formatting Firestore date:", error);
      return "recently";
    }
  };

  // Render item card
  const renderItemCard = ({ item }: { item: Item }) => (
    <TouchableOpacity
      className="w-[48%] mb-4"
      onPress={() => router.push(`/items/${item.id}`)}
    >
      <View className="bg-white rounded-xl overflow-hidden border border-gray-100">
        <View className="aspect-square">
          {item.images && item.images[0] ? (
            <Image
              source={{ uri: item.images[0] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-gray-100 items-center justify-center">
              <Image source={images.empty} className="w-12 h-12 opacity-30" />
            </View>
          )}
        </View>
        <View className="p-3">
          <Text
            className="text-lg font-pbold text-gray-900 mb-1"
            numberOfLines={1}
          >
            {item.itemName}
          </Text>
          <Text className="text-primary text-base font-pbold">
            ₱{item.itemPrice}
            <Text className="text-gray-500 text-sm font-pregular">/day</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <Text className="text-xl font-pbold text-gray-800">Item Details</Text>
        </View>
        <View className="w-8" />
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
                Created {formatFirestoreDate(userProfile?.createdAt)}
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
                <View className="flex-row items-center">
                  <Image
                    source={icons.location}
                    className="w-4 h-4 mr-2"
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
          <View className="flex-1 items-center justify-center p-8">
            <Image
              source={icons.emptyBox}
              className="w-20 h-20 opacity-30 mb-4"
            />
            <Text className="text-gray-500 text-center">
              This user hasn't listed any items yet
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
