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

// OpenRouteService API configuration
const ORS_API_KEY =
  "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImIzY2FmNTg1NThhMTQ4OGM4NjhiNGIzZTIwZjY1YTJlIiwiaCI6Im11cm11cjY0In0=";
const ORS_BASE_URL = "https://api.openrouteservice.org/v2";

interface RouteDistanceResult extends DistanceResult {
  routeDistance: {
    meters: number;
    kilometers: number;
  };
  duration: number; // in seconds
  routeGeometry?: any; // GeoJSON geometry for the route
}

interface UseLocationOptions {
  autoStart?: boolean;
  watchLocation?: boolean;
  accuracy?: Location.LocationAccuracy;
  showErrorAlerts?: boolean;
  updateInterval?: number;
  useRouting?: boolean; // NEW: Enable route-based distance calculation
  routeProfile?: "driving-car" | "cycling-regular" | "foot-walking"; // NEW: Route profile
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
  lastUpdated: Date | null;
  refreshLocation: () => Promise<void>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  calculateDistanceTo: (location: Position) => DistanceResult | null;
  calculateRouteTo: (location: Position) => Promise<RouteDistanceResult | null>; // NEW
  isWithinRadius: (location: Position, radiusInMeters: number) => boolean;
  isWithinRouteRadius: (
    location: Position,
    radiusInMeters: number
  ) => Promise<boolean>; // NEW
}

// OpenRouteService API functions
class OpenRouteService {
  static async calculateRoute(
    start: Position,
    end: Position,
    profile: "driving-car" | "cycling-regular" | "foot-walking" = "driving-car"
  ): Promise<RouteDistanceResult | null> {
    try {
      const url = `${ORS_BASE_URL}/directions/cycling-regular`;
      const coordinates = [
        [start.longitude, start.latitude],
        [end.longitude, end.latitude],
      ];

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept:
            "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
          Authorization: ORS_API_KEY,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          coordinates,
          format: "json",
          instructions: false,
          geometry: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouteService API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const summary = route.summary;

        // Calculate straight-line distance for comparison
        const straightLineDistance =
          LocationUtils.Distance.calculateUserToItemDistance(start, end);

        return {
          ...straightLineDistance,
          routeDistance: {
            meters: summary.distance,
            kilometers: summary.distance / 1000,
          },
          duration: summary.duration,
          routeGeometry: route.geometry,
        };
      }

      return null;
    } catch (error) {
      console.error("Error calculating route:", error);
      return null;
    }
  }

  static async isWithinRouteRadius(
    start: Position,
    end: Position,
    radiusInMeters: number,
    profile: "driving-car" | "cycling-regular" | "foot-walking" = "driving-car"
  ): Promise<boolean> {
    try {
      const routeResult = await this.calculateRoute(start, end, profile);
      return routeResult
        ? routeResult.routeDistance.meters <= radiusInMeters
        : false;
    } catch (error) {
      console.error("Error checking route radius:", error);
      // Fallback to straight-line distance
      return LocationUtils.Distance.isWithinRadius(start, end, radiusInMeters);
    }
  }
}

