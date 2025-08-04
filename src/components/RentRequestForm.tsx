import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Image,
} from "react-native";

import DateTimePicker, {
  useDefaultClassNames,
} from "react-native-ui-datepicker";
import dayjs from "dayjs";
import { icons, images } from "@/constant";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface RentRequestFormProps {
  onClose: () => void;
  onSubmit: (data: { startDate: Date; endDate: Date; message: string }) => void;
  itemName: string;
  itemPrice: number;
  itemImage?: string;
}

const RentRequestForm = ({
  onClose,
  onSubmit,
  itemName,
  itemPrice,
  itemImage,
}: RentRequestFormProps) => {
  const insets = useSafeAreaInsets();
  const defaultClassNames = useDefaultClassNames();
  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs().add(1, "day"));
  const [message, setMessage] = useState("");
  const [activeCalendar, setActiveCalendar] = useState<"start" | "end" | null>(
    null
  );

  const calculateTotalPrice = () => {
    const days = endDate.diff(startDate, "day");
    return Math.max(1, days) * itemPrice;
  };

  const handleSubmit = () => {
    onSubmit({
      startDate: startDate.toDate(),
      endDate: endDate.toDate(),
      message,
    });
  };

  return (
    <View
      className="absolute inset-0 bg-white"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={onClose} className="p-2">
          <Image
            source={icons.leftArrow}
            className="w-6 h-6"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">Rent Request</Text>
        <View className="w-10" /> {/* Spacer for alignment */}
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Item Preview */}
        <View className="flex-row items-center p-3 bg-gray-50 rounded-xl my-4">
          <Image
            source={itemImage ? { uri: itemImage } : images.thumbnail}
            className="w-16 h-16 rounded-lg"
            resizeMode="cover"
          />
          <View className="ml-3">
            <Text className="text-lg font-psemibold text-gray-800">
              {itemName}
            </Text>
            <Text className="text-primary font-psemibold">
              ₱{itemPrice}/day
            </Text>
          </View>
        </View>

        {/* Date Selection */}
        <View className="mb-6">
          <Text className="text-base font-psemibold text-gray-700 mb-2">
            Rental Period
          </Text>

          <View className="flex-row justify-between mb-4">
            <TouchableOpacity
              onPress={() => setActiveCalendar("start")}
              className={`flex-1 p-3 rounded-xl mr-2 ${
                activeCalendar === "start" ? "bg-primary/10" : "bg-gray-50"
              }`}
            >
              <Text className="text-xs text-gray-500 mb-1">Start Date</Text>
              <Text className="font-psemibold">
                {startDate.format("MMM DD, YYYY")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveCalendar("end")}
              className={`flex-1 p-3 rounded-xl ${
                activeCalendar === "end" ? "bg-primary/10" : "bg-gray-50"
              }`}
            >
              <Text className="text-xs text-gray-500 mb-1">End Date</Text>
              <Text className="font-psemibold">
                {endDate.format("MMM DD, YYYY")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Calendar */}
          {activeCalendar && (
            <View className="rounded-xl bg-white border-2 border-gray-200 p-2 mb-4">
              <DateTimePicker
                mode="single"
                date={activeCalendar === "start" ? startDate : endDate}
                onChange={(params) => {
                  const newDate = dayjs(params.date);
                  if (activeCalendar === "start") {
                    setStartDate(newDate);
                    if (newDate.isAfter(endDate)) {
                      setEndDate(newDate.add(1, "day"));
                    }
                  } else {
                    setEndDate(newDate);
                  }
                }}
                classNames={{
                  ...defaultClassNames,
                  weekday_label: "text-secondary-300 font-pregular",
                  year_selector_label: "font-pbold text-xl text-primary",
                  month_selector_label: "font-pbold text-xl text-primary",
                  button_next: "bg-gray-500/20 rounded-full",
                  button_prev: "bg-gray-500/20 rounded-full",
                  today: "bg-primary",
                  selected: "bg-primary",
                }}
              />
            </View>
          )}
        </View>

        {/* Message */}
        <View className="mb-6">
          <Text className="text-base font-psemibold text-gray-700 mb-2">
            Message to Owner
          </Text>
          <TextInput
            className="p-3 bg-gray-50 rounded-xl"
            placeholder="Enter your message here..."
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
          />
        </View>

        {/* Total Price */}
        <View className="flex-row justify-between items-center p-4 bg-gray-50 rounded-xl mb-6">
          <Text className="text-base font-psemibold text-gray-700">
            Total Price
          </Text>
          <Text className="text-xl font-pbold text-primary">
            ₱{calculateTotalPrice()}
          </Text>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View className="p-4 border-t border-gray-100 bg-white">
        <TouchableOpacity
          className="bg-primary py-4 rounded-xl items-center"
          onPress={handleSubmit}
        >
          <Text className="text-white font-pbold text-base">
            Submit Request
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default RentRequestForm;
