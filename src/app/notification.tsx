import { useState } from "react";
import {
  View,
  Text,
  SafeAreaView,
  Image,
  FlatList,
  Modal,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { icons } from "@/constant";
import NotificationCard from "@/components/NotificationCard";
import { useNotifications } from "@/context/NotificationProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppNotification } from "@/context/NotificationProvider";

const NotificationScreen = () => {
  const insets = useSafeAreaInsets();
  const { notifications, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const [selectedNotification, setSelectedNotification] =
    useState<AppNotification | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleNotificationPress = (notification: AppNotification) => {
    markAsRead(notification.id);
    setSelectedNotification(notification);
    setModalVisible(true);
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <NotificationCard
      notification={item}
      onPress={() => handleNotificationPress(item)}
      showActions={true}
      onDelete={() => deleteNotification(item.id)}
    />
  );

  return (
    <SafeAreaView
      className="bg-white h-full px-4"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between my-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Image
            source={icons.leftArrow}
            className="h-[28px] w-[28px]"
            resizeMode="contain"
          />
        </TouchableOpacity>

        <Text className="text-center font-psemibold text-2xl flex-1">
          Notifications
        </Text>

        {notifications.some((n) => !n.isRead) && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text className="text-primary font-pmedium">Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-8">
            <Text className="text-gray-500 font-pmedium">
              No notifications yet
            </Text>
          </View>
        )}
      />

      {/* Notification Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-2xl p-6">
            {selectedNotification && (
              <>
                <View className="flex-row justify-between items-start mb-4">
                  <Text className="text-xl font-pbold text-gray-900">
                    {selectedNotification.title}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    className="p-2 -mr-2"
                  >
                    <Image
                      source={icons.close}
                      className="w-5 h-5"
                      tintColor="#6B7280"
                    />
                  </TouchableOpacity>
                </View>

                <Text className="text-base text-gray-600 mb-4">
                  {selectedNotification.message}
                </Text>

                <Text className="text-sm text-gray-500">
                  {new Date(
                    selectedNotification.dateReceived
                  ).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default NotificationScreen;
