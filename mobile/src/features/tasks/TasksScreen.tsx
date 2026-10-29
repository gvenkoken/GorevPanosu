import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { mobileApi, type Task } from '../../api/mobile';
import { ApiError } from '../../api/transport';
import { selectedPerson } from '../../storage/person';
import { theme } from '../../theme';
import { assignedTasks } from './api';

export interface Dependencies {
  readPerson: typeof selectedPerson.read;
  clearPerson: typeof selectedPerson.clear;
  people: typeof mobileApi.people;
  tasks: (personId: string) => Promise<Task[]>;
  subscribe: (active: () => void) => () => void;
}
const defaults: Dependencies = {
  readPerson: selectedPerson.read, clearPerson: selectedPerson.clear,
  people: mobileApi.people, tasks: assignedTasks,
  subscribe: active => {
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') active(); });
    return () => subscription.remove();
  },
};

export function TasksScreen({ onSelectPerson, onTask, dependencies = defaults }: {
  onSelectPerson: () => void; onTask: (id: string) => void; dependencies?: Dependencies;
}) {
  const [name, setName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    let revision = 0;
    async function load() {
      const request = ++revision;
      const current = () => live && request === revision;
      setLoading(true);
      setError(false);
      try {
        const id = await dependencies.readPerson();
        if (!current()) return;
        if (!id?.trim()) { onSelectPerson(); return; }
        const [people, items] = await Promise.all([dependencies.people(), dependencies.tasks(id)]);
        if (!current()) return;
        const person = people.find(value => value.id === id && value.isActive);
        if (!person) throw new ApiError(404, 'Person not found');
        setName(person.fullName);
        setTasks(items);
      } catch (failure) {
        if (!current()) return;
        if (failure instanceof ApiError && failure.status === 404) {
          try {
            await dependencies.clearPerson();
            if (current()) onSelectPerson();
          } catch { if (current()) setError(true); }
        } else setError(true);
      } finally { if (current()) setLoading(false); }
    }
    void load();
    const unsubscribe = dependencies.subscribe(() => { void load(); });
    return () => { live = false; unsubscribe(); };
  }, [dependencies, onSelectPerson, attempt]);

  function section(status: Task['status'], title: string, empty: string) {
    const items = tasks.filter(task => task.status === status);
    return <View style={styles.section}>
      <Text accessibilityRole="header" style={theme.typography.heading}>{title}</Text>
      {items.length === 0 && <Text>{empty}</Text>}
      {items.map(task => <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={task.title}
        style={styles.card} onPress={() => onTask(task.id)}>
        <Text style={theme.typography.heading}>{task.title}</Text>
        <Text>Son tarih: {task.dueDate ?? 'Belirtilmedi'}</Text>
      </Pressable>)}
    </View>;
  }
  return <FlatList testID="tasks-list" style={styles.scroll} contentContainerStyle={styles.page}
    refreshing={loading} onRefresh={() => setAttempt(value => value + 1)}
    data={loading || error ? [] : tasks.filter(task => task.status === 'Open')}
    keyExtractor={task => task.id}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item.title}
      style={styles.card} onPress={() => onTask(item.id)}>
      <Text style={theme.typography.heading}>{item.title}</Text>
      <Text>Son tarih: {item.dueDate ?? 'Belirtilmedi'}</Text>
    </Pressable>}
    ListHeaderComponent={<View style={styles.section}>
    <Text accessibilityRole="header" style={theme.typography.title}>Görevlerim</Text>
    {!!name && <Text style={theme.typography.heading}>{name}</Text>}
    <Pressable accessibilityRole="button" style={styles.button} onPress={onSelectPerson}><Text>Kişi değiştir</Text></Pressable>
    {loading ? <ActivityIndicator accessibilityLabel="Görevler yükleniyor" /> : error ? <View>
      <Text accessibilityRole="alert">Görevler yüklenemedi. Lütfen tekrar deneyin.</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt(value => value + 1)}><Text>Tekrar dene</Text></Pressable>
    </View> : <>
      <Text accessibilityRole="header" style={theme.typography.heading}>Açık görevler</Text>
      {!tasks.some(task => task.status === 'Open') && <Text>Açık göreviniz yok.</Text>}
    </>}
    </View>}
    ListFooterComponent={!loading && !error ? section('Completed', 'Tamamlananlar', 'Son 30 günde tamamlanan göreviniz yok.') : undefined}
  />;
}
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', flexGrow: 1, padding: theme.spacing.lg, gap: theme.spacing.md },
  section: { gap: theme.spacing.md },
  button: { ...theme.touchTarget, justifyContent: 'center', padding: theme.spacing.sm },
  card: { ...theme.touchTarget, padding: theme.spacing.md, gap: theme.spacing.sm, borderWidth: 1,
    borderColor: theme.colors.border, borderRadius: 12, backgroundColor: theme.colors.surface },
});
