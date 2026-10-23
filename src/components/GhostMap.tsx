// Native (iOS/Android) map built on the Mapbox Maps SDK via @rnmapbox/maps.
// Draws the route path, the user's location dot and the ghost marker, and
// either follows the user or fits the camera to the whole route.
// Requires a development build (not Expo Go) and EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.
import { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import type { Feature, LineString } from 'geojson';
import { colors } from '../constants/ghostTheme';
import type { GhostMapProps } from '../types/map';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} else {
  console.warn('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set — map tiles will not load.');
}

const FOLLOW_ZOOM = 16;
const FIT_PADDING = 24;

/**
 * Renders the Mapbox map. Coordinates are converted to Mapbox's
 * [longitude, latitude] order. When `fitPath` is set and the path has at least
 * two points, the camera is bounded to the path's extent; otherwise it centers
 * on `center`. With no center yet, the camera is left at Mapbox's default view
 * and no user dot is drawn. The first center is applied instantly via
 * `defaultSettings`; later center changes ease.
 */
export default function GhostMap({
  center,
  path,
  ghostPosition,
  showUser = true,
  fitPath = false,
  pathColor = colors.blue,
  interactive = true,
}: GhostMapProps) {
  const hasPath = !!path && path.length > 1;

  // GeoJSON line for the route; memoized so the native source only updates when the path changes.
  const pathShape = useMemo<Feature<LineString> | null>(() => {
    if (!hasPath) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: path!.map((p) => [p.lng, p.lat]) },
    };
  }, [hasPath, path]);

  // Bounding box of the path, used when the camera should show the whole route.
  const bounds = useMemo(() => {
    if (!fitPath || !hasPath) return undefined;
    const lats = path!.map((p) => p.lat);
    const lngs = path!.map((p) => p.lng);
    return {
      ne: [Math.max(...lngs), Math.max(...lats)],
      sw: [Math.min(...lngs), Math.min(...lats)],
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
      rotateEnabled={false}
      pitchEnabled={false}
      scaleBarEnabled={false}
    >
      {bounds ? (
        <Mapbox.Camera bounds={bounds} animationDuration={0} />
      ) : center ? (
        <Mapbox.Camera
          // Applied once on mount without animation, so a freshly mounted map opens on the
          // user instead of easing in from Mapbox's default 0,0 camera.
          defaultSettings={{ centerCoordinate: [center.lng, center.lat], zoomLevel: FOLLOW_ZOOM }}
          centerCoordinate={[center.lng, center.lat]}
          zoomLevel={FOLLOW_ZOOM}
          animationMode="easeTo"
          animationDuration={300}
        />
      ) : null}

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
          <View style={styles.ghost}>
            <Text style={styles.ghostIcon}>👻</Text>
          </View>
        </Mapbox.MarkerView>
      )}

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
  ghost: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ghostIcon: { fontSize: 16 },
});
