import { useRouter } from 'expo-router';
import { PersonSelectScreen } from '../features/person-select/PersonSelectScreen';

export default function SelectPerson() {
  const router = useRouter();
  return <PersonSelectScreen onSelected={() => router.replace('/tasks')} />;
}
