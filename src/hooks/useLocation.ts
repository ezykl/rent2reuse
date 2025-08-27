import { useState, useEffect, useCallback, useRef } from "react";
import * as Location from "expo-location";
import {
  LocationUtils,
  UserLocation,
  Position,
  DistanceResult,
} from "../utils/locationUtils";

interface UseLocationOptions {
  autoStart?: boolean;
  watchLocation?: boolean;
  accuracy?: Location.LocationAccuracy;
  showErrorAlerts?: boolean;
}

interface UseLocationReturn {
  userLocation: UserLocation | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
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
  } = options;

  // State
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Refs
  const isWatching = useRef<boolean>(false);
  const mounted = useRef<boolean>(true);

  // Get current location
  const getCurrentLocation = useCallback(async (): Promise<void> => {
    if (!mounted.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const location = await LocationUtils.Service.getCurrentLocation({
        accuracy,
        showErrorAlert: showErrorAlerts,
      });

      if (mounted.current) {
        if (location) {
          setUserLocation(location);
          setHasPermission(true);
        } else {
          setError("Unable to get location");
          setHasPermission(false);
        }
      }
    } catch (err: any) {
      if (mounted.current) {
        setError(err.message || "Location error occurred");
        setHasPermission(false);
      }
    } finally {
      if (mounted.current) {
        setIsLoading(false);
      }
    }
  }, [accuracy, showErrorAlerts]);

  // Start watching location
  const startWatching = useCallback(async (): Promise<void> => {
    if (isWatching.current) return;

    const success = await LocationUtils.Service.startWatchingLocation(
      (location) => {
        if (mounted.current) {
          setUserLocation(location);
          setHasPermission(true);
          setError(null);
        }
      },
      (err) => {
        if (mounted.current) {
          setError(err.message || "Location watching error");
        }
      },
      { accuracy }
    );

    isWatching.current = success;
  }, [accuracy]);

  // Stop watching location
  const stopWatching = useCallback((): void => {
    LocationUtils.Service.stopWatchingLocation();
    isWatching.current = false;
  }, []);

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
    await getCurrentLocation();
  }, [getCurrentLocation]);

  // Effects
  useEffect(() => {
    mounted.current = true;

    // Auto start if enabled
    if (autoStart) {
      getCurrentLocation();
    }

    // Start watching if enabled
    if (watchLocation) {
      startWatching();
    }

    // Cleanup
    return () => {
      mounted.current = false;
      if (isWatching.current) {
        stopWatching();
      }
    };
  }, [
    autoStart,
    watchLocation,
    getCurrentLocation,
    startWatching,
    stopWatching,
  ]);

  return {
    userLocation,
    isLoading,
    error,
    hasPermission,
    refreshLocation,
    startWatching,
    stopWatching,
    calculateDistanceTo,
    isWithinRadius,
  };
};

// Hook for calculating distances to multiple items
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
