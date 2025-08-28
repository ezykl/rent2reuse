import { useState, useEffect, useCallback, useRef } from "react";
import * as Location from "expo-location";
import {
  LocationUtils,
  UserLocation,
  Position,
  DistanceResult,
} from "../utils/locationUtils";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

interface UseLocationOptions {
  autoStart?: boolean;
  watchLocation?: boolean;
  accuracy?: Location.LocationAccuracy;
  showErrorAlerts?: boolean;
  updateInterval?: number; // NEW: Update interval in milliseconds (default 5 minutes)
}

interface StoredLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

interface UseLocationReturn {
  userLocation: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  isUsingStoredLocation: boolean;
  firestoreLocation: StoredLocation | null;
  lastUpdated: Date | null; // NEW: Track when location was last updated
  refreshLocation: () => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  calculateDistanceTo: (location: Position) => DistanceResult | null;
  isWithinRadius: (location: Position, radiusInMeters: number) => boolean;
}

export const useLocation = (
  options: UseLocationOptions = {}
): UseLocationReturn => {
  const {
    autoStart = true,
    watchLocation = false,
    accuracy = Location.Accuracy.Balanced,
    showErrorAlerts = true,
    updateInterval = 5 * 60 * 1000, // Default: 5 minutes
  } = options;

  // State
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isUsingStoredLocation, setIsUsingStoredLocation] = useState(false);
  const [storedLocation, setStoredLocation] = useState<StoredLocation | null>(
    null
  );
  const [firestoreLocation, setFirestoreLocation] =
    useState<StoredLocation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Refs
  const isWatching = useRef<boolean>(false);
  const mounted = useRef<boolean>(true);
  const locationInterval = useRef<NodeJS.Timeout | null>(null);

  // Get stored location from Firestore
  const fetchStoredLocation = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists() && userDoc.data().location) {
        const location = userDoc.data().location;
        if (location.latitude && location.longitude) {
          const storedLoc = {
            latitude: location.latitude,
            longitude: location.longitude,
            address: location.address,
          };
          setFirestoreLocation(storedLoc);
          return storedLoc;
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching stored location:", error);
      return null;
    }
  };

  // Get current location (single fetch)
  const getCurrentLocation = useCallback(
    async (isInitial: boolean = false): Promise<void> => {
      if (!mounted.current) return;

      setIsLoading(true);
      setError(null);

      // Fetch stored location on initial load
      if (isInitial) {
        await fetchStoredLocation();
      }

      try {
        const { status } = await Location.getForegroundPermissionsAsync();

        if (status === "granted") {
          setHasPermission(true);

          const location = await LocationUtils.Service.getCurrentLocation({
            accuracy,
            showErrorAlert: showErrorAlerts,
          });

          if (mounted.current && location) {
            setUserLocation(location);
            setIsUsingStoredLocation(false);
            setLastUpdated(new Date());
            return;
          }
        }

        // If we reach here, either no permission or failed to get location
        // Use firestore location if available
        if (firestoreLocation) {
          setUserLocation({
            latitude: firestoreLocation.latitude,
            longitude: firestoreLocation.longitude,
          });
          setIsUsingStoredLocation(true);
          setHasPermission(false);
          if (isInitial) setLastUpdated(new Date());
        } else {
          setUserLocation(null);
          setHasPermission(false);
          setError("Location not available");
        }
      } catch (err: any) {
        console.error("Location error:", err);
        // Use firestore location as fallback
        if (firestoreLocation) {
          setUserLocation({
            latitude: firestoreLocation.latitude,
            longitude: firestoreLocation.longitude,
          });
          setIsUsingStoredLocation(true);
          if (isInitial) setLastUpdated(new Date());
        }
      } finally {
        if (mounted.current) {
          setIsLoading(false);
        }
      }
    },
    [accuracy, showErrorAlerts, firestoreLocation]
  );

  // Start periodic location updates
  const startPeriodicUpdates = useCallback((): void => {
    if (locationInterval.current) return; // Already running

    locationInterval.current = setInterval(async () => {
      if (mounted.current && hasPermission) {
        console.log("Updating location (5-minute interval)...");
        await getCurrentLocation(false);
      }
    }, updateInterval);
  }, [getCurrentLocation, updateInterval, hasPermission]);

  // Stop periodic updates
  const stopPeriodicUpdates = useCallback((): void => {
    if (locationInterval.current) {
      clearInterval(locationInterval.current);
      locationInterval.current = null;
    }
  }, []);

  // Start watching location (now uses periodic updates instead of continuous watching)
  const startWatching = useCallback(async (): Promise<void> => {
    if (isWatching.current) return;

    // Get initial location
    await getCurrentLocation(false);

    // Start periodic updates
    startPeriodicUpdates();
    isWatching.current = true;
  }, [getCurrentLocation, startPeriodicUpdates]);

  // Stop watching location
  const stopWatching = useCallback((): void => {
    stopPeriodicUpdates();
    isWatching.current = false;
  }, [stopPeriodicUpdates]);

  // Calculate distance to a location
  const calculateDistanceTo = useCallback(
    (location: Position): DistanceResult | null => {
      if (!userLocation) return null;
      return LocationUtils.Distance.calculateUserToItemDistance(
        userLocation,
        location
      );
    },
    [userLocation]
  );

  // Check if within radius
  const isWithinRadius = useCallback(
    (location: Position, radiusInMeters: number): boolean => {
      if (!userLocation) return false;
      return LocationUtils.Distance.isWithinRadius(
        userLocation,
        location,
        radiusInMeters
      );
    },
    [userLocation]
  );

  // Refresh location (manual trigger)
  const refreshLocation = useCallback(async (): Promise<void> => {
    await getCurrentLocation(false);
  }, [getCurrentLocation]);

  // Effects
  useEffect(() => {
    mounted.current = true;

    // Auto start if enabled (initial fetch + setup)
    if (autoStart) {
      getCurrentLocation(true); // Initial load with Firestore fetch
    }

    // Start periodic watching if enabled
    if (watchLocation) {
      startWatching();
    }

    // Cleanup
    return () => {
      mounted.current = false;
      stopPeriodicUpdates();
      if (isWatching.current) {
        stopWatching();
      }
    };
  }, [autoStart, watchLocation]);

  // Start periodic updates when permission is granted
  useEffect(() => {
    if (hasPermission && watchLocation && !locationInterval.current) {
      startPeriodicUpdates();
    } else if (!hasPermission && locationInterval.current) {
      stopPeriodicUpdates();
    }
  }, [hasPermission, watchLocation, startPeriodicUpdates, stopPeriodicUpdates]);

  return {
    userLocation,
    firestoreLocation,
    isLoading,
    error,
    hasPermission,
    isUsingStoredLocation,
    lastUpdated,
    refreshLocation,
    startWatching,
    stopWatching,
    calculateDistanceTo,
    isWithinRadius,
  };
};

