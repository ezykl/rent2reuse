import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Alert,
} from "react-native";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface ContactContentProps {
  onSave: (phoneNumber: string) => void;
  loading?: boolean;
}

export const ContactContent = ({ onSave, loading }: ContactContentProps) => {
  const user = auth.currentUser;
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasExistingNumber, setHasExistingNumber] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchExistingContact();
  }, []);

  const fetchExistingContact = async () => {
    if (!user?.uid) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().contactNumber) {
        const existingNumber = userDoc.data().contactNumber;
        setPhoneNumber(existingNumber.replace("+63", ""));
        setHasExistingNumber(true);
        setIsValid(true);
      } else {
        // No existing number, enable editing mode
        setIsEditing(true);
      }
    } catch (error) {
      console.log("Error fetching contact:", error);
    }
  };

  const validatePhoneNumber = (number: string) => {
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
    const formatted = text.replace(/[^\d]/g, "").slice(0, 10);
    setPhoneNumber(formatted);
    validatePhoneNumber(formatted);
  };

  const handleSave = async () => {
    if (!isValid || !user) return;

    setIsLoading(true);
    setError("");

    try {
      const fullPhoneNumber = `+63${phoneNumber}`;

      // Save to Firestore
      await updateDoc(doc(db, "users", user.uid), {
        contactNumber: fullPhoneNumber,
        contactUpdatedAt: new Date().toISOString(),
      });

      setHasExistingNumber(true);
      setIsEditing(false);
      onSave(fullPhoneNumber);

      Keyboard.dismiss();
    } catch (error: any) {
      console.log("Error saving contact:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError("");
  };

  const handleCancel = () => {
    // Restore original number if it exists
    if (hasExistingNumber) {
      fetchExistingContact();
      setIsEditing(false);
      setError("");
    }
  };

  // Show saved number (not editing)
  if (hasExistingNumber && !isEditing) {
    return (
      <View className="p-4">
        <Text className="text-xl font-psemibold text-gray-800 mb-2">
          Contact Information
        </Text>
        <Text className="text-gray-600 mb-6 font-pregular">
          Your registered contact number for rental communications.
        </Text>

        <View className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <Text className="text-gray-500 text-sm font-pmedium mb-1">
            Phone Number
          </Text>
          <Text className="text-gray-800 font-pmedium text-lg">
            +63{phoneNumber}
          </Text>
        </View>

        <TouchableOpacity
          className="w-full py-3 rounded-xl border-2 border-primary"
          onPress={handleEdit}
        >
          <Text className="text-primary text-center text-lg font-pmedium">
            Change Number
          </Text>
        </TouchableOpacity>

        <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
          <Text className="text-blue-800 text-xs font-pregular">
            💡 This number will be used for important rental notifications and
            communications.
          </Text>
        </View>
      </View>
    );
  }

  // Show input form (editing or no existing number)
  return (
    <View className="p-4">
      <Text className="text-xl font-psemibold text-gray-800 mb-2">
        {hasExistingNumber ? "Update Contact" : "Contact Information"}
      </Text>
      <Text className="text-gray-600 mb-6 font-pregular">
        {hasExistingNumber
          ? "Enter your new contact number below."
          : "Please enter your active contact number for rental communications."}
      </Text>

      <View className="space-y-4">
        <View className="rounded-xl">
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
                error ? "border-red-500" : "border-gray-200"
              }`}
              maxLength={10}
              editable={!isLoading}
              autoFocus={isEditing}
            />
          </View>
          {error && (
            <Text className="text-red-500 text-sm mt-2 font-pregular">
              {error}
            </Text>
          )}
        </View>

        <View className="mt-4 space-y-3">
          <TouchableOpacity
            className={`w-full py-3 rounded-xl flex-row justify-center items-center
              ${isValid ? "bg-primary" : "bg-primary/40"}
              ${isLoading ? "opacity-70" : ""}`}
            onPress={handleSave}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center text-lg font-pmedium">
                {hasExistingNumber ? "Update Contact" : "Save Contact"}
              </Text>
            )}
          </TouchableOpacity>

          {hasExistingNumber && (
            <TouchableOpacity
              className="w-full bg-red-400 py-3 mt-2 rounded-xl"
              onPress={handleCancel}
              disabled={isLoading}
            >
              <Text className="text-white text-center text-lg font-pmedium">
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2">
          <Text className="text-blue-800 text-xs font-pregular">
            💡 Make sure this is an active number where you can receive
            important notifications about your rentals.
          </Text>
        </View>
      </View>
    </View>
  );
};
