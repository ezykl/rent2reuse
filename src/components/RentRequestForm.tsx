import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Image,
  Modal,
} from "react-native";

import DateTimePicker, {
  DateType,
  useDefaultClassNames,
} from "react-native-ui-datepicker";
import dayjs from "dayjs";
import { icons, images } from "@/constant";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RangeChange {
  startDate?: DateType;
  endDate?: DateType;
}
import TimePicker from "./TimePicker"; // Adjust the import based on your file structure
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

interface RentRequestFormProps {
  mode?: "create" | "edit";
  initialData?: {
    startDate: Date;
    endDate: Date;
    message: string;
    selectedTime: string;
  };
  itemData: {
    itemName: string;
    itemPrice: number;
    itemImage?: string;
    itemMinRentDuration: number; // Make this required
  };
  onSubmit: (data: {
    startDate: Date;
    endDate: Date;
    message: string;
    selectedTime: string;
  }) => void;
  onClose?: () => void;
}

const RentRequestForm = ({
  mode = "create",
  initialData,
  itemData,
  onSubmit,
  onClose,
}: RentRequestFormProps) => {
  const insets = useSafeAreaInsets();
  const defaultClassNames = useDefaultClassNames();
  const [startDate, setStartDate] = useState(
    initialData ? dayjs(initialData.startDate) : dayjs()
  );
  const [endDate, setEndDate] = useState(
    initialData ? dayjs(initialData.endDate) : dayjs().add(1, "day")
  );
  const [message, setMessage] = useState(initialData?.message || "");
  const [selectedTime, setSelectedTime] = useState(
    initialData?.selectedTime || "9:00 AM"
  );
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const today = dayjs().add(1, "day").startOf("day");
  const minimumDate = today.toDate();
  const [selectedDates, setSelectedDates] = useState<{
    startDate: dayjs.Dayjs | null;
    endDate: dayjs.Dayjs | null;
  }>({
    startDate: initialData ? dayjs(initialData.startDate) : null,
    endDate: initialData ? dayjs(initialData.endDate) : null,
  });
  // Check for changes
  useEffect(() => {
    if (mode === "edit" && initialData) {
      const isChanged =
        !dayjs(initialData.startDate).isSame(startDate, "day") ||
        !dayjs(initialData.endDate).isSame(endDate, "day") ||
        initialData.message !== message ||
        initialData.selectedTime !== selectedTime;

      setHasChanges(isChanged);
    }
  }, [startDate, endDate, message, selectedTime, initialData]);

  const calculateTotalPrice = () => {
    const days = endDate.diff(startDate, "day");
    return Math.max(1, days) * itemData.itemPrice;
  };

  // Update handleDateChange function
  const handleDateChange = ({ startDate, endDate }: RangeChange) => {
    if (startDate) {
      const start = dayjs(startDate).startOf("day");
      const end = endDate ? dayjs(endDate).startOf("day") : null;

      // Ensure start date is not before today
      if (start.isBefore(today)) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Invalid Date",
          textBody: "Start date cannot be before today",
        });
        return;
      }

      // If end date is selected, ensure it meets minimum rental period
      if (end) {
        const days = end.diff(start, "day");
        if (days < itemData.itemMinRentDuration) {
          Toast.show({
            type: ALERT_TYPE.WARNING,
            title: "Invalid Duration",
            textBody: `Minimum rental period is ${itemData.itemMinRentDuration} days`,
          });
          return;
        }
      }

      setSelectedDates({
        startDate: start,
        endDate: end,
      });

      if (start) setStartDate(start);
      if (end) setEndDate(end);
    }
  };

  // Update validateDates function
  const validateDates = () => {
    if (!selectedDates.startDate || !selectedDates.endDate) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Invalid Date Range",
        textBody: "Please select both start and end dates",
      });
      return false;
    }

    const days = selectedDates.endDate.diff(selectedDates.startDate, "day");
    if (days < itemData.itemMinRentDuration) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Invalid Duration",
        textBody: `Minimum rental period is ${itemData.itemMinRentDuration} days`,
      });
      return false;
    }

    return true;
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={onClose} className="p-2">
          <Image
            source={icons.leftArrow}
            className="w-6 h-6"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">
          {mode === "edit" ? "Edit Request" : "Rent Request"}
        </Text>
        <View className="w-10" /> {/* Spacer for alignment */}
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Item Preview */}
        <View className="flex-row items-center p-3 bg-gray-50 rounded-xl my-4">
          <Image
            source={
              itemData.itemImage
                ? { uri: itemData.itemImage }
                : images.thumbnail
            }
            className="w-16 h-16 rounded-lg"
            resizeMode="cover"
          />
          <View className="ml-3 flex-1">
            <Text
              className="text-lg font-psemibold text-gray-800"
              numberOfLines={1}
            >
              {itemData.itemName}
            </Text>
            <Text className="text-primary font-psemibold">
              ₱{itemData.itemPrice}/day
            </Text>
            {itemData.itemMinRentDuration && (
              <Text className="text-xs text-gray-500">
                Min. {itemData.itemMinRentDuration} day(s)
              </Text>
            )}
          </View>
        </View>

        {/* Date Selection */}
        <View className="mb-6">
          <Text className="text-base font-psemibold text-gray-700 mb-2">
            Rental Period
          </Text>

          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="p-4 bg-gray-50 rounded-xl mb-3"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-gray-500 mb-1">Select Dates</Text>
                {selectedDates.startDate && selectedDates.endDate ? (
                  <>
                    <Text className="font-psemibold text-gray-800">
                      {selectedDates.startDate.format("MMM DD")} -{" "}
                      {selectedDates.endDate.format("MMM DD, YYYY")}
                    </Text>
                    <Text className="text-sm text-gray-500 mt-1">
                      {selectedDates.endDate.diff(
                        selectedDates.startDate,
                        "day"
                      )}{" "}
                      days
                    </Text>
                  </>
                ) : (
                  <Text className="font-psemibold text-gray-800">
                    Select dates
                  </Text>
                )}
              </View>
              <Image
                source={icons.calendar}
                className="w-5 h-5"
                tintColor="#6B7280"
              />
            </View>
          </TouchableOpacity>

          {/* Time Selection */}
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            className="p-4 bg-gray-50 rounded-xl"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-gray-500 mb-1">Pickup Time</Text>
                <Text className="font-psemibold text-gray-800">
                  {selectedTime}
                </Text>
              </View>
              <Image
                source={icons.clock}
                className="w-5 h-5"
                tintColor="#6B7280"
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Message */}
        <View className="mb-6">
          <Text className="text-base font-psemibold text-gray-700 mb-2">
            Message to Owner
          </Text>
          <TextInput
            className="p-3 bg-gray-50 rounded-xl min-h-[100]"
            placeholder="Enter your message here..."
            multiline
            value={message}
            onChangeText={setMessage}
          />
        </View>

        {/* Price Summary */}
        <View className="bg-gray-50 rounded-xl p-4 mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-gray-600">Duration</Text>
            <Text className="font-psemibold">
              {endDate.diff(startDate, "day")} days
            </Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-base font-psemibold text-gray-700">
              Total
            </Text>
            <Text className="text-xl font-pbold text-primary">
              ₱{calculateTotalPrice().toLocaleString()}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="p-4 border-t border-gray-100">
        <TouchableOpacity
          className={`py-4 rounded-xl items-center ${
            mode === "edit" && !hasChanges ? "bg-gray-300" : "bg-primary"
          }`}
          onPress={() =>
            onSubmit({
              startDate: startDate.toDate(),
              endDate: endDate.toDate(),
              message,
              selectedTime,
            })
          }
          disabled={mode === "edit" && !hasChanges}
        >
          <Text className="text-white font-pbold text-base">
            {mode === "edit" ? "Update Request" : "Submit Request"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          animationType="slide"
          transparent={true}
        >
          <View className="flex-1 bg-black/50 justify-center px-4 ">
            <View className="bg-white rounded-3xl p-4">
              <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text className="text-red-500">Cancel</Text>
                </TouchableOpacity>
                <Text className="font-psemibold text-lg">Select Dates</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (validateDates()) {
                      setShowDatePicker(false);
                    }
                  }}
                >
                  <Text className="text-primary font-psemibold">Done</Text>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                mode="range"
                startDate={selectedDates.startDate?.toDate()}
                endDate={selectedDates.endDate?.toDate()}
                onChange={handleDateChange}
                showOutsideDays={true}
                minDate={minimumDate}
                classNames={{
                  ...defaultClassNames,
                  weekday_label: "text-secondary-300 font-pregular",
                  year_selector_label: "font-pbold text-xl text-primary ",
                  month_selector_label: "font-pbold text-xl text-primary ",
                  day_label: "font-pregular text-lg",
                  month_label: "font-pregular text-lg",
                  year_label: "font-pregular text-lg",
                  selected_month_label: "text-white ",
                  selected_year_label: "text-white",
                  outside_label: "text-gray-400",
                  range_fill: "bg-primary/20",
                  range_middle_label: "text-gray-600",
                  range_start_label: "text-white font-pmedium  ",
                  range_end_label: "text-white font-pmedium ",
                  range_start: "bg-primary border-2 border-green-500 ",
                  range_end: "bg-primary border-2 border-green-500 ",
                  day: `${defaultClassNames.day} hover:bg-amber-100`,
                  disabled: "opacity-50",
                }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Time Picker Modal */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          animationType="slide"
          transparent={true}
        >
          <View className="flex-1 bg-black/50 justify-center px-4 ">
            <View className="bg-white rounded-3xl p-4">
              <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text className="text-gray-500">Cancel</Text>
                </TouchableOpacity>
                <Text className="font-psemibold text-lg">Select Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text className="text-primary font-psemibold">Done</Text>
                </TouchableOpacity>
              </View>

              <TimePicker
                initialTime={selectedTime}
                minTime="8:00 AM"
                maxTime="6:00 PM"
                onTimeChange={(time) => {
                  setSelectedTime(time);
                }}
                onDone={() => setShowTimePicker(false)}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export default RentRequestForm;
