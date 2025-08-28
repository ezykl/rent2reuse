import { View, Text, Image, TouchableOpacity } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { icons } from "../constant";
import { useLocation } from "../hooks/useLocation";
import { LocationUtils, Position } from "../utils/locationUtils";
import { auth, db } from "../lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

interface ItemCardProps {
  title: string;
  thumbnail: string[];
  description?: string;
  price?: number;
  status?: string;
  condition?: string;
  itemLocation?: {
    latitude: number;
    longitude: number;
  };
  owner?: {
    id: string;
    fullname: string;
  };
  showProtectionOverlay?: boolean;
  onPress?: () => void;
}

const ItemCard = ({
  title,
  thumbnail,
  description,
  price,
  status,
  owner,
  condition,
  itemLocation,
  showProtectionOverlay = false,
  onPress,
}: ItemCardProps) => {
  const DistanceBadge = ({ itemLocation }: { itemLocation: Position }) => {
    const {
      userLocation,
      hasPermission,
      isLoading,
      firestoreLocation,
      isUsingStoredLocation,
    } = useLocation({
      autoStart: true,
      watchLocation: true, // Now uses 5-minute intervals instead of continuous watching
      updateInterval: 5 * 60 * 1000, // 5 minutes
    });

    const [distanceText, setDistanceText] = useState<string | null>(null);

    // Calculate distance using current location or Firestore location as fallback
    useEffect(() => {
      const locationToUse = userLocation || firestoreLocation;

      if (hasPermission && locationToUse && itemLocation) {
        try {
          const result = LocationUtils.Distance.calculateUserToItemDistance(
            locationToUse,
            itemLocation
          );
          if (result.kilometers < 1) {
            setDistanceText(`${Math.round(result.meters)}m`);
          } else if (result.kilometers < 10) {
            setDistanceText(`${result.kilometers.toFixed(1)}km`);
          } else {
            setDistanceText(`${Math.round(result.kilometers)}km`);
          }
        } catch (err) {
          console.error("Error calculating distance:", err);
          setDistanceText(null);
        }
      } else {
        setDistanceText(null);
      }
    }, [userLocation, firestoreLocation, hasPermission, itemLocation]);

    // Don't show anything if we don't have permission
    if (!hasPermission) return null;

    // Don't show if no distance calculated
    if (!distanceText) return null;

    return (
      <View className="bg-gray-100/90 px-2 py-1 rounded-full flex-row items-center">
        <Image
          source={icons.location}
          className="w-3 h-3 mr-1"
          tintColor="#6B7280"
        />
        <Text className="text-xs text-gray-600 font-pmedium">
          {distanceText}
        </Text>
        {/* Small indicator dot when using Firestore location */}
        {isUsingStoredLocation && (
          <View className="w-1 h-1 bg-blue-400 rounded-full ml-1" />
        )}
      </View>
    );
  };

  // Status color mapping
  const getStatusColor = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case "available":
        return "bg-green-400";
      case "rented":
        return "bg-blue-400";
      case "reserved":
        return "bg-yellow-400";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <TouchableOpacity
      className="w-[48%] bg-white border border-gray-200 shadow-sm mb-4 rounded-lg"
      onPress={onPress}
    >
      <View className="relative">
        <Image
          source={{
            uri:
              Array.isArray(thumbnail) && thumbnail.length > 0
                ? thumbnail[0]
                : undefined,
          }}
          className="w-full h-[150px] rounded-t-lg"
          resizeMode="cover"
        />

        {/* Protection Overlay */}
        {showProtectionOverlay && (
          <View className="absolute inset-0 bg-black/40 justify-center items-center rounded-t-lg">
            <View className=" px-3 py-2 rounded-lg">
              <View className="flex-row items-center">
                <Image
                  source={icons.lock}
                  className="w-6 h-6"
                  resizeMode="contain"
                  tintColor={"#FFFFFF"}
                />
              </View>
            </View>
          </View>
        )}

        {/* Distance Badge - Only show if location data exists and profile is complete */}
        {!showProtectionOverlay &&
          itemLocation &&
          itemLocation.latitude &&
          itemLocation.longitude && (
            <View className="absolute top-2 left-2">
              <DistanceBadge
                itemLocation={{
                  latitude: itemLocation.latitude,
                  longitude: itemLocation.longitude,
                }}
              />
            </View>
          )}

        {/* Status Badge - Only show if not protected */}
        {!showProtectionOverlay && status && (
          <View
            className={`absolute top-2 right-2 px-2 py-1 rounded-full ${getStatusColor(
              status
            )}`}
          >
            <Text className="text-xs font-pmedium capitalize text-white">
              {status || "Unknown"}
            </Text>
          </View>
        )}
      </View>

      <View className="p-2">
        {/* Title - Always visible */}
        <Text
          className="text-base font-pmedium text-gray-800"
          numberOfLines={1}
        >
          {title || "Untitled"}
        </Text>

        {/* Protected Content - Only show if profile is complete */}
        {!showProtectionOverlay ? (
          <>
            {/* Owner */}
            <Text className="text-xs text-gray-500 mt-1 font-pregular">
              by {owner?.fullname || "Unknown User"}
            </Text>

            {/* Description */}
            <Text
              className="text-xs text-gray-400 mt-1"
              numberOfLines={2}
              style={{ lineHeight: 16 }}
            >
              {description || "No description available"}
            </Text>

            {/* Price */}
            <Text className="text-lg font-psemibold text-primary mt-1">
              ₱ {price || "Price Negotiable"} / day
            </Text>
          </>
        ) : (
          /* Protected Content Placeholder */
          <View className="mt-1">
            <Text className="text-xs text-gray-400 font-pregular mb-2">
              Complete profile to view details
            </Text>

            {/* Blurred placeholder content */}
            <View className="space-y-1">
              <View className="h-3 bg-gray-200 rounded w-3/4" />
              <View className="h-3 bg-gray-200 rounded w-1/2" />
              <View className="h-4 bg-gray-200 rounded w-2/3 mt-2" />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default ItemCard;
