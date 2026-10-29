import { useLocalSearchParams } from 'expo-router';
import { TaskDetailScreen } from '../../features/task-detail/TaskDetailScreen';

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  return <TaskDetailScreen id={Array.isArray(id) ? id[0] ?? '' : id ?? ''} />;
}
