// Explore screen: map with a search bar and filter chips, plus a bottom sheet listing nearby challenges.
// Every listed route gets a pin at its start. Tapping a pin or a card selects the route (draws it and zooms to fit).
// The selected card expands to show Distance, Time to beat and a Start button; tapping it again collapses it.
// The list has your own routes (from this phone) plus routes shared with you by the server (public + friends').
// Above the cards is a "Live now" strip showing who is racing you at the moment.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthContext } from '../auth';
import AvatarStack from '../components/AvatarStack';
import BottomSheet from '../components/BottomSheet';
import ChallengeCard from '../components/ChallengeCard';
import GhostMap from '../components/GhostMap';
import LiveStrip from '../components/LiveStrip';
import LocationButton from '../components/LocationButton';
import { colors, shadow } from '../constants/ghostTheme';
import type { Challenges } from '../hooks/useChallenges';
import { useCurrentPosition } from '../hooks/useCurrentPosition';
import { useLiveChallengers } from '../hooks/useLiveChallengers';
import { showNotice } from '../services/dialog';
import { formatDistance, haversineDistance } from '../services/distance';
import { cleanError } from '../services/friends';
import { archiveRoute } from '../services/serverRoutes';
import { deleteRoute, getRoutes } from '../services/storage';
import type { GhostMapHandle } from '../types/map';
import { SavedRoute } from '../types/route';
import LeaderboardScreen from './LeaderboardScreen';
import SearchScreen from './SearchScreen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | 'run' | 'bike' | 'friends';

const MAX_AVATARS = 3;

