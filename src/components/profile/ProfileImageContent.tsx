import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { icons } from "@/constant";
import { CustomCamera } from "@/components/CustomCamera";

interface ProfileImageContentProps {
  onSave: (imageUri: string) => void;
  loading?: boolean;
  idImageBase64?: string; // Add this
  requireIdComparison?: boolean; // Add this
}

export const ProfileImageContent = ({
  onSave,
  loading,
  idImageBase64,
  requireIdComparison = false,
}: ProfileImageContentProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);

  const handlePhotoTaken = (uri: string) => {
    setImage(uri);
    setShowCamera(false);
  };

  const handleSave = () => {
    if (!image) return;
    onSave(image);
  };

  return (
    <>
      <ScrollView className="flex-1">
        <View className="p-4">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-xl font-pbold text-gray-800">
              Profile Picture
            </Text>
          </View>

          <Text className="text-gray-600 mb-6 leading-5">
            Take a clear photo of yourself with our guided camera. This helps
            build trust with other users and improves your profile visibility.
            {"\n"}• Center your face in frame{"\n"}• Ensure clear, well-lit
            environment
            {"\n"}• Remove glasses and head coverings{"\n"}• Individual photos
            only
          </Text>

          <View className="items-center justify-center">
            {/* Photo Preview */}
            <TouchableOpacity
              onPress={() => setShowCamera(true)}
              className="mb-6"
              activeOpacity={0.8}
            >
              {image ? (
                <View className="relative">
                  <Image
                    source={{ uri: image }}
                    className="w-60 h-60 border-2 border-primary rounded-2xl"
                    resizeMode="cover"
                  />
                  <View className="absolute -top-2 -right-2 bg-green-500 w-8 h-8 rounded-full items-center justify-center shadow-lg">
                    <Image
                      source={icons.check}
                      className="w-4 h-4"
                      tintColor="#ffffff"
                    />
                  </View>
                </View>
              ) : (
                <View className="w-60 h-60 border-2 border-dashed border-gray-300 rounded-2xl items-center justify-center bg-gray-50">
                  <Image
                    source={icons.upload}
                    className="w-20 h-20 mb-2"
                    resizeMode="contain"
                    tintColor="#9CA3AF"
                  />
                  <Text className="text-gray-500 text-center font-pmedium leading-5">
                    Tap to open{"\n"}guided camera
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Action Buttons */}
            {image && (
              <TouchableOpacity
                className="w-full py-3 rounded-xl mb-3 bg-red-400 active:bg-red-100"
                onPress={() => setShowCamera(true)}
                activeOpacity={0.9}
              >
                <Text className="text-white text-center text-lg font-pmedium">
                  Retake Photo
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              className={`w-full py-3 rounded-xl flex-row justify-center items-center ${
                image ? "bg-primary" : "bg-primary/40"
              } ${loading ? "opacity-70" : ""} active:opacity-80`}
              onPress={handleSave}
              disabled={!image || loading}
              activeOpacity={0.9}
            >
              <Text className="text-white text-center text-lg font-pmedium">
                {loading
                  ? "Saving..."
                  : image
                  ? "Save Picture"
                  : "Take Photo First"}
              </Text>
            </TouchableOpacity>

            {/* Additional Info */}
            <View className="mt-4 p-3 bg-amber-50 rounded-lg w-full border border-amber-100">
              <Text className="text-amber-800 text-sm text-center">
                <Text className="font-pmedium">💡 Pro Tip:</Text> Photos are
                automatically analyzed for quality. If rejected, follow the
                guidance and try again!
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Custom Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <CustomCamera
          onPhotoTaken={handlePhotoTaken}
          onCancel={() => setShowCamera(false)}
          idImageBase64={idImageBase64}
          requireIdComparison={requireIdComparison}
        />
      </Modal>
    </>
  );
};
