import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import { useState } from "react";
import { icons } from "../constant";

interface InputFieldProps {
  title: string;
  subtitle?: string;
  value: string;
  placeholder: string;
  handleChangeText: (text: string) => void;
  otherStyles?: string;
  borderColor?: string;
  [key: string]: any;
}

const InputField = ({
  title,
  subtitle,
  value,
  placeholder,
  handleChangeText,
  otherStyles,
  ...props
}: InputFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className={`space-y-2 ${otherStyles}`}>
      <View className="flex-row items-center">
        <Text className="text-xl text-secondary-300 font-psemibold m-1">
          {title}
        </Text>
        {subtitle && (
          <Text className="text-sm text-secondary-200 font-psemibold ml-1">
            {subtitle}
          </Text>
        )}
      </View>
      <View
        className="w-full h-16 px-4 bg-black-100 rounded-xl border-2 border-secondary-300  flex flex-row items-center"
        style={[
          isFocused && { borderColor: "#4BD07F" },
          props.borderColor && { borderColor: props.borderColor },
        ]}
      >
        <TextInput
          className="flex-1 text-secondary-300 font-psemibold text-base "
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#A7BEB4"
          onChangeText={handleChangeText}
          secureTextEntry={
            (title === "Password" || title === "Confirm Password") &&
            !showPassword
          }
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{ color: "#6C9082" }}
          {...props}
        />
        {title === "Password" && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Image
              source={!showPassword ? icons.eyeHide : icons.eye}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        {title === "Confirm Password" && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Image
              source={!showPassword ? icons.eyeHide : icons.eye}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default InputField;
