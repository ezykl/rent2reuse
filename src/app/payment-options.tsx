import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebaseConfig";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { icons, images } from "@/constant";
import CustomAlert from "@/components/CustomAlert";

interface PaymentMethod {
  id: string;
  name: string;
  image: any;
  isAvailable: boolean;
}

interface AlertButton {
  text: string;
  type?: "cancel" | "default";
  onPress: () => void;
}

interface AlertConfig {
  title: string;
  message: string;
  buttons: AlertButton[];
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "paypal", name: "PayPal", image: images.paypal, isAvailable: true },
  { id: "card", name: "Credit Card", image: images.visaMc, isAvailable: false },
  { id: "gcash", name: "GCash", image: images.gcash, isAvailable: false },
];

const PaymentOptions = () => {
  const insets = useSafeAreaInsets();
  const [showPayPalModal, setShowPayPalModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [currentPaypalEmail, setCurrentPaypalEmail] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    title: "",
    message: "",
    buttons: [],
  });

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser?.uid) return;

      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentPaypalEmail(userData.paypalEmail || null);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, []);

  const handleMethodSelect = (method: PaymentMethod) => {
    if (!method.isAvailable) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Not Available",
        textBody: `${method.name} is not available yet.`,
      });
      return;
    }

    if (method.id === "paypal") {
      if (currentPaypalEmail) {
        setAlertConfig({
          title: "Update PayPal Account",
          message: `Current PayPal email: ${currentPaypalEmail}\n\nWould you like to change it?`,
          buttons: [
            {
              text: "Change Email",
              onPress: () => {
                setShowAlert(false);
                setPaypalEmail(currentPaypalEmail);
                setShowPayPalModal(true);
              },
            },
            {
              text: "Cancel",
              type: "cancel",
              onPress: () => setShowAlert(false),
            },
          ],
        });
        setShowAlert(true);
      } else {
        setShowPayPalModal(true);
      }
    }
  };

  const handleSavePaypalEmail = async () => {
    if (!auth.currentUser?.uid) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "You must be logged in to save payment options",
      });
      return;
    }

    if (!paypalEmail.trim()) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Invalid Input",
        textBody: "Please enter your PayPal email address",
      });
      return;
    }

    if (!paypalEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Invalid Email",
        textBody: "Please enter a valid PayPal email address",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("Saving PayPal email:", paypalEmail);

      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        paypalEmail: paypalEmail.trim(),
        updatedAt: new Date().toISOString(),
      });

      setCurrentPaypalEmail(paypalEmail.trim());
      setShowPayPalModal(false);
      setPaypalEmail("");

      Toast.show({
        type: ALERT_TYPE.SUCCESS,
        title: "Success",
        textBody: "PayPal account connected successfully",
      });
    } catch (error) {
      console.error("Error saving PayPal email:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to save PayPal account information",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()}>
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">
          Payment Options
        </Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1 p-4">
        <Text className="text-base text-gray-600 mb-4">
          Choose your preferred payment method for receiving payments.
        </Text>

        {PAYMENT_METHODS.map((method) => (
          <TouchableOpacity
            key={method.id}
            className={`bg-white rounded-2xl p-4 border-2 mb-3 ${
              !method.isAvailable
                ? "opacity-50 border-gray-200"
                : method.id === "paypal" && currentPaypalEmail
                ? "border-green-500"
                : "border-gray-200"
            }`}
            onPress={() => handleMethodSelect(method)}
            disabled={!method.isAvailable || isLoading}
          >
            <View className="flex-row items-center">
              <View
                className={`w-5 h-5 rounded-full border-2 mr-4 items-center justify-center ${
                  !method.isAvailable ? "border-gray-300" : "border-green-500"
                }`}
              >
                {method.id === "paypal" && currentPaypalEmail && (
                  <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                )}
              </View>
              <View className="flex-1 flex-row items-center justify-between">
                <View>
                  <Text
                    className={`font-medium ${
                      !method.isAvailable ? "text-gray-500" : "text-gray-900"
                    }`}
                  >
                    {method.name}
                  </Text>
                  {method.id === "paypal" && currentPaypalEmail && (
                    <Text className="text-sm text-gray-500">
                      {currentPaypalEmail}
                    </Text>
                  )}
                </View>
                <Image
                  source={method.image}
                  className="h-[30px]"
                  style={{
                    width:
                      method.id === "paypal"
                        ? 25
                        : method.id === "card"
                        ? 90
                        : 30,
                  }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <View className="bg-blue-50 rounded-xl p-4 mt-2">
          <View className="flex-row items-start">
            <Image
              source={icons.about}
              className="w-5 h-5 mr-2 mt-0.5"
              tintColor="#1D4ED8"
            />
            <Text className="text-blue-900 flex-1">
              Currently, only PayPal is supported for receiving payments. More
              payment options will be available soon.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* PayPal Email Modal */}
      <Modal visible={showPayPalModal} animationType="slide" transparent={true}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-4">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-pbold text-gray-900">
                {currentPaypalEmail
                  ? "Update PayPal Email"
                  : "Connect PayPal Account"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPayPalModal(false);
                  setPaypalEmail("");
                }}
                className="p-2"
              >
                <Image source={icons.close} className="w-5 h-5" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-600 mb-4">
              {currentPaypalEmail
                ? "Enter your new PayPal email address to update your account."
                : "Enter your PayPal email address to connect your account."}
            </Text>

            <TextInput
              value={paypalEmail}
              onChangeText={setPaypalEmail}
              placeholder="Enter your PayPal email"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-gray-300 rounded-xl px-4 py-3 mb-4"
              autoFocus={true}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleSavePaypalEmail}
                disabled={isLoading || !paypalEmail.trim()}
                className={`flex-1 py-4 rounded-xl ${
                  isLoading || !paypalEmail.trim()
                    ? "bg-gray-300"
                    : "bg-primary"
                }`}
              >
                <Text className="text-white text-center font-pbold">
                  {isLoading
                    ? "Saving..."
                    : currentPaypalEmail
                    ? "Update"
                    : "Connect"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowPayPalModal(false);
                  setPaypalEmail("");
                }}
                className="flex-1 bg-gray-200 py-4 rounded-xl"
                disabled={isLoading}
              >
                <Text className="text-gray-700 text-center font-pbold">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert
        visible={showAlert}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setShowAlert(false)}
      />
    </SafeAreaView>
  );
};

export default PaymentOptions;
