// ActionMenu.tsx - REPLACE entire component
import React from "react";
import { Modal, TouchableOpacity, View, Image, Text } from "react-native";

interface ActionMenuItem {
  id: string;
  icon: any;
  label: string;
  description?: string; // Add description for larger buttons
  action: () => void;
  bgColor: string;
  iconColor: string;
}

const ActionMenu = ({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: ActionMenuItem[];
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/50 justify-end"
      >
        <View className="bg-white rounded-t-3xl px-4 py-6">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-psemibold text-gray-800">
              Actions
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Text className="text-gray-500 text-lg">✕</Text>
            </TouchableOpacity>
          </View>

          {/* Vertical Action Buttons */}
          <View className="gap-3">
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  onClose();
                  item.action();
                }}
                className="flex-row items-center p-4 rounded-xl border border-gray-200"
                style={{ backgroundColor: item.bgColor }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: "white" }}
                >
                  <Image
                    source={item.icon}
                    className="w-6 h-6"
                    tintColor={item.iconColor}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-psemibold text-gray-800">
                    {item.label}
                  </Text>
                  {item.description && (
                    <Text className="text-sm text-gray-600 mt-1">
                      {item.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default ActionMenu;
