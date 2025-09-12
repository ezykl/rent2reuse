import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { icons } from "@/constant";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import { StatusBar } from "expo-status-bar";

interface ModalImageViewerProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  imageName?: string;
}

const ModalImageViewer: React.FC<ModalImageViewerProps> = ({
  visible,
  imageUrl,
  onClose,
  imageName = "RentEase_Image",
}) => {
  const [isImageSaved, setIsImageSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      checkIfImageExists();
    }
  }, [visible, imageUrl]);

  const checkIfImageExists = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") return;

      // Create a unique filename based on the image URL
      const fileName = `${imageName}_${Date.now()}.jpg`;
      const albums = await MediaLibrary.getAlbumsAsync();
      const rentEaseAlbum = albums.find((album) => album.title === "RentEase");

      if (rentEaseAlbum) {
        const assets = await MediaLibrary.getAssetsAsync({
          album: rentEaseAlbum,
          mediaType: "photo",
        });

        // Check if image with similar name exists (basic check)
        const imageExists = assets.assets.some((asset) =>
          asset.filename.includes(imageName)
        );
        setIsImageSaved(imageExists);
      }
    } catch (error) {
      console.error("Error checking image existence:", error);
    }
  };

  const saveImageToGallery = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant permission to save images to your gallery."
        );
        setIsSaving(false);
        return;
      }

      // Download the image
      const fileName = `${imageName}_${Date.now()}.jpg`;
      const downloadPath = `${FileSystem.documentDirectory}${fileName}`;

      const downloadResult = await FileSystem.downloadAsync(
        imageUrl,
        downloadPath
      );

      if (downloadResult.status === 200) {
        // Create or get RentEase album
        let album = await MediaLibrary.getAlbumAsync("RentEase");
        if (!album) {
          // Create the album by first saving an asset
          const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
          album = await MediaLibrary.createAlbumAsync("RentEase", asset, false);
        } else {
          // Add to existing album
          const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }

        setIsImageSaved(true);
        Alert.alert("Success", "Image saved to RentEase album!");
      } else {
        throw new Error("Failed to download image");
      }
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save image. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      presentationStyle="fullScreen"
    >
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 z-10 bg-black/50 pt-12 pb-4 px-4">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <Image
                source={icons.close}
                className="w-6 h-6"
                tintColor="white"
              />
            </TouchableOpacity>

            <View className="flex-1 items-center">
              <Text className="text-white text-lg font-pmedium">Image</Text>
            </View>

            <TouchableOpacity
              onPress={saveImageToGallery}
              disabled={isSaving || isImageSaved}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isImageSaved
                  ? "bg-green-500/80"
                  : isSaving
                  ? "bg-gray-500/80"
                  : "bg-white/20"
              }`}
            >
              {isSaving ? (
                <Text className="text-white text-xs">...</Text>
              ) : (
                <Image
                  source={isImageSaved ? icons.check : icons.download}
                  className="w-6 h-6"
                  tintColor="white"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Image */}
        <View className="flex-1 items-center justify-center">
          <Image
            source={{ uri: imageUrl }}
            className="w-full h-full"
            resizeMode="contain"
          />
        </View>

        {/* Footer with save status */}
        {isImageSaved && (
          <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-3">
            <View className="flex-row items-center justify-center">
              <Image
                source={icons.check}
                className="w-5 h-5 mr-2"
                tintColor="#10B981"
              />
              <Text className="text-green-400 text-sm font-pmedium">
                Image already saved to gallery
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};
