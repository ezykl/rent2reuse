import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
} from "react-native";
import { MapView, Camera, MarkerView } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";

const CEBU_COORDINATES = {
  latitude: 10.3157,
  longitude: 123.8854,
};

const MAP_BOUNDS = {
  ne: [124.0854, 10.4157],
  sw: [123.7854, 10.2157],
};

const MIN_ZOOM_LEVEL = 12;
const MAX_ZOOM_LEVEL = 22;

// Update the helper function with proper API key
const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=60e64bf3f33b40158223b9ea8354791b`
    );
    const data = await response.json();
    return data.results[0]?.formatted || "";
  } catch (error) {
    console.error("Error fetching address:", error);
    return "";
  }
};

// Add this helper to check if coordinates are the same
const areCoordinatesEqual = (
  coord1: [number, number] | undefined,
  coord2: [number, number] | null
): boolean => {
  if (!coord1 || !coord2) return false;
  return coord1[0] === coord2[0] && coord1[1] === coord2[1];
};

// Add this helper function to check if coordinates are within Cebu bounds
const isWithinCebuBounds = (coords: [number, number]): boolean => {
  const [longitude, latitude] = coords;
  return (
    longitude >= MAP_BOUNDS.sw[0] &&
    longitude <= MAP_BOUNDS.ne[0] &&
    latitude >= MAP_BOUNDS.sw[1] &&
    latitude <= MAP_BOUNDS.ne[1]
  );
};

interface LocationModalContentProps {
  onSave: (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  loading?: boolean;
}

export const LocationModalContent = ({
  onSave,
  loading,
}: LocationModalContentProps) => {
  const mapRef = useRef<any>();
  const cameraRef = useRef<any>();
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );
  const [pinCoord, setPinCoord] = useState<[number, number]>([
    CEBU_COORDINATES.longitude,
    CEBU_COORDINATES.latitude,
  ]);
  const [initialRegion, setInitialRegion] = useState<[number, number]>([
    CEBU_COORDINATES.longitude,
    CEBU_COORDINATES.latitude,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [address, setAddress] = useState("");
  const [currentZoom, setCurrentZoom] = useState(14);
  const [shouldTrackLocation, setShouldTrackLocation] = useState(true);

  const updatePinLocation = async (coords: [number, number]) => {
    setPinCoord(coords);
    const [lng, lat] = coords;
    const formattedAddress = await getAddressFromCoordinates(lat, lng);
    setAddress(formattedAddress);

    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: coords,
        animationDuration: 1000,
      });
    }
  };

  const getUserLocation = async (): Promise<void> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === "granted");

      if (status !== "granted") {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Permission Required",
          textBody: "Please enable location services to use this feature",
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      if (
        longitude >= MAP_BOUNDS.sw[0] &&
        longitude <= MAP_BOUNDS.ne[0] &&
        latitude >= MAP_BOUNDS.sw[1] &&
        latitude <= MAP_BOUNDS.ne[1]
      ) {
        const userCoords: [number, number] = [longitude, latitude];
        setUserLocation(userCoords);
        await updatePinLocation(userCoords);
      } else {
        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Location Notice",
          textBody: "This app is limited to Cebu City area",
        });
      }
    } catch (error) {
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to get your location. Please try again.",
      });
    }
  };

  const handlePinMyLocation = async () => {
    if (userLocation) {
      await updatePinLocation(userLocation);
    }
  };

  const animateToLocation = (longitude: number, latitude: number) => {
    if (cameraRef.current) {
      cameraRef.current.flyTo([longitude, latitude], 1000);
    }
  };

  const handleMapPress = async (event: any) => {
    setShouldTrackLocation(false);
    const coords = event.geometry.coordinates;
    await updatePinLocation(coords);
  };

  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearch = async () => {
    if (searchQuery.length < 3) {
      alert("Please enter at least 3 characters to search");
      return;
    }

    try {
      setIsSearching(true);
      const results = await Location.geocodeAsync(searchQuery);

      if (results.length === 0) {
        setSearchResults([]);
        alert("No locations found for your search");
        return;
      }

      const detailedResults = await Promise.all(
        results.map(async (result) => {
          const { latitude, longitude } = result;
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=60e64bf3f33b40158223b9ea8354791b`
          );
          const data = await response.json();
          return {
            coordinates: [longitude, latitude] as [number, number],
            address: data.results[0]?.formatted || "",
            placeType: data.results[0]?.components?.type || "",
          };
        })
      );

      setSearchResults(detailedResults);
    } catch (error) {
      alert("Failed to search location. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = async (location: any) => {
    setShouldTrackLocation(false);
    const [longitude, latitude] = location.coordinates;
    await updatePinLocation([longitude, latitude]);
    setSearchResults([]);
    setSearchQuery(location.address);
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  return (
    <View className="flex-1 w-full h-full">
      <View className=" bg-orange-400/10 p-2 m-4 mb-0  rounded-xl border border-orange-300">
        <Text className="text-orange-500 text-xs font-pmedium text-center">
          Note: Please pin the exact location where the item will be available
          for pickup. This helps interested renters find the item easily and
          ensures a smooth handover.
        </Text>
      </View>
      {/* Search Bar */}
      <View className="p-4">
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl"
            placeholder="Search location..."
            value={searchQuery}
            onChangeText={handleSearchInput}
            onSubmitEditing={() => handleSearch()}
          />
          <TouchableOpacity
            className="bg-primary px-4 justify-center rounded-xl"
            onPress={handleSearch}
            disabled={isSearching}
          >
            <Text className="text-white font-pmedium">
              {isSearching ? "Searching..." : "Search"}
            </Text>
          </TouchableOpacity>
        </View>

        {searchResults.length > 0 && (
          <ScrollView className="relative mt-2  rounded-lg ">
            <Text className="text-secondary-400 text-sm font-pmedium mb-2">
              Search Results{" "}
            </Text>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={index}
                className="flex-row p-3 border border-secondary-400 rounded-lg"
                onPress={() => handleSelectLocation(result)}
              >
                <Text className="font-pmedium text-sm text-secondary-400">
                  {result.address}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Map Container */}
      <View className="flex-1 relative">
        <MapView
          ref={mapRef}
          style={{ flex: 1, width: "100%", height: "100%" }}
          rotateEnabled={false}
          attributionEnabled={false}
          compassViewPosition={3}
          mapStyle="https://api.maptiler.com/maps/streets-v2/style.json?key=JsHqOp9SqKGMUgYiibdt"
          onPress={handleMapPress}
        >
          <Camera
            ref={cameraRef}
            bounds={MAP_BOUNDS}
            minZoomLevel={MIN_ZOOM_LEVEL}
            maxZoomLevel={MAX_ZOOM_LEVEL}
            defaultSettings={{
              centerCoordinate: initialRegion,
              zoomLevel: 14,
              animationDuration: 1000,
            }}
          />

          {pinCoord && (
            <MarkerView coordinate={pinCoord} anchor={{ x: 0.5, y: 1 }}>
              <Image
                source={require("@/assets/images/marker-home.png")}
                style={{ width: 32, height: 40 }}
                resizeMode="contain"
              />
            </MarkerView>
          )}
        </MapView>

        {address && (
          <View
            className="absolute top-4 left-4 right-4 bg-white rounded-xl shadow-lg p-4"
            style={{ elevation: 5, zIndex: 1000 }}
          >
            <Text className="text-sm font-pmedium text-gray-800">
              Current Pin Location
              {areCoordinatesEqual(pinCoord, userLocation) &&
                " (Your Location)"}
            </Text>
            <Text className="text-sm text-gray-600 mt-1">{address}</Text>
          </View>
        )}

        <View className="absolute bottom-4 left-4" style={{ zIndex: 999 }}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={{ width: 170, height: 30, opacity: 0.5 }}
            resizeMode="cover"
          />
        </View>
      </View>

      <View className="p-4 bg-white border-t border-gray-200">
        <TouchableOpacity
          className="bg-primary py-3 rounded-xl"
          onPress={() => {
            if (pinCoord && address) {
              onSave({
                latitude: pinCoord[1],
                longitude: pinCoord[0],
                address,
              });
            }
          }}
          disabled={!pinCoord || !address || loading}
        >
          <Text className="text-white text-center font-pbold">
            {loading ? "Saving..." : "Save Location"}
          </Text>
        </TouchableOpacity>

        {hasLocationPermission && userLocation && (
          <TouchableOpacity
            className="bg-blue-500 py-3 rounded-xl mt-2"
            onPress={handlePinMyLocation}
          >
            <Text className="text-white text-center font-pbold">
              Pin My Location
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
