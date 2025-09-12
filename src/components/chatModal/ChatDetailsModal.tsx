// ChatDetailsModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
  Dimensions,
} from "react-native";
import { format } from "date-fns";
import { icons } from "@/constant";
import RentalProgressIndicator from "@/components/RentalProgressIndicator";
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";

interface Message {
  id: string;
  type?: string;
  imageUrl?: string;
  createdAt: any;
  senderId: string;
  isDeleted?: boolean;
}

interface ChatDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  onImagePress: (selectedImageUrl: string) => void;
  chatData: any;
  recipientName: {
    firstname: string;
    lastname: string;
    middlename?: string;
  };
  recipientImage?: string;
  recipientId: string;
  messages: Message[];
  isOwner: boolean;
  currentUserId: string;
}

interface MediaItem {
  id: string;
  imageUrl: string;
  timestamp: any;
  senderId: string;
}

const ChatDetailsModal: React.FC<ChatDetailsModalProps> = ({
  visible,
  onClose,
  onImagePress,
  chatData,
  recipientName,
  recipientImage,
  recipientId,
  messages,
  isOwner,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<
    "progress" | "media" | "participants" | "report"
  >("progress");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [currentUserData, setCurrentUserData] = useState<{
    firstname: string;
    lastname: string;
    middlename?: string;
    profileImage?: string;
  } | null>(null);

  useEffect(() => {
    // Filter and sort media messages
    const imageMessages = messages
      .filter((msg) => msg.type === "image" && msg.imageUrl && !msg.isDeleted)
      .map((msg) => ({
        id: msg.id,
        imageUrl: msg.imageUrl!,
        timestamp: msg.createdAt,
        senderId: msg.senderId,
      }))
      .sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime();
      });

    setMediaItems(imageMessages);
  }, [messages]);

  useEffect(() => {
    const fetchCurrentUserData = async () => {
      if (!currentUserId) return;

      try {
        const userRef = doc(db, "users", currentUserId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentUserData({
            firstname: userData.firstname || "",
            lastname: userData.lastname || "",
            middlename: userData.middlename || "",
            profileImage: userData.profileImage || "",
          });
        }
      } catch (error) {
        console.error("Error fetching current user data:", error);
      }
    };

    fetchCurrentUserData();
  }, [currentUserId]);

  const formatFullName = () => {
    const middleInitial = recipientName.middlename
      ? ` ${recipientName.middlename.charAt(0)}.`
      : "";
    return `${recipientName.firstname}${middleInitial} ${recipientName.lastname}`;
  };

  const TabButton = ({
    id,
    title,
    icon,
    isActive,
    onPress,
  }: {
    id: string;
    title: string;
    icon: any;
    isActive: boolean;
    onPress: () => void;
  }) => (
    <>
      {id != "report" ? (
        <TouchableOpacity
          onPress={onPress}
          className={`flex-1 flex-row items-center justify-center py-3 px-2 ${
            (isActive ? "border-b-2 border-primary bg-white" : "") ||
            (id === "report" ? "" : "")
          }`}
        >
          <Image
            source={icon}
            className="w-4 h-4 mr-2"
            tintColor={isActive ? "#4BD07F" : "#9CA3AF"}
          />

          <Text
            className={`text-sm font-pmedium ${
              isActive ? "text-primary" : "text-gray-500"
            }`}
          >
            {title}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          className={`p-2 rounded-full justify-center items-center ${
            isActive ? "bg-red-500 " : "bg-red-100"
          }`}
        >
          <Image
            source={icon}
            className="w-6 h-6"
            tintColor={isActive ? "white" : "#dc2626"}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </>
  );

  const RentalProgressTab = () => (
    <ScrollView className="flex-1 p-4">
      {chatData?.status ? (
        <RentalProgressIndicator
          currentStatus={chatData.status}
          isOwner={isOwner}
          compact={false}
        />
      ) : (
        <View className="items-center py-8">
          <Text className="text-gray-500 text-center">
            No rental process active
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const MediaTab = () => {
    const screenWidth = Dimensions.get("window").width;
    const itemSize = (screenWidth - 48) / 3; // 3 columns with padding

    const renderMediaItem = ({
      item,
      index,
    }: {
      item: MediaItem;
      index: number;
    }) => (
      <TouchableOpacity
        key={item.id}
        className="mb-2"
        style={{ width: itemSize, height: itemSize }}
        onPress={() => onImagePress(item.imageUrl)}
      >
        <Image
          source={{ uri: item.imageUrl }}
          className="w-full h-full rounded-lg bg-gray-200"
          resizeMode="cover"
        />
        <View className="absolute bottom-1 right-1 bg-black/50 rounded px-1">
          <Text className="text-white text-xs">
            {item.timestamp ? format(item.timestamp.toDate(), "MMM d") : ""}
          </Text>
        </View>
      </TouchableOpacity>
    );

    return (
      <ScrollView className="flex-1 p-4">
        <Text className="text-lg font-pbold text-gray-800 mb-4">
          Shared Media ({mediaItems.length})
        </Text>

        {mediaItems.length > 0 ? (
          <FlatList
            data={mediaItems}
            renderItem={renderMediaItem}
            numColumns={3}
            columnWrapperStyle={{ justifyContent: "flex-start", marginLeft: 4 }}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
          />
        ) : (
          <View className="items-center py-8">
            <Image
              source={icons.gallery}
              className="w-12 h-12 mb-2"
              tintColor="#9CA3AF"
            />
            <Text className="text-gray-500 text-center">
              No images shared yet
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  const ParticipantsTab = () => (
    <ScrollView className="flex-1 p-4">
      <Text className="text-lg font-pbold text-gray-800 mb-4">
        Participants
      </Text>

      {/* Current User */}
      <View className="flex-row items-center p-3 bg-gray-50 rounded-xl mb-3">
        <Image
          source={{
            uri:
              currentUserData?.profileImage ||
              "https://placehold.co/48x48@2x.png",
          }}
          className="w-12 h-12 rounded-full bg-gray-200 mr-3"
        />
        <View className="flex-1">
          <Text className="text-base font-pmedium text-gray-800">
            {formatFullName()}
          </Text>
          <Text className="text-sm text-gray-500">
            {isOwner ? "Item Owner" : "Requester"} • You
          </Text>
        </View>
      </View>

      {/* Other Participant */}
      <TouchableOpacity
        className="flex-row items-center p-3 bg-white rounded-xl border border-gray-200"
        onPress={() => {
          router.push(`/user/${recipientId}`);
          onClose();
        }}
      >
        <Image
          source={{
            uri: recipientImage || "https://placehold.co/48x48@2x.png",
          }}
          className="w-12 h-12 rounded-full bg-gray-200 mr-3"
        />
        <View className="flex-1">
          <Text className="text-base font-pmedium text-gray-800">
            {formatFullName()}
          </Text>
          <Text className="text-sm text-gray-500">
            {isOwner ? "Requester" : "Item Owner"}
          </Text>
        </View>
        <Image
          source={icons.rightArrow}
          className="w-5 h-5"
          tintColor="#9CA3AF"
        />
      </TouchableOpacity>
    </ScrollView>
  );

  const ReportTab = () => (
    <ScrollView className="flex-1 p-4">
      <Text className="text-lg font-pbold text-gray-800 mb-4">Report User</Text>

      <View className="bg-red-50 rounded-xl p-4 mb-4">
        <Text className="text-red-600 font-pmedium mb-2">
          Report {formatFullName()}
        </Text>
        <Text className="text-red-500 text-sm">
          If this user is violating our community guidelines or behaving
          inappropriately, you can report them. Our team will review your
          report.
        </Text>
      </View>

      <TouchableOpacity
        className="bg-red-500 rounded-xl p-4 items-center"
        onPress={() => {
          router.push(`/report/${recipientId}`);
          onClose();
        }}
      >
        <Text className="text-white font-pbold">Report User</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "progress":
        return <RentalProgressTab />;
      case "media":
        return <MediaTab />;
      case "participants":
        return <ParticipantsTab />;
      case "report":
        return <ReportTab />;
      default:
        return <RentalProgressTab />;
    }
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="pageSheet">
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 pt-8 pb-4">
          <View className="flex-row items-center justify-between px-4 mb-4">
            <TouchableOpacity
              onPress={onClose}
              className="w-8 h-8 items-center justify-center mr-3"
            >
              <Image
                source={icons.leftArrow}
                className="w-8 h-8"
                tintColor="#6B7280"
              />
            </TouchableOpacity>
            <View className="flex-row items-center flex-1">
              <Image
                source={{
                  uri:
                    chatData.itemDetails.image ||
                    "https://placehold.co/40x40@2x.png",
                }}
                className="w-12 h-12 rounded-xl  bg-gray-200 "
              />
              <View className="shadow-lg shadow-red-800">
                <Image
                  source={{
                    uri: recipientImage || "https://placehold.co/40x40@2x.png",
                  }}
                  className="w-12 h-12 rounded-xl  bg-gray-200 -ml-4 mt-4 mr-3"
                />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-pbold text-gray-800 ">
                  {formatFullName()}
                </Text>
                {chatData?.itemDetails?.name && (
                  <Text className="text-sm text-gray-500">
                    {chatData.itemDetails.name}
                  </Text>
                )}
              </View>
            </View>
            <TabButton
              id="report"
              title="Report"
              icon={icons.report}
              isActive={activeTab === "report"}
              onPress={() => setActiveTab("report")}
            />
          </View>

          {/* Tab Navigation */}
          <View className="flex-row bg-gray-100 mx-4 rounded-lg overflow-hidden">
            <TabButton
              id="progress"
              title="Progress"
              icon={icons.milestone}
              isActive={activeTab === "progress"}
              onPress={() => setActiveTab("progress")}
            />

            <TabButton
              id="media"
              title="Media"
              icon={icons.gallery}
              isActive={activeTab === "media"}
              onPress={() => setActiveTab("media")}
            />
            <TabButton
              id="participants"
              title="People"
              icon={icons.profile}
              isActive={activeTab === "participants"}
              onPress={() => setActiveTab("participants")}
            />
          </View>
        </View>

        {/* Tab Content */}
        {renderTabContent()}
      </View>
    </Modal>
  );
};

export default ChatDetailsModal;
