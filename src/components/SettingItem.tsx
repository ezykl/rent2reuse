import React from "react";
import { View, Text, Image, TouchableOpacity, Animated } from "react-native";
import { icons } from "../constant";

interface SettingItemProps {
  icon: any;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  backgroundColor?: string;
  iconBackgroundColor?: string;
  textColor?: string;
  disabled?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  backgroundColor = "bg-white",
  iconBackgroundColor = "bg-blue-50",
  textColor = "text-gray-800",
  disabled = false,
}) => {
  const scaleValue = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 300,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 8,
    }).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleValue }],
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
      className="mb-3"
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={0.9}
        className={`${backgroundColor} ${
          disabled ? "opacity-50" : ""
        } rounded-2xl px-5 py-4 border border-gray-100`}
      >
        <View className="flex-row items-center justify-between">
          {/* Left side content */}
          <View className="flex-row items-center flex-1">
            {/* Icon container with background */}
            <View
              className={`${iconBackgroundColor} w-12 h-12 rounded-xl items-center justify-center mr-4`}
            >
              <Image
                source={icon}
                className="h-6 w-6"
                resizeMode="contain"
                style={{ tintColor: disabled ? "#9CA3AF" : undefined }}
              />
            </View>

            {/* Text content */}
            <View className="flex-1">
              <Text
                className={`text-lg font-psemibold ${textColor} ${
                  disabled ? "text-gray-400" : ""
                }`}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle && (
                <Text
                  className={`text-sm font-pregular mt-0.5 ${
                    disabled ? "text-gray-300" : "text-gray-500"
                  }`}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          </View>

          {/* Right arrow */}
          {showArrow && (
            <View className="ml-3">
              <Image
                source={icons.arrowRight}
                className="h-5 w-5"
                resizeMode="contain"
                style={{
                  tintColor: disabled ? "#D1D5DB" : "#9CA3AF",
                }}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Enhanced version with more customization options
export const AdvancedSettingItem: React.FC<
  SettingItemProps & {
    badge?: string;
    badgeColor?: string;
    leftAccessory?: React.ReactNode;
    rightAccessory?: React.ReactNode;
  }
> = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  backgroundColor = "bg-white",
  iconBackgroundColor = "bg-gray-100",
  textColor = "text-gray-800",
  disabled = false,
  badge,
  badgeColor = "bg-red-500",
  leftAccessory,
  rightAccessory,
}) => {
  const scaleValue = new Animated.Value(1);
  const opacityValue = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 0.97,
        useNativeDriver: true,
        tension: 400,
        friction: 10,
      }),
      Animated.timing(opacityValue, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 400,
        friction: 10,
      }),
      Animated.timing(opacityValue, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleValue }],
        opacity: opacityValue,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
      }}
      className="mb-4"
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        activeOpacity={1}
        className={`${backgroundColor} ${
          disabled ? "opacity-50" : ""
        } rounded-3xl px-6 py-5 border border-gray-50 relative overflow-hidden`}
      >
        {/* Subtle gradient overlay */}
        <View className="absolute inset-0 bg-gradient-to-r from-transparent to-gray-50/20 rounded-3xl" />

        <View className="flex-row items-center justify-between relative">
          {/* Left side content */}
          <View className="flex-row items-center flex-1">
            {leftAccessory}

            {/* Icon container with enhanced styling */}
            <View
              className={`${iconBackgroundColor} w-14 h-14 rounded-2xl items-center justify-center mr-4 relative`}
            >
              <Image
                source={icon}
                className="h-7 w-7"
                resizeMode="contain"
                style={{ tintColor: disabled ? "#374151" : undefined }}
              />

              {/* Badge indicator */}
              {badge && (
                <View
                  className={`${badgeColor} absolute -top-1 -right-1 w-5 h-5 rounded-full items-center justify-center`}
                >
                  <Text className="text-xs font-pbold text-white">{badge}</Text>
                </View>
              )}
            </View>

            {/* Text content */}
            <View className="flex-1">
              <Text
                className={`text-xl font-psemibold ${textColor} ${
                  disabled ? "text-gray-400" : ""
                } mb-1`}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle && (
                <Text
                  className={`text-base font-pregular ${
                    disabled ? "text-gray-300" : "text-gray-600"
                  }`}
                  numberOfLines={2}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          </View>

          {/* Right side accessories */}
          <View className="flex-row items-center ml-3 gap-3">
            {rightAccessory}

            {showArrow && (
              <View className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
                <Image
                  source={icons.arrowRight}
                  className="h-5 w-5"
                  resizeMode="contain"
                  style={{
                    tintColor: disabled ? "#D1D5DB" : "#6B7280",
                  }}
                />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default SettingItem;
