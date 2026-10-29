import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { selectedPerson } from '../src/storage/person';
import { theme } from '../src/theme';

export default function RootLayout() {
  const [selection, setSelection] = useState<{ route: string; personId: string | null }>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const segments = useSegments();
  const route = segments.join('/');

  useEffect(() => {
    let active = true;
    setFailed(false);
    selectedPerson.read().then(
      id => { if (active) setSelection({ route, personId: id?.trim() ? id : null }); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [attempt, route]);

  if (failed) return <View style={styles.page}>
    <Text accessibilityRole="alert">Kayıtlı kişi okunamadı.</Text>
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt(value => value + 1)}>
      <Text>Yeniden dene</Text>
    </Pressable>
  </View>;
  if (!selection || selection.route !== route) return <View style={styles.page}>
    <ActivityIndicator accessibilityLabel="Kayıtlı kişi yükleniyor" color={theme.colors.primary} />
  </View>;
  if (!selection.personId && segments[0] !== 'person-selection') return <Redirect href="/person-selection" />;

  return <>
    <Stack screenOptions={{
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.text,
      contentStyle: { backgroundColor: theme.colors.background },
    }} />
    <StatusBar style="dark" />
  </>;
}

// Landing route until the separate person-selection screen is implemented.
export function PersonSelectionRoute() {
  return <View style={styles.page}>
    <Text accessibilityRole="header" style={styles.title}>Kişi seçimi</Text>
    <Text style={styles.body}>Görevlerinizi görmek için bir kişi seçin.</Text>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.background },
  title: { ...theme.typography.title, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.secondaryText },
  button: { ...theme.touchTarget, justifyContent: 'center', padding: theme.spacing.sm },
});
