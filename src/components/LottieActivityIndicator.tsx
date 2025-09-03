import React from "react";
import { View, StyleSheet } from "react-native";
import LottieView from "lottie-react-native";

const LottieActivityIndicator = ({
  size = 80,
  style,
}: {
  size?: number;
  color?: string;
  style?: any;
}) => (
  <View style={[styles.container, style]}>
    <LottieView
      source={require("../assets/lottie/LoaderLottie.json")}
      autoPlay
      loop
      style={{ width: size, height: size }}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default LottieActivityIndicator;
