import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { icons } from "../constant";

interface SettingItemProps {
  icon: any;
  title: string;
  onPress: () => void;
}

const SettingItem: React.FC<SettingItemProps> = ({ icon, title, onPress }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="h-24 w-full border-2 border-secondary-200 flex-row items-center justify-between px-4 rounded-lg mb-2"
    >
      <View className="flex-row items-center gap-4">
        <Image
          source={icon}
          className="h-[28px] w-[28px]"
          resizeMode="contain"
        />
        <Text className="text-xl  font-pregular text-secondary-400">
          {title}
        </Text>
      </View>

      <Image
        source={icons.arrowRight}
        className="h-[28px] w-[28px]"
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
};

export default SettingItem;
