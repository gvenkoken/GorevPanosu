import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TaskDetailScreen } from '../../features/task-detail/TaskDetailScreen';

export default function TaskDetail() {
  const router = useRouter();
  const selectPerson = useCallback(() => router.replace({
    pathname: '/select-person', params: { reselect: 'true' },
  }), [router]);
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return <TaskDetailScreen onSelectPerson={selectPerson} id={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />;
}
