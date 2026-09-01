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
  const [announcements, setAnnouncements] = useState<Announcement[]>([]); // Store ALL announcements
  const [currentAnnouncement, setCurrentAnnouncement] =
    useState<Announcement | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all announcements ONCE on mount
  useEffect(() => {
    const fetchAllAnnouncements = async () => {
      try {
        setIsLoading(true);
        const allAnnouncementsQuery = query(
          collection(db, "announcements"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(allAnnouncementsQuery);
        const fetchedAnnouncements = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Announcement[];

        setAnnouncements(fetchedAnnouncements);
      } catch (error) {
        console.log("Error fetching announcements:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllAnnouncements();
  }, []); // Empty dependency - fetch only once

  // Update current announcement when ID or announcements change
  useEffect(() => {
    if (announcements.length > 0 && id) {
      const index = announcements.findIndex((ann) => ann.id === id);
      if (index !== -1) {
        setCurrentIndex(index);
        setCurrentAnnouncement(announcements[index]);
      }
    }
  }, [id, announcements]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevId = announcements[currentIndex - 1].id;
      router.replace(`/announcement/${prevId}`);
    }
  };

  const handleNext = () => {
    if (currentIndex < announcements.length - 1) {
      const nextId = announcements[currentIndex + 1].id;
      router.replace(`/announcement/${nextId}`);
    }
  };

  // Show loading only on initial fetch
  if (isLoading) {
    return (
      <View className="flex-1 bg-white w-full h-full">
        <View className="flex-1 items-center justify-center">
          <LottieActivityIndicator size={100} color="#5C6EF6" />
        </View>
      </View>
    );
  }

  // Show error state if announcement not found
  if (!currentAnnouncement) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
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
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Announcement not found</Text>
        </View>
      </View>
    );
  }

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < announcements.length - 1;

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
        {currentAnnouncement.imageUrl && (
          <View className="px-2 rounded-lg overflow-hidden">
            <Image
              source={{ uri: currentAnnouncement.imageUrl }}
              className="w-full h-64 rounded-lg"
              resizeMode="cover"
            />
          </View>
        )}

        {/* Content */}
        <View className="p-4">
          <Text className="text-2xl font-pbold text-gray-900 mb-4">
            {currentAnnouncement.title}
          </Text>

          <Text className="text-gray-600 text-base leading-6">
            {currentAnnouncement.message}
          </Text>

          {currentAnnouncement.createdAt && (
            <Text className="text-gray-400 text-sm mt-6">
              Posted on{" "}
              {currentAnnouncement.createdAt.toDate().toLocaleDateString()}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View className="flex-row justify-between items-center p-4">
        <TouchableOpacity
          disabled={!hasPrevious}
          onPress={handlePrevious}
          className={`p-4 rounded-full ${
            hasPrevious ? "bg-primary" : "bg-gray-200"
          }`}
        >
          <Image
            source={icons.leftArrow}
            className="w-6 h-6"
            tintColor={hasPrevious ? "#FFFFFF" : "#9CA3AF"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!hasNext}
          onPress={handleNext}
          className={`p-4 rounded-full ${
            hasNext ? "bg-primary" : "bg-gray-200"
          }`}
        >
          <Image
            source={icons.rightArrow}
            className="w-6 h-6"
            tintColor={hasNext ? "#FFFFFF" : "#9CA3AF"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
