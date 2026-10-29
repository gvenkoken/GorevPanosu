import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return <>
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="index" options={{ title: "GorevPanosu" }} />
    </Stack>
    <StatusBar style="auto" />
  </>;
}
