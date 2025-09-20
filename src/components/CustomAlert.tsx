import React from "react";
import { View, Text, TouchableOpacity, Modal, Image } from "react-native";
import { icons } from "@/constant";

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: {
    text: string;
    type?: "default" | "cancel" | "destructive";
    onPress: () => void;
  }[];
  onClose: () => void;
}

const CustomAlert = ({
  visible,
  title,
  message,
  buttons,
  onClose,
}: CustomAlertProps) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-center p-4">
        <View className="bg-white w-[90%] max-w-[320px] rounded-2xl p-6">
          <Text className="text-xl font-pbold text-center text-gray-900 mb-2">
            {title}
          </Text>
          <Text className="text-base text-gray-600 text-center mb-6">
            {message}
          </Text>

          <View className="gap-2">
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  button.onPress();
                  onClose();
                }}
                className={`py-3 rounded-xl ${
                  button.type === "destructive"
                    ? "bg-red-500"
                    : button.type === "cancel"
                    ? "bg-gray-100"
                    : "bg-primary"
                }`}
              >
                <Text
                  className={`text-center font-pbold ${
                    button.type === "cancel" ? "text-gray-700" : "text-white"
                  }`}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CustomAlert;
