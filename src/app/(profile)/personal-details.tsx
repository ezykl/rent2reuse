import React, { useState, useEffect, useRef } from "react";
import {
  MapView,
  Camera,
  MarkerView,
  PointAnnotation,
} from "@maplibre/maplibre-react-native";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { ALERT_TYPE, Toast } from "react-native-alert-notification";
import { MAP_TILER_API_KEY, OPEN_CAGE_API_KEY } from "@env";

const CEBU_COORDINATES = {
  latitude: 10.3157,
  longitude: 123.8854,
};

const MAP_BOUNDS = {
  ne: [124.0854, 10.4157], // Northeast bounds of Cebu City
  sw: [123.7854, 10.2157], // Southwest bounds of Cebu City
};

const MIN_ZOOM_LEVEL = 12; // Adjusted to show a wider area
const MAX_ZOOM_LEVEL = 22; // Adjusted to limit closer zoom

const PersonalDetails = () => {
  interface SearchResult {
    coordinates: [number, number];
    address: string;
    placeType?: string;
  }

  interface LocationCoordinates {
    latitude: number;
    longitude: number;
  }

  const mapRef = useRef<any>();
  const cameraRef = useRef<any>();
  const [pinCoord, setPinCoord] = useState<[number, number]>();
  const [initialRegion, setInitialRegion] = useState<[number, number]>([
    123.8854, 10.3157,
  ]); // Default to Cebu
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [address, setAddress] = useState("");
  const [currentZoom, setCurrentZoom] = useState(14);

  const requestAndUpdateLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "Permission Required",
          textBody: "Please enable location services to use this feature",
        });
        // If permission denied, center on Cebu City
        setInitialRegion([
          CEBU_COORDINATES.longitude,
          CEBU_COORDINATES.latitude,
        ]);
        setPinCoord([CEBU_COORDINATES.longitude, CEBU_COORDINATES.latitude]);
        // Center camera on Cebu
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [
              CEBU_COORDINATES.longitude,
              CEBU_COORDINATES.latitude,
            ],
            zoomLevel: 14,
            animationDuration: 1000,
          });
        }
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { longitude, latitude } = location.coords;

      // Check if location is within Cebu City bounds
      if (
        longitude >= MAP_BOUNDS.sw[0] &&
        longitude <= MAP_BOUNDS.ne[0] &&
        latitude >= MAP_BOUNDS.sw[1] &&
        latitude <= MAP_BOUNDS.ne[1]
      ) {
        setInitialRegion([longitude, latitude]);
        setPinCoord([longitude, latitude]);
        // Center camera on user location
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [longitude, latitude],
            zoomLevel: 14,
            animationDuration: 1000,
          });
        }
      } else {
        // If outside Cebu, center on Cebu City
        setInitialRegion([
          CEBU_COORDINATES.longitude,
          CEBU_COORDINATES.latitude,
        ]);
        setPinCoord([CEBU_COORDINATES.longitude, CEBU_COORDINATES.latitude]);
        // Center camera on Cebu
        if (cameraRef.current) {
          cameraRef.current.setCamera({
            centerCoordinate: [
              CEBU_COORDINATES.longitude,
              CEBU_COORDINATES.latitude,
            ],
            zoomLevel: 14,
            animationDuration: 1000,
          });
        }
        Toast.show({
          type: ALERT_TYPE.INFO,
          title: "Location Notice",
          textBody: "This app is limited to Cebu City area",
        });
      }

      // Get address for location
      const response = await fetch(
        `https://api.data.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPEN_CAGE_API_KEY}`
      );
      const data = await response.json();
      const formattedAddress = data.results[0]?.formatted || "";
      setAddress(formattedAddress);
    } catch (error) {
      console.error("Error getting location:", error);
      // Center on Cebu City if there's an error
      setInitialRegion([CEBU_COORDINATES.longitude, CEBU_COORDINATES.latitude]);
      setPinCoord([CEBU_COORDINATES.longitude, CEBU_COORDINATES.latitude]);
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [
            CEBU_COORDINATES.longitude,
            CEBU_COORDINATES.latitude,
          ],
          zoomLevel: 14,
          animationDuration: 1000,
        });
      }
    }
  };

  useEffect(() => {
    requestAndUpdateLocation();
  }, []);

  const animateToLocation = (longitude: number, latitude: number) => {
    if (cameraRef.current) {
      cameraRef.current.flyTo([longitude, latitude], 1000);
    }
  };

  const fitToCebuBounds = () => {
    if (cameraRef.current) {
      cameraRef.current.fitBounds(
        MAP_BOUNDS.ne,
        MAP_BOUNDS.sw,
        [50, 50, 50, 50], // padding
        1000 // animation duration
      );
    }
  };

  const handleMapPress = async (event: any) => {
    const coords = event.geometry.coordinates;
    setPinCoord(coords);

    // Center camera on pressed location
    if (cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: coords,
        zoomLevel: Math.max(currentZoom, MIN_ZOOM_LEVEL), // Use current zoom but not less than minimum
        animationDuration: 1000,
      });
    }

    const [lng, lat] = coords;
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lng}&key=${OPEN_CAGE_API_KEY}`
    );
    const data = await response.json();
    const formattedAddress = data.results[0]?.formatted || "";
    setAddress(formattedAddress);
    console.log("Formatted Address:", formattedAddress);
    console.log("Address ", address);
  };

  const handleSearchInput = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearch = async () => {
    if (searchQuery.length < 3) {
      Toast.show({
        type: ALERT_TYPE.WARNING,
        title: "Search Query Too Short",
        textBody: "Please enter at least 3 characters to search",
      });
      return;
    }

    try {
      setIsSearching(true);
      const results = await Location.geocodeAsync(searchQuery);

      if (results.length === 0) {
        setSearchResults([]);
        Toast.show({
          type: ALERT_TYPE.WARNING,
          title: "No Results",
          textBody: "No locations found for your search",
        });
        return;
      }

      // Get detailed addresses for results
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
      console.error("Error searching location:", error);
      Toast.show({
        type: ALERT_TYPE.DANGER,
        title: "Error",
        textBody: "Failed to search location. Please try again.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (location: any) => {
    const [longitude, latitude] = location.coordinates;
    setPinCoord(location.coordinates);
    setAddress(location.address);
    animateToLocation(longitude, latitude);
    setSearchResults([]); // Clear search results
    setSearchQuery(location.address); // Update search input with selected address
  };

  return (
    <View className="flex-1 bg-white mt-6">
      {/* Search Section */}
      <View className="p-4 bg-white shadow-lg z-50 relative">
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 px-4 py-4 bg-gray-100 rounded-xl"
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

        {/* Search Results - Only show if we have results */}
        {searchResults.length > 0 && (
          <ScrollView className="mt-2 max-h-40 bg-white rounded-lg border border-gray-200">
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={index}
                className="p-3 border-b border-gray-100"
                onPress={() => handleSelectLocation(result)}
              >
                <Text className="text-sm text-gray-600">{result.address}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Map Section */}
      <View className="flex-1 relative">
        {/* Current Pin Address */}
        {address && (
          <View
            style={{
              position: "absolute",
              zIndex: 10,
              alignSelf: "center",
              backgroundColor: "white",
              top: 10,
              padding: 10,
              borderRadius: 10,
            }}
          >
            <Text className="text-sm font-pmedium text-gray-800">
              Current Pin Location:
            </Text>
            <Text className="text-sm text-gray-600 mt-1">{address}</Text>
          </View>
        )}
        <View
          style={{ position: "absolute", bottom: 10, left: 10, zIndex: 10 }}
        >
          <Image
            source={require("@/assets/images/logo.png")}
            style={{ width: 170, height: 30 }}
            resizeMode="cover"
          />
        </View>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          // logoEnabled={true}
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

          {pinCoord && (
            <MarkerView coordinate={pinCoord} anchor={{ x: 0.5, y: 1 }}>
              <View className="items-center">
                <View className="bg-white p-2 rounded-lg shadow-md mb-2">
                  <Text className="text-xs text-gray-800">
                    {address.split(",")[0]}
                  </Text>
                </View>
                <Image
                  source={require("@/assets/images/marker-home.png")}
                  style={{ width: 32, height: 40 }}
                  resizeMode="contain"
                />
              </View>
            </MarkerView>
          )}
        </MapView>
      </View>

      {/* Save Button - Fixed at bottom */}
      <View className="p-4 bg-white shadow-lg">
        <TouchableOpacity
          className="w-full bg-primary py-3 rounded-xl"
          onPress={() => {
            console.log("Location:", { coordinates: pinCoord, address });
          }}
        >
          <Text className="text-white text-center font-pbold text-lg">
            Save Location
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PersonalDetails;
