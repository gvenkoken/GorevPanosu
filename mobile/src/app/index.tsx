import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";

type Health = "checking" | "ready" | "unreachable";

export default function Home() {
  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    let live = true;
    api<unknown>("/health/ready").then(() => live && setHealth("ready")).catch(() => live && setHealth("unreachable"));
    return () => { live = false; };
  }, []);
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>GorevPanosu</Text>
    {health === "checking" ? <ActivityIndicator accessibilityLabel="Checking the API" />
      : <Text testID="api-status">{health === "ready" ? "API is ready." : "The API cannot be reached."}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  title: { fontSize: 28, fontWeight: "700" },
});
