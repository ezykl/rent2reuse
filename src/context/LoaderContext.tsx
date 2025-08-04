import React, { createContext, useContext, useState } from "react";
import LottieView from "lottie-react-native";
import { View, Text } from "react-native";

type LoaderContextType = {
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

const LoaderProviderWithOverlay = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isLoading, setIsLoading] = useState(false);
  // Auto-disable the loader after 1 minute (60000ms)
  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 60000);

      return () => clearTimeout(timer);
    }
  }, [isLoading]);
  return (
    <LoaderContext.Provider value={{ isLoading, setIsLoading }}>
      <View style={{ flex: 1, zIndex: 999999 }}>
        {/* Render the children content */}
        {children}

        {/* Render overlay loader if isLoading is true */}
        {isLoading && (
          <View className="absolute top-0 left-0 w-full h-full justify-center items-center p-3 bg-black opacity-90">
            <View style={{ width: 100, height: 100 }}>
              <LottieView
                style={{ height: "100%", width: "100%" }}
                source={require("../assets/RR.json")}
                autoPlay
                loop
              />
            </View>
            <Text className="font-pbold text-xl text-center text-white mt-4">
              Processing...
            </Text>
          </View>
        )}
      </View>
    </LoaderContext.Provider>
  );
};

export const useLoader = () => {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error("useLoader must be used within a LoaderProvider");
  }
  return context;
};

export default LoaderProviderWithOverlay;
