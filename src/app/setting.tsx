import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Modal,
} from "react-native";
import { useNavigation } from "expo-router";
import { icons } from "../constant";
import SettingItem from "../components/SettingItem"; // Import SettingItem

const Setting = () => {
  const navigation = useNavigation();

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <SafeAreaView className="bg-white h-full px-4 pt-8">
      {/* HEADER */}
      <View className="flex-row items-center justify-between my-4">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Image
            source={icons.leftArrow}
            className="h-[28px] w-[28px]"
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text className="text-center font-psemibold text-2xl flex-1">
          Settings
        </Text>

        <View className="w-[28px]" />
      </View>

      {/* Reusable Setting Items */}
      <SettingItem
        icon={icons.about}
        title="About Us"
        onPress={() => setModalVisible(true)}
      />

      <SettingItem
        icon={icons.terms}
        title="Term & Conditions"
        onPress={() => setModalVisible(true)}
      />

      <SettingItem
        icon={icons.privacy}
        title="Privacy Policy"
        onPress={() => setModalVisible(true)}
      />

      <SettingItem
        icon={icons.faq}
        title="FAQ"
        onPress={() => setModalVisible(true)}
      />

      {/* Modal */}
      <Modal
        visible={modalVisible}
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-white p-5 rounded-lg w-3/4"
          >
            <Text className="text-lg font-bold mb-4">Profile Settings</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="text-blue-500">Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default Setting;
