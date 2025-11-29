import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import DateTimePicker, {
  useDefaultClassNames,
} from "react-native-ui-datepicker";
import dayjs from "dayjs";

interface BirthdayContentProps {
  onSave: (date: string) => void;
  onClose?: () => void;
}

export const BirthdayContent = ({ onSave, onClose }: BirthdayContentProps) => {
  const defaultClassNames = useDefaultClassNames();
  const [date, setDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false); // Add confirmation state

  // Calculate the latest allowed birthday (today minus 18 years)
  const today = dayjs();
  const maxDate = today.subtract(18, "year").toDate();
  const minDate = new Date(1900, 0, 1);

  const handleValidate = () => {
    if (!date) {
      setWarning("Please select your birthdate.");
      return;
    }
    if (dayjs(date).isAfter(maxDate)) {
      setWarning("You must be at least 18 years old.");
      return;
    }
    setWarning(null);
    setShowConfirmation(true); // Show confirmation instead of saving immediately
  };

  const handleConfirmAndSave = async () => {
    setLoading(true);
    try {
      await onSave(date.toISOString());
    } catch (error) {
      console.error("Error saving birthday:", error);
      setWarning("Failed to save birthday. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditDate = () => {
    setShowConfirmation(false); // Go back to date picker
    setWarning(null);
  };

  return (
    <View className="p-4">
      {!showConfirmation ? (
        <>
          <Text className="text-gray-600 mb-4">
            Please enter your date of birth
          </Text>

          <View className="rounded-xl mb-4 bg-white border-2 border-gray-200 p-2">
            <DateTimePicker
              mode="single"
              date={date}
              timeZone="UTC"
              onChange={(params) => setDate(dayjs(params.date))}
              startDate={maxDate}
              endDate={minDate}
              classNames={{
                ...defaultClassNames,
                weekday_label: "text-secondary-300 font-pregular",
                year_selector_label: "font-pbold text-xl text-primary ",
                month_selector_label: "font-pbold text-xl text-primary ",
                button_next: "bg-gray-500/20 rounded-full ",
                button_prev: "bg-gray-500/20  rounded-full ",
                day_label: "font-pregular text-lg",
                month_label: "font-pregular text-lg",
                year_label: "font-pregular text-lg",
                selected_month_label: "text-white ",
                selected_year_label: "text-white",
                selected_label: "text-white",
                day: `${defaultClassNames.day} hover:bg-amber-100`,
                disabled: "opacity-50",
              }}
            />
          </View>

          {warning && (
            <View className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Text className="text-red-600 text-center">{warning}</Text>
            </View>
          )}

          <TouchableOpacity
            className="bg-primary w-full py-3 rounded-xl"
            onPress={handleValidate}
          >
            <Text className="text-white text-center font-pmedium">
              Continue
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Confirmation View */}
          <Text className="text-gray-600 mb-2 text-center">
            Please confirm your birthdate
          </Text>

          <View className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
            <Text className="text-center text-3xl font-pbold text-gray-800 mb-2">
              {date.format("MMMM DD, YYYY")}
            </Text>
            <Text className="text-center text-gray-500 text-sm">
              You are {today.diff(date, "year")} years old
            </Text>
          </View>

          {warning && (
            <View className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Text className="text-red-600 text-center">{warning}</Text>
            </View>
          )}

          {/* Confirm Button */}
          <TouchableOpacity
            className={`w-full py-3 rounded-xl mb-3 ${
              loading ? "bg-gray-300" : "bg-primary"
            }`}
            onPress={handleConfirmAndSave}
            disabled={loading}
          >
            <Text className="text-white text-center font-pbold">
              {loading ? "Saving..." : "Yes, Confirm"}
            </Text>
          </TouchableOpacity>

          {/* Edit Button */}
          <TouchableOpacity
            className="w-full py-3 rounded-xl border-2 border-gray-300"
            onPress={handleEditDate}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-pmedium">
              Edit Date
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};
