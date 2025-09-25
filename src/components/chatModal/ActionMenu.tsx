import React from "react";
import { Modal, TouchableOpacity, View, Image, Text } from "react-native";

interface ActionMenuItem {
  id: string;
  icon: any;
  label: string;
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
        className="flex-1 bg-black/10 px-2 justify-end item"
      >
        <View className="mb-2 py-4 flex bg-white rounded-3xl shadow-lg">
          <View className="flex-row justify-center ">
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  onClose();
                  item.action();
                }}
                className="items-center w-[72px]"
              >
                <View
                  className={`w-12 h-12 rounded-full items-center justify-center mb-1`}
                  style={{ backgroundColor: item.bgColor }}
                >
                  <Image
                    source={item.icon}
                    className="w-6 h-6"
                    tintColor={item.iconColor}
                  />
                </View>
                <Text className="text-xs text-center text-gray-600 font-pmedium">
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
export default ActionMenu;
