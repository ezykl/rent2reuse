import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { Image } from "expo-image";
import { icons } from "@/constant";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

const reportReasons = [
  "Inappropriate behavior",
  "Harassment or bullying",
  "Spam or scam",
  "Fake profile",
  "Item misrepresentation",
  "Other",
];

export default function ReportScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      Alert.alert("Reason Required", "Please select a reason for reporting");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Missing Details", "Please provide details about the issue.");
      return;
    }

    try {
      setIsSubmitting(true);
      const reportData = {
        reportedUserId: userId,
        reporterId: auth.currentUser?.uid,
        reason: selectedReason,
        description: description.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "reports"), reportData);

      if (auth.currentUser?.uid) {
        try {
          // Create a reference to the user's notifications subcollection
          const userNotificationsRef = collection(
            db,
            `users/${auth.currentUser?.uid}/notifications`
          );

          await addDoc(userNotificationsRef, {
            type: "REPORT_ISSUE",
            title: "Report Submitted",
            message: `We've received your report regarding ${reportData.reason.toLowerCase()}. Our team will review this matter and take appropriate action if needed.`,
            isRead: false,
            createdAt: serverTimestamp(),
            data: {
              reportReason: reportData.reason,
              reportedUserId: userId,
              reportDescription: description.trim().slice(0, 100),
            },
          });
        } catch (error) {
          console.error("Error creating welcome notification:", error);
        }

        // await createNotification(auth.currentUser.uid, "REPORT_ISSUE", {
        //   reportReason: reportData.reason,
        // });
      }

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Report Submitted",
        textBody: "Thank you for your report. We'll review it shortly.",
      });

      router.back();
    } catch (error) {
      console.error("Error submitting report:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit report. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row justify-center items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">Report User</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="text-base font-psemibold mb-4">
          Select a reason for reporting:
        </Text>

        {reportReasons.map((reason) => (
          <TouchableOpacity
            key={reason}
            onPress={() => setSelectedReason(reason)}
            className={`p-4 mb-2 rounded-xl border ${
              selectedReason === reason
                ? "border-primary bg-primary/5"
                : "border-gray-200"
            }`}
          >
            <Text
              className={`font-pmedium ${
                selectedReason === reason ? "text-primary" : "text-gray-700"
              }`}
            >
              {reason}
            </Text>
          </TouchableOpacity>
        ))}

        <Text className="text-base font-psemibold mt-6 mb-2">
          Provide additional details:
        </Text>
        <TextInput
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          placeholder="Please describe the issue..."
          className="p-4 rounded-xl border border-gray-200 min-h-[120px] text-base"
          textAlignVertical="top"
        />

        <TouchableOpacity
          onPress={handleSubmitReport}
          disabled={isSubmitting}
          className={`mt-6 p-4 rounded-xl ${
            isSubmitting ? "bg-gray-400" : "bg-primary"
          }`}
        >
          <Text className="text-white text-center font-semibold">
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
