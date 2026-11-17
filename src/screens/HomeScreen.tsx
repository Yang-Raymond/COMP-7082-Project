// Home screen: map with a search bar and activity filters, plus a bottom sheet listing nearby challenges.
// Every listed route gets a pin at its start. Tapping a pin or card selects the route (draws it and zooms to fit).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GhostMap from '../components/GhostMap';
import LocationButton from '../components/LocationButton';
import type { GhostMapHandle } from '../types/map';
import BottomSheet from '../components/BottomSheet';
import RouteSketch from '../components/RouteSketch';
import { useAuthContext } from '../auth';
import { useCurrentPosition } from '../hooks/useCurrentPosition';
import { getRoutes, deleteRoute } from '../services/storage';
import { formatKm, formatMinSec } from '../services/format';
import { formatDistance, haversineDistance } from '../services/distance';
import { colors, shadow } from '../constants/ghostTheme';
import { ActivityType, SavedRoute } from '../types/route';


type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Toggleable filter chip shown under the search bar. */
function Chip({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Loads saved routes, filters them by search text and activity, and renders them
 * as race-able cards over a live map centered on the shared current position.
 * Each visible route has a start pin on the map. Selecting a route
 * draws its path and fits the camera to it.
 */
export default function HomeScreen({ onRace }: { onRace: (r: SavedRoute) => void }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<GhostMapHandle>(null);
  const { canChallenge } = useAuthContext();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ActivityType | null>(null);
  const [publicOnly, setPublicOnly] = useState(false); 
  const { position, isLive } = useCurrentPosition();

  useEffect(() => {
    getRoutes().then(setRoutes);
  }, []);

  const visible = useMemo(
    () =>
      routes.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) &&
          (!filter || (r.activity ?? 'run') === filter)
      ),
    [routes, query, filter]
  );

  // Route currently highlighted on the map
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => visible.find((r) => r.id === selectedId), [visible, selectedId]);

  // One pin per visible route, placed at its start point.
  const pins = useMemo(
    () => visible.filter((r) => r.points[0]).map((r) => ({ id: r.id, coordinate: r.points[0] })),
    [visible]
  );

  /** Highlights a route and zooms the map to fit it. */
  const selectRoute = (r: SavedRoute) => {
    setSelectedId(r.id);
    mapRef.current?.fitTo(r.points);
  };

  /** Card tap: first tap selects the route, a second tap on the selected route starts the race.
   * CHANGE LATER WHEN REDESIGNING THE HOME SCREEN.
   * New logic to be implemented later: tapping a card expands it and shows more details, 
   * fits route on map, and a "Race" button is shown to start the race. 
   * Tapping the card again collapses it.
   */
  const onCardPress = (r: SavedRoute) => {
    if (r.id === selectedId) onRace(r);
    else selectRoute(r);
  };

  /** Pin tap: only selects and fits the route on the map */
  const onPinPress = (id: string) => {
    const r = visible.find((v) => v.id === id);
    if (r) selectRoute(r);
  };

  const remove = async (id: string) => {
    await deleteRoute(id);
    if (id === selectedId) setSelectedId(null);
    setRoutes(await getRoutes());
  };

  /**
   * Search bar and filter buttons. 
   * The search bar filters by route name, and the filter buttons filter by activity type and public/private status.
   */
  const searchUI = (
    <>
      <View style={[s.search, shadow]}>
        <TextInput
          style={s.searchInput}
          placeholder="Search routes"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
        />
        <Ionicons name="search" size={20} color={colors.primary} />
      </View>
      <View style={s.chips}>
        <Chip label="Biking Tracks" icon="bicycle" on={filter === 'bike'} onPress={() => setFilter(filter === 'bike' ? null : 'bike')} />
        <Chip label="Running Tracks" icon="walk" on={filter === 'run'} onPress={() => setFilter(filter === 'run' ? null : 'run')} />
        <Chip label="Public" icon="globe-outline" on={publicOnly} onPress={() => setPublicOnly(!publicOnly)} />
      </View>
    </>
  );

  /**
   * Route cards.
   * Each route card shows the route name, activity type, time to beat, distance. 
   */
  const cardsUI = (
    <>
      {visible.length === 0 && (
        <Text style={s.empty}>
          {routes.length === 0
            ? 'No routes yet. Tap Record to create your first challenge.'
            : 'No routes match your search.'}
        </Text>
      )}
      {visible.map((r) => {
        const start = r.points[0];
        // Only measure from a live fix, never from a stale stored location.
        const away = isLive && position && start ? formatDistance(haversineDistance(position, start)) : null;
        return (
          <Pressable key={r.id} style={s.card} onPress={() => onCardPress(r)}>
            <View style={s.cardHead}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{r.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{r.name}</Text>
                <Text style={s.cardSub}>{away ? `${away} away` : 'Beat your own ghost'}</Text>
              </View>
              <View style={s.tag}>
                {!canChallenge && <Ionicons name="lock-closed" size={11} color={colors.text} />}
                <Text style={s.tagText}>{(r.activity ?? 'run') === 'bike' ? 'Bike' : 'Run'}</Text>
              </View>
              <Pressable onPress={() => remove(r.id)} hitSlop={8} accessibilityLabel="Delete route">
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <View style={s.cardRow}>
              <View>
                <Text style={s.small}>Time to beat</Text>
                <Text style={s.big}>{formatMinSec(r.durationMs)}<Text style={s.unit}>min</Text></Text>
              </View>
              <View>
                <Text style={s.small}>Distance</Text>
                <Text style={s.big}>{formatKm(r.distanceMeters)}<Text style={s.unit}>km</Text></Text>
              </View>
              <View style={s.sketch}>
                <RouteSketch points={r.points} />
              </View>
            </View>
          </Pressable>
        );
      })}
    </>
  );

  /**
   * Map using Mapbox.
   */
  const map = <GhostMap ref={mapRef} center={position} showUser={isLive} pins={pins} onPinPress={onPinPress} path={selected?.points} />;

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>{map}</View>
      <View style={[s.top, { paddingTop: insets.top + 10 }]}>{searchUI}</View>
      <BottomSheet title="Challenges Nearby" accessory={<LocationButton mapRef={mapRef} />}>{cardsUI}</BottomSheet>
    </View>
  );
}

const noSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : {};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 10 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 28, paddingHorizontal: 20, height: 50 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.chipActive, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.text, ...noSelect },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 12 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, backgroundColor: colors.bg, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.text },
  cardRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  small: { fontSize: 11, color: colors.muted },
  big: { fontSize: 26, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 14, fontWeight: '600' },
  sketch: { flex: 1, alignItems: 'flex-end' },
});