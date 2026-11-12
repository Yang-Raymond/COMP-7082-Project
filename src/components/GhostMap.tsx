// Native (iOS/Android) map built on the Mapbox Maps SDK via @rnmapbox/maps.
// Draws the route path, the route being raced, tappable route pins, the user's location dot and the ghost marker,
// and either follows the user or fits the camera to the whole route.
// Requires a EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.
import { useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import type { Feature, LineString } from 'geojson';
import { colors } from '../constants/ghostTheme';
import RoutePin from './RoutePin';
import GhostMarker from './GhostMarker';
import type { GhostMapProps, LatLng } from '../types/map';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} else {
  console.warn('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set — map tiles will not load.');
}

const FOLLOW_ZOOM = 16;
const FIT_PADDING = 24;
const FIT_PADDING_LARGE = 60;

/** Bounding box of a path as Mapbox [lng, lat] corners (north-east and south-west). */
function pathExtent(path: LatLng[]) {
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)],
    sw: [Math.min(...lngs), Math.min(...lats)],
  };
}

/**
 * Renders the Mapbox map. Coordinates are converted to Mapbox's
 * [longitude, latitude] order. When `fitPath` is set and the path has at least
 * two points, the camera is bounded to the path's extent. Otherwise it centers
 * on `center`. With no center yet, the camera is left at Mapbox's default view
 * and no user dot is drawn. The first center is applied instantly via
 * `defaultSettings`. The camera does not follow later center changes and only moves back via `ref.recenter()` or to a route
 * via `ref.fitTo()`. Each entry in `pins` is drawn as a tappable teardrop whose
 * tip sits on its coordinate. Tapping a pin calls `onPinPress` with the pin's id.
 * `ghostPath` (the route being raced) is drawn as a wide accent line beneath `path`, and
 * `ghostPosition` as a GhostMarker. When `initialBounds` has at least two points the camera
 * opens fitted to them (via `defaultSettings`) instead of on `center`.
 */
export default function GhostMap({
  center,
  path,
  ghostPath,
  ghostPosition,
  initialBounds,
  showUser = true,
  fitPath = false,
  pathColor = colors.blue,
  interactive = true,
  pins,
  onPinPress,
  ref,
}: GhostMapProps) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Snaps the camera back onto the user after panning away.
  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        if (!center) return;
        cameraRef.current?.setCamera({
          centerCoordinate: [center.lng, center.lat],
          zoomLevel: FOLLOW_ZOOM,
          animationMode: 'easeTo',
          animationDuration: 600,
        });
      },
      // Animates the camera so the whole path is visible.
      fitTo: (points) => {
        if (points.length < 2) return;
        const { ne, sw } = pathExtent(points);
        cameraRef.current?.fitBounds(ne, sw, FIT_PADDING_LARGE, 600);
      },
    }),
    [center],
  );

  const hasPath = !!path && path.length > 1;
  const hasGhostPath = !!ghostPath && ghostPath.length > 1;

  // GeoJSON line for the route. Memoized so the native source only updates when the path changes.
  const pathShape = useMemo<Feature<LineString> | null>(() => {
    if (!hasPath) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: path!.map((p) => [p.lng, p.lat]) },
    };
  }, [hasPath, path]);

  // GeoJSON line for the route being raced.
  const ghostPathShape = useMemo<Feature<LineString> | null>(() => {
    if (!hasGhostPath) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: ghostPath!.map((p) => [p.lng, p.lat]) },
    };
  }, [hasGhostPath, ghostPath]);

  // Initial camera fit for `initialBounds`, applied once on mount through `defaultSettings`.
  const initialFit = useMemo(() => {
    if (!initialBounds || initialBounds.length < 2) return undefined;
    return {
      ...pathExtent(initialBounds),
      paddingTop: FIT_PADDING_LARGE,
      paddingBottom: FIT_PADDING_LARGE,
      paddingLeft: FIT_PADDING_LARGE,
      paddingRight: FIT_PADDING_LARGE,
    };
  }, [initialBounds]);

  // Bounding box of the path, used when the camera should show the whole route.
  const bounds = useMemo(() => {
    if (!fitPath || !hasPath) return undefined;
    return {
      ...pathExtent(path!),
      paddingTop: FIT_PADDING,
      paddingBottom: FIT_PADDING,
      paddingLeft: FIT_PADDING,
      paddingRight: FIT_PADDING,
    };
  }, [fitPath, hasPath, path]);

  return (
    <Mapbox.MapView
      style={styles.map}
      styleURL={Mapbox.StyleURL.Street}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={false}
      scaleBarEnabled={false}
    >
      {initialFit ? (
        // No declarative zoomLevel/centerCoordinate here: any such prop is applied as a camera
        // stop and would override the initial fit. Later moves go through `ref`.
        <Mapbox.Camera ref={cameraRef} defaultSettings={{ bounds: initialFit }} />
      ) : bounds ? (
        <Mapbox.Camera bounds={bounds} animationDuration={0} />
      ) : center ? (
        <Mapbox.Camera
          ref={cameraRef}
          // Applied once on mount without animation, so a freshly mounted map opens on the user instead of easing in from Mapbox's default 0,0 camera.
          defaultSettings={{ centerCoordinate: [center.lng, center.lat], zoomLevel: FOLLOW_ZOOM }}
          zoomLevel={FOLLOW_ZOOM}
          animationMode="easeTo"
          animationDuration={1000}
        />
      ) : (
        // No location yet: keep a camera so `fitTo` can still move to a selected route.
        <Mapbox.Camera ref={cameraRef} />
      )}

      {ghostPathShape && (
        <Mapbox.ShapeSource id="race-route" shape={ghostPathShape}>
          <Mapbox.LineLayer
            id="race-route-line"
            style={{ lineColor: colors.accent, lineWidth: 8, lineOpacity: 0.5, lineCap: 'round', lineJoin: 'round' }}
          />
        </Mapbox.ShapeSource>
      )}

      {pathShape && (
        <Mapbox.ShapeSource id="ghost-path" shape={pathShape}>
          <Mapbox.LineLayer
            id="ghost-path-line"
            style={{ lineColor: pathColor, lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
          />
        </Mapbox.ShapeSource>
      )}

      {ghostPosition && (
        <Mapbox.MarkerView
          coordinate={[ghostPosition.lng, ghostPosition.lat]}
          anchor={{ x: 0.5, y: 0.5 }}
          allowOverlap
        >
          <GhostMarker />
        </Mapbox.MarkerView>
      )}

      {pins?.map((pin) => (
        <Mapbox.MarkerView
          key={pin.id}
          coordinate={[pin.coordinate.lng, pin.coordinate.lat]}
          anchor={{ x: 0.5, y: 1 }}
          allowOverlap
        >
          <Pressable onPress={() => onPinPress?.(pin.id)} accessibilityLabel="Select route">
            <RoutePin />
          </Pressable>
        </Mapbox.MarkerView>
      ))}

      {showUser && center && (
        <Mapbox.MarkerView coordinate={[center.lng, center.lat]} anchor={{ x: 0.5, y: 0.5 }} allowOverlap>
          <View style={styles.userDot} />
        </Mapbox.MarkerView>
      )}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.blue,
    borderWidth: 3,
    borderColor: colors.bg,
  },
});
