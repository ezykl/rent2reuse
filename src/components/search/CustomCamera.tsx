import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  FlashMode,
} from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

interface CustomCameraProps {
  visible: boolean;
  onClose: () => void;
  onImageCaptured: (uri: string) => void;
  onError?: (error: string) => void;
}

const CustomCamera: React.FC<CustomCameraProps> = ({
  visible,
  onClose,
  onImageCaptured,
  onError,
}) => {
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    MediaLibrary.usePermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();

  // Request permissions when component mounts
  useEffect(() => {
    if (visible) {
      requestPermissions();
    }
  }, [visible]);

  const requestPermissions = async () => {
    try {
      if (!permission?.granted) {
        const cameraResult = await requestPermission();
        if (!cameraResult.granted) {
          Toast.show({
            type: ALERT_TYPE.WARNING,
            title: "Permission Required",
            textBody: "Camera permission is required to take photos.",
          });
          onClose();
          return;
        }
      }

      if (!mediaPermission?.granted) {
        await requestMediaPermission();
      }
    } catch (error) {
      onError?.("Failed to request permissions");
      onClose();
    }
  };

  const handleClose = () => {
    console.log("Close button pressed");
    onClose();
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });

      if (photo?.uri) {
        setPreviewUri(photo.uri);
        setShowPreview(true);
      }
    } catch (error) {
      console.log("Error taking picture:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to capture image. Please try again.",
      });
      onError?.("Failed to capture image");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setShowPreview(false);
    setPreviewUri(null);
  };

  const handleUsePhoto = async () => {
    if (!previewUri) return;

    try {
      // Optionally save to device gallery
      if (mediaPermission?.granted) {
        await MediaLibrary.saveToLibraryAsync(previewUri);
      }

      // Pass the captured image to parent component
      onImageCaptured(previewUri);

      // Reset states and close
      setShowPreview(false);
      setPreviewUri(null);
      onClose();
    } catch (error) {
      console.log("Error saving photo:", error);
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Warning",
        textBody: "Photo captured but couldn't save to gallery.",
      });

      // Still use the photo even if saving failed
      onImageCaptured(previewUri);
      setShowPreview(false);
      setPreviewUri(null);
      onClose();
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const toggleFlash = () => {
    setFlash((current) => {
      switch (current) {
        case "off":
          return "on";
        case "on":
          return "auto";
        case "auto":
          return "off";
        default:
          return "off";
      }
    });
  };

  const getFlashIcon = () => {
    switch (flash) {
      case "on":
        return icons.flashOn || icons.flashOn;
      case "auto":
        return icons.flashOff || icons.flashOff;
      default:
        return icons.flashOff || icons.flashOff;
    }
  };

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View className="flex-1 bg-black/80 justify-center items-center px-5">
          <View className="bg-white rounded-2xl p-6 items-center max-w-xs">
            <Text className="text-lg font-semibold mb-3 text-center">
              Camera Permission Required
            </Text>
            <Text className="text-sm text-gray-600 text-center mb-5 leading-5">
              This app needs camera access to take photos for item
              identification.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 px-6 rounded-lg bg-gray-100 items-center"
                onPress={onClose}
              >
                <Text className="text-gray-600 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 px-6 rounded-lg bg-blue-500 items-center"
                onPress={requestPermission}
              >
                <Text className="text-white font-medium">Allow</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" style={{ flex: 1 }}>
      <View
        style={[
          { flex: 1, backgroundColor: "black" },
          StyleSheet.absoluteFillObject,
        ]}
      >
        {showPreview && previewUri ? (
          // Preview Screen
          <View className="flex-1 bg-black">
            <Image
              source={{ uri: previewUri }}
              className="flex-1 w-full"
              style={{ resizeMode: "contain" }}
            />

            {/* Preview Controls */}
            <View className="flex-row justify-around py-7 px-10 bg-black/80">
              <TouchableOpacity
                className="py-4 px-8 rounded-3xl bg-white/20 min-w-25 items-center"
                onPress={handleRetake}
              >
                <Text className="text-white text-base font-medium">Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-4 px-8 rounded-3xl bg-blue-500 min-w-25 items-center"
                onPress={handleUsePhoto}
              >
                <Text className="text-white text-base font-medium">
                  Use Photo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Camera Screen
          <>
            <CameraView
              ref={cameraRef}
              style={[
                {
                  flex: 1,
                  width: width,
                  height: height,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  aspectRatio: height / width,
                },
              ]}
              facing={facing}
              flash={flash}
              mode="picture"
              pointerEvents="box-none"
            >
              {/* Header Controls */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 20,
                  paddingHorizontal: 20,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 999,
                  elevation: 999,
                }}
              >
                <TouchableOpacity
                  className="w-11 h-11 rounded-full bg-black/30 justify-center items-center"
                  style={{ zIndex: 1000 }}
                  onPress={onClose}
                >
                  <Image
                    source={icons.close}
                    className="w-6 h-6"
                    style={{ tintColor: "white" }}
                  />
                </TouchableOpacity>

                <View className="w-12 h-12" />
              </View>

              {/* Bottom Controls */}
              <View
                style={{
                  paddingBottom: 50,
                  paddingHorizontal: 20,
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 999,
                  elevation: 999,
                }}
              >
                <View className="flex-row justify-between items-center">
                  {/* Gallery Button */}
                  <TouchableOpacity
                    className="w-11 h-11 rounded-full bg-black/30 justify-center items-center"
                    onPress={toggleFlash}
                  >
                    <Image
                      source={getFlashIcon()}
                      className="w-6 h-6"
                      style={{ tintColor: "white" }}
                    />
                  </TouchableOpacity>

                  {/* Capture Button */}
                  <TouchableOpacity
                    className={`w-20 h-20 rounded-full bg-primary justify-center items-center border-4 border-white/30 ${
                      isCapturing ? "opacity-50" : ""
                    }`}
                    style={{ zIndex: 1000 }}
                    onPress={takePicture}
                    disabled={isCapturing}
                  >
                    {isCapturing ? (
                      <ActivityIndicator size="large" color="#fff" />
                    ) : (
                      <View className="w-15 h-15 rounded-full bg-white" />
                    )}
                  </TouchableOpacity>

                  {/* Flip Camera Button */}
                  <TouchableOpacity
                    className="w-12 h-12 rounded-full bg-white/20 justify-center items-center"
                    onPress={toggleCameraFacing}
                  >
                    <Image
                      source={icons.refresh || icons.camera}
                      className="w-6 h-6"
                      style={{ tintColor: "white" }}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </CameraView>
          </>
        )}
      </View>
    </Modal>
  );
};

export default CustomCamera;
