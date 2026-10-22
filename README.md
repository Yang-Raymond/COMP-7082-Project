# Ghost Racer

Ghost Racer is a mobile-first Expo app for recording a route, saving it locally, and racing against your own previous performance as a ghost. The current app combines GPS tracking, route discovery, local challenge lists, and a Supabase-backed auth flow to create a simple competitive fitness experience.

## What the app does

- Tracks live GPS position and speed while you move
- Records a route with duration, distance, and activity type
- Saves completed routes locally so they can be reused later
- Lets you search and filter saved routes by type and name
- Races a saved route again with a live ahead/behind comparison
- Displays the route and current location on a map for native and web builds
- Requires sign-in/sign-up for challenge access via Supabase auth

## Tech stack

- Expo SDK 57
- React Native + TypeScript
- Expo Router
- react-native-maps
- Supabase auth
- AsyncStorage for local persistence

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add your Supabase configuration to a local `.env` file if you want auth enabled:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   If these variables are not set, the app will still start, but authentication will be unavailable.

3. Start the project:

   ```bash
   npx expo start -c
   ```

4. Choose a platform:
   - Press `w` for web
   - Press `a` for Android
   - Press `i` for iOS
   - Or scan the QR code with Expo Go on a device

## Current project structure

```text
src/
  app/
    _layout.tsx
    index.tsx
  auth/
    AuthContext.tsx
    AuthScreen.tsx
    auth.ts
    index.ts
    SignInPrompt.tsx
    supabase.ts
    useAuth.ts
  components/
    AppShell.tsx
    BottomSheet.tsx
    GhostMap.tsx
    GhostMap.web.tsx
    StartButton.tsx
    TabBar.tsx
  constants/
    ghostTheme.ts
  hooks/
    useGhostRace.ts
    useGpsTracking.ts
    useRouteRecorder.ts
  screens/
    HomeScreen.tsx
    PlaceholderScreen.tsx
    RaceScreen.tsx
    RecordDoneScreen.tsx
    RecordScreen.tsx
    YouScreen.tsx
  services/
    backendClient.ts
    distance.ts
    elevation.ts
    format.ts
    gpsTracker.ts
    ghostCompare.ts
    gpxExport.ts
    storage.ts
    storage.web.ts
  types/
    gps.ts
    route.ts
```

## File-by-file descriptions

### Top-level project files

- `package.json` — Defines the Expo app metadata, dependencies, and npm scripts such as `start`, `web`, `android`, and `ios`.
- `app.json` — Expo application configuration, including app name, bundle ID, and platform launch settings.
- `babel.config.js` — Babel setup used by Expo and the project path aliases.
- `tsconfig.json` — TypeScript compiler configuration and project path rules.
- `expo-env.d.ts` — Type declarations for Expo environment variables used by TypeScript.
- `README.md` — Project overview and developer documentation.
- `scripts/reset-project.js` — Helper script for resetting scaffolded project files to a clean starting state.

### `src/app` files

- `src/app/_layout.tsx` — Root layout that mounts the app shell and overall navigation flow.
- `src/app/index.tsx` — Default route entry; currently acts as a minimal placeholder.

### `src/auth` files

- `src/auth/auth.ts` — Core Supabase authentication helpers for sign up, sign in, sign out, session lookup, and friendly error messages.
- `src/auth/supabase.ts` — Creates the Supabase client, reads env variables, and configures auth persistence for web and native.
- `src/auth/useAuth.ts` — Hook that subscribes to Supabase session changes and exposes the current auth state to the app.
- `src/auth/AuthContext.tsx` — Global authentication provider that decides whether a user is signed in and when a prompt should block protected actions.
- `src/auth/AuthScreen.tsx` — UI for email/password sign-in and sign-up.
- `src/auth/SignInPrompt.tsx` — Small modal that prompts the user to sign in before racing or challenging others.
- `src/auth/index.ts` — Barrel export for auth-related modules.

### `src/components` files

- `src/components/AppShell.tsx` — Main app shell that manages tabs, auth gating, route recording, and the race flow.
- `src/components/BottomSheet.tsx` — Reusable bottom sheet panel used to show the challenge list on the home screen.
- `src/components/GhostMap.tsx` — Native map implementation using `react-native-maps` to render the user, route path, and ghost marker.
- `src/components/GhostMap.web.tsx` — Web-specific map implementation using the browser map API for browser-based runs.
- `src/components/StartButton.tsx` — Large call-to-action button used to begin recording.
- `src/components/TabBar.tsx` — Bottom navigation bar for Home, Record, Social, and You tabs.

