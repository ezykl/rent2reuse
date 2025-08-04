import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { icons } from "@/constant";

interface ProfileImageContentProps {
  onSave: (imageUri: string) => void;
  loading?: boolean;
}

export const ProfileImageContent = ({
  onSave,
  loading,
}: ProfileImageContentProps) => {
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSave = () => {
    if (!image) return;
    onSave(image);
  };

  return (
    <View className="p-4">
      <Text className="text-xl font-pbold text-gray-800 mb-2">
        Profile Picture
      </Text>
      <Text className="text-gray-600 mb-6">
        Upload a clear photo of yourself. This helps build trust with other
        users.
      </Text>

      <View className="items-center justify-center">
        <TouchableOpacity onPress={pickImage} className="mb-6">
          {image ? (
            <View className="relative">
              <Image
                source={{ uri: image }}
                className="w-60 h-60 border-2 border-dashed border-gray-300   rounded-2xl"
                resizeMode="cover"
              />
            </View>
          ) : (
            <View className="w-60 h-60 border-2 border-dashed border-gray-300 rounded-2xl items-center justify-center bg-gray-50">
              <Image
                source={icons.upload}
                className="w-20 h-20 mb-2"
                resizeMode="contain"
                tintColor="#9CA3AF"
              />
              <Text className="text-gray-500 text-center font-pmedium">
                Click to upload{"\n"}profile picture
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`w-full py-3 rounded-xl flex-row justify-center items-center space-x-2
            ${image ? "bg-primary" : "bg-primary/40"}
            ${loading ? "opacity-70" : ""}`}
          onPress={handleSave}
          disabled={!image || loading}
        >
          <Text className="text-white text-center text-lg font-pmedium">
            {loading ? "Saving..." : "Save Picture"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
