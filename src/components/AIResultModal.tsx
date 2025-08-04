import React from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { AIResult } from "../types/ai-types";
import { processAIResult, getCategoryInfo } from "../utils/ai-processing";
import LargeButton from "./LargeButton";

type Props = {
  visible: boolean;
  isProcessing: boolean;
  aiResults: AIResult[];
  tempImage: string | null;
  onRetry: () => void;
  onSkip: () => void;
  onSelect: (result: AIResult) => void;
};

export const AIResultModal = ({
  visible,
  isProcessing,
  aiResults,
  tempImage,
  onRetry,
  onSkip,
  onSelect,
}: Props) => {
  const renderResult = (result: AIResult, index: number) => {
    const {
      itemName,
      confidence,
      isProhibited,
      category,
      isUnknown,
      isLowConfidence,
    } = processAIResult(result);

    const categoryInfo = getCategoryInfo(itemName);

    return (
      <TouchableOpacity
        key={index}
        onPress={() => !isProhibited && onSelect(result)}
        disabled={isProhibited || isUnknown}
        className={`p-4 rounded-xl mb-2 ${
          isProhibited
            ? "bg-red-50 border border-red-200"
            : isUnknown
            ? "bg-gray-50 border border-gray-200"
            : "bg-green-50 border border-green-200"
        }`}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text
              className={`font-semibold ${
                isProhibited ? "text-red-800" : "text-gray-800"
              }`}
            >
              {itemName}
            </Text>
            {categoryInfo && (
              <Text className="text-gray-600 text-sm mt-1">
                Category: {categoryInfo.category}
              </Text>
            )}
            <Text
              className={`text-sm ${
                isProhibited ? "text-red-600" : "text-gray-600"
              }`}
            >
              Confidence: {result.Confidence}
            </Text>
          </View>
          {isProhibited ? (
            <View className="bg-red-100 px-2 py-1 rounded">
              <Text className="text-red-800 text-xs font-medium">
                ⚠️ Not Allowed
              </Text>
            </View>
          ) : isUnknown ? (
            <View className="bg-gray-100 px-2 py-1 rounded">
              <Text className="text-gray-600 text-xs font-medium">
                Low Confidence
              </Text>
            </View>
          ) : (
            <View className="bg-green-100 px-2 py-1 rounded">
              <Text className="text-green-800 text-xs font-medium">
                ✓ Allowed
              </Text>
            </View>
          )}
        </View>

        {/* Show similar items */}
        {categoryInfo && categoryInfo.examples.length > 0 && (
          <View className="mt-2 bg-gray-50 p-2 rounded">
            <Text className="text-xs text-gray-500">
              Similar items: {categoryInfo.examples.slice(0, 3).join(", ")}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* ... rest of the modal code ... */}
    </Modal>
  );
};
