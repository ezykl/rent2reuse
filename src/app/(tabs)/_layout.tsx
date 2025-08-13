import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  TouchableOpacity,
} from "react-native";
import React, { useState } from "react";
import { Tabs, Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useAuth } from "@/context/AuthContext";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { useCameraPermissions } from "expo-image-picker";

import { icons, images } from "../../constant";
import { checkAndUpdateLimits } from "@/utils/planLimits";
import useProfileCompletion from "@/hooks/useProfileCompletion";

interface TabIconProps {
  icon: any;
  color: string;
  name: string;
  focused: boolean;
}

const TabIcon = ({ icon, color, name, focused }: TabIconProps) => {
  return (
    <View className="flex-1 h-full items-center  gap-2">
      <Image
        source={icon}
        resizeMode="contain"
        style={{ tintColor: color }}
        className="w-6 h-6"
      />
      <Text
        className={`${
          focused ? "font-psemibold" : "font-pregular"
        } text-xs text-center`}
        style={{ color, width: 60 }}
      >
        {name}
      </Text>
    </View>
  );
};

const TabsLayout = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // Message Detection
  const [hasNewMessages, setHasNewMessages] = useState(true); // true = show badge
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const { user } = useAuth();
  const { completionPercentage } = useProfileCompletion();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Create a new function to check camera permissions
  const checkCameraPermission = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Camera Permission Required",
          textBody: "Please enable camera access to use this feature",
        });
        return false;
      }
    }
    return true;
  };

  // Update the handleListItem function
  const handleListItem = async () => {
    setIsOptionsVisible(false);

    try {
      // Check camera permission first
      const hasCameraPermission = await checkCameraPermission();
      if (!hasCameraPermission) return;

      // 1. First check if user is logged in
      if (!user) {
        router.push("/sign-in");
        return;
      }

      // 2. Check profile completion
      if (completionPercentage < 100) {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Complete Your Profile",
          textBody: `Your profile is ${completionPercentage}% complete. Please complete your profile before listing items.`,
        });
        router.push("/profile");
        return;
      }

      // 3. Check user's current plan and limits
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data();
      {
        if (!userData) {
          Toast.show({
            type: ALERT_TYPE.DANGER,
            title: "Error",
            textBody: "Unable to fetch user data",
          });
          return;
        }

        // Check if user has any plan
        if (!userData.currentPlan) {
          router.push("/plans");
          Toast.show({
            type: ALERT_TYPE.INFO,
            title: "Plan Required",
            textBody: "Please select a plan to start listing items",
          });
          return;
        }
      }
      // Now check the listing limits
      const { listLimit, listUsed } = userData.currentPlan || {};
      if (typeof listLimit === "number" && typeof listUsed === "number") {
        if (listUsed >= listLimit) {
          Toast.show({
            type: ALERT_TYPE.WARNING,
            title: "Plan Limit Reached",
            textBody: "Upgrade your plan to list more items",
          });
          router.push("/plans");
          return;
        }
      }

      // 4. If all checks pass, navigate to add listing
      router.push({
        pathname: "/add-listing",
        params: { openCamera: "true" },
      });
    } catch (error) {
      console.error("Error:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "#4BD07F",
          tabBarInactiveTintColor: "#A7BEB4",
          tabBarInactiveBackgroundColor: "#ffff",
          tabBarStyle: {
            backgroundColor: "#ffff",
            height: 62,
            paddingTop: 4,
            justifyContent: "center",
            alignItems: "center",

            // borderTopColor: "#232537",
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            headerShown: false,
            tabBarButton: (props: any) => (
              <TouchableOpacity
                {...props}
                style={props.style}
                android_ripple={{
                  color: "#CFE0D9",
                  radius: 25,
                }}
              >
                {props.children}
              </TouchableOpacity>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.home}
                color={color}
                name="Home"
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="tools"
          options={{
            title: "Tools",
            headerShown: false,
            tabBarButton: (props: any) => (
              <TouchableOpacity
                {...props}
                style={props.style}
                android_ripple={{
                  color: "#CFE0D9",
                  radius: 25,
                }}
              >
                {props.children}
              </TouchableOpacity>
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.box}
                color={color}
                name="KitHub"
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            headerShown: false,
            tabBarItemStyle: {
              marginTop: -2, // Moves the tab icon a little upwards
            },
            tabBarButton: (props) => (
              <>
                <TouchableOpacity
                  {...props}
                  onPress={() => setIsOptionsVisible(true)}
                  android_ripple={{
                    color: "#CFE0D9",
                    radius: 25,
                  }}
                  className="items-center justify-center "
                >
                  <Image source={images.logoSmall} className="w-12 h-12" />
                </TouchableOpacity>

                {/* Options Modal */}
                <Modal
                  visible={isOptionsVisible}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setIsOptionsVisible(false)}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setIsOptionsVisible(false)}
                    className="flex-1 justify-end bg-black/50"
                  >
                    <View className="bg-white rounded-t-3xl border border-gray-200 shadow-lg  overflow-hidden">
                      {/* Header */}
                      <View className="px-4 py-3 border-b border-gray-100">
                        <Text className="text-lg font-pbold text-gray-800 text-center">
                          Quick Actions
                        </Text>
                      </View>

                      {/* Options Container */}
                      <View className="flex-row">
                        {/* List Item Option */}
                        <TouchableOpacity
                          onPress={handleListItem}
                          className="flex-1 flex-col items-center py-6 px-4 border-r border-gray-100"
                        >
                          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center mb-3">
                            <Image
                              source={icons.plus}
                              className="w-6 h-6"
                              tintColor="#4BD07F"
                            />
                          </View>
                          <Text className="text-sm font-pmedium text-gray-800 text-center">
                            List Item
                          </Text>
                          <Text className="text-xs text-gray-500 text-center mt-1">
                            Add new listing
                          </Text>
                        </TouchableOpacity>

                        {/* Search Option */}
                        <TouchableOpacity
                          onPress={async () => {
                            const hasCameraPermission =
                              await checkCameraPermission();
                            if (!hasCameraPermission) return;

                            setIsOptionsVisible(false);
                            router.push({
                              pathname: "/search",
                              params: { openCamera: "true" },
                            });
                          }}
                          className="flex-1 flex-col items-center py-6 px-4"
                        >
                          <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mb-3">
                            <Image
                              source={icons.searchHeart}
                              className="w-6 h-6"
                              tintColor="#2563EB"
                            />
                          </View>
                          <Text className="text-sm font-pmedium text-gray-800 text-center">
                            Search Items
                          </Text>
                          <Text className="text-xs text-gray-500 text-center mt-1">
                            Find listings
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Cancel Button */}
                      <TouchableOpacity
                        onPress={() => setIsOptionsVisible(false)}
                        className="py-4 border-t border-gray-100"
                      >
                        <Text className="text-center text-red-500 font-pbold">
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>
              </>
            ),
          }}
        />

        <Tabs.Screen
          name="chat"
          options={{
            title: "Chats",
            headerShown: false,
            tabBarBadge: hasNewMessages ? " " : undefined,
            tabBarBadgeStyle: {
              backgroundColor: "#FF0000", // Adjust color if needed
              minWidth: 10, // Reduce size
              minHeight: 10,
              width: 10,
              height: 10,
              borderRadius: 10, // Makes it a small circle
              right: 10,
            },
            tabBarButton: (props) => (
              <Pressable
                {...props}
                android_ripple={{
                  color: "#CFE0D9",
                  radius: 25,
                }}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.chat}
                color={color}
                name="Chat"
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            headerShown: false,
            tabBarButton: (props) => (
              <Pressable
                {...props}
                android_ripple={{
                  color: "#CFE0D9",
                  radius: 25,
                }}
              />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon
                icon={icons.profile}
                color={color}
                name="Profile"
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
};

export default TabsLayout;
