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

  // Calculate the latest allowed birthday (today minus 18 years)
  const today = dayjs();
  const maxDate = today.subtract(18, "year").toDate();
  const minDate = new Date(1900, 0, 1);

  const handleValidateAndSave = () => {
    if (!date) {
      setWarning("Please select your birthdate.");
      return;
    }
    if (dayjs(date).isAfter(maxDate)) {
      setWarning("You must be at least 18 years old.");
      return;
    }
    setWarning(null);
    setLoading(true);
    onSave(date.toISOString());
    setLoading(false);
  };

  return (
    <View className="p-4">
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
            button_next: "bg-primary rounded-lg ",
            button_prev: "bg-primary rounded-lg ",
            today: "bg-primary",
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
        onPress={handleValidateAndSave}
        disabled={loading}
      >
        <Text className="text-white text-center font-pmedium">
          {loading ? "Validating..." : "Continue"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
