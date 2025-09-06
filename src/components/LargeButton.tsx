import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import React from "react";

interface LargeButtonProps {
  title: string;
  handlePress: () => void;
  containerStyles?: string;
  textStyles?: string;
  isLoading?: boolean;
  disabled?: boolean; // Add 'disabled' here
}

const LargeButton = ({
  title,
  handlePress,
  containerStyles = "", // Default empty string if not provided
  textStyles = "", // Default empty string if not provided
  isLoading = false, // Default false if not provided
  disabled = false, // Default false if not provided
}: LargeButtonProps) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className={`relative  rounded-xl min-h-[56px] justify-center items-center
       ${isLoading ? "bg-primary/70" : "bg-primary"}
       ${containerStyles}`}
      disabled={isLoading || disabled} // Ensure 'disabled' works correctly here
    >
      {!isLoading && (
        <Text className={`text-white font-psemibold text-xl ${textStyles}`}>
          {title}
        </Text>
      )}
      {isLoading && (
        <ActivityIndicator
          animating={isLoading}
          color="#fff"
          size="small"
          className="ml-2 absolute"
        />
      )}
    </TouchableOpacity>
  );
};

export default LargeButton;
