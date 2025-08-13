import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { icons } from "@/constant";
import LottieActivityIndicator from "@/components/LottieActivityIndicator";

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
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        // Get all active announcements ordered by createdAt
        const allAnnouncementsQuery = query(
          collection(db, "announcements"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(allAnnouncementsQuery);
        const announcements = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Find current announcement index
        const currentIndex = announcements.findIndex((ann) => ann.id === id);

        if (currentIndex !== -1) {
          // Set current announcement
          setAnnouncement(announcements[currentIndex] as Announcement);

          // Set previous and next IDs
          setPrevId(
            currentIndex > 0 ? announcements[currentIndex - 1].id : null
          );
          setNextId(
            currentIndex < announcements.length - 1
              ? announcements[currentIndex + 1].id
              : null
          );
        }
      } catch (error) {
        console.error("Error fetching announcements:", error);
      }
    };

    fetchAnnouncements();
  }, [id]);

  if (!announcement) {
    return (
      <View className=" flex-1 bg-white w-full h-full">
        <View className="flex-1 items-center justify-center">
          <LottieActivityIndicator size={100} color="#5C6EF6" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Image
            source={icons.leftArrow}
            className="w-8 h-8"
            tintColor="#6B7280"
          />
        </TouchableOpacity>
        <Text className="text-xl font-pbold text-gray-800">Announcement</Text>
        <View className="w-6" />
      </View>

      <ScrollView>
        {/* Image */}
        {announcement.imageUrl && (
          <View className="px-2 rounded-lg overflow-hidden">
            <Image
              source={{ uri: announcement.imageUrl }}
              className="w-full h-64 rounded-lg"
              resizeMode="cover"
            />
          </View>
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
      <View className="flex-row justify-between items-center p-4">
        <TouchableOpacity
          disabled={!prevId}
          onPress={() => prevId && router.replace(`/announcement/${prevId}`)}
          className={`p-4 rounded-full ${
            prevId ? "bg-primary" : "bg-gray-200"
          }`}
        >
          <Image
            source={icons.leftArrow}
            className="w-6 h-6"
            tintColor={prevId ? "#FFFFFF" : "#9CA3AF"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!nextId}
          onPress={() => nextId && router.replace(`/announcement/${nextId}`)}
          className={`p-4 rounded-full ${
            nextId ? "bg-primary" : "bg-gray-200"
          }`}
        >
          <Image
            source={icons.rightArrow}
            className="w-6 h-6"
            tintColor="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
