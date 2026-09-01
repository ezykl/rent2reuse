// utils/locationUtils.ts
import { Alert, Linking } from "react-native";
import * as Location from "expo-location";

// TypeScript interfaces
export interface Position {
  latitude: number;
  longitude: number;
}

export interface UserLocation extends Position {
  accuracy?: number;
  timestamp?: number;
}

export interface LocationError {
  code: string;
  message: string;
}

export interface DistanceResult {
  kilometers: number;
  meters: number;
  formatted: string;
}

// Location permission utilities
export class LocationPermissionManager {
  static async checkLocationServices(): Promise<boolean> {
    try {
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          "Location Services Disabled",
          "Please enable location services in your device settings to use this feature.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
      return isEnabled;
    } catch (error) {
      console.log("Error checking location services:", error);
      return false;
    }
  }

  static async requestLocationPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Please allow location access to show your position and calculate distances.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.log("Error requesting location permissions:", error);
      return false;
    }
  }

  static async checkAndRequestPermissions(): Promise<boolean> {
    const servicesEnabled = await this.checkLocationServices();
    if (!servicesEnabled) return false;

    return await this.requestLocationPermissions();
  }
}

// Core location utilities
export class LocationService {
  private static locationSubscription: Location.LocationSubscription | null =
    null;

  static async getCurrentLocation(options?: {
    accuracy?: Location.LocationAccuracy;
    timeout?: number;
    showErrorAlert?: boolean;
  }): Promise<UserLocation | null> {
    const {
      accuracy = Location.Accuracy.Balanced,
      timeout = 15000,
      showErrorAlert = true,
    } = options || {};

    try {
      // Check permissions first
      const hasPermission =
        await LocationPermissionManager.checkAndRequestPermissions();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy,
        timeInterval: 5000,
        distanceInterval: 10,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };
    } catch (error: any) {
      console.log("Location error:", error);
      if (showErrorAlert) {
        LocationService.handleLocationError(error);
      }
      return null;
    }
  }

  static async startWatchingLocation(
    onLocationUpdate: (location: UserLocation) => void,
    onError?: (error: any) => void,
    options?: {
      accuracy?: Location.LocationAccuracy;
      timeInterval?: number;
      distanceInterval?: number;
    }
  ): Promise<boolean> {
    const {
      accuracy = Location.Accuracy.Balanced,
      timeInterval = 10000,
      distanceInterval = 50,
    } = options || {};

    try {
      const hasPermission =
        await LocationPermissionManager.checkAndRequestPermissions();
      if (!hasPermission) return false;

      // Stop any existing subscription
      this.stopWatchingLocation();

      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy,
          timeInterval,
          distanceInterval,
        },
        (location) => {
          onLocationUpdate({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          });
        }
      );

      return true;
    } catch (error) {
      console.log("Error starting location watch:", error);
      if (onError) onError(error);
      return false;
    }
  }

  static stopWatchingLocation(): void {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  private static handleLocationError(error: any): void {
    let title = "Location Error";
    let message = "Unable to get your current location.";
    let showSettings = false;

    if (error.message?.includes("Location request timed out")) {
      title = "Location Timeout";
      message =
        "Location request timed out. Please make sure you have a clear view of the sky and try again.";
    } else if (error.message?.includes("Location services are disabled")) {
      title = "Location Services Disabled";
      message = "Please enable location services in your device settings.";
      showSettings = true;
    } else if (error.message?.includes("Location permission")) {
      title = "Location Permission Required";
      message = "Please allow location access in your device settings.";
      showSettings = true;
    } else if (error.message?.includes("Network")) {
      title = "Network Error";
      message =
        "Unable to get location due to network issues. Please check your internet connection.";
    } else {
      message = `${
        error.message || "Please try again or check your location settings."
      }`;
    }

    const buttons = [{ text: "OK", style: "default" as const }];

    if (showSettings) {
      buttons.unshift({
        text: "Open Settings",
        onPress: () => Linking.openSettings(),
      } as any);
    }

    Alert.alert(title, message, buttons);
  }
}

// Distance calculation utilities
export class DistanceCalculator {
  // Calculate distance between two points using Haversine formula
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): DistanceResult {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const kilometers = R * c;
    const meters = kilometers * 1000;

    return {
      kilometers,
      meters,
      formatted: this.formatDistance(kilometers),
    };
  }

  // Calculate distance between user location and item location
  static calculateUserToItemDistance(
    userLocation: Position,
    itemLocation: Position
  ): DistanceResult {
    return this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      itemLocation.latitude,
      itemLocation.longitude
    );
  }

  // Check if user is within pickup radius
  static isWithinRadius(
    userLocation: Position,
    itemLocation: Position,
    radiusInMeters: number
  ): boolean {
    const distance = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      itemLocation.latitude,
      itemLocation.longitude
    );
    return distance.meters <= radiusInMeters;
  }

  // Format distance for display
  private static formatDistance(kilometers: number): string {
    if (kilometers < 1) {
      return `${Math.round(kilometers * 1000)}m`;
    } else if (kilometers < 10) {
      return `${kilometers.toFixed(1)}km`;
    } else {
      return `${Math.round(kilometers)}km`;
    }
  }

  // Get multiple distances (useful for sorting items by distance)
  static calculateMultipleDistances(
    userLocation: Position,
    locations: Array<Position & { id: string }>
  ): Array<{ id: string; distance: DistanceResult }> {
    return locations.map((location) => ({
      id: location.id,
      distance: this.calculateUserToItemDistance(userLocation, location),
    }));
  }

  // Sort locations by distance
  static sortByDistance<T extends Position & { id: string }>(
    userLocation: Position,
    locations: T[]
  ): T[] {
    return locations.sort((a, b) => {
      const distanceA = this.calculateUserToItemDistance(userLocation, a);
      const distanceB = this.calculateUserToItemDistance(userLocation, b);
      return distanceA.kilometers - distanceB.kilometers;
    });
  }
}

// Navigation utilities
export class NavigationHelper {
  // Open location in Google Maps (view only)
  static async openInGoogleMaps(
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<void> {
    const label = address || "Location";
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}&query_place_id=${encodeURIComponent(
      label
    )}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log("Error opening Google Maps:", error);
      Alert.alert("Error", "Unable to open Google Maps");
    }
  }

  // Get directions to location
  static async getDirectionsToLocation(
    latitude: number,
    longitude: number,
    address?: string
  ): Promise<void> {
    const label = address || "Destination";
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${encodeURIComponent(
      label
    )}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.log("Error opening directions:", error);
      Alert.alert("Error", "Unable to open directions");
    }
  }
}

// Main utility class that combines all services
export class LocationUtils {
  static Permission = LocationPermissionManager;
  static Service = LocationService;
  static Distance = DistanceCalculator;
  static Navigation = NavigationHelper;

  // Convenience method for common use case
  static async getUserLocationAndCalculateDistance(
    itemLocation: Position
  ): Promise<{
    userLocation: UserLocation | null;
    distance: DistanceResult | null;
    isWithinRadius: boolean;
  }> {
    const userLocation = await LocationService.getCurrentLocation();

    if (!userLocation) {
      return {
        userLocation: null,
        distance: null,
        isWithinRadius: false,
      };
    }

    const distance = DistanceCalculator.calculateUserToItemDistance(
      userLocation,
      itemLocation
    );

    return {
      userLocation,
      distance,
      isWithinRadius: true, // You can add radius check here if needed
    };
  }
}
