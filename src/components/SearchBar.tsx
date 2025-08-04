import {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { View, TouchableOpacity, Image, Text } from "react-native";
import { icons } from "@/constant";

export const SearchBar = ({
  isExpanded = false,
  onPress,
  onCameraPress,
  style,
}: {
  isExpanded?: boolean;
  onPress: () => void;
  onCameraPress: () => void;
  style?: any;
}) => {
  const searchBarHeight = useSharedValue(56);
  const opacity = useSharedValue(1);

  const animatedStyles = useAnimatedStyle(() => {
    return {
      height: withTiming(searchBarHeight.value, { duration: 300 }),
      opacity: withTiming(opacity.value, { duration: 300 }),
    };
  });

  return (
    <Animated.View style={[animatedStyles, style]}>
      <View className="bg-white border-secondary-300 h-16 px-4 flex-row w-full border rounded-xl justify-between items-center">
        <TouchableOpacity
          onPress={onPress}
          className="flex-1 flex-row items-center"
        >
          <Image
            source={icons.search}
            className="w-6 h-6"
            resizeMode="contain"
          />
          <Text className="text-center text-secondary-300 text-lg px-3 font-pregular">
            What are you looking for?
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={onPress}>
            <Image
              source={icons.filter}
              className="w-8 h-8"
              resizeMode="contain"
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onCameraPress}>
            <Image
              source={icons.searchAi}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};
