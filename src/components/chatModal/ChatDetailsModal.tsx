// ChatDetailsModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  FlatList,
  BackHandler,
  Dimensions,
} from "react-native";
import { format } from "date-fns";
import { icons } from "@/constant";
import RentalProgressIndicator from "@/components/RentalProgressIndicator";
import { router } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebaseConfig";
import ModalImageViewer from "@/components/chatModal/ModalImageViewer";
import { useTimeConverter } from "@/hooks/useTimeConverter";
import { formatDistance, set } from "date-fns";
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  FillLayer,
} from "@maplibre/maplibre-react-native";
import * as Linking from "expo-linking";
import { MAP_TILER_API_KEY } from "@env";

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
    createdAt?: any;
  } | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>("");

  useEffect(() => {
    const backAction = () => {
      if (visible) {
        onClose(); // Close the modal when hardware back is pressed
        return true; // Prevent default behavior
      }
      return false; // Allow default behavior if modal is not visible
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    // Cleanup function to remove the listener
    return () => backHandler.remove();
  }, [visible, onClose]);

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

  const formatFirestoreDate = (firestoreTimestamp: any) => {
    try {
      if (!firestoreTimestamp) return "recently";

      if (
        firestoreTimestamp.toDate &&
        typeof firestoreTimestamp.toDate === "function"
      ) {
        const date = firestoreTimestamp.toDate();
        return formatDistance(date, new Date(), { addSuffix: true });
      }

      if (typeof firestoreTimestamp === "string") {
        const date = new Date(firestoreTimestamp);
        if (!isNaN(date.getTime())) {
          return formatDistance(date, new Date(), { addSuffix: true });
        }
      }

      return "recently";
    } catch (error) {
      console.log("Error formatting Firestore date:", error);
      return "recently";
    }
  };

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
            createdAt: userData.createdAt || "",
          });
        }
      } catch (error) {
        console.log("Error fetching current user data:", error);
      }
    };

    fetchCurrentUserData();
  }, [currentUserId]);

  const createCirclePolygon = (
    center: [number, number],
    radiusInMeters: number,
    points: number = 64
  ) => {
    const coords: number[][] = [];
    const distanceX =
      radiusInMeters / (111320 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = radiusInMeters / 110540;

    for (let i = 0; i < points; i++) {
      const theta = (i / points) * (2 * Math.PI);
      const x = distanceX * Math.cos(theta);
      const y = distanceY * Math.sin(theta);
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]);

    return {
      type: "Feature" as const,
      geometry: {
        type: "Polygon" as const,
        coordinates: [coords],
      },
      properties: {},
    };
  };

  const getDirectionsToLocation = (
    latitude: number,
    longitude: number,
    address: string
  ) => {
    const latLng = `${latitude},${longitude}`;
    const label = address || "Pickup Location";

    // URL schemes for directions
    const url =
      Platform.select({
        ios: `maps:?daddr=${latLng}&dirflg=w`,
        android: `google.navigation:q=${latLng}&mode=w`,
      }) || "";

    // Fallback to web Google Maps directions
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${latLng}&destination_place_id=${encodeURIComponent(
      label
    )}`;

    Linking.canOpenURL(url || webUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          return Linking.openURL(webUrl);
        }
      })
      .catch((err) => {
        // Fallback to web version
        Linking.openURL(webUrl);
      });
  };

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
            (isActive ? "rounded-xl border-2 border-primary bg-white" : "") ||
            (id === "report" ? "" : "")
          }`}
        >
          <Image
            source={icon}
            className="w-5 h-5 mr-2"
            tintColor={isActive ? "#4BD07F" : "#9CA3AF"}
          />

          <Text
            className={`text-sm  ${
              isActive
                ? "text-primary font-pmedium"
                : "text-gray-500 font-pregular"
            }`}
          >
            {title}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          className={`p-1 rounded-full justify-center items-center ${
            isActive ? "bg-red-500 " : "bg-red-100"
          }`}
        >
          <Image
            source={icon}
            className="w-5 h-5"
            tintColor={isActive ? "white" : "#dc2626"}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </>
  );

  const RentalProgressTab = () => {
    const { minutesToTime } = useTimeConverter();
    const formatDate = (date: any) => {
      if (!date) return "";
      if (date.toDate) return format(date.toDate(), "MMM d, yyyy");
      if (date instanceof Date) return format(date, "MMM d, yyyy");
      return "Date unavailable";
    };

    // ✅ NEW: Calculate security deposit amounts
    const calculateDepositAmount = () => {
      const rentalDays = chatData?.itemDetails?.rentalDays || 0;
      const price = chatData?.itemDetails?.price || 0;
      const securityDepositPercentage =
        chatData?.itemDetails?.securityDepositPercentage || 0;

      const baseTotal = price * rentalDays;
      const depositAmount = (baseTotal * securityDepositPercentage) / 100;

      return {
        baseTotal,
        depositAmount,
        securityDepositPercentage,
        totalWithDeposit: baseTotal + depositAmount,
      };
    };

    const depositInfo = calculateDepositAmount();

    return (
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

        {/* Item Details Section */}
        {chatData?.itemDetails && (
          <>
            <View className="mt-6 bg-white rounded-xl p-4 border border-gray-200">
              <Text className="text-xl font-psemibold text-gray-900 mb-4">
                Rental Details
              </Text>

              {/* Item Info */}
              <View className="flex-row items-center mb-4">
                <Image
                  source={{
                    uri:
                      chatData.itemDetails.image ||
                      "https://placehold.co/60x60@2x.png",
                  }}
                  className="w-16 h-16 rounded-lg bg-gray-200 mr-3"
                />
                <View className="flex-1">
                  <Text className="text-lg font-pmedium text-gray-800">
                    {chatData.itemDetails.name}
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    {chatData.itemDetails.message}
                  </Text>
                </View>
              </View>

              {/* Rental Information Grid */}
              <View className="space-y-3">
                {/* Price Information */}
                <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <Text className="text-gray-600 font-pmedium">Daily Rate</Text>
                  <Text className="text-gray-800 font-psemibold">
                    ₱{chatData.itemDetails.price?.toLocaleString() || "N/A"}
                  </Text>
                </View>

                {/* Rental Period - Updated Start Date */}
                <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <Text className="text-gray-600 font-pmedium">Start Date</Text>
                  <Text className="text-gray-800 font-psemibold">
                    {formatDate(chatData.itemDetails.startDate)}
                  </Text>
                </View>

                {/* Rental Period - Updated End Date */}
                <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <Text className="text-gray-600 font-pmedium">End Date</Text>
                  <Text className="text-gray-800 font-psemibold">
                    {formatDate(chatData.itemDetails.endDate)}
                  </Text>
                </View>

                {/* Rental Days */}
                <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
                  <Text className="text-gray-600 font-pmedium">
                    Rental Days
                  </Text>
                  <Text className="text-gray-800 font-psemibold">
                    {chatData.itemDetails.rentalDays || 0} days
                  </Text>
                </View>

                {/* ✅ NEW: Price Breakdown Section */}
                <View className="mt-3 bg-gray-50 p-3 rounded-lg">
                  <Text className="text-xs font-pbold uppercase text-gray-400 mb-2">
                    Price Breakdown
                  </Text>

                  {/* Base Rental Fee */}
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm font-pregular text-gray-700">
                      Rental Fee ({chatData.itemDetails.rentalDays || 0} days ×
                      ₱{chatData.itemDetails.price?.toLocaleString()})
                    </Text>
                    <Text className="text-sm font-pmedium text-gray-800">
                      ₱{depositInfo.baseTotal.toLocaleString()}
                    </Text>
                  </View>

                  {/* Security Deposit - Only show if applicable */}
                  {depositInfo.securityDepositPercentage &&
                  depositInfo.securityDepositPercentage > 0 ? (
                    <>
                      <View className="flex-row justify-between py-2 border-t border-gray-200 mb-2">
                        <Text className="text-sm font-pregular text-gray-700">
                          Security Deposit (
                          {depositInfo.securityDepositPercentage}%)
                        </Text>
                        <Text className="text-sm font-pmedium text-orange-600">
                          ₱{depositInfo.depositAmount.toLocaleString()}
                        </Text>
                      </View>

                      {/* Total with Deposit */}
                      <View className="flex-row justify-between pt-2 border-t border-gray-200">
                        <Text className="text-sm font-pbold text-gray-900">
                          Total Amount Due
                        </Text>
                        <Text className="text-base font-pbold text-primary">
                          ₱{depositInfo.totalWithDeposit.toLocaleString()}
                        </Text>
                      </View>

                      {/* Info Note */}
                      <View className="mt-2 bg-orange-50 p-2 rounded border border-orange-200">
                        <Text className="text-xs font-pregular text-orange-700">
                          💡 Security deposit will be collected at pickup and
                          refunded upon safe return.
                        </Text>
                      </View>
                    </>
                  ) : (
                    // No security deposit
                    <View className="flex-row justify-between pt-2 border-t border-gray-200">
                      <Text className="text-sm font-pbold text-gray-900">
                        Total Amount Due
                      </Text>
                      <Text className="text-base font-pbold text-primary">
                        ₱{depositInfo.baseTotal.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Pickup Location Section */}
            {chatData.itemDetails.itemLocation && (
              <View className="mt-6 bg-white rounded-xl overflow-hidden border border-gray-200">
                <View className="p-4 border-b border-gray-200">
                  <Text className="text-xl font-psemibold text-gray-900">
                    Pickup Location
                  </Text>
                </View>

                {/* Map container */}
                <View className="relative">
                  <View className="h-48">
                    <MapView
                      style={{ flex: 1 }}
                      rotateEnabled={false}
                      attributionEnabled={false}
                      logoEnabled={false}
                      compassEnabled={false}
                      compassViewPosition={3}
                      mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAP_TILER_API_KEY}`}
                    >
                      <Camera
                        defaultSettings={{
                          centerCoordinate: [
                            chatData.itemDetails.itemLocation.longitude,
                            chatData.itemDetails.itemLocation.latitude,
                          ],
                          zoomLevel: 15,
                        }}
                      />

                      {/* Radius circle if available */}
                      {chatData.itemDetails.itemLocation.radius && (
                        <ShapeSource
                          id="pickup-radius"
                          shape={createCirclePolygon(
                            [
                              chatData.itemDetails.itemLocation.longitude,
                              chatData.itemDetails.itemLocation.latitude,
                            ],
                            chatData.itemDetails.itemLocation.radius
                          )}
                        >
                          <FillLayer
                            id="pickup-radius-fill"
                            style={{
                              fillColor: "rgba(33, 150, 243, 0.15)",
                              fillOutlineColor: "#2196F3",
                            }}
                          />
                        </ShapeSource>
                      )}

                      {/* Pickup location marker */}
                      <MarkerView
                        coordinate={[
                          chatData.itemDetails.itemLocation.longitude,
                          chatData.itemDetails.itemLocation.latitude,
                        ]}
                        anchor={{ x: 0.5, y: 1 }}
                      >
                        <View
                          style={{
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Image
                            source={require("@/assets/images/marker-home.png")}
                            style={{ width: 32, height: 40 }}
                            resizeMode="contain"
                          />
                        </View>
                      </MarkerView>
                    </MapView>
                  </View>

                  {/* Get Directions Button */}
                  <TouchableOpacity
                    className="absolute bottom-2 right-2 flex-row justify-center items-end bg-white rounded-lg p-2 shadow-md"
                    onPress={() =>
                      getDirectionsToLocation(
                        chatData.itemDetails.itemLocation.latitude,
                        chatData.itemDetails.itemLocation.longitude,
                        chatData.itemDetails.itemLocation.address
                      )
                    }
                  >
                    <Text className="text-blue-600 text-sm font-medium">
                      Get Direction
                    </Text>
                    <Image
                      source={icons.rightArrow}
                      className="w-5 h-5 ml-1"
                      tintColor={"#2563eb"}
                    />
                  </TouchableOpacity>
                </View>

                {/* Address Information */}
                <View className="p-4 bg-gray-50">
                  <Text className="text-gray-600 font-pmedium text-sm">
                    {chatData.itemDetails.itemLocation.address ||
                      "Address not available"}
                  </Text>
                  {chatData.itemDetails.itemLocation.radius &&
                    typeof chatData.itemDetails.itemLocation.radius ===
                      "number" && (
                      <Text className="text-gray-500 text-xs mt-1">
                        Pickup radius:{" "}
                        {chatData.itemDetails.itemLocation.radius >= 1000
                          ? `${(
                              chatData.itemDetails.itemLocation.radius / 1000
                            ).toFixed(1)}km`
                          : `${chatData.itemDetails.itemLocation.radius}m`}
                      </Text>
                    )}
                </View>
              </View>
            )}
          </>
        )}
        <View className="h-12" />
      </ScrollView>
    );
  };
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
        onPress={() => {
          setSelectedImageUrl(item.imageUrl);
          setImageViewerVisible(true);
        }}
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
            columnWrapperStyle={{
              justifyContent: "space-between",
              marginLeft: 4,
            }}
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            style={{ paddingBottom: 12 }}
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
            {currentUserData?.firstname && currentUserData?.lastname
              ? `${currentUserData.firstname}${
                  currentUserData.middlename
                    ? ` ${currentUserData.middlename.charAt(0)}.`
                    : ""
                } ${currentUserData.lastname}`
              : "You"}
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
            {recipientName.firstname && recipientName.lastname
              ? `${recipientName.firstname}${
                  recipientName.middlename
                    ? ` ${recipientName.middlename.charAt(0)}.`
                    : ""
                } ${recipientName.lastname}`
              : "User"}
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
    <>
      <Modal visible={visible} transparent={true} animationType="fade">
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="bg-white border-b border-gray-200 py-4">
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
              <TouchableOpacity
                className="flex-row items-center flex-1"
                onPress={() => {
                  onClose(); // close the modal first
                  router.push(`/user/${recipientId}`); // then navigate
                }}
              >
                {/* <Image
                  source={{
                    uri:
                      chatData.itemDetails.image ||
                      "https://placehold.co/40x40@2x.png",
                  }}
                  className="w-12 h-12 rounded-xl  bg-gray-200 "
                /> */}
                {/* <View className="shadow-lg shadow-red-800"> */}
                <View>
                  <Image
                    source={{
                      uri:
                        recipientImage || "https://placehold.co/40x40@2x.png",
                    }}
                    className="w-12 h-12 rounded-full  bg-gray-200 mr-3"
                  />
                  <Image
                    source={icons.verified}
                    className="w-4 h-4 absolute bottom-0 right-2"
                    resizeMode="contain"
                  />
                </View>
                {/* </View> */}
                <View className="flex-1 ml-1">
                  <Text className="text-lg font-pbold text-gray-800 ">
                    {formatFullName()}
                  </Text>
                  <Text className="text-gray-500 text-sm ">
                    Joined {formatFirestoreDate(currentUserData?.createdAt)}
                  </Text>
                  {/* {chatData?.itemDetails?.name && (
                    <Text className="text-sm text-gray-500">
                      {chatData.itemDetails.name}
                    </Text>
                  )} */}
                </View>
              </TouchableOpacity>
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
      <ModalImageViewer
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImageUrl("");
        }}
        imageName={`r2r_${chatData?.itemDetails?.name || "Image"}`}
      />
    </>
  );
};

export default ChatDetailsModal;
