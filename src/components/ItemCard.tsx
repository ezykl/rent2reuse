// Enhanced ItemCard component with location optimizations

import { View, Text, Image, TouchableOpacity } from "react-native";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import { icons } from "../constant";
import { useLocation } from "../hooks/useLocation";
import { LocationUtils, Position } from "../utils/locationUtils";
import { LinearGradient } from "expo-linear-gradient";

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
    address?: string; // Add address for fallback display
  };
  owner?: {
    id: string;
    fullname: string;
  };
  showProtectionOverlay?: boolean;
  onPress?: () => void;
  enableAI?: boolean;
  // NEW: Optional prop to pass user location from parent to avoid multiple location hooks
  userLocationProp?: {
    latitude: number;
    longitude: number;
  } | null;
}

const ItemCard = ({
  title,
  thumbnail,
  description,
  price,
  status,
  owner,
  enableAI,
  condition,
  itemLocation,
  showProtectionOverlay = false,
  onPress,
  userLocationProp, // NEW: Accept user location from parent
}: ItemCardProps) => {
  // Optimized DistanceBadge component
  const DistanceBadge = ({ itemLocation }: { itemLocation: Position }) => {
    // Use prop location if provided, otherwise use hook
    const locationHook = useLocation({
      autoStart: !userLocationProp, // Only auto-start if no prop provided
      watchLocation: false, // Disable watching since parent handles it
    });

    const effectiveUserLocation = userLocationProp || locationHook.userLocation;
    const effectiveHasPermission = userLocationProp
      ? true
      : locationHook.hasPermission;

    // Memoize distance calculation for performance
    const distanceResult = useMemo(() => {
      if (!effectiveUserLocation || !itemLocation) return null;

      try {
        return LocationUtils.Distance.calculateUserToItemDistance(
          effectiveUserLocation,
          itemLocation
        );
      } catch (err) {
        console.error("Error calculating distance:", err);
        return null;
      }
    }, [effectiveUserLocation, itemLocation]);

    // Memoize distance text formatting
    const distanceText = useMemo(() => {
      if (!distanceResult) return null;

      if (distanceResult.kilometers < 0.1) {
        return "< 100m";
      } else if (distanceResult.kilometers < 1) {
        return `${Math.round(distanceResult.meters)}m`;
      } else if (distanceResult.kilometers < 10) {
        return `${distanceResult.kilometers.toFixed(1)}km`;
      } else {
        return `${Math.round(distanceResult.kilometers)}km`;
      }
    }, [distanceResult]);

    // Don't show if no permission or no distance calculated
    if (!effectiveHasPermission || !distanceText) return null;

    return (
      <View className="bg-black/70 px-2 py-1 rounded-full flex-row items-center">
        <Image
          source={icons.location}
          className="w-3 h-3 mr-1"
          tintColor="#FFFFFF"
        />
        <Text className="text-xs text-white font-pmedium">{distanceText}</Text>
      </View>
    );
  };

  // Status color mapping with memoization
  const statusColorConfig = useMemo(() => {
    switch (status?.toLowerCase()) {
      case "available":
        return { bg: "bg-green-400", text: "Available" };
      case "rented":
        return { bg: "bg-blue-400", text: "Rented" };
      case "reserved":
        return { bg: "bg-yellow-400", text: "Reserved" };
      case "unavailable":
        return { bg: "bg-gray-400", text: "Unavailable" };
      default:
        return { bg: "bg-gray-400", text: "Unknown" };
    }
  }, [status]);

  const conditionColorConfig = useMemo(() => {
    switch (condition?.toLowerCase()) {
      case "brand new":
        return { bg: "bg-emerald-100", text: "text-emerald-800" };
      case "like new":
        return { bg: "bg-teal-100", text: "text-teal-800" };
      case "very good":
        return { bg: "bg-blue-100", text: "text-blue-800" };
      case "good":
        return { bg: "bg-yellow-100", text: "text-yellow-800" };
      case "fair":
        return { bg: "bg-orange-100", text: "text-orange-800" };
      case "worn but usable":
        return { bg: "bg-red-100", text: "text-red-800" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700" };
    }
  }, [condition]);

  return (
    <TouchableOpacity
      className="w-[48%] bg-white border border-gray-200 shadow-sm mb-4 rounded-lg"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="relative">
        <Image
          source={{
            uri:
              Array.isArray(thumbnail) && thumbnail.length > 0
                ? thumbnail[0]
                : undefined,
          }}
          className="w-full h-[160px] rounded-t-lg"
          resizeMode="cover"
        />

        {/* Protection Overlay */}
        {showProtectionOverlay && (
          <View className="absolute inset-0 bg-black/40 justify-center items-center rounded-t-lg">
            <View className="px-3 py-2 rounded-lg">
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

        {/* Distance Badge - Enhanced positioning and styling */}
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

        {/* NEW: Location address as fallback when no coordinates */}
        {!itemLocation?.latitude && itemLocation?.address && (
          <View className="absolute top-2 left-2 flex-row">
            <Text>Ts</Text>
            <DistanceBadge
              itemLocation={{
                latitude: itemLocation.latitude,
                longitude: itemLocation.longitude,
              }}
            />
          </View>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          className="absolute bottom-0 left-0 right-0 h-12 rounded-b-2xl p-4"
        />

        {/* Status Badge - Moved to bottom-right for better visibility */}
        {!showProtectionOverlay && status && (
          <View className="absolute top-2 right-2">
            <View className={`px-2 py-1 rounded-full ${statusColorConfig.bg}`}>
              <Text className="text-xs font-pmedium text-white">
                {statusColorConfig.text}
              </Text>
            </View>
          </View>
        )}

        {!enableAI && (
          <Image
            source={icons.aiImage}
            className="w-6 h-6 absolute bottom-2 right-2"
            tintColor={"#ffffff"}
            style={{ opacity: 0.8 }}
          />
        )}
      </View>

      <View className="p-3">
        {/* Title - Always visible */}
        <View className="flex-row items-center">
          <Text
            className="text-base font-pmedium text-gray-800"
            numberOfLines={1}
          >
            {title || "Untitled"}
          </Text>

          {!showProtectionOverlay && condition && (
            <View
              className={`ml-1 px-2 py-1 rounded-full ${conditionColorConfig.bg}`}
              style={{ opacity: 0.7 }}
            >
              <Text
                className={`text-xs font-pmedium ${conditionColorConfig.text}`}
              >
                {condition}
              </Text>
            </View>
          )}
        </View>

        {/* Protected Content - Only show if profile is complete */}
        {!showProtectionOverlay ? (
          <>
            {/* Owner */}
            {owner && (
              <Text className="text-xs text-gray-500 mt-1 font-pregular">
                by {owner.fullname || "Unknown User"}
              </Text>
            )}

            {/* Description */}
            {description && (
              <Text
                className="text-xs text-gray-400 mt-1"
                numberOfLines={2}
                style={{ lineHeight: 16 }}
              >
                {description}
              </Text>
            )}
            <View className="flex-row items-center justify-between mt-2">
              {/* Price */}
              {price !== undefined && (
                <Text className="text-lg font-psemibold text-primary mt-2">
                  ₱{price.toLocaleString()}/day
                </Text>
              )}

              {/* {!showProtectionOverlay && condition && (
                <View className="ml-2">
                  <View
                    className={`px-2 py-1 rounded-full ${conditionColorConfig.bg}`}
                    style={{ opacity: 0.7 }}
                  >
                    <Text
                      className={`text-xs font-pmedium ${conditionColorConfig.text}`}
                    >
                      {condition}
                    </Text>
                  </View>
                </View>
              )} */}
            </View>
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
