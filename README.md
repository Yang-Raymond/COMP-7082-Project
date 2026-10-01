# Ghost Racer — GPS + Ghost Racing Module

A working slice of the Ghost Racer core loop: track GPS, draw it on a map,
record a route once, then race against your own past run as a "ghost."
Built for the 1-week/campus MVP scope — rough edges are intentional, noted
at the bottom.

## What it does right now
1. **Track** your live position (lat/lng, accuracy, speed) via GPS
2. **See it on a map** — Google Maps, working on both web and native
3. **Record a route** — walk it once, name it, it's saved locally
4. **Race it** — pick a saved route, run it again, see a live "X seconds
   ahead/behind" readout plus a ghost marker moving along your old path

## Setup
Everything's already wired into this repo — dependencies are in
`package.json` and the Google Maps API key is already set up in `.env`.
Just:

```bash
git clone <repo-url>
cd <project-folder>
npm install
npx expo start -c
```

Press `w` for web, or scan the QR code with Expo Go on your phone.

## Folder structure
```
src/
  types/
    gps.ts
    route.ts
  services/
    distance.ts
    gpsTracker.ts
    backendClient.ts
    gpxExport.ts
    storage.ts
    storage.web.ts
    ghostCompare.ts
  hooks/
    useGpsTracking.ts
    useRouteRecorder.ts
    useGhostRace.ts
  components/
    GhostMap.tsx
    GhostMap.web.tsx
  screens/
    GhostRaceScreen.tsx
    GpsTestScreen.tsx
```

## What each file does

### `types/gps.ts`
Defines `GpsFix` (one GPS reading: lat, lng, accuracy, speed, heading,
timestamp), `LogEntry`, and `flagAccuracy()` — a helper that labels a
reading "good," "warn," or "bad" based on its accuracy in meters. No logic
beyond types — nothing here talks to a device or the network.

### `types/route.ts`
Defines `RoutePoint` (a point with elapsed time `t`, which is what turns a
plain path into a "ghost"), `SavedRoute` (a named, saved recording), and
`GhostDelta` (the live result of comparing your position against a ghost —
how far ahead/behind, and where the ghost currently is).

### `services/distance.ts`
Pure math, zero dependencies. `haversineDistance()` computes the
straight-line distance between two lat/lng points in meters;
`totalDistance()` sums that across a whole route; `formatDistance()` turns
meters into a readable string ("450 m" / "2.30 km"). Easy to unit test
without a phone or GPS mock, since it's just functions in, numbers out.

### `services/gpsTracker.ts`
The **only** file that imports `expo-location`. Wraps
`watchPositionAsync` behind a small `GpsTracker` class with `start()` /
`stop()`, converting whatever `expo-location` returns into our own
`GpsFix` shape. If the GPS provider is ever swapped out, this is the only
file that needs to change — nothing else in the app knows or cares how
GPS actually works under the hood.

### `services/backendClient.ts`
The **only** file that talks to a backend API. `postFix()` sends one GPS
reading to an endpoint; `testConnection()` pings an endpoint to confirm
it's reachable. This is the handoff point for whoever owns
networking/storage on the team — the payload shape can change here
without touching tracking, map, or screen code.

### `services/gpxExport.ts`
Turns a recorded run into a `.gpx` file (a standard format for GPS
tracks). Lets you save a real walked route once and reuse it for testing
later instead of re-walking it every time.

### `services/storage.ts` / `services/storage.web.ts`
Save and load `SavedRoute`s to disk, with the exact same function names
(`getRoutes`, `saveRoute`, `deleteRoute`) on both platforms so the rest of
the app never has to check which one it's running on. `storage.ts` uses
`AsyncStorage` on native (iOS/Android); `storage.web.ts` uses the
browser's `localStorage`. Metro automatically picks the right file per
platform based on the `.web.ts` suffix — you only ever `import` from
`'../services/storage'`, never the `.web` version directly.

### `services/ghostCompare.ts`
The core "racing" algorithm. `computeGhostDelta()` takes a saved route
plus your current position and elapsed time, finds the closest point on
the old route to where you are now, and compares that point's recorded
timestamp to your own elapsed time — that difference is how far
ahead/behind you are. `formatDelta()` turns that into a readable string
("12s ahead"). This file has no GPS or storage dependencies — just math —
so it's easy to test with fake data.

### `hooks/useGpsTracking.ts`
Combines `gpsTracker`, `backendClient`, `distance`, and a log into one
React hook. Used by the older `GpsTestScreen` — starts/stops tracking,
posts each fix to a backend if an endpoint is set, and keeps a running
log and distance total. The screen component just reads this hook's
return value; it doesn't know how any of the pieces work internally.

### `hooks/useRouteRecorder.ts`
Drives the "record a new route" flow. Starts a `GpsTracker`, collects
each fix with its elapsed time into a `RoutePoint[]`, and on `save()`
builds a `SavedRoute` (with total distance/duration) and persists it via
`storage.ts`.

### `hooks/useGhostRace.ts`
Drives the "race a saved route" flow. Starts a `GpsTracker`, and on every
new fix calls `ghostCompare.ts` to compute the live delta against the
chosen route. Exposes `current` (your live position) and `delta` (the
ghost comparison) for the screen to render.

### `components/GhostMap.tsx`
The map for **native** (iOS/Android), built on `react-native-maps` with
the Google provider. Renders your live position as a marker, an optional
`path` as a line (the recorded route), and an optional `ghostPosition`
marker (where the ghost currently is in a race).

### `components/GhostMap.web.tsx`
The map for **web** — same props as `GhostMap.tsx` (`latitude`,
`longitude`, `path`, `ghostPosition`), but implemented with the Google
Maps JavaScript SDK directly, since `react-native-maps` doesn't run in a
browser. Metro picks this file automatically when bundling for web — the
rest of the app just imports `GhostMap` and never has to know two
versions exist.

### `screens/GhostRaceScreen.tsx`
The main, current screen. Ties `useRouteRecorder`, `useGhostRace`,
`storage.ts`, and `GhostMap` together into one flow: a menu listing saved
routes → record a new one → name and save it → pick one to race → live
map + ahead/behind readout. This is what's wired into `_layout.tsx`.

### `screens/GpsTestScreen.tsx`
An earlier, simpler screen — just raw GPS numbers (lat/lng/accuracy/speed)
and a log, no recording or racing. Kept as a reference/fallback; superseded
by `GhostRaceScreen` for actual use.

## How the ghost comparison works
`ghostCompare.ts` takes your current position and finds the **closest point**
on the saved route to where you are right now. That point's recorded
timestamp is "how long the ghost took to get here" — compared against your
own elapsed time, that's your delta (ahead/behind).

This is nearest-point matching, not true path-projection — simple on
purpose, to get the full loop working first. It can misjudge position on
routes that cross near themselves (e.g. an out-and-back path).

## Known gaps (intentional — out of scope for this pass)
- No GPS accuracy smoothing — raw fixes only; drift near buildings will
  show up directly in the ghost comparison
- No background/screen-lock tracking handling yet (will drop fixes if the
  phone locks mid-run)
- No anti-cheat / speed-threshold checks yet
- Ghost comparison uses nearest-point matching, not true route projection
- No route discovery/sharing — routes are stored per-device, not synced
- No auth — anyone using the device sees the same local route list