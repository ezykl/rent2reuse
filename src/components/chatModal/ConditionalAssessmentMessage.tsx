import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import Message from "@/types/message";
import { icons } from "@/constant";
import { format, isToday, isYesterday } from "date-fns";
import { auth, db } from "@/lib/firebaseConfig";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

interface ConditionalAssessmentMessageProps {
  item: Message;
  isCurrentUser: boolean;
  onSubmit: (assessment: AssessmentData) => void;
  isLoading?: boolean;
  chatId?: string;
  assessmentType: "pickup" | "return";
  isOwner: boolean; // ✅ ADD THIS
}

export interface AssessmentData {
  overallCondition: "excellent" | "good" | "fair" | "poor";
  scratches: boolean;
  damageFound: boolean;
  dents: boolean;
  stains: boolean;
  tears: boolean;
  functioningIssues: boolean;
  otherDamage: string;
  notes: string;
  photos: string[];
}

const ConditionalAssessmentMessage: React.FC<
  ConditionalAssessmentMessageProps
> = ({
  item,
  isCurrentUser,
  onSubmit,
  isLoading = false,
  chatId,
  assessmentType,
  isOwner,
}) => {
  const [liveStatus, setLiveStatus] = useState<string | undefined>(item.status);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentData>({
    overallCondition: "good",
    scratches: false,
    damageFound: false,
    dents: false,
    stains: false,
    tears: false,
    functioningIssues: false,
    otherDamage: "",
    notes: "",
    photos: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const isSender = item.senderId === auth.currentUser?.uid;

  // Real-time listener
  useEffect(() => {
    if (!chatId || !item.id) return;

    const messageRef = doc(db, "chat", String(chatId), "messages", item.id);

    const unsubscribe = onSnapshot(messageRef, (snapshot) => {
      if (snapshot.exists()) {
        const messageData = snapshot.data();
        setLiveStatus(messageData.status);
        // ✅ Load submitted assessment data
        if (messageData.assessment) {
          setAssessment(messageData.assessment);
        }
      }
    });

    return () => unsubscribe();
  }, [chatId, item.id]);

  const displayStatus = liveStatus || item.status || "pending";

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return "";

    const date = timestamp.toDate();

    if (isToday(date)) {
      return format(date, "h:mm a");
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, "h:mm a")}`;
    } else {
      return format(date, "MMM d, h:mm a");
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "excellent":
        return {
          bg: "bg-green-100",
          text: "text-green-700",
          label: "Excellent",
        };
      case "good":
        return { bg: "bg-blue-100", text: "text-blue-700", label: "Good" };
      case "fair":
        return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Fair" };
      case "poor":
        return { bg: "bg-red-100", text: "text-red-700", label: "Poor" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", label: "Unknown" };
    }
  };

  const handleSubmitAssessment = async () => {
    if (!assessment.overallCondition) {
      Alert.alert("Error", "Please select an overall condition");
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(assessment);
      setShowAssessmentForm(false);
      setAssessment({
        overallCondition: "good",
        scratches: false,
        damageFound: false,
        dents: false,
        stains: false,
        tears: false,
        functioningIssues: false,
        otherDamage: "",
        notes: "",
        photos: [],
      });
    } catch (error) {
      console.log("Error submitting assessment:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to submit assessment",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ NEW: If assessment is pending and renter sent it, show form to fill
  if (displayStatus === "pending" && isCurrentUser && !item.assessment) {
    return (
      <View className="mb-3 pr-24">
        <View className="p-4 bg-white rounded-xl rounded-bl-none border border-gray-200 shadow-sm">
          <View className="mb-4">
            <Text className="text-sm font-pmedium text-gray-500 mb-2">
              {assessmentType === "pickup"
                ? "Item Pickup Inspection"
                : "Item Return Inspection"}
            </Text>
            <Text className="text-base font-pbold text-gray-900">
              {assessmentType === "pickup"
                ? "Verify Item Condition Before Pickup"
                : "Verify Item Condition Before Returning"}
            </Text>
          </View>

          <Text className="text-sm text-gray-700 mb-4 leading-5">
            {assessmentType === "pickup"
              ? "Please inspect the item and confirm its condition matches the rental agreement before taking possession."
              : "Please inspect the returned item carefully and document any damage before completing the rental."}
          </Text>

          {!showAssessmentForm ? (
            <TouchableOpacity
              onPress={() => setShowAssessmentForm(true)}
              className="bg-blue-500 rounded-lg py-3 items-center justify-center"
            >
              <View className="flex-row items-center">
                <Image
                  source={icons.check}
                  className="w-5 h-5 mr-2"
                  tintColor="#fff"
                />
                <Text className="text-white font-psemibold">
                  Start Inspection
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <ScrollView className="max-h-96 bg-gray-50 rounded-lg p-4 mb-4">
              {/* Overall Condition Selection */}
              <Text className="text-sm font-pbold text-gray-900 mb-3">
                Overall Condition
              </Text>
              <View className="gap-2 mb-4">
                {(["excellent", "good", "fair", "poor"] as const).map(
                  (condition) => {
                    const colors = getConditionColor(condition);
                    const isSelected =
                      assessment.overallCondition === condition;

                    return (
                      <TouchableOpacity
                        key={condition}
                        onPress={() =>
                          setAssessment({
                            ...assessment,
                            overallCondition: condition,
                          })
                        }
                        className={`p-3 rounded-lg border-2 ${
                          isSelected
                            ? `${colors.bg} border-${colors.text}`
                            : "bg-white border-gray-200"
                        }`}
                      >
                        <Text
                          className={`font-psemibold ${
                            isSelected ? colors.text : "text-gray-700"
                          }`}
                        >
                          {colors.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>

              {/* Damage Checklist */}
              <Text className="text-sm font-pbold text-gray-900 mb-3">
                Visible Damage
              </Text>
              <View className="gap-2 mb-4">
                {[
                  { key: "scratches", label: "Scratches" },
                  { key: "dents", label: "Dents" },
                  { key: "stains", label: "Stains" },
                  { key: "tears", label: "Tears" },
                  {
                    key: "functioningIssues",
                    label: "Functioning Issues",
                  },
                ].map(
                  (
                    { key, label } // ✅ ADDED CLOSING ]
                  ) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() =>
                        setAssessment({
                          ...assessment,
                          [key]: !assessment[key as keyof AssessmentData],
                        })
                      }
                      className={`flex-row items-center p-3 rounded-lg border ${
                        assessment[key as keyof AssessmentData]
                          ? "bg-red-50 border-red-300"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <View
                        className={`w-5 h-5 rounded border-2 mr-3 items-center justify-center ${
                          assessment[key as keyof AssessmentData]
                            ? "bg-red-500 border-red-500"
                            : "border-gray-300"
                        }`}
                      >
                        {assessment[key as keyof AssessmentData] && (
                          <Text className="text-white font-pbold">✓</Text>
                        )}
                      </View>
                      <Text className="text-gray-900 font-pmedium">
                        {label}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>

              {/* Notes */}
              <Text className="text-sm font-pbold text-gray-900 mb-2">
                Additional Notes
              </Text>
              <View className="bg-white rounded-lg p-3 border border-gray-200">
                <Text
                  className="text-gray-700 text-sm"
                  numberOfLines={2}
                  onPress={() => {
                    // This would normally open a text input
                  }}
                >
                  {assessment.notes || "Tap to add notes..."}
                </Text>
              </View>
            </ScrollView>
          )}

          {showAssessmentForm && (
            <View className="flex-row gap-2 mt-4">
              <TouchableOpacity
                onPress={() => setShowAssessmentForm(false)}
                className="flex-1 bg-gray-200 rounded-lg py-3"
              >
                <Text className="text-gray-700 font-psemibold text-center">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSubmitAssessment}
                disabled={submitting}
                className={`flex-1 rounded-lg py-3 items-center justify-center ${
                  submitting ? "bg-gray-300" : "bg-green-500"
                }`}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-psemibold">
                    Submit Assessment
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View className="mt-2 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ✅ NEW: If assessment is submitted, show summary (for both owner and renter to view)
  if (item.assessment) {
    const submittedAssessment = item.assessment;

    // ✅ GET OVERALL CONDITION
    const overallCondition = submittedAssessment.overallCondition || "good";
    const conditionColor = getConditionColor(overallCondition);

    // ✅ CHECK IF DAMAGE WAS FOUND
    const damageFound =
      submittedAssessment.damageFound !== undefined
        ? submittedAssessment.damageFound
        : true;

    // ✅ GET DAMAGE ITEMS
    const damageItems = [
      { key: "scratches", label: "Scratches" },
      { key: "dents", label: "Dents" },
      { key: "stains", label: "Stains" },
      { key: "tears", label: "Tears" },
      { key: "functioningIssues", label: "Functioning Issues" },
    ];

    const foundDamage = damageItems.filter(
      (item) =>
        submittedAssessment[item.key as keyof typeof submittedAssessment]
    );

    return (
      <View className={`mb-3 ${isCurrentUser ? "pr-24" : "pl-24"}`}>
        <View
          className={`p-4 bg-white rounded-xl border border-gray-200 shadow-sm ${
            isCurrentUser ? "rounded-bl-none" : "rounded-tl-none"
          }`}
        >
          {/* Header */}
          <View className="flex-row items-center mb-3">
            <View className="flex-1">
              <Text className="text-sm font-pmedium text-gray-500 mb-1">
                {assessmentType === "pickup"
                  ? "✅ Pickup Inspection Submitted"
                  : "✅ Return Inspection Submitted"}
              </Text>
              <Text className="text-base font-pbold text-gray-900">
                Item Condition Assessment
              </Text>
            </View>
            <View
              className={`w-10 h-10 rounded-full items-center justify-center ${conditionColor.bg}`}
            >
              <Text className={`font-pbold text-lg ${conditionColor.text}`}>
                ✓
              </Text>
            </View>
          </View>

          {/* Overall Condition Badge */}
          <View
            className={`${conditionColor.bg} rounded-lg p-3 mb-4 items-center`}
          >
            <Text className={`text-sm font-pbold ${conditionColor.text}`}>
              Condition: {conditionColor.label}
            </Text>
          </View>

          {/* ✅ NEW: Damage Status */}
          {!damageFound ? (
            // No Damage Found
            <View className="bg-green-50 rounded-lg p-3 mb-4 border border-green-200">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-2">✨</Text>
                <View className="flex-1">
                  <Text className="text-sm font-pbold text-green-700">
                    No Issues Found
                  </Text>
                  <Text className="text-xs text-green-600">
                    Item is in perfect condition for rental
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            // Damage Found
            <>
              <View className="bg-orange-50 rounded-lg p-3 mb-4 border border-orange-200">
                <Text className="text-xs font-pbold text-orange-600 mb-2 uppercase">
                  ⚠️ Issues Reported
                </Text>
                {foundDamage.length > 0 ? (
                  <View>
                    {foundDamage.map(({ key, label }) => (
                      <View key={key} className="flex-row items-center mb-2">
                        <View className="w-4 h-4 rounded bg-red-500 mr-2" />
                        <Text className="text-sm text-gray-700 font-pmedium">
                          {label} - Found
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text className="text-sm text-orange-700 font-pmedium">
                    Damage reported but not specified
                  </Text>
                )}
              </View>
            </>
          )}

          {/* Other Damage */}
          {submittedAssessment.otherDamage && (
            <View className="bg-red-50 rounded-lg p-3 mb-4 border border-red-200">
              <Text className="text-xs font-pbold text-red-600 mb-1">
                🔧 Other Damage Details
              </Text>
              <Text className="text-sm text-red-900">
                {submittedAssessment.otherDamage}
              </Text>
            </View>
          )}

          {/* Notes Section */}
          {submittedAssessment.notes && (
            <View className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
              <Text className="text-xs font-pbold text-blue-600 mb-1">
                📝 Notes
              </Text>
              <Text className="text-sm text-blue-900">
                {submittedAssessment.notes}
              </Text>
            </View>
          )}

          {/* Photos Section */}
          {submittedAssessment.photos &&
            submittedAssessment.photos.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-pbold text-gray-600 mb-2">
                  📸 Photos ({submittedAssessment.photos.length})
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="gap-2"
                >
                  <View className="flex-row gap-2">
                    {submittedAssessment.photos.map((photoUrl, index) => (
                      <TouchableOpacity key={index}>
                        <Image
                          source={{ uri: photoUrl }}
                          className="w-16 h-16 rounded-lg"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

          {/* ✅ NEW: Alert if damage found */}
          {damageFound && foundDamage.length > 0 && (
            <View className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 mb-3">
              <Text className="text-xs font-pbold text-yellow-700">
                ⚠️ Important
              </Text>
              <Text className="text-xs text-yellow-600 mt-1">
                Renter reported issues with this item. Owner should review
                before confirming receipt.
              </Text>
            </View>
          )}

          {/* Status Indicator for Owner */}
          {!isCurrentUser && isOwner && (
            <View className="bg-green-50 rounded-lg p-3 border border-green-200 mt-3">
              <Text className="text-xs font-pbold text-green-700">
                ℹ️ Assessment received
              </Text>
              <Text className="text-xs text-green-600 mt-1">
                {damageFound
                  ? "Review the reported issues and decide whether to confirm receipt."
                  : "Item condition confirmed. Click 'Confirm Item Received' to proceed."}
              </Text>
            </View>
          )}

          {/* Status Indicator for Renter */}
          {isCurrentUser && !isOwner && (
            <View
              className={`rounded-lg p-3 border mt-3 ${
                damageFound
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-blue-50 border-blue-200"
              }`}
            >
              <Text
                className={`text-xs font-pbold ${
                  damageFound ? "text-yellow-700" : "text-blue-700"
                }`}
              >
                ℹ️ Assessment submitted
              </Text>
              <Text
                className={`text-xs mt-1 ${
                  damageFound ? "text-yellow-600" : "text-blue-600"
                }`}
              >
                {damageFound
                  ? "Waiting for owner to review reported issues..."
                  : "Waiting for owner to confirm receipt..."}
              </Text>
            </View>
          )}

          <View className="mt-3 flex-row justify-end">
            <Text className="text-xs text-gray-400">
              {item.createdAt ? formatTimestamp(item.createdAt) : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // ✅ Default: If no status or assessment, don't show anything
  return null;
};

export default ConditionalAssessmentMessage;
