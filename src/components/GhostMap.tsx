
import { useMemo } from 'react';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { StyleSheet, View, Text } from 'react-native';
import { colors } from '../constants/ghostTheme';

interface LatLng {
  lat: number;
  lng: number;
}

export interface GhostMapProps {
  latitude: number;
  longitude: number;
  path?: LatLng[];
  ghostPosition?: LatLng;
 
  showUser?: boolean;
  
  fitPath?: boolean;
  pathColor?: string;
  
  interactive?: boolean;
}

export default function GhostMap({
  latitude,
  longitude,
  path,
  ghostPosition,
  showUser = true,
  fitPath = false,
  pathColor = colors.blue,
  interactive = true,
}: GhostMapProps) {
  const region = useMemo(() => {
    if (fitPath && path && path.length > 1) {
      const lats = path.map((p) => p.lat);
      const lngs = path.map((p) => p.lng);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.002),
        longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.002),
      };
    }
    return { latitude, longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 };
  }, [fitPath, path, latitude, longitude]);

  return (
    // No provider prop: iOS uses Apple Maps (Google Maps on iOS needs a custom build with an API key), Android uses Google Maps.
    <MapView
      style={styles.map}
      region={region}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      showsMyLocationButton={false}
    >
      {path && path.length > 1 && (
        <Polyline
          coordinates={path.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor={pathColor}
          strokeWidth={4}
        />
      )}

      {ghostPosition && (
        <Marker
          coordinate={{ latitude: ghostPosition.lat, longitude: ghostPosition.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.ghost}>
            <Text style={styles.ghostIcon}>👻</Text>
          </View>
        </Marker>
      )}

      {showUser && (
        <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.userDot} />
        </Marker>
      )}
    </MapView>
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