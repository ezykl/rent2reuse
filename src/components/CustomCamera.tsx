import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  Alert,
  Image,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { detectFace, FaceDetectionResult } from "@/utils/facepp";
import * as FileSystem from "expo-file-system";
import { icons } from "@/constant";
import LottieView from "lottie-react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { FACE_PLUS_PLUS_API_KEY, FACE_PLUS_PLUS_API_SECRET } from "@env";
import { opacity } from "react-native-reanimated/lib/typescript/Colors";

interface CustomCameraProps {
  onPhotoTaken: (uri: string) => void;
  onCancel: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
// Adjust these dimensions to match your face detection area
const LOTTIE_SIZE = screenWidth * 0.95; // Adjust this to fit your needs

export const CustomCamera = ({ onPhotoTaken, onCancel }: CustomCameraProps) => {
  const [facing, setFacing] = useState<CameraType>("front");
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<FaceDetectionResult | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 justify-center items-center bg-black p-4">
        <Text className="text-white text-center text-lg mb-4">
          Camera access is required to take your profile picture
        </Text>
        <TouchableOpacity
          className="bg-primary py-3 px-6 rounded-xl"
          onPress={requestPermission}
        >
          <Text className="text-white font-pmedium">Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      setDetectionResult(null);

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3, // Lower quality to reduce initial size
        base64: false, // Don't get base64 immediately
        skipProcessing: false,
        exif: false,
      });

      if (photo?.uri) {
        // Compress and resize image using ImageManipulator
        const compressedImage = await manipulateAsync(
          photo.uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.6,
            format: SaveFormat.JPEG, // or "jpeg"
            base64: true,
          }
        );

        if (compressedImage.base64) {
          setCapturedImageUri(compressedImage.uri);
          setAnalyzing(true);

          const result = await detectFace(compressedImage.base64);
          setAnalyzing(false);
          setDetectionResult(result);

          if (result.success) {
            // Use the compressed image URI for saving

            onPhotoTaken(compressedImage.uri);
          }
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take picture. Please try again.");
      setAnalyzing(false);
      setCapturedImageUri(null);
    } finally {
      setIsCapturing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const LottieOverlay = () => (
    <View style={styles.lottieContainer} pointerEvents="none">
      <LottieView
        source={require("../assets/lottie/face.json")}
        autoPlay
        loop
        style={[styles.lottieAnimation, { opacity: 0.5 }]}
        resizeMode="contain"
      />

      {/* Guide text positioned above the Lottie animation */}
    </View>
  );

  const AnalyzingOverlay = () => (
    <View style={styles.analyzingOverlay} pointerEvents="none">
      <LottieView
        source={require("../assets/lottie/face.json")}
        autoPlay
        loop
        style={styles.lottieAnimation} // Same size as main animation
        resizeMode="contain"
      />
      <Text style={styles.analyzingText}>Analyzing face...</Text>
    </View>
  );

  const ResultModal = () => (
    <Modal
      visible={!!detectionResult && !detectionResult.success}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {detectionResult?.type === "warning" ? "⚠️" : "❌"}{" "}
            {detectionResult?.message}
          </Text>
          <Text style={styles.modalDescription}>
            {detectionResult?.details}
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => {
              setDetectionResult(null);
              setCapturedImageUri(null); // Reset to camera view
            }}
          >
            <Text style={styles.modalButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View className="flex-1 bg-primary">
      {/* Show camera view or captured image */}
      {capturedImageUri ? (
        <Image
          source={{ uri: capturedImageUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
      ) : (
        // Show camera view
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={facing}
          mirror={facing === "front" ? true : undefined}
        />
      )}

      {/* Header */}
      <View className="flex-row justify-between items-center p-4 pt-4">
        <TouchableOpacity
          onPress={onCancel}
          className="p-4 rounded-full bg-black/40 "
        >
          <Image
            source={icons.close}
            tintColor={"#ef4444"}
            className="w-6 h-6"
          />
        </TouchableOpacity>
        <Text className="bg-black/40 px-4 py-3 rounded-full justify-center items-center text-white text-lg font-pbold">
          Profile Photo
        </Text>
        <TouchableOpacity
          onPress={toggleCameraFacing}
          className="p-4 bg-black/40 rounded-full"
        >
          <Image
            source={icons.refresh}
            tintColor={"#ffffff"}
            className="w-6 h-6"
          />
        </TouchableOpacity>
      </View>

      <View className="flex-col py-2 rounded-xl bg-black/40 gap-2 justify-center items-center mx-4">
        <Text className="text-white text-center font-psemibold text-base ">
          Position your face in the frame
        </Text>
        <Text className="text-white font-pregular text-center text-base">
          Look straight at the camera
        </Text>
      </View>

      {/* Main Lottie Overlay (only show when not analyzing) */}
      {!analyzing && <LottieOverlay />}

      {/* Analyzing overlay (shows during analysis) */}
      {analyzing && <AnalyzingOverlay />}

      {/* Bottom controls */}
      <View className="absolute bottom-0 left-0 right-0 p-8">
        <View className="flex-row justify-center items-center">
          <TouchableOpacity
            onPress={takePicture}
            disabled={isCapturing || analyzing}
            className="w-20 h-20 rounded-full bg-white justify-center items-center"
            style={[(isCapturing || analyzing) && styles.captureButtonDisabled]}
          >
            <View className="w-16 h-16 rounded-full  bg-primary" />
          </TouchableOpacity>
        </View>

        <Text className="text-white text-center mt-4 text-base">
          {analyzing ? "Analyzing..." : "Tap to capture"}
        </Text>
      </View>

      <ResultModal />
    </View>
  );
};

const styles = StyleSheet.create({
  lottieContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100, // Adjust to position below header
    paddingBottom: 150, // Adjust to position above controls
  },
  lottieAnimation: {
    width: LOTTIE_SIZE,
    height: LOTTIE_SIZE,
  },
  guideTextContainer: {
    position: "absolute",
    top: 80, // Position above the Lottie animation
    left: 0,
    right: 0,
    alignItems: "center",
  },
  guideText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subGuideText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.9,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  analyzingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  analyzingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 20,
    textAlign: "center",
  },

  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    maxWidth: 320,
    width: "100%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 100,
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
});
