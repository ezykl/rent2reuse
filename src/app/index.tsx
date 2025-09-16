import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { View, Text, Image, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Carousel, { ICarouselInstance } from "react-native-reanimated-carousel";
import LottieView from "lottie-react-native";

import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from "react-native-reanimated";
import { images, icons } from "../constant";
import { useAuth } from "@/context/AuthContext";
import { useLoader } from "@/context/LoaderContext";

const { width } = Dimensions.get("window");

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const onboardingData = [
  {
    id: 1,
    title: "Find Items Fast",
    subtitle: "Snap or Search",
    description:
      "Use a photo or browse the app to find tools, equipment, and other items available to rent.",
    //image: images.splash2,
  },
  {
    id: 2,
    title: "Rent & List Items",
    subtitle: "Embrace the Cycle",
    description:
      "Looking for something? Rent it. Got unused tools or gear? List them for others to use.",
    //image: images.splash3, // Replace with your second onboarding image
  },
  {
    id: 3,
    title: "Built for the Community",
    subtitle: "Share What You Have",
    description:
      "Join others in reusing tools and gear. Help reduce waste and save money together.",
    //image: images.splash1, // Replace with your third onboarding image
  },
];

const Welcome = () => {
  const { user, loading } = useAuth();
  const { setIsLoading } = useLoader();
  const [currentScreen, setCurrentScreen] = useState(0);
  const carouselRef = useRef<ICarouselInstance>(null);

  useEffect(() => {
    // Handle loading states
    if (loading && !user) {
      setIsLoading(true);
    } else if (!loading && user) {
      setIsLoading(false);
      router.replace("/home");
    } else {
      setIsLoading(false);
    }
  }, [user, loading, setIsLoading]);

  const handleNext = () => {
    if (currentScreen < onboardingData.length - 1) {
      carouselRef.current?.scrollTo({ index: currentScreen + 1 });
      setCurrentScreen(currentScreen + 1);
    } else {
      router.push("/auth/sign-in");
    }
  };

  const handlePrevious = () => {
    if (currentScreen > 0) {
      carouselRef.current?.scrollTo({ index: currentScreen - 1 });
      setCurrentScreen(currentScreen - 1);
    }
  };

  interface OnboardingItem {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    //image: any;
  }

  const renderItem = ({
    item,
    index,
  }: {
    item: OnboardingItem;
    index: number;
  }) => (
    <View className="flex-1 justify-center items-center px-6">
      {/* Main Image */}
      <View className="w-full h-80 justify-center items-center mb-8">
        {item.id === 1 && (
          <LottieView
            source={require("../assets/lottie/searchingAnimation.json")}
            autoPlay
            loop
            style={{ width: "100%", height: "100%" }}
          />
        )}
        {item.id === 2 && (
          <LottieView
            source={require("../assets/lottie/cycleAnimation.json")}
            autoPlay
            loop
            style={{ width: "100%", height: "100%" }}
          />
        )}
        {item.id === 3 && (
          <LottieView
            source={require("../assets/lottie/communityAnimation.json")}
            autoPlay
            loop
            style={{ width: "100%", height: "100%" }}
          />
        )}
      </View>

      {/* Content */}
      <View className="w-full items-center mb-8">
        <Text className="text-3xl text-secondary-400 text-center font-psemibold mb-2">
          {item.title}
        </Text>
        <Text className="text-xl text-primary text-center font-pmedium mb-4">
          {item.subtitle}
        </Text>
        <Text className="font-pregular text-base text-secondary-300 text-center leading-6 mb-6">
          {item.description}
        </Text>
      </View>
    </View>
  );

  // Show empty loading view while authenticating
  if (loading && !user) {
    return (
      <View className="w-full h-full justify-center items-center bg-white" />
    );
  }

  if (!user) {
    const isLastScreen = currentScreen === onboardingData.length - 1;

    return (
      <SafeAreaView className="bg-white h-full" style={{ flex: 1 }}>
        {/* Header with Skip button */}
        <View className="flex-row justify-between items-center px-6 pt-4">
          <Image
            source={images.logo}
            className="h-[28px] w-[160px]"
            resizeMode="contain"
          />
          <TouchableOpacity onPress={() => router.push("/auth/sign-in")}>
            <Text className="text-primary font-pmedium text-lg">Skip</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-1 justify-center pb-5 mb-5">
          {/* Carousel */}
          <Carousel
            ref={carouselRef}
            loop={false}
            width={width}
            height={width * 1.2}
            data={onboardingData}
            scrollAnimationDuration={500}
            onSnapToItem={(index) => setCurrentScreen(index)}
            renderItem={renderItem}
            style={{ marginTop: 20, marginBottom: 20 }}
          />

          {/* Pagination Dots */}
          <View className="flex-row justify-center items-center mb-4">
            {onboardingData.map((_, index) => (
              <View
                key={index}
                className={`w-3 h-3 rounded-full mx-1 ${
                  index === currentScreen ? "bg-primary" : "bg-gray-300"
                }`}
              />
            ))}
          </View>

          {/* Navigation Buttons */}
          <View className="px-6 ">
            {isLastScreen ? (
              <TouchableOpacity
                onPress={() => router.push("/auth/sign-in")}
                className="w-full bg-primary h-14 justify-center rounded-xl"
              >
                <Text className="text-white font-pbold text-lg text-center">
                  Get Started
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="flex-row justify-between items-center">
                <TouchableOpacity
                  onPress={handlePrevious}
                  disabled={currentScreen === 0}
                  className={`w-14 h-14 rounded-full justify-center items-center ${
                    currentScreen === 0 ? "bg-gray-100" : "bg-primary"
                  }`}
                >
                  <Image
                    source={icons.leftArrow}
                    className="w-6 h-6"
                    tintColor={currentScreen === 0 ? "#9CA3AF" : "#FFFFFF"}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNext}
                  className="w-14 h-14 bg-primary rounded-full justify-center items-center"
                >
                  <Image
                    source={icons.rightArrow}
                    className="w-6 h-6"
                    tintColor="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
        {/* Bottom Progress Indicator */}
        <View className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
          <View
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${((currentScreen + 1) / onboardingData.length) * 100}%`,
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return null;
};

export default Welcome;
