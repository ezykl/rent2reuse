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
import {
  detectFace,
  FaceDetectionResult,
  compareFaces,
  FaceComparisonResult,
} from "@/utils/facepp";
import * as FileSystem from "expo-file-system";
import { icons } from "@/constant";
import LottieView from "lottie-react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { FACE_PLUS_PLUS_API_KEY, FACE_PLUS_PLUS_API_SECRET } from "@env";

interface CustomCameraProps {
  onPhotoTaken: (uri: string) => void;
  onCancel: () => void;
  idImageBase64?: string; // Add this prop for ID comparison
  requireIdComparison?: boolean; // Add this prop to enable comparison
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
// Adjust these dimensions to match your face detection area
const LOTTIE_SIZE = screenWidth * 0.95; // Adjust this to fit your needs

export const CustomCamera = ({
  onPhotoTaken,
  onCancel,
  idImageBase64,
  requireIdComparison = false,
}: CustomCameraProps) => {
  const [facing, setFacing] = useState<CameraType>("front");
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [comparing, setComparing] = useState(false); // Add this state
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] =
    useState<FaceDetectionResult | null>(null);
  const [comparisonResult, setComparisonResult] =
    useState<FaceComparisonResult | null>(null); // Add this state
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
      setComparisonResult(null); // Reset comparison result

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
        skipProcessing: false,
        exif: false,
      });

      if (photo?.uri) {
        const compressedImage = await manipulateAsync(
          photo.uri,
          [{ resize: { width: 1024 } }],
          {
            compress: 0.6,
            format: SaveFormat.JPEG,
            base64: true,
          }
        );

        if (compressedImage.base64) {
          setCapturedImageUri(compressedImage.uri);
          setAnalyzing(true);

          // First, detect face in the current photo
          const result = await detectFace(compressedImage.base64);
          setAnalyzing(false);
          setDetectionResult(result);

          if (result.success) {
            // If ID comparison is required, perform face comparison
            if (requireIdComparison && idImageBase64) {
              setComparing(true);
              const compResult = await compareFaces(
                compressedImage.base64,
                idImageBase64
              );
              setComparing(false);
              setComparisonResult(compResult);

              // Only accept if both detection and comparison succeed
              if (compResult.success) {
                onPhotoTaken(compressedImage.uri);
              }
            } else {
              // If no comparison needed, accept the photo
              onPhotoTaken(compressedImage.uri);
            }
          }
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take picture. Please try again.");
      setAnalyzing(false);
      setComparing(false);
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

  const ComparisonResultModal = () => (
    <Modal
      visible={!!comparisonResult && !comparisonResult.success}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {comparisonResult?.type === "warning" ? "⚠️" : "❌"}{" "}
            {comparisonResult?.message}
          </Text>
          <Text style={styles.modalDescription}>
            {comparisonResult?.details}
          </Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${Math.min(comparisonResult?.confidence || 0, 100)}%`,
                  backgroundColor:
                    (comparisonResult?.confidence || 0) >= 70
                      ? "#22c55e"
                      : "#ef4444",
                },
              ]}
            />
          </View>
          <Text style={styles.confidenceText}>
            Confidence: {(comparisonResult?.confidence || 0).toFixed(1)}%
          </Text>
          <TouchableOpacity
            style={styles.modalButton}
            onPress={() => {
              setComparisonResult(null);
              setDetectionResult(null);
              setCapturedImageUri(null);
            }}
          >
            <Text style={styles.modalButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const ComparisonLoadingOverlay = () =>
    comparing ? (
      <View style={styles.analyzingOverlay} pointerEvents="none">
        <LottieView
          source={require("../assets/lottie/face.json")}
          autoPlay
          loop
          style={styles.lottieAnimation}
          resizeMode="contain"
        />
        <Text style={styles.analyzingText}>Comparing with ID...</Text>
      </View>
    ) : null;

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
      {!analyzing && !comparing && <LottieOverlay />}

      {/* Analyzing overlay (shows during analysis) */}
      {(analyzing || comparing) && <AnalyzingOverlay />}
      <ComparisonLoadingOverlay />

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
      <ComparisonResultModal />
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
  confidenceBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginVertical: 12,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
    fontWeight: "600",
  },
});