### `src/constants` files

- `src/constants/ghostTheme.ts` — Shared theme palette and shadow settings used across the app.

### `src/hooks` files

- `src/hooks/useRouteRecorder.ts` — The route-recording state machine. Tracks points, elapsed time, distance, and elevation while recording a run, then saves a draft route.
- `src/hooks/useGhostRace.ts` — Race-state hook intended to compare live movement against a saved route.
- `src/hooks/useGpsTracking.ts` — GPS hook that wraps tracking and location updates for screens that need live position data.

### `src/screens` files

- `src/screens/HomeScreen.tsx` — Main challenge list screen. Shows nearby routes, filters by type, lets users choose a route to race, and displays a map background.
- `src/screens/RecordScreen.tsx` — Screen used to start/stop route recording, select activity type, and view live stats while recording.
- `src/screens/RecordDoneScreen.tsx` — Review screen after a route is saved, allowing the user to add a name and save or discard the route.
- `src/screens/RaceScreen.tsx` — Race screen that starts the live run and presents the active ghost challenge UI.
- `src/screens/YouScreen.tsx` — User/profile area, likely for account and personal summary information.
- `src/screens/PlaceholderScreen.tsx` — Temporary placeholder screen for tabs not yet fully implemented.

### `src/services` files

- `src/services/gpsTracker.ts` — Expo Location wrapper that requests permission, starts tracking, and converts location output to the app’s normalized `GpsFix` format.
- `src/services/distance.ts` — Math helpers for calculating distance between GPS points and summing route length.
- `src/services/elevation.ts` — Calculates cumulative elevation gain from recorded altitude points.
- `src/services/ghostCompare.ts` — Compares the user’s current position against a saved route and returns the ahead/behind delta used during ghost racing.
- `src/services/backendClient.ts` — Placeholder for backend-facing network logic, including API connection checks and GPS payload submissions.
- `src/services/gpxExport.ts` — Converts saved routes into GPX format so they can be exported or reused externally.
- `src/services/storage.ts` — Native storage layer using AsyncStorage to store route data on mobile devices.
- `src/services/storage.web.ts` — Web implementation of the same storage API using browser localStorage.
- `src/services/format.ts` — Formatting helpers for clock time, route duration, and distance values shown in the UI.

### `src/types` files

- `src/types/gps.ts` — Data model for GPS fixes, tracking status, and accuracy classification rules.
- `src/types/route.ts` — Core route data model, including route points, saved route records, and ghost-race delta information.

## App flow

- `src/app/_layout.tsx` mounts the main shell
- `src/auth` handles sign-in, sign-up, and auth state
- `src/screens/HomeScreen.tsx` shows saved challenge routes and the nearby map
- `src/screens/RecordScreen.tsx` records a new route
- `src/screens/RaceScreen.tsx` compares your live run against a saved ghost route
- `src/services/storage.ts` stores route data locally on device
- `src/services/ghostCompare.ts` computes the ahead/behind delta during a race

## Main modules

### Auth and session management

The authentication layer lives in `src/auth`, using Supabase for email/password sign-in and sign-up. `AuthContext` provides app-wide access to user state and route access gating.

### GPS and route tracking

- `src/services/gpsTracker.ts` wraps Expo Location tracking and normalizes GPS readings
- `src/services/distance.ts` handles distance calculations
- `src/hooks/useRouteRecorder.ts` records a run and saves a route snapshot
- `src/types/route.ts` defines the saved route and timing data model

### Ghost racing logic

- `src/services/ghostCompare.ts` compares your current position to the saved route and produces the delta
- `src/screens/RaceScreen.tsx` links the live tracker to the map and ghost progress readout
- `src/components/GhostMap.tsx` and `src/components/GhostMap.web.tsx` render the map for native and web environments

## Notes

- Routes are currently stored locally per device.
- The app is built as a campus MVP and focuses on the core ghost-racing loop rather than full social sharing or backend syncing.
- Auth is optional at startup, but challenge access is controlled by the session state when Supabase is configured.

## Useful commands

```bash
npm install
npx expo start -c
npm run web
npm run android
npm run ios
```

## License

This project is licensed under the terms in the repository license file.