import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { addOrUpdateRating } from "@/utils/ratingUtils";
import { icons } from "@/constant";

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  ratedUserName: string;
  ratedUserId: string;
  raterUserId: string;
  itemId?: string;
  transactionType?: "rental" | "general";
  existingRating?: number;
  existingReview?: string;
  onRatingComplete?: (rating: number, review: string) => void;
}

export default function RatingModal({
  visible,
  onClose,
  ratedUserName,
  ratedUserId,
  raterUserId,
  itemId,
  transactionType = "general",
  existingRating,
  existingReview,
  onRatingComplete,
}: RatingModalProps) {
  const [selectedRating, setSelectedRating] = useState(existingRating || 0);
  const [review, setReview] = useState(existingReview || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      Alert.alert(
        "Rating Required",
        "Please select a rating before submitting."
      );
      return;
    }

    try {
      setIsLoading(true);

      const result = await addOrUpdateRating(
        raterUserId,
        ratedUserId,
        selectedRating,
        review.trim(),
        itemId,
        transactionType
      );

      if (result.success) {
        Alert.alert("Success", result.message);
        onRatingComplete?.(selectedRating, review.trim());
        onClose();

        // Reset form
        setSelectedRating(existingRating || 0);
        setReview(existingReview || "");
      } else {
        Alert.alert("Error", result.message);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit rating. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      return (
        <TouchableOpacity
          key={index}
          onPress={() => setSelectedRating(starNumber)}
          className="p-1"
          activeOpacity={0.7}
        >
          <Text
            className={`text-3xl ${
              starNumber <= selectedRating ? "text-yellow-500" : "text-gray-300"
            }`}
          >
            ★
          </Text>
        </TouchableOpacity>
      );
    });
  };

  const getRatingText = (rating: number) => {
    switch (rating) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "Select Rating";
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center px-4">
        <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-gray-900">
              Rate {ratedUserName}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 items-center justify-center"
              disabled={isLoading}
            >
              <Image source={icons.close} className="w-6 h-6" />
            </TouchableOpacity>
          </View>

          {/* Rating Stars */}
          <View className="items-center mb-6">
            <View className="flex-row justify-center mb-3">
              {renderStars()}
            </View>
            <Text className="text-lg font-semibold text-gray-700">
              {getRatingText(selectedRating)}
            </Text>
            {selectedRating > 0 && (
              <Text className="text-sm text-gray-500 mt-1">
                {selectedRating} out of 5 stars
              </Text>
            )}
          </View>

          {/* Review Input */}
          <View className="mb-6">
            <Text className="text-base font-medium text-gray-700 mb-3">
              Write a review (optional)
            </Text>
            <TextInput
              className="border border-gray-200 rounded-xl p-4 text-base text-gray-700 min-h-[100px]"
              placeholder="Share your experience..."
              multiline
              textAlignVertical="top"
              value={review}
              onChangeText={setReview}
              maxLength={500}
              editable={!isLoading}
            />
            <Text className="text-xs text-gray-400 mt-1 text-right">
              {review.length}/500
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 border border-gray-200 rounded-xl py-3"
              disabled={isLoading}
            >
              <Text className="text-center text-gray-700 font-medium">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              className="flex-1 rounded-xl py-3"
              disabled={isLoading || selectedRating === 0}
            >
              <LinearGradient
                colors={
                  selectedRating === 0 || isLoading
                    ? ["#D1D5DB", "#9CA3AF"]
                    : ["#4BD07F", "#3ec986"]
                }
                className="py-3 rounded-xl items-center justify-center"
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    {existingRating ? "Update" : "Submit"}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Transaction Info */}
          {transactionType === "rental" && (
            <Text className="text-xs text-gray-400 text-center mt-3">
              This rating is for a rental transaction
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
