import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import { useState } from "react";
import DateTimePicker, {
  DateType,
  useDefaultStyles,
} from "react-native-ui-datepicker";
import dayjs from "dayjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { icons } from "@/constant";
import { useRouter } from "expo-router";

export default function Favorites() {
  const defaultStyles = useDefaultStyles();
  const [selected, setSelected] = useState<DateType>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top }}
    >
      {/* Date Picker Test */}
      <View className="flex-1 p-4">
        <View className="bg-white rounded-xl border border-gray-200 p-4">
          <Text className="text-gray-600 mb-4 font-pmedium">
            Date Picker Test
          </Text>
          <DateTimePicker
            mode="single"
            date={selected}
            onChange={({ date }) => setSelected(date)}
            styles={{
              ...defaultStyles,
              weekday_label: {
                color: "text-secondary-300",
                fontFamily: "font-pregular",
              },
              year_selector_label: {
                fontFamily: "font-pbold",

                color: "text-primary",
              },
              month_selector_label: {
                fontFamily: "font-pbold",

                color: "text-primary",
              },
              button_next: {
                backgroundColor: "bg-primary",
                color: "text-white",
                borderRadius: "rounded-lg",
              },
              button_prev: {
                backgroundColor: "bg-primary",
                borderRadius: "rounded-lg",
              },
              day_label: { fontFamily: "font-pregular" },
              month_label: { fontFamily: "font-pregular" },
              year_label: { fontFamily: "font-pregular" },
              selected_month_label: { color: "text-white" },
              selected_year_label: { color: "text-white" },
              outside_label: { color: "text-gray-400" },
              range_fill: { backgroundColor: "bg-primary/20" },
              range_middle_label: { color: "text-gray-600" },
              range_start_label: {
                color: "text-white",
                fontFamily: "font-pmedium",
              },
              range_end_label: {
                color: "text-white",
                fontFamily: "font-pmedium",
              },
              range_start: {
                backgroundColor: "bg-primary",

                borderColor: "border-green-500",
              },
              range_end: {
                backgroundColor: "bg-primary",

                borderColor: "border-green-500",
              },
            }}
          />
        </View>

        {/* Display selected date */}
        <View className="mt-4 p-4 bg-gray-50 rounded-xl">
          <Text className="text-gray-600 font-pmedium">Selected Date:</Text>
          <Text className="text-gray-800 font-pbold mt-1">
            {dayjs(selected).format("MMMM D, YYYY")}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5FCFF",
  },
});
