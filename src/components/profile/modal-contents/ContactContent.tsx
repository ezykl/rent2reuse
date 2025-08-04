import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

interface ContactContentProps {
  onSave: (phoneNumber: string) => void;
  loading?: boolean;
}

export const ContactContent = ({ onSave, loading }: ContactContentProps) => {
  const user = auth.currentUser;
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    fetchExistingContact();
  }, []);

  const fetchExistingContact = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().contactNumber) {
        // Remove +63 prefix for display
        const existingNumber = userDoc.data().contactNumber;
        setPhoneNumber(existingNumber.replace("+63", ""));
      }
    } catch (error) {
      console.error("Error fetching contact:", error);
    }
  };

  const validatePhoneNumber = (number: string) => {
    // Validate 10 digits starting with 9
    const phoneRegex = /^9\d{9}$/;
    const isValidNumber = phoneRegex.test(number);
    setIsValid(isValidNumber);
    setError(
      number
        ? isValidNumber
          ? ""
          : "Please enter a valid number starting with 9 (10 digits)"
        : ""
    );
    return isValidNumber;
  };

  const handlePhoneNumberChange = (text: string) => {
    // Only allow digits and limit to 10 characters
    const formatted = text.replace(/[^\d]/g, "").slice(0, 10);
    setPhoneNumber(formatted);
    validatePhoneNumber(formatted);
  };

  const handleSave = () => {
    if (!isValid) return;
    // Add +63 prefix before saving
    const fullPhoneNumber = `+63${phoneNumber}`;
    onSave(fullPhoneNumber);
    Keyboard.dismiss();
  };

  return (
    <View className="p-4">
      <Text className="text-xl font-psemibold text-gray-800 mb-2">
        Contact Information
      </Text>
      <Text className="text-gray-600 mb-6 font-pregular">
        Please enter your active contact number. This will be used for rental
        communications.
      </Text>

      <View className="space-y-4">
        <View className=" rounded-xl  ">
          <Text className="text-lg text-gray-500 font-pmedium mb-2">
            Phone Number
          </Text>
          <View className="flex-row items-center bg-gray-50 rounded-xl">
            <View className="px-4 py-4 border border-gray-200 rounded-l-xl">
              <Text className="text-gray-600 text-lg font-pmedium">+63</Text>
            </View>
            <TextInput
              placeholder="9123456789"
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              keyboardType="number-pad"
              className={`flex-1 font-pmedium text-lg px-4 py-4 border rounded-r-xl text-gray-600 ${
                error ? " border-red-500 " : "border-gray-200"
              }`}
              maxLength={10}
              editable={!loading}
            />
          </View>
          {error && (
            <Text className="text-red-500 text-sm mt-2 font-pregular">
              {error}
            </Text>
          )}
        </View>

        <View className="mt-4">
          <TouchableOpacity
            className={`w-full py-3 rounded-xl flex-row justify-center items-center space-x-2
              ${isValid ? "bg-primary" : "bg-primary/40"}
              ${loading ? "opacity-70" : ""}`}
            onPress={handleSave}
            disabled={!isValid || loading}
          >
            <Text className="text-white text-center text-lg font-pmedium">
              {loading ? "Saving..." : "Save Contact"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
