import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import RootLayout, { PersonSelectionRoute } from '../../app/_layout';

declare const require: {
  context(path: string, recursive: boolean, filter: RegExp): {
    (key: string): any;
    keys(): string[];
    resolve(key: string): string;
    id: string;
  };
};

// Preserve the existing src/app screens while using the task-scoped root layout.
const screens = require.context('../app', true, /\.[jt]sx?$/);
const context = Object.assign(
  (key: string) => {
    if (key === './_layout.tsx') return { default: RootLayout };
    if (key === './person-selection.tsx' && !screens.keys().includes(key)) {
      return { default: PersonSelectionRoute };
    }
    return screens(key);
  },
  { keys: () => [...new Set([...screens.keys(), './person-selection.tsx'])], resolve: screens.resolve, id: screens.id },
);

function App() {
  return <ExpoRoot context={context} />;
}

registerRootComponent(App);
