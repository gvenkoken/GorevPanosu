import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { TasksScreen } from '../../features/tasks/TasksScreen';

export default function Tasks() {
  const router = useRouter();
  const selectPerson = useCallback((reselect = false) => router.replace(reselect
    ? { pathname: '/select-person', params: { reselect: 'true' } }
    : '/select-person'), [router]);
  return <TasksScreen onSelectPerson={selectPerson}
    onTask={id => router.push({ pathname: '/tasks/[id]', params: { id } })} />;
}