// Hook for calculating distances to multiple items (unchanged)
interface UseItemDistancesOptions {
  items: Array<Position & { id: string }>;
  sortByDistance?: boolean;
}

interface UseItemDistancesReturn {
  itemsWithDistances: Array<
    Position & { id: string; distance: DistanceResult | null }
  >;
  userLocation: UserLocation | null;
  isLoading: boolean;
  refreshDistances: () => void;
}

export const useItemDistances = (
  options: UseItemDistancesOptions
): UseItemDistancesReturn => {
  const { items, sortByDistance = false } = options;
  const { userLocation, isLoading, refreshLocation } = useLocation();

  const [itemsWithDistances, setItemsWithDistances] = useState<
    Array<Position & { id: string; distance: DistanceResult | null }>
  >([]);

  // Calculate distances when user location or items change
  useEffect(() => {
    if (userLocation && items.length > 0) {
      const distances = LocationUtils.Distance.calculateMultipleDistances(
        userLocation,
        items
      );

      let itemsWithDist = items.map((item) => ({
        ...item,
        distance: distances.find((d) => d.id === item.id)?.distance || null,
      }));

      // Sort by distance if requested
      if (sortByDistance) {
        itemsWithDist = itemsWithDist.sort((a, b) => {
          if (!a.distance || !b.distance) return 0;
          return a.distance.kilometers - b.distance.kilometers;
        });
      }

      setItemsWithDistances(itemsWithDist);
    } else {
      // No user location, set distances to null
      setItemsWithDistances(items.map((item) => ({ ...item, distance: null })));
    }
  }, [userLocation, items, sortByDistance]);

  const refreshDistances = useCallback(() => {
    refreshLocation();
  }, [refreshLocation]);

  return {
    itemsWithDistances,
    userLocation,
    isLoading,
    refreshDistances,
  };
};
