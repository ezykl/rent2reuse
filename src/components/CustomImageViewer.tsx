import { icons } from "@/constant";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  StyleSheet,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CustomImageViewerProps {
  images: string[];
  visible: boolean;
  imageIndex: number;
  onRequestClose: () => void;
  onImageIndexChange?: (index: number) => void;
}

const CustomImageViewer: React.FC<CustomImageViewerProps> = ({
  images,
  visible,
  imageIndex,
  onRequestClose,
  onImageIndexChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(imageIndex);

  const getVisibleDots = (currentIndex: number, total: number) => {
    const maxDots = 5;
    if (total <= maxDots) {
      // Show all dots if total is less or equal to maxDots
      return [...Array(total).keys()];
    }

    let start = currentIndex - 2;
    let end = currentIndex + 2;

    if (start < 0) {
      start = 0;
      end = maxDots - 1;
    } else if (end > total - 1) {
      end = total - 1;
      start = end - (maxDots - 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => i + start);
  };

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const swipeTranslateX = useSharedValue(0);

  // Reset all values
  const resetTransform = () => {
    "worklet";
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    swipeTranslateX.value = 0;
  };

  // Change image index
  const changeImage = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < images.length) {
      setCurrentIndex(newIndex);
      onImageIndexChange?.(newIndex);
      resetTransform();
    }
  };

  // Effects
  useEffect(() => {
    setCurrentIndex(imageIndex);
    resetTransform();
  }, [imageIndex]);

  useEffect(() => {
    if (visible) {
      resetTransform();
    }
  }, [visible]);

  // Gestures
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      "worklet";
      scale.value = Math.min(Math.max(event.scale, 0.5), 3);
    })
    .onEnd(() => {
      "worklet";
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const panGesture = Gesture.Pan().onUpdate((event) => {
    "worklet";
    if (scale.value > 1) {
      const maxTranslateX = ((scale.value - 1) * SCREEN_WIDTH) / 2;
      const maxTranslateY = ((scale.value - 1) * SCREEN_HEIGHT) / 2;

      translateX.value = Math.max(
        -maxTranslateX,
        Math.min(maxTranslateX, event.translationX)
      );
      translateY.value = Math.max(
        -maxTranslateY,
        Math.min(maxTranslateY, event.translationY)
      );
    }
  });

  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      "worklet";
      if (scale.value <= 1.1) {
        swipeTranslateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      "worklet";
      if (scale.value <= 1.1) {
        const threshold = SCREEN_WIDTH * 0.3;
        if (event.translationX > threshold && currentIndex > 0) {
          swipeTranslateX.value = withTiming(
            SCREEN_WIDTH,
            { duration: 300 },
            () => {
              runOnJS(changeImage)(currentIndex - 1);
            }
          );
        } else if (
          event.translationX < -threshold &&
          currentIndex < images.length - 1
        ) {
          swipeTranslateX.value = withTiming(
            -SCREEN_WIDTH,
            { duration: 300 },
            () => {
              runOnJS(changeImage)(currentIndex + 1);
            }
          );
        } else {
          swipeTranslateX.value = withSpring(0);
        }
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      "worklet";
      if (scale.value > 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        swipeTranslateX.value = 0;
      } else {
        scale.value = withSpring(2);
      }
    });

  const combinedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Exclusive(panGesture, swipeGesture),
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + swipeTranslateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!visible || !images.length) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* Header */}
      <View
        style={[
          styles.header,
          { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
        ]}
      >
        <TouchableOpacity onPress={onRequestClose} style={styles.closeButton}>
          <Image source={icons.close} className="w-6 h-6" tintColor={"red"} />
        </TouchableOpacity>

        <Text style={styles.counter}>
          {currentIndex + 1} of {images.length}
        </Text>

        <View style={styles.spacer} />
      </View>

      {/* Main Content */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.imageContainer}>
          <GestureDetector gesture={combinedGesture}>
            <View style={styles.gestureArea}>
              <View className="rounded-md overflow-hidden">
                <Animated.Image
                  source={{ uri: images[currentIndex] }}
                  style={[styles.image, animatedStyle]}
                  resizeMode="contain"
                />
              </View>
            </View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>

      {images.length > 1 && (
        <View style={[styles.dotsContainer, { paddingVertical: 12 }]}>
          {getVisibleDots(currentIndex, images.length).map((index) => {
            const distance = Math.abs(index - currentIndex);
            const opacity = Math.max(1 - distance * 0.3, 0.3);

            return (
              <TouchableOpacity
                key={index}
                onPress={() => changeImage(index)}
                style={{
                  width: index === currentIndex ? 16 : 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: `rgba(255, 255, 255, ${opacity})`,
                  marginHorizontal: 6,
                }}
              />
            );
          })}
        </View>
      )}

      {/* Navigation Arrows */}
      {images.length > 1 && currentIndex > 0 && (
        <TouchableOpacity
          style={[styles.arrow, styles.leftArrow]}
          className="p-4 bg-black/50 rounded-full justify-center items-center"
          onPress={() => changeImage(currentIndex - 1)}
        >
          <Image
            source={icons.arrowRight}
            className="w-6 h-6"
            style={{ transform: [{ rotate: "180deg" }] }}
            tintColor={"white"}
          />
        </TouchableOpacity>
      )}

      {images.length > 1 && currentIndex < images.length - 1 && (
        <TouchableOpacity
          style={[styles.arrow, styles.rightArrow]}
          className="p-4 bg-black/50 rounded-full justify-center items-center"
          onPress={() => changeImage(currentIndex + 1)}
        >
          <Image
            source={icons.arrowRight}
            className="w-6 h-6"
            tintColor={"white"}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "black",
    zIndex: 9999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 24,
  },
  counter: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  spacer: {
    width: 40,
  },
  gestureRoot: {
    flex: 1,
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  gestureArea: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 150,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "white",
    width: 20,
  },
  inactiveDot: {
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  arrow: {
    position: "absolute",
    top: "50%",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: -25,
  },
  leftArrow: {
    left: 10,
  },
  rightArrow: {
    right: 10,
  },
  arrowText: {
    color: "white",
    fontSize: 30,
    fontWeight: "bold",
  },
  instructions: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  instructionsText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
});

export default CustomImageViewer;
