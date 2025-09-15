import "../global.css";

import React, { useEffect } from "react";
import { Stack, SplashScreen } from "expo-router";
import { useFonts } from "expo-font";
import LoaderProviderWithOverlay from "../context/LoaderContext";
import { AlertNotificationRoot } from "react-native-alert-notification";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { SearchTransitionProvider } from "@/context/SearchTransitionContext";
import { NotificationProvider } from "@/context/NotificationProvider";
import { usePushNotifications } from "@/utils/userPushNotifications";
import { manageUserToken } from "@/utils/tokenManagement";
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const { expoPushToken, notification } = usePushNotifications();
  const data = JSON.stringify(notification, undefined, 2);

  // Monitor account status
  useAccountStatus();

  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid && expoPushToken?.data) {
      manageUserToken(user.uid, expoPushToken.data);
    }
  }, [user?.uid, expoPushToken?.data]);

  return (
    <>
      <StatusBar backgroundColor="#FFFFFF" style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none", // Disable default animation
          presentation: "transparentModal",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setting" options={{ headerShown: false }} />
        <Stack.Screen name="notification" options={{ headerShown: false }} />
        <Stack.Screen name="add-listing" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen name="(profile)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="items/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="listing/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="edit-listing/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="announcement/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="create-ticket" options={{ headerShown: false }} />
        <Stack.Screen name="rating-screen" options={{ headerShown: false }} />
        <Stack.Screen name="plans" options={{ headerShown: false }} />
        <Stack.Screen
          name="search"
          options={{
            animation: "fade",
            presentation: "containedModal",
            headerShown: false,
            contentStyle: {
              backgroundColor: "transparent",
            },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    "Poppins-Black": require("../assets/fonts/Poppins-Black.ttf"),
    "Poppins-Bold": require("../assets/fonts/Poppins-Bold.ttf"),
    "Poppins-ExtraBold": require("../assets/fonts/Poppins-ExtraBold.ttf"),
    "Poppins-ExtraLight": require("../assets/fonts/Poppins-ExtraLight.ttf"),
    "Poppins-Light": require("../assets/fonts/Poppins-Light.ttf"),
    "Poppins-Medium": require("../assets/fonts/Poppins-Medium.ttf"),
    "Poppins-Regular": require("../assets/fonts/Poppins-Regular.ttf"),
    "Poppins-SemiBold": require("../assets/fonts/Poppins-SemiBold.ttf"),
    "Poppins-Thin": require("../assets/fonts/Poppins-Thin.ttf"),
  });

  useEffect(() => {
    if (error) throw error;

    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded) {
    return null;
  }

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <AuthProvider>
      <LoaderProviderWithOverlay>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NotificationProvider>
            <AlertNotificationRoot>
              <SearchTransitionProvider>
                <RootLayoutContent />
              </SearchTransitionProvider>
            </AlertNotificationRoot>
          </NotificationProvider>
        </GestureHandlerRootView>
      </LoaderProviderWithOverlay>
    </AuthProvider>
  );
}
