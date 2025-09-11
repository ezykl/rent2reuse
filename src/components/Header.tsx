import { View, Image, Pressable, Platform, Text } from "react-native";
import { router } from "expo-router";
import { images, icons } from "@/constant";
import { useNotifications } from "@/context/NotificationProvider";
import Animated, { useSharedValue, withSpring } from "react-native-reanimated";

// Add TypeScript props interface
interface RippleSpringButtonProps {
  onPress: () => void;
  children: React.ReactNode;
}

const RippleSpringButton = ({ onPress, children }: RippleSpringButtonProps) => {
  const scale = useSharedValue(1);

  return (
    <Pressable
      onPressIn={() => (scale.value = withSpring(0.9))}
      onPressOut={() => (scale.value = withSpring(1))}
      onPress={onPress}
      android_ripple={
        Platform.OS === "android" ? { color: "#CFE0D9", radius: 15 } : undefined
      }
      className="rounded-full p-2"
    >
      <Animated.View style={{ transform: [{ scale: scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

interface HeaderProps {
  variant?: "default" | "setting";
}

const Header = ({ variant = "default" }: HeaderProps) => {
  const { notifications } = useNotifications();
  const unreadCount = notifications.filter((msg) => !msg.isRead).length;

  return (
    <View className="flex-row justify-between bg-white items-center py-2">
      {/* Logo - Only show on default variant */}
      <Image
        source={images.logo}
        className="h-[28px] w-[160px]"
        resizeMode="contain"
      />

      {/* Right side icons */}
      <View className="flex-row justify-center ml-auto">
        {/* Settings Icon - Only show on profile variant */}
        {variant === "setting" && (
          <RippleSpringButton onPress={() => router.push("/setting")}>
            <Image
              source={icons.setting}
              className="h-[22px] w-[22px]"
              resizeMode="contain"
            />
          </RippleSpringButton>
        )}

        {/* Notification Icon with Badge */}
        <RippleSpringButton onPress={() => router.push("/notification")}>
          <View className="relative">
            <Image
              source={icons.notificationOff} // or switch based on unreadCount > 0
              className="h-[24px] w-[24px]"
              resizeMode="contain"
            />

            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] flex items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </RippleSpringButton>
      </View>
    </View>
  );
};

export default Header;
