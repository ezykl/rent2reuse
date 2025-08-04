import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack>
      <Stack.Screen name="personal-details" options={{ headerShown: false }} />
    </Stack>
  );
}
