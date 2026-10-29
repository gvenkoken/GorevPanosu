import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return <>
    <Stack screenOptions={{ headerTitleAlign: "center" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="select-person" options={{ title: "Kişi seçimi", headerBackVisible: false }} />
      <Stack.Screen name="tasks/index" options={{ title: "Görevlerim", headerBackVisible: false }} />
      <Stack.Screen name="tasks/[id]" options={{ title: "Görev ayrıntısı" }} />
    </Stack>
    <StatusBar style="auto" />
  </>;
}
