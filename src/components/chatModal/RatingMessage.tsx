import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import Message from "@/types/message";
import { icons } from "@/constant";
import { format, isToday, isYesterday } from "date-fns";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

interface RatingMessageProps {
  item: Message;
  isCurrentUser: boolean;
  onSubmitRating: (rating: RatingData) => Promise<void>;
  isLoading?: boolean;
  chatId?: string;
  isOwner: boolean;
}

export interface RatingData {
  rating: number; // 1-5 stars
  review: string;
  categories: {
    communication: number;
    itemCondition: number;
    punctuality: number;
    cleanliness: number;
  };
}

const RatingMessage: React.FC<RatingMessageProps> = ({
  item,
  isCurrentUser,
  onSubmitRating,
  isLoading = false,
  chatId,
  isOwner,
}) => {
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [review, setReview] = useState("");
  const [categories, setCategories] = useState({
    communication: 0,
    itemCondition: 0,
    punctuality: 0,
    cleanliness: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return "";

    const date = timestamp.toDate();

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmitRating({
        rating,
        review,
        categories,
      });
      setShowRatingForm(false);
      setRating(0);
      setReview("");
      setCategories({
        communication: 0,
        itemCondition: 0,
        punctuality: 0,
        cleanliness: 0,
      });
    } catch (error) {
      console.log("Error submitting rating:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit rating",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingColor = (ratingValue: number) => {
    if (ratingValue <= 2) return "#EF4444"; // Red
    if (ratingValue <= 3) return "#F59E0B"; // Orange
    if (ratingValue <= 4) return "#3B82F6"; // Blue
    return "#10B981"; // Green
  };

  const getRatingText = (ratingValue: number) => {
    if (ratingValue === 0) return "Not rated";
    if (ratingValue <= 2) return "Poor";
    if (ratingValue <= 3) return "Fair";
    if (ratingValue <= 4) return "Good";
    return "Excellent";
  };

  // ✅ If rating already submitted, show summary
  if (item.rating) {
    return (
      <View className={`mb-3 ${isCurrentUser ? "pr-24" : "pl-24"}`}>
        <View
          className={`p-4 bg-white rounded-xl border border-gray-200 shadow-sm ${
            isCurrentUser ? "rounded-bl-none" : "rounded-tl-none"
          }`}
        >
          {/* Header */}
          <View className="flex-row items-center mb-3">
            <View className="flex-1">
              <Text className="text-sm font-pmedium text-gray-500 mb-1">
                ⭐ {isCurrentUser ? "Your Rating" : "Rating from"}
              </Text>
              <Text className="text-base font-pbold text-gray-900">
                Rental Review
              </Text>
            </View>
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: getRatingColor(item.rating) }}
            >
              <Text className="text-white font-pbold text-lg">
                {item.rating}
              </Text>
            </View>
          </View>

          {/* Overall Rating */}
          <View className="bg-gray-50 rounded-lg p-3 mb-4">
            <View className="flex-row items-center mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Text key={star} className="text-xl mr-1">
                  {star <= item.rating ? "⭐" : "☆"}
                </Text>
              ))}
            </View>
            <Text className="text-sm font-pbold text-gray-700">
              {getRatingText(item.rating)} ({item.rating}/5)
            </Text>
          </View>

          {/* Category Ratings */}
          {item.categories && (
            <View className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
              <Text className="text-xs font-pbold text-blue-600 mb-2 uppercase">
                📊 Category Breakdown
              </Text>
              <View className="gap-2">
                {[
                  {
                    key: "communication",
                    label: "Communication",
                    icon: "💬",
                  },
                  {
                    key: "itemCondition",
                    label: "Item Condition",
                    icon: "📦",
                  },
                  {
                    key: "punctuality",
                    label: "Punctuality",
                    icon: "⏰",
                  },
                  {
                    key: "cleanliness",
                    label: "Cleanliness",
                    icon: "✨",
                  },
                ].map(({ key, label, icon }) => (
                  <View key={key} className="flex-row items-center">
                    <Text className="text-lg mr-2">{icon}</Text>
                    <View className="flex-1">
                      <Text className="text-xs font-pmedium text-blue-700">
                        {label}
                      </Text>
                    </View>
                    <View className="flex-row">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text key={star} className="text-sm">
                          {star <=
                          item.categories[key as keyof typeof item.categories]
                            ? "⭐"
                            : "☆"}
                        </Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Review Text */}
          {item.review && (
            <View className="bg-yellow-50 rounded-lg p-3 mb-4 border border-yellow-200">
              <Text className="text-xs font-pbold text-yellow-700 mb-2">
                💬 Review
              </Text>
              <Text className="text-sm text-yellow-900 leading-5">
                {item.review}
              </Text>
            </View>
          )}

          {/* Status Indicator */}
          <View className="bg-green-50 rounded-lg p-3 border border-green-200 mt-3">
            <Text className="text-xs font-pbold text-green-700">
              ✓ Rating submitted
            </Text>
          </View>

          <View className="mt-3 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ✅ If no rating and is current user, show form
  if (isCurrentUser && !showRatingForm) {
    return (
      <View className="mb-3 pr-24">
        <View className="p-4 bg-white rounded-xl rounded-bl-none border border-gray-200 shadow-sm">
          <View className="mb-4">
            <Text className="text-sm font-pmedium text-gray-500 mb-2">
              ⭐ Rate This Rental
            </Text>
            <Text className="text-base font-pbold text-gray-900">
              Share Your Experience
            </Text>
          </View>

          <Text className="text-sm text-gray-700 mb-4 leading-5">
            {isOwner
              ? "How was your experience renting out this item? Your honest feedback helps build a better community."
              : "How was your rental experience? Your honest feedback helps build a better community."}
          </Text>

          <TouchableOpacity
            onPress={() => setShowRatingForm(true)}
            className="bg-blue-500 rounded-lg py-3 items-center justify-center"
          >
            <View className="flex-row items-center">
              <Image
                source={icons.star}
                className="w-5 h-5 mr-2"
                tintColor="#fff"
              />
              <Text className="text-white font-psemibold">Leave a Rating</Text>
            </View>
          </TouchableOpacity>

          <View className="mt-2 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ✅ Rating form
  if (isCurrentUser && showRatingForm) {
    return (
      <View className="mb-3 pr-24">
        <View className="p-4 bg-white rounded-xl rounded-bl-none border border-gray-200 shadow-sm">
          <Text className="text-base font-pbold text-gray-900 mb-4">
            Rate Your Experience
          </Text>

          {/* Star Rating */}
          <View className="mb-4">
            <Text className="text-sm font-pmedium text-gray-700 mb-3">
              Overall Rating
            </Text>
            <View className="flex-row justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  <Text
                    className="text-4xl"
                    style={{
                      opacity: star <= (hoveredRating || rating) ? 1 : 0.3,
                    }}
                  >
                    ⭐
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text className="text-center text-sm font-pmedium text-gray-600 mt-2">
                {getRatingText(rating)} ({rating}/5)
              </Text>
            )}
          </View>

          {/* Category Ratings */}
          <View className="mb-4 bg-gray-50 rounded-lg p-3">
            <Text className="text-sm font-pmedium text-gray-700 mb-3">
              Category Ratings
            </Text>
            {[
              {
                key: "communication",
                label: "Communication",
                icon: "💬",
              },
              {
                key: "itemCondition",
                label: isOwner ? "Renter Care" : "Item Condition",
                icon: "📦",
              },
              {
                key: "punctuality",
                label: "Punctuality",
                icon: "⏰",
              },
              {
                key: "cleanliness",
                label: "Cleanliness",
                icon: "✨",
              },
            ].map(({ key, label, icon }) => (
              <View key={key} className="mb-3">
                <View className="flex-row items-center mb-2">
                  <Text className="text-lg mr-2">{icon}</Text>
                  <Text className="text-xs font-pmedium text-gray-600">
                    {label}
                  </Text>
                </View>
                <View className="flex-row gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() =>
                        setCategories({
                          ...categories,
                          [key]: star,
                        })
                      }
                    >
                      <Text
                        className="text-2xl"
                        style={{
                          opacity:
                            star <= categories[key as keyof typeof categories]
                              ? 1
                              : 0.3,
                        }}
                      >
                        ⭐
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>

          {/* Review Text */}
          <View className="mb-4">
            <Text className="text-sm font-pmedium text-gray-700 mb-2">
              Written Review (Optional)
            </Text>
            <View className="bg-gray-100 rounded-lg p-3 border border-gray-200 min-h-24">
              <Text
                className="text-gray-700 text-sm"
                onPress={() => {
                  // In a real app, this would open a text input
                }}
              >
                {review || "Tap to write your review..."}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setShowRatingForm(false)}
              className="flex-1 bg-gray-200 rounded-lg py-3"
            >
              <Text className="text-gray-700 font-psemibold text-center">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmitRating}
              disabled={submitting || rating === 0}
              className={`flex-1 rounded-lg py-3 items-center justify-center ${
                submitting || rating === 0 ? "bg-gray-300" : "bg-green-500"
              }`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white font-psemibold">Submit Rating</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ✅ If not current user and already rated, show read-only
  return (
    <View className="mb-3 pl-24">
      <View className="p-4 bg-white rounded-xl rounded-tl-none border border-gray-200 shadow-sm">
        <View className="mb-3">
          <Text className="text-sm font-pmedium text-gray-500 mb-1">
            ⭐ Waiting for rating
          </Text>
          <Text className="text-base font-pbold text-gray-900">
            Awaiting Your Review
          </Text>
        </View>

        <Text className="text-sm text-gray-600 leading-5">
          Your rating is pending. Leave yo ur rating to complete the rental.
        </Text>
      </View>
    </View>
  );
};

export default RatingMessage;
