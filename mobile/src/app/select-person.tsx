import { useLocalSearchParams, useRouter } from 'expo-router';
import { PersonSelectScreen } from '../features/person-select/PersonSelectScreen';

export default function SelectPerson() {
  const router = useRouter();
  const { reselect } = useLocalSearchParams<{ reselect?: string }>();
  return <PersonSelectScreen reselect={reselect === 'true'} onSelected={() => router.replace('/tasks')} />;
}
