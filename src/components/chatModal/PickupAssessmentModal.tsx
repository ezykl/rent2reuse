import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { icons } from "@/constant";
import * as ImagePicker from "expo-image-picker";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useLoader } from "@/context/LoaderContext"; // ✅ USE LOADER HOOK

interface PickupAssessmentModalProps {
  visible: boolean;
  itemName: string;
  onClose: () => void;
  onSubmit: (data: PickupAssessmentData) => void;
  initialData?: PickupAssessmentData;
  chatId: string;
}

// ✅ ALIGNED WITH CONDITIONAL ASSESSMENT MESSAGE
export interface PickupAssessmentData {
  overallCondition: "excellent" | "good" | "fair" | "poor";
  scratches: boolean;
  dents: boolean;
  stains: boolean;
  tears: boolean;
  functioningIssues: boolean;
  otherDamage: string;
  notes: string;
  photos: string[];
}

const PickupAssessmentModal: React.FC<PickupAssessmentModalProps> = ({
  visible,
  itemName,
  onClose,
  onSubmit,
  initialData,
  chatId,
}) => {
  // ✅ USE LOADER HOOK
  const { isLoading, setIsLoading } = useLoader();

  // ✅ ALIGNED STATE WITH CONDITIONAL ASSESSMENT
  const [overallCondition, setOverallCondition] = useState<
    "excellent" | "good" | "fair" | "poor"
  >(initialData?.overallCondition || "good");

  const [damageItems, setDamageItems] = useState({
    scratches: initialData?.scratches || false,
    dents: initialData?.dents || false,
    stains: initialData?.stains || false,
    tears: initialData?.tears || false,
    functioningIssues: initialData?.functioningIssues || false,
  });

  const [otherDamage, setOtherDamage] = useState(
    initialData?.otherDamage || ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const storage = getStorage();

  const conditionOptions = [
    { value: "excellent", label: "Excellent", emoji: "✨" },
    { value: "good", label: "Good", emoji: "👍" },
    { value: "fair", label: "Fair", emoji: "😐" },
    { value: "poor", label: "Poor", emoji: "😞" },
  ] as const;

  const damageChecklist = [
    { key: "scratches", label: "Scratches", icon: "🔲" },
    { key: "dents", label: "Dents", icon: "📍" },
    { key: "stains", label: "Stains", icon: "💧" },
    { key: "tears", label: "Tears", icon: "✂️" },
    { key: "functioningIssues", label: "Functioning Issues", icon: "⚙️" },
  ];

  const capturePhoto = async () => {
    try {
      setPhotoLoading(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos([...photos, result.assets[0].uri]);
        Toast.show({
          type: ALERT_TYPE.SUCCESS,
          title: "Photo Captured",
          textBody: `${photos.length + 1} photo(s) captured`,
        });
      }
    } catch (error) {
      console.log("Error capturing photo:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to capture photo",
      });
    } finally {
      setPhotoLoading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // ✅ VALIDATION
    if (photos.length === 0) {
      Alert.alert(
        "Photos Required",
        "Please capture at least one photo of the item"
      );
      return;
    }

    try {
      setIsLoading(true);

      // ✅ UPLOAD PHOTOS TO FIREBASE
      const uploadedPhotoUrls: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photoUri = photos[i];
        try {
          // If it's already a URL (from Firebase), skip upload
          if (photoUri.startsWith("http")) {
            uploadedPhotoUrls.push(photoUri);
            continue;
          }

          const filename = `assessments/${chatId}/${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}.jpg`;

          const response = await fetch(photoUri);
          const blob = await response.blob();

          const imageRef = ref(storage, filename);
          await uploadBytes(imageRef, blob);
          const downloadURL = await getDownloadURL(imageRef);

          uploadedPhotoUrls.push(downloadURL);

          // ✅ Update progress
          setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
        } catch (photoError) {
          console.log("Error uploading photo:", photoError);
          throw new Error("Failed to upload photos");
        }
      }

      // ✅ BUILD ASSESSMENT DATA - ALIGNED WITH CONDITIONAL ASSESSMENT
      const assessmentData: PickupAssessmentData = {
        overallCondition,
        scratches: damageItems.scratches,
        dents: damageItems.dents,
        stains: damageItems.stains,
        tears: damageItems.tears,
        functioningIssues: damageItems.functioningIssues,
        otherDamage,
        notes,
        photos: uploadedPhotoUrls,
      };

      await onSubmit(assessmentData);
      setUploadProgress(0);

      // ✅ CLOSE MODAL ON SUCCESS
      onClose();
    } catch (error) {
      console.log("Error in handleSubmit:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: error instanceof Error ? error.message : "Failed to submit",
      });
      setUploadProgress(0);
    } finally {
      setIsLoading(false);
    }
  };

  const canSubmit =
    photos.length > 0 && Object.values(damageItems).some((v) => v === true);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-primary px-4 py-4 flex-row items-center justify-between">
          <Text className="text-white font-pbold text-lg flex-1">
            Item Condition Assessment
          </Text>
          <TouchableOpacity onPress={onClose} disabled={isLoading}>
            <Image source={icons.close} className="w-6 h-6" tintColor="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Item Name */}
          <Text className="text-sm text-gray-600 font-pmedium mb-1">Item</Text>
          <View className="bg-gray-100 p-3 rounded-lg mb-6">
            <Text className="text-lg font-pbold text-gray-900">{itemName}</Text>
          </View>

          {/* Instructions */}
          <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <Text className="text-sm font-pbold text-blue-900 mb-2">
              📋 Instructions
            </Text>
            <Text className="text-xs text-blue-800 leading-5">
              Assess the item's overall condition and document any visible
              damage. Capture clear photos showing all important details.
            </Text>
          </View>

          {/* Overall Condition */}
          <View className="mb-6">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              Overall Condition
            </Text>
            <View className="gap-2">
              {conditionOptions.map(({ value, label, emoji }) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setOverallCondition(value)}
                  className={`p-3 rounded-lg border-2 flex-row items-center ${
                    overallCondition === value
                      ? "border-primary bg-primary/10"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text className="text-2xl mr-3">{emoji}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-psemibold ${
                        overallCondition === value
                          ? "text-primary"
                          : "text-gray-700"
                      }`}
                    >
                      {label}
                    </Text>
                  </View>
                  {overallCondition === value && (
                    <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Text className="text-white font-pbold text-xs">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Photos Section */}
          <View className="mb-6">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              📸 Capture Photos (Required)
            </Text>

            {/* Photo Grid */}
            <View className="flex-row flex-wrap gap-3 mb-3">
              {photos.map((photo, index) => (
                <View
                  key={index}
                  className="relative w-24 h-24 rounded-lg overflow-hidden"
                >
                  <Image
                    source={{ uri: photo }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1"
                  >
                    <Image
                      source={icons.close}
                      className="w-4 h-4"
                      tintColor="#fff"
                    />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Capture Photo Button */}
              <TouchableOpacity
                onPress={capturePhoto}
                disabled={photoLoading || isLoading}
                className="w-24 h-24 border-2 border-dashed border-primary rounded-lg items-center justify-center bg-primary/10"
              >
                {photoLoading ? (
                  <ActivityIndicator color="#5C6EF6" size="small" />
                ) : (
                  <>
                    <Image
                      source={icons.camera}
                      className="w-6 h-6 mb-1"
                      tintColor="#5C6EF6"
                    />
                    <Text className="text-xs text-primary font-pmedium">
                      Add Photo
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-gray-500">
              {photos.length} photo(s) captured
            </Text>
          </View>

          {/* Damage Checklist */}
          <View className="mb-6">
            <Text className="text-sm font-pbold text-gray-900 mb-3">
              🔍 Visible Damage
            </Text>
            <View className="gap-2">
              {damageChecklist.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() =>
                    setDamageItems({
                      ...damageItems,
                      [key]: !damageItems[key as keyof typeof damageItems],
                    })
                  }
                  className={`p-3 rounded-lg border-2 flex-row items-center ${
                    damageItems[key as keyof typeof damageItems]
                      ? "border-red-300 bg-red-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text className="text-lg mr-3">{icon}</Text>
                  <View className="flex-1">
                    <Text
                      className={`font-pmedium ${
                        damageItems[key as keyof typeof damageItems]
                          ? "text-red-700"
                          : "text-gray-700"
                      }`}
                    >
                      {label}
                    </Text>
                  </View>
                  {damageItems[key as keyof typeof damageItems] && (
                    <View className="w-5 h-5 rounded bg-red-500 items-center justify-center">
                      <Text className="text-white font-pbold text-xs">✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Other Damage */}
          <View className="mb-6">
            <Text className="text-sm font-pbold text-gray-900 mb-2">
              Other Damage (Optional)
            </Text>
            <TextInput
              value={otherDamage}
              onChangeText={setOtherDamage}
              placeholder="e.g., Broken handle, Missing battery cover..."
              multiline
              numberOfLines={2}
              className="border border-gray-300 rounded-lg p-3 text-gray-900 font-pregular"
              style={{ textAlignVertical: "top" }}
            />
          </View>

          {/* Additional Notes */}
          <View className="mb-6">
            <Text className="text-sm font-pbold text-gray-900 mb-2">
              📝 Additional Notes (Optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Item in good working condition, all accessories present..."
              multiline
              numberOfLines={3}
              className="border border-gray-300 rounded-lg p-3 text-gray-900 font-pregular"
              style={{ textAlignVertical: "top" }}
            />
          </View>

          {/* Summary */}
          <View className="bg-gray-50 rounded-lg p-3 mb-6 border border-gray-200">
            <Text className="text-xs font-pbold text-gray-700 mb-2">
              SUMMARY
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              📸 Photos: {photos.length} captured
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              📋 Condition: {overallCondition}
            </Text>
            <Text className="text-xs text-gray-600 mb-1">
              🔴 Damage items:{" "}
              {Object.values(damageItems).filter(Boolean).length}
            </Text>
          </View>
        </ScrollView>

        {/* Upload Progress */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <View className="bg-blue-50 px-4 py-2">
            <Text className="text-xs text-blue-700 font-pmedium mb-1">
              Uploading photos... {uploadProgress}%
            </Text>
            <View className="h-2 bg-blue-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-blue-500"
                style={{ width: `${uploadProgress}%` }}
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="border-t border-gray-200 p-4 bg-white gap-3">
          <TouchableOpacity
            onPress={onClose}
            disabled={isLoading}
            className={`rounded-lg py-3 ${
              isLoading ? "bg-gray-300" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-center font-psemibold ${
                isLoading ? "text-gray-600" : "text-gray-700"
              }`}
            >
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit || isLoading}
            className={`rounded-lg py-3 flex-row items-center justify-center ${
              canSubmit && !isLoading ? "bg-primary" : "bg-gray-300"
            }`}
          >
            {isLoading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text className="text-white font-psemibold ml-2">
                  Uploading & Submitting...
                </Text>
              </>
            ) : (
              <>
                <Image
                  source={icons.check}
                  className="w-5 h-5 mr-2"
                  tintColor="#fff"
                />
                <Text className="text-white font-psemibold">
                  {canSubmit ? "Submit Assessment" : "Complete All Fields"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default PickupAssessmentModal;
