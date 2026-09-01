import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  SafeAreaView,
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { icons } from "@/constant";
import * as ImageManipulator from "expo-image-manipulator";

interface ChatCameraProps {
  onPhotoTaken: (uri: string) => void;
  onClose: () => void;
}

export const ChatCamera = ({ onPhotoTaken, onClose }: ChatCameraProps) => {
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCropView, setShowCropView] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      if (photo) {
        setCapturedImage(photo.uri);
      }
    } catch (error) {
      console.log("Error taking picture:", error);
    }
  };

  const handleSendPhoto = async () => {
    if (!capturedImage) return;

    try {
      // Compress image before sending
      const compressedImage = await manipulateAsync(
        capturedImage,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.6,
          format: SaveFormat.JPEG,
        }
      );

      onPhotoTaken(compressedImage.uri);
    } catch (error) {
      console.log("Error processing image:", error);
    }
  };

  const ImagePreview = () => (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row justify-between items-center p-4">
          <TouchableOpacity
            onPress={() => setCapturedImage(null)}
            className="p-3 rounded-full bg-black/30"
          >
            <Image
              source={icons.leftArrow}
              className="w-6 h-6"
              tintColor="white"
            />
          </TouchableOpacity>
        </View>

        {/* Image Preview */}
        <Image
          source={{ uri: capturedImage || "" }}
          className="flex-1"
          resizeMode="contain"
        />

        {/* Bottom Actions */}
        <View className="p-4 flex-row justify-between items-center bg-black/50">
          <TouchableOpacity
            onPress={() => setCapturedImage(null)}
            className="px-6 py-3 rounded-xl w-40 justify-center items-center bg-gray-800"
          >
            <Text className="text-white font-pmedium">Retake</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSendPhoto}
            className="px-6 py-3 rounded-xl w-40 justify-center items-center bg-primary"
          >
            <Text className="text-white font-pmedium">Send Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );

  const CameraControls = () => (
    <View className="absolute bottom-0 left-0 right-0 p-8">
      {/* Camera Controls Row */}
      <View className="flex-row justify-between items-center mb-8">
        <TouchableOpacity
          onPress={() => setFlash(flash === "on" ? "off" : "on")}
          className="p-4 rounded-full bg-black/40"
        >
          <Image
            source={flash === "on" ? icons.flashOn : icons.flashOff}
            className="w-6 h-6"
            resizeMode="contain"
            tintColor="white"
          />
        </TouchableOpacity>

        {/* Capture Button */}
        <TouchableOpacity
          onPress={takePicture}
          className="w-20 h-20 rounded-full bg-white justify-center items-center"
        >
          <View className="w-16 h-16 rounded-full  bg-primary" />
        </TouchableOpacity>

        {/* Flip Camera */}
        <TouchableOpacity
          onPress={() => setFacing(facing === "back" ? "front" : "back")}
          className="p-4 rounded-full bg-black/40"
        >
          <Image source={icons.refresh} className="w-6 h-6" tintColor="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (capturedImage) {
    return <ImagePreview />;
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing={facing}
        flash={flash}
      />

      {/* Header */}
      <SafeAreaView>
        <View className="flex-row justify-between items-center p-4">
          <TouchableOpacity
            onPress={onClose}
            className="p-3 rounded-full items-center justify-center bg-black/30"
          >
            <Image
              source={icons.close}
              className="w-6 h-6"
              tintColor="#ef4444"
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <CameraControls />
    </View>
  );
};