export const useLocation = (
  options: UseLocationOptions = {}
): UseLocationReturn => {
  const {
    autoStart = true,
    watchLocation = false,
    accuracy = Location.Accuracy.Balanced,
    showErrorAlerts = true,
    updateInterval = 5 * 60 * 1000,
    useRouting = false,
    routeProfile = "driving-car",
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

  // Start watching location
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

  // Calculate straight-line distance to a location (original method)
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

  // NEW: Calculate route-based distance to a location
  const calculateRouteTo = useCallback(
    async (location: Position): Promise<RouteDistanceResult | null> => {
      if (!userLocation) return null;

      if (useRouting) {
        return await OpenRouteService.calculateRoute(
          userLocation,
          location,
          routeProfile
        );
      } else {
        // Fallback to straight-line distance if routing is disabled
        const straightDistance =
          LocationUtils.Distance.calculateUserToItemDistance(
            userLocation,
            location
          );
        return {
          ...straightDistance,
          routeDistance: {
            meters: straightDistance.meters,
            kilometers: straightDistance.kilometers,
          },
          duration: 0, // Unknown for straight-line
        };
      }
    },
    [userLocation, useRouting, routeProfile]
  );

  // Check if within radius (straight-line)
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

  // NEW: Check if within radius (route-based)
  const isWithinRouteRadius = useCallback(
    async (location: Position, radiusInMeters: number): Promise<boolean> => {
      if (!userLocation) return false;

      if (useRouting) {
        return await OpenRouteService.isWithinRouteRadius(
          userLocation,
          location,
          radiusInMeters,
          routeProfile
        );
      } else {
        // Fallback to straight-line distance
        return LocationUtils.Distance.isWithinRadius(
          userLocation,
          location,
          radiusInMeters
        );
      }
    },
    [userLocation, useRouting, routeProfile]
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
    calculateRouteTo, // NEW
    isWithinRadius,
    isWithinRouteRadius, // NEW
  };
};

// Enhanced hook for calculating distances to multiple items with routing support
interface UseItemDistancesOptions {
  items: Array<Position & { id: string }>;
  sortByDistance?: boolean;
  useRouting?: boolean; // NEW: Enable route-based calculations
  routeProfile?: "driving-car" | "cycling-regular" | "foot-walking"; // NEW
  batchSize?: number; // NEW: Batch API calls to avoid rate limits
}

interface ItemWithRouteDistance extends Position {
  id: string;
  distance: DistanceResult | null;
  routeDistance?: RouteDistanceResult | null; // NEW
}

interface UseItemDistancesReturn {
  itemsWithDistances: Array<ItemWithRouteDistance>;
  userLocation: UserLocation | null;
  isLoading: boolean;
  isCalculatingRoutes: boolean; // NEW: Separate loading state for route calculations
  refreshDistances: () => void;
  refreshRoutes: () => Promise<void>; // NEW: Refresh route distances
}

export const useItemDistances = (
  options: UseItemDistancesOptions
): UseItemDistancesReturn => {
  const {
    items,
    sortByDistance = false,
    useRouting = false,
    routeProfile = "driving-car",
    batchSize = 5, // Process 5 routes at a time to avoid rate limits
  } = options;

  const { userLocation, isLoading, refreshLocation } = useLocation({
    useRouting,
    routeProfile,
  });

  const [itemsWithDistances, setItemsWithDistances] = useState<
    Array<ItemWithRouteDistance>
  >([]);
  const [isCalculatingRoutes, setIsCalculatingRoutes] = useState(false);

  // Calculate straight-line distances
  const calculateStraightLineDistances = useCallback(() => {
    if (userLocation && items.length > 0) {
      const distances = LocationUtils.Distance.calculateMultipleDistances(
        userLocation,
        items
      );

      let itemsWithDist = items.map((item) => ({
        ...item,
        distance: distances.find((d) => d.id === item.id)?.distance || null,
        routeDistance: null, // Reset route distances
      }));

      // Sort by straight-line distance if requested and not using routing
      if (sortByDistance && !useRouting) {
        itemsWithDist = itemsWithDist.sort((a, b) => {
          if (!a.distance || !b.distance) return 0;
          return a.distance.kilometers - b.distance.kilometers;
        });
      }

      setItemsWithDistances(itemsWithDist);
      return itemsWithDist;
    } else {
      // No user location, set distances to null
      const emptyDistances = items.map((item) => ({
        ...item,
        distance: null,
        routeDistance: null,
      }));
      setItemsWithDistances(emptyDistances);
      return emptyDistances;
    }
  }, [userLocation, items, sortByDistance, useRouting]);

  // Calculate route distances in batches
  const calculateRouteDistances = useCallback(async () => {
    if (!userLocation || !useRouting || items.length === 0) return;

    setIsCalculatingRoutes(true);

    try {
      const currentItems = [...itemsWithDistances];

      // Process items in batches to avoid overwhelming the API
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Calculate routes for this batch
        const routePromises = batch.map(async (item) => {
          const routeResult = await OpenRouteService.calculateRoute(
            userLocation,
            item,
            routeProfile
          );
          return { id: item.id, routeResult };
        });

        const batchResults = await Promise.all(routePromises);

        // Update the items with route results
        batchResults.forEach(({ id, routeResult }) => {
          const itemIndex = currentItems.findIndex((item) => item.id === id);
          if (itemIndex >= 0) {
            currentItems[itemIndex] = {
              ...currentItems[itemIndex],
              routeDistance: routeResult,
            };
          }
        });

        // Update state after each batch
        setItemsWithDistances([...currentItems]);

        // Add a small delay between batches to be respectful of API limits
        if (i + batchSize < items.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Sort by route distance if requested
      if (sortByDistance) {
        const sortedItems = currentItems.sort((a, b) => {
          if (useRouting && a.routeDistance && b.routeDistance) {
            return (
              a.routeDistance.routeDistance.kilometers -
              b.routeDistance.routeDistance.kilometers
            );
          } else if (a.distance && b.distance) {
            return a.distance.kilometers - b.distance.kilometers;
          }
          return 0;
        });
        setItemsWithDistances(sortedItems);
      }
    } catch (error) {
      console.error("Error calculating route distances:", error);
    } finally {
      setIsCalculatingRoutes(false);
    }
  }, [
    userLocation,
    items,
    useRouting,
    routeProfile,
    batchSize,
    sortByDistance,
    itemsWithDistances,
  ]);

  // Calculate distances when user location or items change
  useEffect(() => {
    const updatedItems = calculateStraightLineDistances();

    // Calculate route distances if routing is enabled
    if (useRouting && userLocation && updatedItems.length > 0) {
      calculateRouteDistances();
    }
  }, [userLocation, items, calculateStraightLineDistances]);

  // Refresh straight-line distances
  const refreshDistances = useCallback(() => {
    refreshLocation();
  }, [refreshLocation]);

  // Refresh route distances
  const refreshRoutes = useCallback(async () => {
    if (useRouting) {
      await calculateRouteDistances();
    }
  }, [calculateRouteDistances, useRouting]);

  return {
    itemsWithDistances,
    userLocation,
    isLoading,
    isCalculatingRoutes,
    refreshDistances,
    refreshRoutes,
  };
};

// Enhanced location hook with route support
export const useLocationWithRouting = (
  options: UseLocationOptions = {}
): UseLocationReturn => {
  const enhancedOptions = {
    ...options,
    useRouting: true,
    routeProfile: options.routeProfile || "driving-car",
  };

  const locationHook = useLocation(enhancedOptions);

  // NEW: Calculate route-based distance
  const calculateRouteTo = useCallback(
    async (location: Position): Promise<RouteDistanceResult | null> => {
      if (!locationHook.userLocation) return null;

      return await OpenRouteService.calculateRoute(
        locationHook.userLocation,
        location,
        enhancedOptions.routeProfile!
      );
    },
    [locationHook.userLocation, enhancedOptions.routeProfile]
  );

  // NEW: Check if within route radius
  const isWithinRouteRadius = useCallback(
    async (location: Position, radiusInMeters: number): Promise<boolean> => {
      if (!locationHook.userLocation) return false;

      return await OpenRouteService.isWithinRouteRadius(
        locationHook.userLocation,
        location,
        radiusInMeters,
        enhancedOptions.routeProfile!
      );
    },
    [locationHook.userLocation, enhancedOptions.routeProfile]
  );

  return {
    ...locationHook,
    calculateRouteTo,
    isWithinRouteRadius,
  };
};
