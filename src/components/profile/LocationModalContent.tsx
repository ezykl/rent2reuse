import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
} from "react-native";
import {
  MapView,
  Camera,
  MarkerView,
  ShapeSource,
  CircleLayer,
  FillLayer,
  SymbolLayer,
} from "@maplibre/maplibre-react-native";
import { OPEN_CAGE_API_KEY, MAP_TILER_API_KEY } from "@env";

import * as Location from "expo-location";
import { icons } from "@/constant";
// Remove the Toast import since we're displaying errors in the view now

const CEBU_COORDINATES = {
  latitude: 10.296581,
  longitude: 123.906541,
};

const MAP_BOUNDS = {
  ne: [123.80664825439452, 10.20673915914469],
  sw: [124.00234222412107, 10.41075861313864],
};

const MIN_ZOOM_LEVEL = 15;
const MAX_ZOOM_LEVEL = 22;

// Update the helper function with proper API key OPENCAGE
const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPEN_CAGE_API_KEY}`
    );
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
    return data.results[0]?.formatted || "";
  } catch (error) {
    console.log("Error fetching address:", error);
    return "";
  }
};

// Helper function to create a circle polygon
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
  coords.push(coords[0]); // Close the polygon

  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
    properties: {},
  };
};

// Add this helper to check if coordinates are the same
const areCoordinatesEqual = (
  coord1: [number, number] | undefined,
  coord2: [number, number] | null
): boolean => {
  if (!coord1 || !coord2) return false;
  return coord1[0] === coord2[0] && coord1[1] === coord2[1];
};

const isWithinCebuBounds = (coords: [number, number]): boolean => {
  const [longitude, latitude] = coords;

  //Cebu City bounds
  const PRECISE_CEBU_BOUNDS = {
    north: 10.45, // Northern limit
    south: 10.2, // Southern limit
    east: 123.95, // Eastern limit
    west: 123.75, // Western limit
  };

  return (
    longitude >= PRECISE_CEBU_BOUNDS.west &&
    longitude <= PRECISE_CEBU_BOUNDS.east &&
    latitude >= PRECISE_CEBU_BOUNDS.south &&
    latitude <= PRECISE_CEBU_BOUNDS.north
  );
};

interface LocationModalContentProps {
  onSave: (location: {
    latitude: number;
    longitude: number;
    address: string;
    radius?: number;
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
  const [showCircleRadius, setShowCircleRadius] = useState(true);
  const [selectedRadius, setSelectedRadius] = useState(100); // Changed to 100m default
  const [showRadiusSelector, setShowRadiusSelector] = useState(false);

  // Add error state for displaying errors in the note view
  const [errorMessage, setErrorMessage] = useState<string>("");

  console.log("Debug Location Button:", {
    hasLocationPermission,
    userLocation,
    isWithinBounds: userLocation ? isWithinCebuBounds(userLocation) : false,
  });

  const circleFeature = useMemo(() => {
    if (!pinCoord || !showCircleRadius) return null;
    return createCirclePolygon(pinCoord, selectedRadius);
  }, [pinCoord, selectedRadius, showCircleRadius]);

  const radiusOptions = [
    { value: 25, label: "25m" },
    { value: 50, label: "50m" },
    { value: 100, label: "100m" },
    { value: 250, label: "250m" },
    { value: 500, label: "500m" },
    { value: 1000, label: "1km" },
    { value: 1500, label: "1.5km" },
    { value: 2000, label: "2km" },
  ];

  const updatePinLocation = async (coords: [number, number]) => {
    // Check if coordinates are within Cebu bounds
    if (!isWithinCebuBounds(coords)) {
      setErrorMessage("Please select a location within Cebu City limits");
      return;
    }

    // Clear any previous error
    setErrorMessage("");
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
      console.log("Requesting location permission...");

      // First check if permissions are already granted
      let { status } = await Location.getForegroundPermissionsAsync();

      if (status !== "granted") {
        console.log("Permission not granted, requesting...");
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }

      console.log("Permission status:", status);
      setHasLocationPermission(status === "granted");

      setInitialRegion(pinCoord);
      if (status !== "granted") {
        setErrorMessage(
          "Location permission is required to show your current location"
        );
        return;
      }

      console.log("Getting current position...");

      // Get location with better options
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("Got location:", location.coords);
      const { latitude, longitude } = location.coords;
      const userCoords: [number, number] = [longitude, latitude];

      console.log("Checking if within bounds...", {
        longitude,
        latitude,
        bounds: MAP_BOUNDS,
      });

      // Check if location is within your map bounds
      if (location) {
        if (
          longitude >= MAP_BOUNDS.sw[0] &&
          longitude <= MAP_BOUNDS.ne[0] &&
          latitude >= MAP_BOUNDS.sw[1] &&
          latitude <= MAP_BOUNDS.ne[1]
        ) {
          console.log("Location is within bounds, setting userLocation");
          setUserLocation(userCoords);
          await updatePinLocation(userCoords);
        } else {
          console.log("Location is outside bounds");
          setErrorMessage(
            "You appear to be outside the Cebu City area. The app is limited to Cebu City locations."
          );
          // Still set the user location for the button to show
          setUserLocation(userCoords);
        }
      } else {
        setErrorMessage("Unable to get your current location.");
      }
    } catch (error) {
      console.log("Error getting location:", error);
      setErrorMessage(
        "Failed to get your location. Please try again or search for a location manually."
      );
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
      setErrorMessage("Please enter at least 3 characters to search");
      return;
    }

    try {
      setIsSearching(true);
      setErrorMessage(""); // Clear any previous error
      const results = await Location.geocodeAsync(searchQuery);

      if (results.length === 0) {
        setSearchResults([]);
        setErrorMessage("No locations found for your search");
        return;
      }

      const detailedResults = await Promise.all(
        results.map(async (result) => {
          const { latitude, longitude } = result;
          const response = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPEN_CAGE_API_KEY}`
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
      setErrorMessage("Failed to search location. Please try again.");
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
      {/* Note view with error handling */}
      <View
        className={`p-2 m-4 mb-0 rounded-xl border ${
          errorMessage
            ? "bg-red-400/10 border-red-300"
            : "bg-orange-400/10 border-orange-300"
        }`}
      >
        <Text
          className={`text-xs font-pmedium text-center ${
            errorMessage ? "text-red-500" : "text-orange-500"
          }`}
        >
          {errorMessage ||
            "Note: Please pin the exact location where the item will be available for pickup. This helps interested renters find the item easily and ensures a smooth handover."}
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
          <ScrollView className="relative mt-2 rounded-lg ">
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
          mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${MAP_TILER_API_KEY}`}
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

          {/* Add circle radius layer */}
          {circleFeature && (
            <ShapeSource id="circle-radius-source" shape={circleFeature}>
              <FillLayer
                id="circle-radius-fill"
                style={{
                  fillColor: "rgba(33, 150, 243, 0.15)",
                  fillOutlineColor: "#2196F3",
                }}
              />
            </ShapeSource>
          )}

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

        {showRadiusSelector && (
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-lg p-4"
            style={{ zIndex: 1001 }}
          >
            <View className="flex-row justify-between items-center mb-4 mx-2">
              <Text className="text-lg font-pbold text-gray-800">
                Select Radius
              </Text>
              <TouchableOpacity onPress={() => setShowRadiusSelector(false)}>
                <Text className="text-primary font-pmedium">Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {radiusOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className={`mr-3 px-4 py-2 rounded-full ${
                    selectedRadius === option.value
                      ? "bg-primary"
                      : "bg-gray-200"
                  }`}
                  onPress={() => {
                    console.log("Selecting radius:", option.value);
                    setSelectedRadius(option.value);
                  }}
                >
                  <Text
                    className={`font-pmedium ${
                      selectedRadius === option.value
                        ? "text-white"
                        : "text-gray-600"
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-sm text-gray-600 text-center">
              Selected radius:{" "}
              {selectedRadius >= 1000
                ? `${selectedRadius / 1000}km`
                : `${selectedRadius}m`}
            </Text>
          </View>
        )}

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

        {hasLocationPermission &&
          userLocation &&
          isWithinCebuBounds(userLocation) && (
            <TouchableOpacity
              className="absolute bottom-2 right-4 bg-blue-500/55 rounded-full p-3 shadow-xl"
              style={{
                elevation: 10,
                zIndex: 999,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
              }}
              onPress={handlePinMyLocation}
              activeOpacity={0.8}
            >
              <Image
                source={icons.crosshair}
                style={{ width: 24, height: 24, tintColor: "white" }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
      </View>

      <View className="p-4 bg-white border-t border-gray-200">
        {/* Show controls only when pin is placed - Show/Hide Radius and Radius selector */}
        {pinCoord && address && (
          <View className="flex-row gap-2 mb-2">
            {/* Show/Hide Radius button */}
            <TouchableOpacity
              className={`px-4 py-3 rounded-xl ${
                showCircleRadius ? "bg-blue-500" : "bg-gray-400"
              }`}
              onPress={() => setShowCircleRadius(!showCircleRadius)}
            >
              <Image
                source={showCircleRadius ? icons.eye : icons.eyeHide}
                className="h-6 w-6 mx-4"
                tintColor="white"
              />
            </TouchableOpacity>

            {/* Radius selector button - only when circle is visible */}
            {pinCoord && (
              <TouchableOpacity
                className=" flex-1 py-3 min-w-10 bg-blue-500 rounded-xl"
                onPress={() => setShowRadiusSelector(true)}
              >
                <Text className="text-white text-center font-pmedium">
                  Pickup Radius:
                  {selectedRadius >= 1000
                    ? ` ${selectedRadius / 1000}km`
                    : ` ${selectedRadius}m`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Save Location button */}
        <TouchableOpacity
          className="bg-primary py-3 rounded-xl"
          onPress={() => {
            if (pinCoord && address && isWithinCebuBounds(pinCoord)) {
              onSave({
                latitude: pinCoord[1],
                longitude: pinCoord[0],
                address,
                radius: showCircleRadius ? selectedRadius : undefined,
              });
            } else if (pinCoord && !isWithinCebuBounds(pinCoord)) {
              setErrorMessage(
                "Please select a location within Cebu City limits."
              );
            }
          }}
          disabled={!pinCoord || !address || loading}
        >
          <Text className="text-white text-center font-pbold">
            {loading ? "Saving..." : "Save Location"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
