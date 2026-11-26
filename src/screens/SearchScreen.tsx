// Full-screen search that opens when you tap the search bar on Explore.
// Empty: your recent searches. Typing: matching routes (with distance and time to beat) or, on the Places tab,
// addresses and landmarks from Mapbox. Recent searches stay under the results.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../constants/ghostTheme';
import type { Info } from '../hooks/useChallenges';
import { formatDistance, haversineDistance } from '../services/distance';
import { formatKm, formatMinSec } from '../services/format';
import { addRecent, clearRecents, getRecents } from '../services/recentSearches';
import type { LatLng } from '../types/map';
import type { SavedRoute } from '../types/route';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

const DISTANCES: { label: string; km: number | null }[] = [
  { label: 'Under 1 km', km: 1 },
  { label: 'Under 3 km', km: 3 },
  { label: 'Under 5 km', km: 5 },
  { label: 'Under 10 km', km: 10 },
  { label: 'Any distance', km: null },
];

type Place = { id: string; name: string; detail: string; lat: number; lng: number };

/** Addresses and landmarks matching `q`, nearest to `near` first when we know where the person is. */
async function searchPlaces(q: string, near: LatLng | null, signal: AbortSignal): Promise<Place[]> {
  const url =
    `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&limit=6&autocomplete=true` +
    (near ? `&proximity=${near.lng},${near.lat}` : '') +
    `&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('places');
  const data = await res.json();
  return (data.features ?? []).map((f: any) => ({
    id: String(f.id),
    name: f.properties?.name ?? '',
    detail: f.properties?.place_formatted ?? f.properties?.full_address ?? '',
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
  }));
}

interface Props {
  userId: number;
  /** Every route the person can see (their own and shared), not filtered by anything. */
  routes: SavedRoute[];
  infoOf: (r: SavedRoute) => Info | undefined;
  position: LatLng | null;
  isLive: boolean;
  initialQuery?: string;
  onBack: () => void;
  /** A route was chosen from the results. */
  onSelectRoute: (r: SavedRoute) => void;
  /** A place was chosen from the results. */
  onSelectPlace: (p: { lat: number; lng: number }) => void;
  /** The keyboard's Search key was pressed: go back and filter Explore by this text. */
  onSubmitQuery: (q: string) => void;
}

export default function SearchScreen({
  userId,
  routes,
  infoOf,
  position,
  isLive,
  initialQuery = '',
  onBack,
  onSelectRoute,
  onSelectPlace,
  onSubmitQuery,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<'routes' | 'places'>('routes');
  const [km, setKm] = useState<number | null>(3);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [placesState, setPlacesState] = useState<'idle' | 'loading' | 'error'>('idle');
  // Latest position without re-running the places search every time the GPS updates
  const posRef = useRef(position);
  posRef.current = position;

  const q = query.trim().toLowerCase();

  useEffect(() => {
    getRecents(userId).then(setRecents);
  }, [userId]);

  const remember = async (text: string) => setRecents(await addRecent(userId, text));

  const results = useMemo(() => {
    if (!q) return [];
    const list = routes
      .filter((r) => r.name.toLowerCase().includes(q) || (infoOf(r)?.creator ?? '').toLowerCase().includes(q))
      .map((r) => ({ r, d: isLive && position && r.points[0] ? haversineDistance(position, r.points[0]) : null }))
      // Without a live location we can't measure, so nothing is hidden by distance
      .filter((x) => km == null || x.d == null || x.d <= km * 1000);
    list.sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.r.name.localeCompare(b.r.name));
    return list;
  }, [q, routes, infoOf, isLive, position, km]);

  // Places: wait for a pause in typing, and drop answers that arrive late
  useEffect(() => {
    if (tab !== 'places' || q.length < 2) {
      setPlaces([]);
      setPlacesState('idle');
      return;
    }
    if (!MAPBOX_TOKEN) {
      setPlacesState('error');
      return;
    }
    const ctrl = new AbortController();
    setPlacesState('loading');
    const t = setTimeout(async () => {
      try {
        setPlaces(await searchPlaces(query.trim(), posRef.current, ctrl.signal));
        setPlacesState('idle');
      } catch {
        if (!ctrl.signal.aborted) setPlacesState('error');
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [tab, query, q]);

  const chooseRoute = (r: SavedRoute) => {
    remember(r.name);
    onSelectRoute(r);
  };
  const choosePlace = (p: Place) => {
    remember(p.name);
    onSelectPlace({ lat: p.lat, lng: p.lng });
  };
  const submit = () => {
    const text = query.trim();
    if (!text) return;
    remember(text);
    onSubmitQuery(text);
  };

  const distLabel = DISTANCES.find((d) => d.km === km)?.label ?? 'Any distance';

  return (
    <View style={[s.root, { paddingTop: insets.top + 12 }]}>
      <View style={s.field}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'routes' ? 'Search routes' : 'Search places'}
          placeholderTextColor={colors.muted}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={submit}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View style={s.chips}>
        <Pressable style={[s.chip, tab === 'routes' && s.chipOn]} onPress={() => setTab('routes')}>
          <Text style={[s.chipText, tab === 'routes' && s.chipTextOn]}>Routes</Text>
        </Pressable>
        <Pressable style={[s.chip, tab === 'places' && s.chipOn]} onPress={() => { setTab('places'); setMenuOpen(false); }}>
          <Text style={[s.chipText, tab === 'places' && s.chipTextOn]}>Places</Text>
        </Pressable>
        {tab === 'routes' && (
          <Pressable style={s.chip} onPress={() => setMenuOpen(!menuOpen)}>
            <Text style={s.chipText}>{distLabel}</Text>
            <Ionicons name={menuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text} />
          </Pressable>
        )}
      </View>

      {menuOpen && (
        <View style={[s.menu, shadow]}>
          {DISTANCES.map((d) => (
            <Pressable key={d.label} style={s.menuItem} onPress={() => { setKm(d.km); setMenuOpen(false); }}>
              <Text style={[s.menuText, d.km === km && { fontWeight: '700', color: colors.primary }]}>{d.label}</Text>
              {d.km === km && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {tab === 'routes' && q.length > 0 && (
          results.length === 0 ? (
            <Text style={s.empty}>
              {km != null && isLive ? `No routes found under ${km} km. Try a wider distance.` : 'No routes found.'}
            </Text>
          ) : (
            results.map(({ r, d }) => (
              <Pressable key={r.id} style={({ pressed }) => [s.card, shadow, pressed && { opacity: 0.8 }]} onPress={() => chooseRoute(r)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{r.name}</Text>
                  <Text style={s.cardSub} numberOfLines={1}>
                    {[`${formatKm(r.distanceMeters)} km`, d != null ? `${formatDistance(d)} away` : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={s.cardTime}>{formatMinSec(r.durationMs)}</Text>
              </Pressable>
            ))
          )
        )}

        {tab === 'places' && q.length >= 2 && (
          <>
            {placesState === 'loading' && places.length === 0 && <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />}
            {placesState === 'error' && (
              <Text style={s.empty}>{MAPBOX_TOKEN ? "Couldn't search places. Check your connection." : 'Place search needs a Mapbox token.'}</Text>
            )}
            {placesState === 'idle' && places.length === 0 && <Text style={s.empty}>No places found.</Text>}
            {places.map((p) => (
              <Pressable key={p.id} style={({ pressed }) => [s.card, shadow, pressed && { opacity: 0.8 }]} onPress={() => choosePlace(p)}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{p.name}</Text>
                  {p.detail ? <Text style={s.cardSub} numberOfLines={1}>{p.detail}</Text> : null}
                </View>
              </Pressable>
            ))}
          </>
        )}

        {recents.length > 0 && (
          <View style={{ marginTop: q ? 8 : 0 }}>
            <View style={s.recentHead}>
              <Text style={s.recentLabel}>RECENT</Text>
              <Pressable onPress={() => { clearRecents(userId); setRecents([]); }} hitSlop={8}>
                <Text style={s.clear}>Clear</Text>
              </Pressable>
            </View>
            {recents.map((text) => (
              <Pressable key={text} style={s.recent} onPress={() => setQuery(text)}>
                <Ionicons name="time-outline" size={16} color={colors.muted} />
                <Text style={s.recentText} numberOfLines={1}>{text}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#fff', paddingHorizontal: 16 },
  input: { flex: 1, height: '100%', fontSize: 14, color: colors.text, ...noOutline },

  chips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text },
  chipTextOn: { color: colors.onPrimary },

  menu: { position: 'absolute', top: 128, left: 150, zIndex: 10, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 6, minWidth: 170 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  menuText: { fontSize: 13, color: colors.text },

  content: { gap: 10, paddingBottom: 32 },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, shadowOpacity: 0.06 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  cardTime: { fontFamily: MONO, fontSize: 16, fontWeight: '700', color: colors.text },

  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  recentLabel: { fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  clear: { fontSize: 11, fontWeight: '700', color: colors.primary },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  recentText: { flex: 1, fontSize: 14, color: colors.text },
});