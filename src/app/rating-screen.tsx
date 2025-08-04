import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { icons, images } from "@/constant";
import {
  fetchUserRating,
  getUserRatings,
  renderStarsArray,
  formatRating,
  getRatingColor,
  UserRating,
  Rating,
} from "@/utils/ratingUtils";
import { useAuth } from "@/context/AuthContext";
import RatingModal from "@/components/RatingModal";

interface UserProfile {
  id: string;
  fullname: string;
  email: string;
  // Add other user fields as needed
}

export default function UserRatingsScreen() {
  const { userId } = useLocalSearchParams();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRating, setUserRating] = useState<UserRating | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasUserRated, setHasUserRated] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch user profile
      const userDoc = await getDoc(doc(db, "users", userId as string));
      if (userDoc.exists()) {
        setUserProfile({
          id: userDoc.id,
          ...userDoc.data(),
        } as UserProfile);
      }

      // Fetch user ratings
      const [ratingData, ratingsData] = await Promise.all([
        fetchUserRating(userId as string),
        getUserRatings(userId as string),
      ]);

      setUserRating(ratingData);
      setRatings(ratingsData);

      // Check if current user has already rated this user
      if (user?.uid && user.uid !== userId) {
        const hasRated = ratingsData.some(
          (rating) => rating.raterUserId === user.uid
        );
        setHasUserRated(hasRated);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const renderStars = (rating: number) => {
    const stars = renderStarsArray(rating);
    return (
      <View className="flex-row">
        {stars.map((star) => (
          <Text
            key={star.key}
            className={`text-sm ${
              star.type === "full"
                ? "text-yellow-500"
                : star.type === "half"
                ? "text-yellow-500"
                : "text-gray-300"
            }`}
          >
            {star.type === "half" ? "☆" : "★"}
          </Text>
        ))}
      </View>
    );
  };

  const renderRatingDistribution = () => {
    if (!userRating?.ratingCount) return null;

    const maxCount = Math.max(...Object.values(userRating.ratingCount));

    return (
      <View className="bg-gray-50 p-4 rounded-xl mb-6">
        <Text className="text-base font-semibold text-gray-900 mb-3">
          Rating Distribution
        </Text>
        {[5, 4, 3, 2, 1].map((star) => {
          const count =
            userRating.ratingCount?.[
              star as keyof typeof userRating.ratingCount
            ] || 0;
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

          return (
            <View key={star} className="flex-row items-center mb-2">
              <Text className="text-sm text-gray-600 w-8">{star}★</Text>
              <View className="flex-1 bg-gray-200 rounded-full h-2 mx-3">
                <View
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                />
              </View>
              <Text className="text-sm text-gray-600 w-8 text-right">
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderRatingItem = (rating: Rating) => {
    const timeAgo = rating.timestamp?.toDate
      ? new Date(rating.timestamp.toDate()).toLocaleDateString()
      : "Recently";

    return (
      <View
        key={rating.id}
        className="bg-white border border-gray-100 rounded-xl p-4 mb-3"
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center">
            {renderStars(rating.rating)}
            <Text className="text-sm text-gray-600 ml-2">{timeAgo}</Text>
          </View>
          {rating.transactionType === "rental" && (
            <View className="bg-blue-100 px-2 py-1 rounded-full">
              <Text className="text-xs text-blue-700 font-medium">Rental</Text>
            </View>
          )}
        </View>
        {rating.review && (
          <Text className="text-gray-700 text-base leading-5">
            {rating.review}
          </Text>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4BD07F" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <View className="items-center px-8">
          <Image source={images.empty} className="w-20 h-20 opacity-30 mb-4" />
          <Text className="text-gray-800 text-lg font-medium mb-2">
            User not found
          </Text>
          <Text className="text-gray-500 text-center">
            The user profile you're looking for doesn't exist.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const canRate = user?.uid && user.uid !== userId && !hasUserRated;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <Image source={icons.leftArrow} className="w-6 h-6" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">
          User Ratings
        </Text>
        <View className="w-10 h-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* User Profile Section */}
        <View className="items-center py-6 px-4">
          <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-4">
            <Text className="text-primary font-bold text-2xl">
              {userProfile.fullname?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 mb-2">
            {userProfile.fullname}
          </Text>

          {userRating?.averageRating ? (
            <View className="items-center">
              <View className="flex-row items-center mb-2">
                {renderStars(userRating.averageRating)}
                <Text className="text-2xl font-bold text-gray-900 ml-2">
                  {formatRating(userRating.averageRating)}
                </Text>
              </View>
              <Text className="text-gray-600">
                Based on {userRating.totalRatings}{" "}
                {userRating.totalRatings === 1 ? "review" : "reviews"}
              </Text>
            </View>
          ) : (
            <Text className="text-gray-500">No ratings yet</Text>
          )}
        </View>

        {/* Rate User Button */}
        {canRate && (
          <View className="px-4 mb-6">
            <TouchableOpacity
              onPress={() => setShowRatingModal(true)}
              className="bg-primary/10 border border-primary/20 rounded-xl py-3"
            >
              <Text className="text-primary font-semibold text-center">
                Rate This User
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="px-4">
          {/* Rating Distribution */}
          {renderRatingDistribution()}

          {/* Reviews Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              Reviews ({ratings.length})
            </Text>

            {ratings.length > 0 ? (
              ratings.map(renderRatingItem)
            ) : (
              <View className="items-center py-8">
                <Image
                  source={images.empty}
                  className="w-16 h-16 opacity-30 mb-3"
                />
                <Text className="text-gray-500 text-center">
                  No reviews yet
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        ratedUserName={userProfile.fullname}
        ratedUserId={userId as string}
        raterUserId={user?.uid || ""}
        onRatingComplete={(rating, review) => {
          setHasUserRated(true);
          onRefresh(); // Refresh the data
        }}
      />
    </SafeAreaView>
  );
}
