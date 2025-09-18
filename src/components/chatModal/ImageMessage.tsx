import Message from "@/types/message";
import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { View, Text, TouchableOpacity, Image, Dimensions } from "react-native";
import { icons } from "@/constant";

const ImageMessage = ({
  item,
  isCurrentUser,
  onLongPress,
  onImagePress,
}: {
  item: Message;
  isCurrentUser: boolean;
  onLongPress: () => void;
  onImagePress: () => void;
}) => {
  const [imageError, setImageError] = useState(false);
  const maxWidth = Dimensions.get("window").width * 0.65;
  const maxHeight = 300;
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    if (item.imageUrl && !item.isDeleted) {
      Image.getSize(
        item.imageUrl,
        (width, height) => {
          setAspectRatio(width / height);
        },
        () => {
          setImageError(true);
        }
      );
    }
  }, [item.imageUrl, item.isDeleted]);

  if (item.isDeleted) {
    return (
      <View
        className={`flex-col ${isCurrentUser ? "items-end" : "items-start"}`}
      >
        <View
          className={`p-3 rounded-xl mb-2 ${
            isCurrentUser
              ? "bg-primary rounded-tr-none self-end"
              : "bg-white rounded-tl-none border border-gray-200"
          }`}
        >
          <Text
            className={`text-base italic ${
              isCurrentUser ? "text-white/70" : "text-gray-500"
            }`}
          >
            [Image deleted]
          </Text>
        </View>
        <View
          className={`flex-row items-center mt-1 px-1 ${
            isCurrentUser ? "justify-end" : "justify-start"
          }`}
        >
          {isCurrentUser && (
            <>
              {item.read ? (
                <Image
                  source={icons.doubleCheck}
                  className="w-3 h-3 mr-1"
                  tintColor="#4285F4"
                />
              ) : (
                <Image
                  source={icons.singleCheck}
                  className="w-3 h-3 mr-1"
                  tintColor="#9CA3AF"
                />
              )}
            </>
          )}
          <Text className="text-xs text-gray-400">
            {item.createdAt ? format(item.createdAt.toDate(), "h:mm a") : ""}
          </Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (imageError || !item.imageUrl) {
    return (
      <View className="bg-gray-100 rounded-xl p-3 mb-2">
        <Text className="text-gray-500 text-center font-pmedium">
          Image not available
        </Text>
      </View>
    );
  }

  const imageWidth = maxWidth;
  const calculatedHeight = maxWidth / aspectRatio;
  const imageHeight = Math.min(calculatedHeight, maxHeight);

  return (
    <View className="flex-col">
      <TouchableOpacity
        onPress={onImagePress}
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={0.9}
      >
        <View className="rounded-xl overflow-hidden">
          <Image
            source={{ uri: item.imageUrl }}
            style={{
              width: imageWidth,
              height: imageHeight,
            }}
            className="rounded-xl"
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        </View>
      </TouchableOpacity>

      {/* Message metadata */}
      <View
        className={`flex-row items-center mt-1 px-1 ${
          isCurrentUser ? "justify-end" : "justify-start"
        }`}
      >
        {isCurrentUser && (
          <>
            {item.read ? (
              <Image
                source={icons.doubleCheck}
                className="w-3 h-3 mr-1"
                tintColor="#4285F4"
              />
            ) : (
              <Image
                source={icons.singleCheck}
                className="w-3 h-3 mr-1"
                tintColor="#9CA3AF"
              />
            )}
          </>
        )}
        <Text className="text-xs text-gray-400">
          {item.createdAt ? format(item.createdAt.toDate(), "h:mm a") : ""}
        </Text>
      </View>
    </View>
  );
};
export default ImageMessage;
