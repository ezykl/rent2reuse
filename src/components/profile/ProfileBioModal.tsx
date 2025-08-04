import React from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { icons } from "@/constant";

interface ProfileBioModalProps {
  visible: boolean;
  form: any;
  loading: boolean;
  idImage: string | null;
  onChangeText: (key: string, value: string) => void;
  onPickImage: () => Promise<void>;
  onSave: () => Promise<void>;
  onClose: () => void;
  refs: {
    firstNameRef: any;
    middleNameRef: any;
    lastNameRef: any;
    addressRef: any;
    contactNumberRef: any;
  };
}

const ProfileBioModal = ({
  visible,
  form,
  loading,
  idImage,
  onChangeText,
  onPickImage,
  onSave,
  onClose,
  refs,
}: ProfileBioModalProps) => {
  if (!visible) return null;

  const fields = [
    {
      name: "First Name",
      key: "firstName",
      ref: refs.firstNameRef,
      nextRef: refs.middleNameRef,
    },
    // ...other fields
  ];

  return (
    <View className="bg-white mb-6">
      <Text className="font-pbold text-xl mb-4">Complete Your Bio</Text>
      {/* Rest of your existing BioForm JSX */}
    </View>
  );
};

export default ProfileBioModal;
