# GorevPanosu mobile client (Expo)

Expo SDK 58 (React Native 0.88, React 19.3) with Expo Router and TypeScript. One codebase builds for iOS, Android and
the web; the web build is what Ideafactra previews and acceptance-tests (served under `/mobile/`).

Rules for changes here:
- Screens are files in `src/app/` (Expo Router); `_layout.tsx` files define navigators. Keep components, hooks and API
  code outside `src/app/` (for example `src/components/`, `src/api/`).
- Use only React Native core components and packages of the Expo SDK that are already in `package.json` or are part of
  Expo SDK 58 (pin them with the SDK's `~58.x` range). No packages that need custom native code outside Expo, no
  `ios/` or `android/` folders (they are generated), no `eas.json` changes unless a task asks for it.
- Use `StyleSheet` and flexbox; layouts must work on a 390x844 phone screen and on the web build. Give interactive
  elements an `accessibilityLabel` or visible text, and stable `testID`s where tests need them.
- Talk to the backend only through `src/api/client.ts` (relative `/api/...` paths). On the web build the API is the same
  origin; on a device `EXPO_PUBLIC_API_URL` points at it.
- Tests: Jest with the `jest-expo` preset and `@testing-library/react-native` in `src/**/__tests__/`. `render` is async
  (`await render(...)`), queries are `screen.findBy…` / `screen.getBy…`, matchers like `toBeOnTheScreen()`.
- `npm run build` (type check + web export) and `npm run test` must pass offline.
- There is no lock file on purpose (`.npmrc`: `package-lock=false`); never add `package-lock.json`.
