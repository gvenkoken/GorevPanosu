import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createMobileApi, mobileApi, type Person } from '../../api/mobile';
import { ApiError } from '../../api/transport';
import { selectedPerson } from '../../storage/person';
import { theme } from '../../theme';

export interface Dependencies {
  people: () => Promise<Person[]>;
  validate: (id: string) => Promise<unknown>;
  storage: typeof selectedPerson;
}
const defaults: Dependencies = {
  people: mobileApi.people,
  validate: id => createMobileApi(undefined, async () => id).tasks(),
  storage: selectedPerson,
};

export function PersonSelectScreen({ onSelected, dependencies = defaults }: {
  onSelected: () => void;
  dependencies?: Dependencies;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const remembered = await dependencies.storage.read();
        let invalid = false;
        if (remembered) {
          try { await dependencies.validate(remembered); }
          catch (failure) {
            if (!(failure instanceof ApiError) || failure.status !== 404) throw failure;
            await dependencies.storage.clear();
            invalid = true;
            if (live) setExplanation(true);
          }
        }
        const active = (await dependencies.people()).filter(person => person.isActive);
        if (remembered && !invalid && !active.some(person => person.id === remembered)) {
          await dependencies.storage.clear();
          invalid = true;
          if (live) setExplanation(true);
        }
        if (live) {
          setPeople(active);
          setSelected(invalid ? null : remembered);
        }
      } catch {
        if (live) setError('Kişiler yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => { live = false; };
  }, [dependencies, attempt]);

  async function choose(id: string) {
    if (busy.current) return;
    busy.current = true;
    setSelected(id);
    setSaving(true);
    setError(null);
    try {
      await dependencies.storage.save(id);
      onSelected();
    } catch {
      setError('Kişi seçimi kaydedilemedi. Lütfen tekrar deneyin.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <ScrollView contentContainerStyle={styles.page}>
    <Text accessibilityRole="header" style={theme.typography.title}>Kişi seçimi</Text>
    <Text style={styles.description}>Görevlerini görmek istediğiniz kişiyi seçin.</Text>
    {explanation && <Text accessibilityRole="alert">Hatırlanan kişi artık aktif değil veya bulunamadı. Lütfen yeniden bir kişi seçin.</Text>}
    {loading ? <ActivityIndicator accessibilityLabel="Kişiler yükleniyor" /> : <>
      {error && <View><Text accessibilityRole="alert">{error}</Text>
        <Pressable accessibilityRole="button" style={styles.retry} disabled={saving}
          onPress={() => setAttempt(value => value + 1)}><Text>Tekrar dene</Text></Pressable>
      </View>}
      {!error && people.length === 0 && <Text>Aktif kişi bulunamadı.</Text>}
      {people.map(person => <Pressable key={person.id} accessibilityRole="radio"
        accessibilityLabel={person.fullName} accessibilityState={{ checked: selected === person.id, disabled: saving }}
        disabled={saving} onPress={() => void choose(person.id)}
        style={[styles.row, selected === person.id && styles.selected]}>
        <View style={styles.avatar} accessible={false}><Text>
          {person.fullName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('tr-TR')}
        </Text></View>
        <Text style={styles.name}>{person.fullName}</Text>
        <Text accessible={false} style={styles.radio}>{selected === person.id ? '◉' : '○'}</Text>
      </Pressable>)}
      {saving && <ActivityIndicator accessibilityLabel="Seçim kaydediliyor" />}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.background },
  description: { ...theme.typography.body, color: theme.colors.secondaryText },
  retry: { ...theme.touchTarget, justifyContent: 'center', padding: theme.spacing.sm },
  row: { ...theme.touchTarget, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md,
    padding: theme.spacing.md, borderWidth: 2, borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
  selected: { borderColor: theme.colors.primary },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  name: { ...theme.typography.body, flex: 1, color: theme.colors.text },
  radio: { fontSize: 28, color: theme.colors.primary },
});
