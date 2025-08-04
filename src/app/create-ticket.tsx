import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SUPPORT_SUBJECTS } from "@/constants/supportSubjects";
import { db, auth } from "@/lib/firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { icons } from "@/constant";

export default function CreateTicket() {
  const insets = useSafeAreaInsets();
  const [selectedSubject, setSelectedSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Improved ticket ID generation function
  const generateTicketId = () => {
    const prefix = "TKT";
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const ticketId = `${prefix}-${timestamp}-${random}`;

    // Debug log to verify generation
    console.log("Generated Ticket ID:", ticketId);
    return ticketId;
  };

  const handleSubmit = async () => {
    if (!selectedSubject || !description.trim()) {
      Alert.alert("Required Fields", "Please fill in all required fields");
      return;
    }

    if (!auth.currentUser) {
      Alert.alert("Error", "You must be logged in to submit a ticket");
      return;
    }

    setIsSubmitting(true);
    try {
      const subject = SUPPORT_SUBJECTS.find((s) => s.id === selectedSubject);
      const now = new Date();
      const generatedTicketId = generateTicketId();

      // Debug log to verify ticket ID before storing
      console.log("About to store ticket with ID:", generatedTicketId);

      const ticketData = {
        ticketId: generatedTicketId, // Use the generated ID
        userId: auth.currentUser.uid,
        email: auth.currentUser.email || "",
        subject: subject?.label || "",
        messages: [
          {
            message: description,
            sender: auth.currentUser.uid,
            timestamp: now.toISOString(),
          },
        ],
        priority: subject?.priority || "Low",
        status: "open",
        date: now.toISOString(),
        description,
        isUnread: true,
        createdAt: serverTimestamp(), // Keep serverTimestamp for sorting/querying
        lastReadAt: now.toISOString(),
        lastReadBy: {
          user: auth.currentUser.uid,
        },
      };

      // Debug log the complete ticket data
      console.log("Complete ticket data:", JSON.stringify(ticketData, null, 2));

      const docRef = await addDoc(collection(db, "support"), ticketData);

      // Debug log the document reference
      console.log("Document created with ID:", docRef.id);
      console.log("Ticket ID stored:", generatedTicketId);

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: `Ticket ${generatedTicketId} submitted successfully`,
      });

      router.back();
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit ticket. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test function to verify ticket ID generation
  const testTicketIdGeneration = () => {
    for (let i = 0; i < 5; i++) {
      console.log(`Test ${i + 1}:`, generateTicketId());
    }
  };

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Image
            source={icons.leftArrow}
            className="w-6 h-6"
            tintColor="#374151"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-900 ml-2">
          Create Support Ticket
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Subject Selection */}
        <Text className="text-base font-pbold text-gray-700 mb-2">
          What can we help you with?
        </Text>
        <View className="gap-2 mb-6">
          {SUPPORT_SUBJECTS.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              onPress={() => setSelectedSubject(subject.id)}
              className={`p-4 rounded-xl border ${
                selectedSubject === subject.id
                  ? "border-primary bg-primary/5"
                  : "border-gray-200"
              }`}
            >
              <Text
                className={`font-pbold ${
                  selectedSubject === subject.id
                    ? "text-primary"
                    : "text-gray-800"
                }`}
              >
                {subject.label}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                {subject.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description Input */}
        <Text className="text-base font-pbold text-gray-700 mb-2">
          Describe your issue
        </Text>
        <TextInput
          className="border border-gray-200 rounded-xl p-4 min-h-[120px] text-base"
          multiline
          placeholder="Please provide as much detail as possible..."
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          className={`my-6 rounded-xl p-4 ${
            isSubmitting ? "bg-gray-400" : "bg-primary"
          }`}
        >
          <Text className="text-white text-center font-pbold text-lg">
            {isSubmitting ? "Submitting..." : "Submit Ticket"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
