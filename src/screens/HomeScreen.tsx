
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GhostMap from '../components/GhostMap';
import BottomSheet from '../components/BottomSheet';
import { useAuthContext } from '../auth';
import { GpsTracker } from '../services/gpsTracker';
import { getRoutes, deleteRoute } from '../services/storage';
import { formatKm, formatMinSec } from '../services/format';
import { colors, shadow } from '../constants/ghostTheme';
import { ActivityType, SavedRoute } from '../types/route';

const FALLBACK = { lat: 49.2494, lng: -122.9987 }; 

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function HomeScreen({ onRace }: { onRace: (r: SavedRoute) => void }) {
  const insets = useSafeAreaInsets();
  const { canChallenge } = useAuthContext();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ActivityType | null>(null);
  const [publicOnly, setPublicOnly] = useState(false); 
  const [pos, setPos] = useState(FALLBACK);
  const tracker = useRef(new GpsTracker());

  useEffect(() => {
    getRoutes().then(setRoutes);
    tracker.current.getCurrent().then((fix) => {
      if (fix) setPos({ lat: fix.lat, lng: fix.lng });
    });
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

  const remove = async (id: string) => {
    await deleteRoute(id);
    setRoutes(await getRoutes());
  };

  const Chip = ({ label, icon, on, onPress }: { label: string; icon: IconName; on: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );

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

  const cardsUI = (
    <>
      {visible.length === 0 && (
        <Text style={s.empty}>
          {routes.length === 0
            ? 'No routes yet. Tap Record to create your first challenge.'
            : 'No routes match your search.'}
        </Text>
      )}
      {visible.map((r) => (
        <View key={r.id} style={s.card}>
          <View style={s.cardHead}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{r.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle} numberOfLines={1}>{r.name}</Text>
              <Text style={s.cardSub}>Beat your own ghost</Text>
            </View>
            <View style={s.tag}>
              <Text style={s.tagText}>{(r.activity ?? 'run') === 'bike' ? 'Bike' : 'Run'}</Text>
            </View>
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
            <View style={s.actions}>
              <Pressable onPress={() => remove(r.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
              <Pressable style={s.raceBtn} onPress={() => onRace(r)}>
                {!canChallenge && <Ionicons name="lock-closed" size={13} color={colors.onPrimary} />}
                <Text style={s.raceText}>Race</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
    </>
  );

  const map = <GhostMap latitude={pos.lat} longitude={pos.lng} />;

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>{map}</View>
      <View style={[s.top, { paddingTop: insets.top + 10 }]}>{searchUI}</View>
      <BottomSheet title="Challenges Nearby">{cardsUI}</BottomSheet>
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
  tag: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontSize: 11, color: colors.text },
  cardRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  small: { fontSize: 11, color: colors.muted },
  big: { fontSize: 26, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 14, fontWeight: '600' },
  actions: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14 },
  raceBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 9 },
  raceText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14 },
});