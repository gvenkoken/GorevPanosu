import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { TasksScreen } from '../../features/tasks/TasksScreen';

export default function Tasks() {
  const router = useRouter();
  const selectPerson = useCallback(() => router.replace('/select-person'), [router]);
  return <TasksScreen onSelectPerson={selectPerson}
    onTask={id => router.push({ pathname: '/tasks/[id]', params: { id } })} />;
}
