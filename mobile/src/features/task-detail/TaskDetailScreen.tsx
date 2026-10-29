import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { createMobileApi, type Task } from '../../api/mobile';
import { ApiError } from '../../api/transport';
import { selectedPerson } from '../../storage/person';
import { theme } from '../../theme';

export interface Dependencies {
  readPerson: () => Promise<string | null>;
  api: (personId: string) => Pick<ReturnType<typeof createMobileApi>, 'detail' | 'complete' | 'reopen'>;
}
const defaults: Dependencies = {
  readPerson: selectedPerson.read,
  api: personId => createMobileApi(undefined, async () => personId),
};
export function localDate(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  return dateOnly ? date.toLocaleDateString('tr-TR') : date.toLocaleString('tr-TR');
}

export function TaskDetailScreen({ id, dependencies = defaults }: { id: string; dependencies?: Dependencies }) {
  const [task, setTask] = useState<Task>();
  const [personId, setPersonId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const revision = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    const current = ++revision.current;
    setTask(undefined); setPersonId(undefined); setLoading(true); setMissing(false);
    setError(''); setNotice(''); setBusy(false); inFlight.current = false;
    async function load() {
      try {
        const person = await dependencies.readPerson();
        if (current !== revision.current) return;
        if (!person?.trim()) throw new Error('Kişi seçilmedi');
        const result = await dependencies.api(person).detail(id);
        if (current !== revision.current) return;
        setPersonId(person); setTask(result);
      } catch (failure) {
        if (current !== revision.current) return;
        if (failure instanceof ApiError && failure.status === 404) setMissing(true);
        else setError('Görev yüklenemedi. Lütfen tekrar deneyin.');
      } finally { if (current === revision.current) setLoading(false); }
    }
    void load();
    return () => { revision.current++; };
  }, [id, dependencies, attempt]);

  async function changeStatus() {
    if (!task || !personId || inFlight.current) return;
    const current = revision.current;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const api = dependencies.api(personId);
      const result = await (task.status === 'Open' ? api.complete(id) : api.reopen(id));
      if (current !== revision.current) return;
      setTask(result);
      setNotice(result.status === 'Completed' ? 'Görev tamamlandı.' : 'Görev yeniden açıldı.');
    } catch (failure) {
      if (current !== revision.current) return;
      if (failure instanceof ApiError && failure.status === 404) setMissing(true);
      else setError('İşlem başarısız. Lütfen tekrar deneyin.');
    } finally {
      if (current === revision.current) { inFlight.current = false; setBusy(false); }
    }
  }

  return <ScrollView style={styles.scroll} contentContainerStyle={styles.page}>
    <Text accessibilityRole="header" style={theme.typography.title}>Görev ayrıntısı</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Görev yükleniyor" /> : missing ?
      <>
        <Text accessibilityRole="alert">Görev artık erişilemiyor.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt(value => value + 1)}>
          <Text style={styles.buttonText}>Tekrar dene</Text>
        </Pressable>
      </> : <>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {!task ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => setAttempt(value => value + 1)}>
        <Text style={styles.buttonText}>Tekrar dene</Text>
      </Pressable> : <>
        <Text accessibilityRole="header" style={theme.typography.heading}>{task.title}</Text>
        <Text style={theme.typography.body}>{task.description ?? 'Açıklama yok.'}</Text>
        <Text>Son tarih: {task.dueDate ? localDate(task.dueDate) : 'Belirtilmedi'}</Text>
        <Text>Durum: {task.status === 'Open' ? 'Açık' : 'Tamamlandı'}</Text>
        <Text>Oluşturulma zamanı: {localDate(task.createdAt)}</Text>
        {task.completedAt && <Text>Tamamlanma zamanı: {localDate(task.completedAt)}</Text>}
        {!!notice && <Text accessibilityRole="alert">{notice}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy}
          style={[styles.button, busy && styles.disabled]} onPress={() => { void changeStatus(); }}>
          <Text style={styles.buttonText}>{busy ? 'İşlem sürüyor…' : error ? 'Tekrar dene' : task.status === 'Open' ? 'Tamamlandı olarak işaretle' : 'Yeniden aç'}</Text>
        </Pressable>
      </>}
    </>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  page: { padding: theme.spacing.lg, gap: theme.spacing.md },
  button: { ...theme.touchTarget, padding: theme.spacing.md, justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: 8 },
  buttonText: { color: theme.colors.surface, ...theme.typography.body },
  disabled: { opacity: 0.6 },
});
