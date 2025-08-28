import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import LargeButton from "@/components/LargeButton";
import { auth } from "@/lib/firebaseConfig";
import { router } from "expo-router";
import * as Linking from "expo-linking";

const AccountSuspendedScreen = () => {
  // Prevent navigation back
  useEffect(() => {
    // This ensures we can't go back from this screen
    router.canGoBack = () => false;
  }, []);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      router.replace("/(auth)/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
      router.replace("/(auth)/sign-in");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.content}>
        <Image
          source={require("@/assets/images/warning.png")}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Account Suspended</Text>

        <Text style={styles.message}>
          Your account has been suspended due to a violation of our terms of
          service. This may include:
        </Text>

        <View style={styles.reasonsContainer}>
          <Text style={styles.reasonItem}>• Posting prohibited items</Text>
          <Text style={styles.reasonItem}>• Inappropriate behavior</Text>
          <Text style={styles.reasonItem}>• Multiple policy violations</Text>
          <Text style={styles.reasonItem}>• Fraudulent activity</Text>
        </View>

        <Text style={styles.contactMessage}>
          If you believe this is an error, please contact our support team for
          assistance.
        </Text>

        <TouchableOpacity
          className="mt-2"
          onPress={() => {
            const user = auth.currentUser;
            const emailBody = `
      User Details:
      - Email: ${user?.email || "N/A"}
      - User ID: ${user?.uid || "N/A"}

      Please explain why you believe your account suspension should be reviewed:
      `;
            Linking.openURL(
              `mailto:rent2reuse@gmail.com?subject=Account Suspension Appeal&body=${encodeURIComponent(
                emailBody
              )}`
            );
          }}
        >
          <Text className="text-blue-500 text-base font-medium italic underline">
            rent2reuse@gmail.com
          </Text>
        </TouchableOpacity>

        <LargeButton
          title="Sign Out"
          handlePress={handleSignOut}
          containerStyles="mt-8 w-full bg-red-500"
          textStyles="text-white"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 180,
    height: 180,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FF3B30",
    marginBottom: 16,
    fontFamily: "Poppins-Bold",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
    fontFamily: "Poppins-Regular",
    color: "#333",
  },
  reasonsContainer: {
    alignSelf: "stretch",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  reasonItem: {
    fontSize: 15,
    lineHeight: 28,
    fontFamily: "Poppins-Regular",
    color: "#333",
  },
  contactMessage: {
    fontSize: 15,
    textAlign: "center",
    color: "#666",
    fontFamily: "Poppins-Medium",
    marginTop: 8,
  },
});

export default AccountSuspendedScreen;