/** Toggleable filter chip under the search bar. Dark when selected. */
function Chip({ label, icon, on, onPress }: { label: string; icon?: IconName; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}>
      {icon && <Ionicons name={icon} size={14} color={on ? colors.onPrimary : colors.text} />}
      <Text style={[s.chipText, on && { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

interface Props {
  onRace: (r: SavedRoute) => void;
  /** Shared routes and who made them (loaded once in the app shell). */
  challenges: Challenges;
  /** "Add friends" button in the empty state. */
  onAddFriends?: () => void;
  /** "Record a route" button in the empty state. */
  onRecord?: () => void;
}

export default function HomeScreen({ onRace, challenges, onAddFriends, onRecord }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<GhostMapHandle>(null);
  const { user } = useAuthContext();
  const { shared, info, infoOf } = challenges;
  const live = useLiveChallengers();
  const [routes, setRoutes] = useState<SavedRoute[]>([]); // saved on this phone
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  // Search opens over the map (the map stays mounted underneath so the camera can move when a result is chosen)
  const [searching, setSearching] = useState(false);
  // The route whose leaderboard is open, if any
  const [board, setBoard] = useState<{ id: string; name: string } | null>(null);
  const { position, isLive } = useCurrentPosition();

  useEffect(() => {
    getRoutes().then(setRoutes);
  }, []);

  // Local storage is shared by everyone who signs in on this phone, so only show (and allow deleting) the
  // signed-in user's own routes from it. Routes with no ownerId belong to nobody and are hidden.
  const isMine = (r: SavedRoute) => r.ownerId === user?.id;

  const visible = useMemo(() => {
    const mine = routes.filter((r) => r.ownerId === user?.id);
    const q = query.trim().toLowerCase();
    const list = [...mine, ...shared].filter((r) => {
      const i = info[r.id.replace(/^server-/, '')];
      return (
        (r.name.toLowerCase().includes(q) || (i?.creator ?? '').toLowerCase().includes(q)) &&
        (filter === 'all' || filter === 'friends' || (r.activity ?? 'run') === filter) &&
        (filter !== 'friends' || !!i?.byFriend)
      );
    });
    // Closest first once we have a live location
    if (isLive && position) {
      const d = (r: SavedRoute) => (r.points[0] ? haversineDistance(position, r.points[0]) : Infinity);
      list.sort((a, b) => d(a) - d(b));
    }
    return list;
  }, [routes, shared, info, query, filter, user?.id, isLive, position]);

  // The people behind the visible challenges, closest first, for the avatars next to the title
  const nearbyNames = useMemo(() => {
    const names: string[] = [];
    for (const r of visible) {
      const who = isMine(r) ? undefined : infoOf(r)?.creator;
      if (who && !names.includes(who)) names.push(who);
      if (names.length === MAX_AVATARS) break;
    }
    return names;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, infoOf, user?.id]);

  // Route currently highlighted on the map and expanded in the list
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

  /** Card tap: expands the card and fits the route on the map; tapping the open card collapses it. */
  const onCardPress = (r: SavedRoute) => {
    if (r.id === selectedId) setSelectedId(null);
    else selectRoute(r);
  };

  /** Pin tap: selects (and expands) the route */
  const onPinPress = (id: string) => {
    const r = visible.find((v) => v.id === id);
    if (r) selectRoute(r);
  };

  /** Opens the leaderboard of an uploaded route. A route that only lives on this phone has none. */
  const openBoard = (r: SavedRoute) => {
    const up = r.upload;
    if (up?.state === 'done') setBoard({ id: up.serverId, name: r.name });
    else showNotice('Leaderboard', 'Choose Save & Challenge when you save a route to give it a leaderboard.');
  };

  /** Deletes one of your own routes. If it was uploaded, it is removed on the server too, so friends stop seeing it. */
  const remove = async (r: SavedRoute) => {
    if (!isMine(r)) return;
    const up = r.upload;
    if (up?.state === 'done') {
      try {
        await archiveRoute(up.serverId);
      } catch (e) {
        showNotice('Delete route', cleanError(e, "Couldn't delete it from the server. Try again."));
        return;
      }
    }
    await deleteRoute(r.id);
    if (r.id === selectedId) setSelectedId(null);
    setRoutes(await getRoutes());
  };

  // Every route I can see, for the search screen to look through
  const allRoutes = useMemo(() => [...routes.filter((r) => r.ownerId === user?.id), ...shared], [routes, shared, user?.id]);

  /** A route was picked in search: close search, expand its card and fit it on the map. */
  const pickRoute = (r: SavedRoute) => {
    setSearching(false);
    setQuery('');
    setFilter('all');
    selectRoute(r);
  };

  /** A place was picked in search: close search and show the area around it. */
  const pickPlace = ({ lat, lng }: { lat: number; lng: number }) => {
    setSearching(false);
    const d = 0.004; // about 450 m each way
    mapRef.current?.fitTo([
      { lat: lat - d, lng: lng - d },
      { lat: lat + d, lng: lng + d },
    ]);
  };

  const noRoutesAtAll = routes.filter(isMine).length + shared.length === 0;

  const searchUI = (
    <>
      <Pressable style={[s.search, shadow]} onPress={() => setSearching(true)} accessibilityRole="search">
        <Ionicons name="search" size={18} color={colors.text} />
        <Text style={[s.searchText, !query && { color: colors.muted }]} numberOfLines={1}>
          {query || 'Search routes'}
        </Text>
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="All" on={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Run" icon="walk" on={filter === 'run'} onPress={() => setFilter(filter === 'run' ? 'all' : 'run')} />
        <Chip label="Ride" icon="bicycle" on={filter === 'bike'} onPress={() => setFilter(filter === 'bike' ? 'all' : 'bike')} />
        <Chip label="Friends" icon="people-outline" on={filter === 'friends'} onPress={() => setFilter(filter === 'friends' ? 'all' : 'friends')} />
      </ScrollView>
    </>
  );

  const emptyUI = (
    <View style={{ gap: 12, paddingTop: 4 }}>
      <Text style={s.emptyBody}>Add friends to get challenges, or record a route and be the first ghost here.</Text>
      <Pressable style={({ pressed }) => [s.start, pressed && { opacity: 0.8 }]} onPress={onAddFriends}>
        <Ionicons name="person-add-outline" size={16} color={colors.onPrimary} />
        <Text style={s.startText}>Add friends</Text>
      </Pressable>
      <Pressable style={({ pressed }) => [s.outlined, pressed && { opacity: 0.7 }]} onPress={onRecord}>
        <Ionicons name="radio-button-on-outline" size={16} color={colors.primary} />
        <Text style={s.outlinedText}>Record a route</Text>
      </Pressable>
    </View>
  );

  const cardsUI = noRoutesAtAll ? (
    emptyUI
  ) : (
    <>
      <LiveStrip challengers={live} />
      {visible.length === 0 ? (
        <Text style={s.empty}>No routes match your search.</Text>
      ) : (
        visible.map((r) => {
          const start = r.points[0];
          // Only measure from a live fix, never from a stale stored location.
          const away = isLive && position && start ? formatDistance(haversineDistance(position, start)) : null;
          const mine = isMine(r);
          return (
            <ChallengeCard
              key={r.id}
              route={r}
              mine={mine}
              info={infoOf(r)}
              away={away}
              expanded={r.id === selectedId}
              onPress={() => onCardPress(r)}
              onStart={() => onRace(r)}
              onBoard={() => openBoard(r)}
              onDelete={mine ? () => remove(r) : undefined}
            />
          );
        })
      )}
    </>
  );

  const sheetTitle = noRoutesAtAll
    ? 'No ghosts around yet'
    : `${visible.length} ${visible.length === 1 ? 'challenge' : 'challenges'} nearby`;

  const map = <GhostMap ref={mapRef} center={position} showUser={isLive} pins={pins} onPinPress={onPinPress} path={selected?.points} />;

  // Leaderboard open: show it instead of the map (all hooks are above, so this early return is safe)
  if (board) return <LeaderboardScreen routeId={board.id} routeName={board.name} onBack={() => setBoard(null)} />;

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>{map}</View>
      <View style={[s.top, { paddingTop: insets.top + 10 }]}>{searchUI}</View>
      <BottomSheet
        title={sheetTitle}
        titleLeft={noRoutesAtAll ? undefined : <AvatarStack names={nearbyNames} />}
        accessory={<LocationButton mapRef={mapRef} />}
      >
        {cardsUI}
      </BottomSheet>
      {searching && user?.id != null && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
          <SearchScreen
            userId={user.id}
            routes={allRoutes}
            infoOf={infoOf}
            position={position}
            isLive={isLive}
            initialQuery={query}
            onBack={() => setSearching(false)}
            onSelectRoute={pickRoute}
            onSelectPlace={pickPlace}
            onSubmitQuery={(text) => {
              setQuery(text);
              setSearching(false);
            }}
          />
        </View>
      )}
    </View>
  );
}

const noSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : {};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, gap: 10 },

  search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 18, height: 48 },
  searchText: { flex: 1, fontSize: 14, color: colors.text },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, ...shadow, shadowOpacity: 0.08 },
  chipOn: { backgroundColor: colors.text },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.text, ...noSelect },

  empty: { color: colors.muted, fontSize: 14, paddingVertical: 12 },
  emptyBody: { fontSize: 14, lineHeight: 20, color: colors.muted },
  start: { height: 48, borderRadius: 24, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  startText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  outlined: { height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outlinedText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});