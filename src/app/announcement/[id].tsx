import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { icons } from "@/constant";

interface Announcement {
  id: string;
  isActive: boolean;
  title: string;
  message: string;
  imageUrl: string | null;
  createdAt: any;
}

export default function AnnouncementDetails() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const docRef = doc(db, "announcements", String(id));
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setAnnouncement({
            id: docSnap.id,
            ...docSnap.data(),
          } as Announcement);
        }
      } catch (error) {
        console.error("Error fetching announcement:", error);
      }
    };

    fetchAnnouncement();
  }, [id]);

  if (!announcement) {
    return null;
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Image
            source={icons.leftArrow}
            className="h-[28px] w-[28px]"
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text className="text-2xl font-pbold text-gray-900 ml-2">
          Announcement
        </Text>
        <View className="w-6" />
      </View>

      <ScrollView>
        {/* Image */}
        {announcement.imageUrl && (
          <Image
            source={{ uri: announcement.imageUrl }}
            className="w-full h-64"
            resizeMode="cover"
          />
        )}

        {/* Content */}
        <View className="p-4">
          <Text className="text-2xl font-pbold text-gray-900 mb-4">
            {announcement.title}
          </Text>

          <Text className="text-gray-600 text-base leading-6">
            {announcement.message}
          </Text>

          {announcement.createdAt && (
            <Text className="text-gray-400 text-sm mt-6">
              Posted on {announcement.createdAt.toDate().toLocaleDateString()}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
