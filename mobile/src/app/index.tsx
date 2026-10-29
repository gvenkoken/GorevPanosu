import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { selectedPerson } from '../storage/person';

export default function Home() {
  const [destination, setDestination] = useState<'/select-person' | '/tasks' | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setError(false);
    selectedPerson.read().then(person => {
      if (live) setDestination(person?.trim() ? '/tasks' : '/select-person');
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [attempt]);
  if (destination) return <Redirect href={destination} />;
  return <View style={{ padding: 24, gap: 16 }}>
    {error ? <>
      <Text accessibilityRole="alert">Kayıtlı kişi okunamadı.</Text>
      <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}>
        <Text>Tekrar dene</Text>
      </Pressable>
    </> : <ActivityIndicator accessibilityLabel="Kayıtlı kişi okunuyor" />}
  </View>;
}
