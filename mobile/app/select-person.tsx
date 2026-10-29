import { useRouter } from 'expo-router';
import { PersonSelectScreen } from '../src/features/person-select/PersonSelectScreen';

export default function SelectPerson() {
  const router = useRouter();
  return <PersonSelectScreen onSelected={() => router.replace('/')} />;
}
