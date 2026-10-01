
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, View, Text } from 'react-native';

interface LatLng {
  lat: number;
  lng: number;
}

interface GhostMapProps {
  latitude: number;
  longitude: number;
  /** Recorded route to draw as a line on the map, e.g. during a race. */
  path?: LatLng[];
  /** Where the ghost currently is along the route, if racing. */
  ghostPosition?: LatLng;
}

export default function GhostMap({ latitude, longitude, path, ghostPosition }: GhostMapProps) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={styles.map}
      region={{
        latitude,
        longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }}
    >
      {path && path.length > 1 && (
        <Polyline
          coordinates={path.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor="#4ee6a8"
          strokeWidth={4}
        />
      )}

      {ghostPosition && (
        <Marker
          coordinate={{ latitude: ghostPosition.lat, longitude: ghostPosition.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.ghostMarker}>
            <Text style={styles.markerIcon}>👻</Text>
          </View>
        </Marker>
      )}

      <Marker coordinate={{ latitude, longitude }} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.marker}>
          <Text style={styles.markerIcon}>🏃</Text>
        </View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: '100%' },
  marker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4ee6a8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0d1117',
  },
  ghostMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7d8895',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0d1117',
    opacity: 0.85,
  },
  markerIcon: { fontSize: 16 },
});