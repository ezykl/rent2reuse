import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { icons } from "@/constant";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ValidationResult = {
  isValid: boolean;
  errors: string[];
  time: string;
  timeObject: { hours: number; minutes: number; period: string };
  timeInMinutes: number;
};

type TimePickerProps = {
  initialTime?: string;
  onTimeChange?: (formattedTime: string, validation: ValidationResult) => void;
  onValidationChange?: (validation: ValidationResult) => void;
  minTime?: string | null;
  maxTime?: string | null;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  errorMessage?: string;
  className?: string;
  onDone?: () => void;
};

const parseTime = (timeString: string) => {
  const [time, period] = timeString.split(" ");
  const [hours, minutes] = time.split(":");
  return {
    hours: parseInt(hours),
    minutes: parseInt(minutes),
    period: period,
  };
};

const TimePicker = ({
  initialTime = "12:00 AM",
  onTimeChange = () => {},
  onValidationChange = () => {},
  minTime = null,
  maxTime = null,
  disabled = false,
  required = false,
  label = "Select Time",
  errorMessage = "",
  className = "",
  onDone = () => {},
}: TimePickerProps) => {
  const insets = useSafeAreaInsets();
  const [selectedTime, setSelectedTime] = useState(parseTime(initialTime));

  // Convert time object to minutes for comparison
  type TimeObject = { hours: number; minutes: number; period: string };

  const timeToMinutes = (timeObj: TimeObject) => {
    let hours = timeObj.hours;
    if (timeObj.period === "PM" && hours !== 12) hours += 12;
    if (timeObj.period === "AM" && hours === 12) hours = 0;
    return hours * 60 + timeObj.minutes;
  };

  // Format time object to string
  const formatTime = (timeObj: TimeObject) => {
    return `${timeObj.hours}:${timeObj.minutes.toString().padStart(2, "0")} ${
      timeObj.period
    }`;
  };

  const [isValid, setIsValid] = useState(true);
  const [validationError, setValidationError] = useState("");

  // Generate arrays
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  // Validation function
  const validateTime = (timeObj: TimeObject) => {
    const currentTimeInMinutes = timeToMinutes(timeObj);
    let errors = [];

    // Required validation
    if (required && !timeObj) {
      errors.push("Time is required");
    }

    // Working hours validation (8 AM - 6 PM)
    const workingHoursStart = timeToMinutes({
      hours: 6,
      minutes: 0,
      period: "AM",
    });
    const workingHoursEnd = timeToMinutes({
      hours: 6,
      minutes: 0,
      period: "PM",
    });

    if (currentTimeInMinutes < workingHoursStart) {
      errors.push("Time must be after 6:00 AM");
    }

    if (currentTimeInMinutes > workingHoursEnd) {
      errors.push("Time must be before 6:00 PM");
    }

    const valid = errors.length === 0;
    setIsValid(valid);
    setValidationError(errors.join(", "));

    return {
      isValid: valid,
      errors: errors,
      time: formatTime(timeObj),
      timeObject: timeObj,
      timeInMinutes: currentTimeInMinutes,
    };
  };

  // Update the handleTimeUpdate function to not trigger onTimeChange immediately
  const handleTimeUpdate = (newTime: TimeObject) => {
    setSelectedTime(newTime);
    const formattedTime = formatTime(newTime);
    const validation = validateTime(newTime);

    // Only update validation state
    onValidationChange(validation);
  };

  // Add a new function to handle the final time selection
  const handleDonePress = () => {
    const formattedTime = formatTime(selectedTime);
    const validation = validateTime(selectedTime);
    onTimeChange(formattedTime, validation);
  };

  // Update functions
  const updateHours = (hour: number) => {
    const newTime = { ...selectedTime, hours: hour };
    handleTimeUpdate(newTime);
  };

  const updateMinutes = (minute: number) => {
    const newTime = { ...selectedTime, minutes: minute };
    handleTimeUpdate(newTime);
  };

  const updatePeriod = (period: string) => {
    const newTime = { ...selectedTime, period };
    handleTimeUpdate(newTime);
  };

  // Initial validation on mount
  useEffect(() => {
    const validation = validateTime(selectedTime);
    onValidationChange(validation);
  }, [minTime, maxTime, required]);

  // Add refs for scrolling
  const hoursScrollRef = React.useRef<ScrollView>(null);
  const minutesScrollRef = React.useRef<ScrollView>(null);

  // Add function to scroll to initial time
  const scrollToInitialTime = (
    scrollViewRef: any,
    value: number,
    itemHeight: number
  ) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: (value - 1) * itemHeight,
        animated: false,
      });
    }, 100);
  };

  return (
    <View className="p-4">
      {/* Selected Time Display */}
      <Text className="text-4xl font-bold text-center text-gray-800 my-4">
        {formatTime(selectedTime)}
      </Text>

      {/* Time Picker Controls */}
      <View className="flex-row justify-between gap-4 p-4">
        {/* Hours */}
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-600 text-center mb-2">
            Hours
          </Text>
          <ScrollView
            ref={hoursScrollRef}
            className="h-48 bg-gray-50 rounded-xl"
            showsVerticalScrollIndicator={false}
            onLayout={() =>
              scrollToInitialTime(hoursScrollRef, selectedTime.hours, 56)
            }
          >
            {hours.map((hour) => (
              <TouchableOpacity
                key={hour}
                onPress={() => updateHours(hour)}
                className={`py-4 ${
                  selectedTime.hours === hour ? "bg-primary/10" : ""
                }`}
              >
                <Text
                  className={`text-center text-lg ${
                    selectedTime.hours === hour
                      ? "text-primary font-bold"
                      : "text-gray-600"
                  }`}
                >
                  {hour}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Minutes */}
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-600 text-center mb-2">
            Minutes
          </Text>
          <ScrollView
            ref={minutesScrollRef}
            className="h-48 bg-gray-50 rounded-xl"
            showsVerticalScrollIndicator={false}
            onLayout={() =>
              scrollToInitialTime(minutesScrollRef, selectedTime.minutes, 56)
            }
          >
            {minutes.map((minute) => (
              <TouchableOpacity
                key={minute}
                onPress={() => updateMinutes(minute)}
                className={`py-4 ${
                  selectedTime.minutes === minute ? "bg-primary/10" : ""
                }`}
              >
                <Text
                  className={`text-center text-lg ${
                    selectedTime.minutes === minute
                      ? "text-primary font-bold"
                      : "text-gray-600"
                  }`}
                >
                  {minute.toString().padStart(2, "0")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* AM/PM */}
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-600 text-center mb-2">
            Period
          </Text>
          <View className="gap-4 mt-4">
            {["AM", "PM"].map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => updatePeriod(period)}
                className={`py-4 rounded-xl ${
                  selectedTime.period === period ? "bg-primary" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-center text-lg ${
                    selectedTime.period === period
                      ? "text-white font-bold"
                      : "text-gray-600"
                  }`}
                >
                  {period}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
      {/* Error Message */}
      {!isValid && (
        <Text className="text-red-500 text-center mt-4">{validationError}</Text>
      )}
      {/* Working Hours Info */}
      <Text className="text-sm text-gray-500 text-center m-4">
        Suggested meet-up time: 6:00 AM - 6:00 PM.{"\n"}We encourage scheduling
        during these hours.
      </Text>

      {/* Done Button - To confirm the time selection */}
      <View className=" px-4 pt-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={handleDonePress}
          disabled={!isValid}
          className={`w-full rounded-xl py-4 ${
            isValid ? "bg-primary" : "bg-gray-300"
          }`}
        >
          <Text className="text-center text-white font-pbold text-base">
            Set Time
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default TimePicker;
