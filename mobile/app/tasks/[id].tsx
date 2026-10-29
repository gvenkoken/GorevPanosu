import { Stack, useLocalSearchParams } from 'expo-router';
import { TaskDetailScreen } from '../../src/features/task-detail/TaskDetailScreen';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return <>
    <Stack.Screen options={{ title: 'Görev ayrıntısı' }} />
    <TaskDetailScreen id={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />
  </>;
}
