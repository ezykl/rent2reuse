import { View, Text } from "react-native";
import React from "react";
import { Redirect, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
// import { useGlobalContext } from "@/context/GlobalProvider";
import { AlertNotificationRoot } from "react-native-alert-notification";

const AuthLayout = () => {
  //   const { loading, isLogged } = useGlobalContext();

  //   if (!loading && isLogged) return <Redirect href="/home" />;
  return (
    <>
      <Stack>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen
          name="account-suspended"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="terms"
          options={{
            presentation: "card",
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
};

export default AuthLayout;
