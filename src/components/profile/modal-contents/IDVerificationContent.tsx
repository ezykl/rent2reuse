import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { icons } from "@/constant";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { OCR_SPACE_API_KEY } from "@env";

interface IDVerificationContentProps {
  onSave: (idVerified: {
    idImage: string;
    idNumber: string;
    idType: IDType;
  }) => void;
  onClose?: () => void;
  loading?: boolean;
}

type IDType = "philsys" | "drivers" | "student";

const ID_TYPES = [
  { label: "PhilSys ID", value: "philsys" },
  { label: "Driver's License", value: "drivers" },
  { label: "Student ID", value: "student" },
];

export const IDVerificationContent = ({
  onSave,
  onClose,
}: IDVerificationContentProps) => {
  const user = auth.currentUser;
  const [loading, setLoading] = useState(false);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selectedIDType, setSelectedIDType] = useState<IDType>("philsys");
  const [idNumber, setIdNumber] = useState("");
  const [userData, setUserData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
  });
  const [showDropdown, setShowDropdown] = useState(false);

  const [cameraVisible, setCameraVisible] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();

  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchUserData = async () => {
    try {
      if (!user?.uid) return;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log("Fetched user data:", data);

        setUserData({
          firstName: data.firstname || "",
          middleName: data.middlename || "",
          lastName: data.lastname || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to fetch user data",
      });
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [user?.uid]);

  const openCamera = async () => {
    if (loading) return;

    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Camera permission is required to take photos."
        );
        return;
      }
    }

    setCameraVisible(true);
  };

  const compressImage = async (imageUri: string) => {
    try {
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          // Resize to max width/height of 1200px while maintaining aspect ratio
          { resize: { width: 1200 } },
        ],
        {
          compress: 0.7, // Compress to 70% quality
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return manipulatedImage.uri;
    } catch (error) {
      console.error("Error compressing image:", error);
      return imageUri; // Return original if compression fails
    }
  };

  const handleImageCreate = async (imageUri: string) => {
    try {
      const compressedUri = await compressImage(imageUri);
      setIdImage(compressedUri);
      setValidationError(null); // Clear any previous validation errors
    } catch (error) {
      console.error("Error handling image:", error);
      Alert.alert("Error", "Failed to process image");
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
        exif: false,
        base64: false,
      });

      if (!photo) return;

      setCameraVisible(false);
      await handleImageCreate(photo.uri);
    } catch (error) {
      console.error("Error capturing photo:", error);
      Alert.alert("Error", "Failed to capture photo");
    }
  };

  const CameraContent = () => {
    const cardFrameWidth = screenWidth * 1.5;
    const cardFrameHeight = cardFrameWidth * 0.63; // Standard ID card ratio

    return (
      <View className="flex-1 bg-black">
        {/* Enhanced Header */}
        <View className="absolute top-0 left-0 right-0 z-20 pt-12 pb-4">
          <View className="flex-row justify-between items-center px-6">
            <TouchableOpacity
              onPress={() => setCameraVisible(false)}
              className="bg-black/60 p-3 rounded-full"
            >
              <Image
                source={icons.close}
                className="w-6 h-6"
                tintColor="white"
              />
            </TouchableOpacity>

            <View className="flex-1 items-center">
              <Text className="text-white font-pbold text-lg">
                Scan ID Card
              </Text>
              <Text className="text-white/70 font-pregular text-sm mt-1">
                Position your ID within the frame
              </Text>
            </View>

            <TouchableOpacity
              onPress={() =>
                setFacing((current) => (current === "back" ? "front" : "back"))
              }
              className="bg-black/60 p-3 rounded-full"
            >
              <Image
                source={icons.refresh}
                className="w-6 h-6"
                tintColor="white"
              />
            </TouchableOpacity>
          </View>
        </View>

        <CameraView
          ref={cameraRef}
          className="flex-1"
          facing={facing}
          style={{ flex: 1 }}
        >
          {/* Enhanced Overlay */}
          <View className="flex-1">
            {/* Dark overlay with cutout effect */}
            <View className="absolute inset-0" />

            {/* Center content */}
            <View className="flex-1 items-center justify-center">
              {/* Card frame container */}
              <View
                className="relative"
                style={{ width: cardFrameHeight, height: cardFrameWidth }}
              >
                {/* Clear area for the card */}
                <View
                  className="absolute inset-0 bg-transparent border-3 border-white rounded-xl"
                  style={{
                    borderWidth: 3,
                    shadowColor: "#fff",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 10,
                  }}
                />

                {/* Corner indicators */}
                <View className="absolute -top-3 -left-3 w-8 h-8">
                  <View className="absolute top-0 left-0 w-6 h-1 bg-white rounded-full" />
                  <View className="absolute top-0 left-0 w-1 h-6 bg-white rounded-full" />
                </View>
                <View className="absolute -top-3 -right-3 w-8 h-8">
                  <View className="absolute top-0 right-0 w-6 h-1 bg-white rounded-full" />
                  <View className="absolute top-0 right-0 w-1 h-6 bg-white rounded-full" />
                </View>
                <View className="absolute -bottom-3 -left-3 w-8 h-8">
                  <View className="absolute bottom-0 left-0 w-6 h-1 bg-white rounded-full" />
                  <View className="absolute bottom-0 left-0 w-1 h-6 bg-white rounded-full" />
                </View>
                <View className="absolute -bottom-3 -right-3 w-8 h-8">
                  <View className="absolute bottom-0 right-0 w-6 h-1 bg-white rounded-full" />
                  <View className="absolute bottom-0 right-0 w-1 h-6 bg-white rounded-full" />
                </View>
              </View>
            </View>

            {/* Enhanced Capture Controls */}
            <View className="absolute bottom-4 inset-x-0">
              <View className="items-center">
                {/* Main capture button */}
                <TouchableOpacity
                  onPress={capturePhoto}
                  className="w-20 h-20 rounded-full bg-white items-center justify-center mb-4"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                  }}
                >
                  <View className="w-16 h-16 rounded-full border-4 border-primary bg-transparent" />
                  <View className="absolute w-14 h-14 rounded-full bg-primary" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CameraView>
      </View>
    );
  };

  const ImagePreview = ({ uri }: { uri: string }) => (
    <View className=" flex-1 mb-6 w-full border-2 border-dashed border-gray-300 rounded-2xl">
      <View
        className=" rounded-2xl overflow-hidden w-full"
        style={{
          aspectRatio: 1, // Standard ID card aspect ratio (1:0.63 inverted)
        }}
      >
        <Image
          source={{ uri }}
          className="w-full h-full"
          resizeMode="cover" // This prevents zooming and maintains aspect ratio
          style={{
            backgroundColor: "#f3f4f6", // Light gray background for letterboxing
          }}
        />
        <TouchableOpacity
          onPress={openCamera}
          className="absolute inset-0 items-center justify-center"
          activeOpacity={0.7}
        >
          <View className="bg-black/60 p-4 rounded-full">
            <Image
              source={icons.camera}
              className="w-8 h-8"
              tintColor="white"
            />
          </View>
          <Text className="text-white font-pmedium mt-3 bg-black/60 px-3 py-1 rounded-full">
            Tap to retake
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getIDNumberLabel = () => {
    switch (selectedIDType) {
      case "philsys":
        return "PhilSys Card Number (PCN)";
      case "drivers":
        return "Driver's License Number";
      case "student":
        return "Student ID Number";
      default:
        return "ID Number";
    }
  };

  const blobToBase64 = (blob: Blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result.split(",")[1]);
        } else {
          reject(new Error("Failed to convert blob to base64."));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const analyzeIdAndSave = async () => {
    let sanitizedIdNumber;
    try {
      if (!idImage) {
        setValidationError("Please upload your ID first.");
        return;
      }

      sanitizedIdNumber =
        selectedIDType === "drivers"
          ? idNumber.replace(/[-/_\s]/g, "")
          : idNumber;
      setLoading(true);
      setValidationError(null);

      const response = await fetch(idImage);
      const blob = await response.blob();
      const base64Image = await blobToBase64(blob);

      const formData = new FormData();
      formData.append("apikey", OCR_SPACE_API_KEY);
      formData.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
      formData.append("language", "eng");
      formData.append("OCREngine", "2");

      const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
        method: "POST",
        body: formData,
      });

      const result = await ocrResponse.json();

      if (!result?.ParsedResults || result.IsErroredOnProcessing) {
        throw new Error(
          result.ErrorMessage || "OCR failed to process the image."
        );
      }

      const parsedText =
        result?.ParsedResults?.[0]?.ParsedText?.toLowerCase() || "";

      const clean = (text: string) => text.toLowerCase().replace(/\s+/g, "");
      const extracted = parsedText.replace(/[\s-]+/g, "");

      console.log("Extracted text:", extracted);

      const matchFirst = new RegExp(clean(userData.firstName)).test(extracted);
      const matchLast = new RegExp(clean(userData.lastName)).test(extracted);
      const matchIdNo = new RegExp(clean(sanitizedIdNumber)).test(extracted);
      let matchIdType = false;

      if (selectedIDType === "philsys") {
        matchIdType = [
          "pambansangpagkakakilanlan",
          "philippineidentificationcard",
          "philsys",
        ].some((term) => new RegExp(clean(term)).test(extracted));
      } else if (selectedIDType === "drivers") {
        matchIdType = [
          "driverslicense",
          "transportation",
          "driver",
          "license",
        ].some((term) => new RegExp(clean(term)).test(extracted));
      } else if (selectedIDType === "student") {
        matchIdType = ["university", "student", "course"].some((term) =>
          new RegExp(clean(term)).test(extracted)
        );
      }

      if (!matchFirst || !matchLast || !matchIdNo || !matchIdType) {
        setValidationError(
          "The details on your ID do not match the information provided. Please ensure:\n" +
            "• Your name matches exactly\n" +
            "• The ID number is correct\n" +
            "• The ID type matches your selection\n" +
            "• The photo is clear and readable"
        );
        console.log("Matches:", {
          matchFirst,
          matchLast,
          matchIdNo,
          matchIdType,
        });
        setIdImage(null);
        return;
      }

      // If validation passes, save and close
      console.log("ID details validated successfully.");

      // Call onSave with the verified data
      await onSave({ idImage, idNumber, idType: selectedIDType });

      // Show success toast
      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "ID verification completed successfully!",
      });

      // Auto-close after successful submission
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error("OCR error:", error);
      setValidationError(
        "Unable to verify ID details. Please ensure the image is clear and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 p-4">
      <View className="mb-4">
        <Text className="text-xl font-pbold text-gray-800 mb-2">
          ID Verification
        </Text>
        <Text className="text-gray-600 mb-4">
          Please take a clear photo of your valid ID. Make sure all text is
          readable and the ID is well-lit.
        </Text>

        <TouchableOpacity
          onPress={openCamera}
          className="items-center justify-center"
        >
          {idImage ? (
            <ImagePreview uri={idImage} />
          ) : (
            <View
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl items-center justify-center bg-gray-50"
              style={{ height: screenWidth * 0.63 }}
            >
              <Image
                source={icons.camera}
                className="w-12 h-12 mb-3"
                tintColor="#9CA3AF"
              />
              <Text className="text-gray-500 text-center font-pmedium">
                Tap to capture{"\n"}ID photo
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {validationError && (
          <View className="my-2 p-4 bg-red-50 rounded-xl border border-red-200">
            <View className="flex-row items-start">
              <Text className="flex-1 text-red-600 font-pmedium">
                {validationError}
              </Text>
            </View>
          </View>
        )}

        <View className="mt-2 space-y-3 gap-3">
          <View className="bg-gray-100 px-4 py-2 rounded-xl">
            <Text className="text-gray-500 font-pregular text-sm">
              First Name
            </Text>
            <Text className="text-gray-800 font-pmedium text-lg">
              {userData.firstName || "Not set"}
            </Text>
          </View>

          {userData.middleName && (
            <View className="bg-gray-100 px-4 py-2 rounded-xl">
              <Text className="text-gray-500 font-pregular text-sm">
                Middle Name
              </Text>
              <Text className="text-gray-800 font-pmedium text-lg">
                {userData.middleName}
              </Text>
            </View>
          )}

          <View className="bg-gray-100 px-4 py-2 rounded-xl">
            <Text className="text-gray-500 font-pregular text-sm">
              Last Name
            </Text>
            <Text className="text-gray-800 font-pmedium text-lg">
              {userData.lastName || "Not set"}
            </Text>
          </View>

          <View className="bg-gray-100 rounded-xl overflow-hidden">
            <TouchableOpacity
              className="px-4 py-2"
              onPress={() => setShowDropdown((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-gray-500 font-pregular text-sm">
                    ID Type
                  </Text>
                  <Text className="text-gray-800 font-pmedium text-lg">
                    {
                      ID_TYPES.find((type) => type.value === selectedIDType)
                        ?.label
                    }
                  </Text>
                </View>
                {showDropdown ? (
                  <Image
                    source={icons.arrowDown}
                    className="w-5 h-5"
                    tintColor="#9CA3AF"
                  />
                ) : (
                  <Image
                    source={icons.arrowRight}
                    className="w-5 h-5"
                    tintColor="#9CA3AF"
                  />
                )}
              </View>
            </TouchableOpacity>
            {showDropdown && (
              <View className="border rounded-b-xl border-gray-200 bg-white">
                {ID_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    className="px-4 py-2"
                    onPress={() => {
                      setSelectedIDType(type.value as IDType);
                      setShowDropdown(false);
                    }}
                  >
                    <Text
                      className={
                        selectedIDType === type.value
                          ? "text-primary font-pmedium"
                          : "text-gray-800 font-pregular"
                      }
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View className="bg-gray-100 px-4 py-2 rounded-xl">
            <Text className="text-gray-500 font-pregular text-sm">
              {getIDNumberLabel()}
            </Text>
            <TextInput
              placeholder={getIDNumberLabel()}
              placeholderTextColor="#9CA3AF"
              value={idNumber}
              onChangeText={setIdNumber}
              className="bg-gray-100 font-pmedium text-lg pt-2"
              keyboardType={
                selectedIDType === "drivers" ? "default" : "numeric"
              }
            />
          </View>
        </View>
      </View>

      <TouchableOpacity
        className={`w-full py-3 rounded-xl mb-8 ${
          !idImage || !idNumber || loading ? "bg-primary/50" : "bg-primary"
        }`}
        onPress={analyzeIdAndSave}
        disabled={!idImage || !idNumber || loading}
      >
        <Text className="text-white text-center font-pmedium">
          {loading ? "Verifying and uploading..." : "Submit Verification"}
        </Text>
      </TouchableOpacity>

      <Modal visible={cameraVisible} animationType="slide" statusBarTranslucent>
        <CameraContent />
      </Modal>
    </ScrollView>
  );
};
