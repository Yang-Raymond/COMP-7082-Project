import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import GhostMap from '../components/GhostMap';
import { useRouteRecorder } from '../hooks/useRouteRecorder';
import { useGhostRace } from '../hooks/useGhostRace';
import { getRoutes, deleteRoute } from '@/services/storage';
import { formatDistance } from '../services/distance';
import { formatDelta } from '../services/ghostCompare';
import { SavedRoute } from '../types/route';

const FALLBACK = { lat: 49.2494, lng: -122.9987 }; // BCIT Burnaby

type Mode = 'menu' | 'recording' | 'naming' | 'racing';

export default function GhostRaceScreen() {
  const [mode, setMode] = useState<Mode>('menu');
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<SavedRoute | null>(null);
  const [nameInput, setNameInput] = useState('');

  const recorder = useRouteRecorder();
  const race = useGhostRace(selectedRoute ?? ({ points: [] } as unknown as SavedRoute));

  const refreshRoutes = useCallback(() => {
    getRoutes().then(setRoutes);
  }, []);

  useEffect(() => {
    refreshRoutes();
  }, [refreshRoutes]);

  const handleStartRecording = () => {
    setMode('recording');
    recorder.start();
  };

  const handleStopRecording = () => {
    recorder.stop();
    setMode('naming');
  };

  const handleSaveRoute = async () => {
    if (!nameInput.trim()) return;
    await recorder.save(nameInput.trim());
    setNameInput('');
    setMode('menu');
    refreshRoutes();
  };

  const handleStartRace = (route: SavedRoute) => {
    setSelectedRoute(route);
    setMode('racing');
  };

  // start() reads `route` via closure inside useGhostRace, so re-trigger once
  // selectedRoute is actually set and we're in racing mode.
  useEffect(() => {
    if (mode === 'racing' && selectedRoute) {
      race.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedRoute]);

  const handleStopRace = () => {
    race.stop();
    setMode('menu');
    setSelectedRoute(null);
  };

  const handleDelete = async (id: string) => {
    await deleteRoute(id);
    refreshRoutes();
  };

  // ---- MENU ----
  if (mode === 'menu') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Ghost Racer</Text>
        <Text style={styles.subtitle}>Record a route once, then race your own ghost.</Text>

        <Pressable style={[styles.button, styles.primary]} onPress={handleStartRecording}>
          <Text style={styles.buttonText}>Record a new route</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Saved routes</Text>
        {routes.length === 0 && <Text style={styles.dim}>No routes recorded yet.</Text>}
        {routes.map((r) => (
          <View key={r.id} style={styles.routeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeName}>{r.name}</Text>
              <Text style={styles.routeMeta}>
                {formatDistance(r.distanceMeters)} · {Math.round(r.durationMs / 1000)}s
              </Text>
            </View>
            <Pressable style={styles.smallButton} onPress={() => handleStartRace(r)}>
              <Text style={styles.buttonText}>Race</Text>
            </Pressable>
            <Pressable style={[styles.smallButton, styles.danger]} onPress={() => handleDelete(r.id)}>
              <Text style={styles.buttonText}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    );
  }

  // ---- RECORDING ----
  if (mode === 'recording') {
    const last = recorder.points[recorder.points.length - 1];
    return (
      <View style={styles.screen}>
        <View style={styles.mapContainer}>
          <GhostMap
            latitude={last?.lat ?? FALLBACK.lat}
            longitude={last?.lng ?? FALLBACK.lng}
            path={recorder.points}
          />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Recording…</Text>
          <Text style={styles.subtitle}>{recorder.points.length} points captured</Text>
          <Pressable style={[styles.button, styles.danger]} onPress={handleStopRecording}>
            <Text style={styles.buttonText}>Stop & save</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- NAMING ----
  if (mode === 'naming') {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Name this route</Text>
        <Text style={styles.subtitle}>
          {recorder.points.length} points ·{' '}
          {formatDistance(
            recorder.points.length
              ? recorder.points[recorder.points.length - 1].t / 1000
              : 0
          )}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. House to Bridgeport Station"
          placeholderTextColor="#7d8895"
          value={nameInput}
          onChangeText={setNameInput}
        />
        <Pressable style={[styles.button, styles.primary]} onPress={handleSaveRoute}>
          <Text style={styles.buttonText}>Save route</Text>
        </Pressable>
      </View>
    );
  }

  // ---- RACING ----
  const ghostLabel = race.delta ? formatDelta(race.delta.deltaMs) : 'waiting for GPS…';
  const ghostColor = race.delta && race.delta.deltaMs < 0 ? '#4ee6a8' : '#ff6b6b';

  return (
    <View style={styles.screen}>
      <View style={styles.mapContainer}>
        <GhostMap
          latitude={race.current?.lat ?? FALLBACK.lat}
          longitude={race.current?.lng ?? FALLBACK.lng}
          path={selectedRoute?.points ?? []}
          ghostPosition={race.delta?.ghostPosition}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Racing: {selectedRoute?.name}</Text>
        <Text style={[styles.deltaText, { color: ghostColor }]}>{ghostLabel}</Text>
        <Pressable style={[styles.button, styles.danger]} onPress={handleStopRace}>
          <Text style={styles.buttonText}>Stop race</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 16, gap: 10 },
  mapContainer: { height: '55%', borderBottomWidth: 1, borderColor: '#232b35' },
  title: { color: '#e6edf3', fontSize: 18, fontWeight: '600' },
  subtitle: { color: '#7d8895', fontSize: 12 },
  sectionLabel: {
    color: '#7d8895',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
  },
  dim: { color: '#7d8895', fontSize: 12 },
  button: {
    backgroundColor: '#161d26',
    borderWidth: 1,
    borderColor: '#232b35',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primary: { backgroundColor: '#4ee6a8', borderColor: '#4ee6a8' },
  danger: { backgroundColor: '#3a1f22', borderColor: '#5c2b30' },
  buttonText: { color: '#e6edf3', fontWeight: '600', fontSize: 13 },
  input: {
    backgroundColor: '#161d26',
    borderWidth: 1,
    borderColor: '#232b35',
    borderRadius: 8,
    color: '#e6edf3',
    padding: 12,
    fontSize: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#161d26',
  },
  routeName: { color: '#e6edf3', fontSize: 14, fontWeight: '600' },
  routeMeta: { color: '#7d8895', fontSize: 11, marginTop: 2 },
  smallButton: {
    backgroundColor: '#161d26',
    borderWidth: 1,
    borderColor: '#232b35',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  deltaText: { fontSize: 32, fontWeight: '700' },
});