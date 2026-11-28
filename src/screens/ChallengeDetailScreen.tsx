// Challenge detail: the route on a map with back button and start/end markers, "activity type · distance away from starting point", the route name,
// three stats (distance, elevation and the time to beat / fastest time), the route's leaderboard and, for a To race
// challenge, a Start button. Opened by tapping a card in any Challenges tab. It only hands the loaded route to
// `onStart`, so it doesn't depend on how the race screen works.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../auth';
import Avatar from '../components/Avatar';
import GhostMap from '../components/GhostMap';
import { colors, shadow } from '../constants/ghostTheme';
import { useCurrentPosition } from '../hooks/useCurrentPosition';
import { formatDistance, haversineDistance } from '../services/distance';
import { formatKm, formatMinSec } from '../services/format';
import { cleanError } from '../services/friends';
import { getLeaderboard, Leaderboard } from '../services/leaderboard';
import { fetchRoute } from '../services/serverRoutes';
import type { ChallengeDetailTarget } from '../types/challenge';
import type { SavedRoute } from '../types/route';

interface Props {
  target: ChallengeDetailTarget;
  onBack: () => void;
  /** Race the loaded route. Only used for a To race challenge. */
  onStart: (route: SavedRoute) => void;
}

/** The sender's time, used for the third stat when the leaderboard can't supply the #1 time. Null when unknown. */
function senderTime(target: ChallengeDetailTarget): number | null {
  switch (target.kind) {
    case 'toRace':
    case 'sent':
      return target.challenge.senderMs;
    case 'finished':
      return target.challenge.role === 'received' ? target.challenge.theirsMs : target.challenge.mineMs;
  }
}

/** One of the three stat tiles. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

/**
 * Loads the route and its leaderboard in parallel whenever `target` changes (an `alive` flag drops results that
 * arrive after the screen has moved on). A route failure replaces the content with a message. Aleaderboard-only
 * failure keeps the route and stats and shows a small note, with the third stat falling back to the sender's time.
 */
export default function ChallengeDetailScreen({ target, onBack, onStart }: Props) {
  const insets = useSafeAreaInsets();
  const { session } = useAuthContext();
  const { position } = useCurrentPosition();
  const challenge = target.challenge;
  const routeId = challenge.route.id;

  // What the server returned for one route id. Tagging it with the id means a stale result is never shown for a
  // different challenge, and `loading` is simply "no result for the current id yet" (no setState needed to reset).
  const [result, setResult] = useState<{
    id: string;
    route: SavedRoute | null;
    board: Leaderboard | null;
    routeError: string | null;
    boardError: string | null;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([fetchRoute(routeId), getLeaderboard(routeId)]).then(([r, b]) => {
      if (!alive) return;
      setResult({
        id: routeId,
        route: r.status === 'fulfilled' ? r.value : null,
        board: b.status === 'fulfilled' ? b.value : null,
        routeError: r.status === 'rejected' ? cleanError(r.reason, "Couldn't load this route.") : null,
        boardError: b.status === 'rejected' ? cleanError(b.reason, "Couldn't load the leaderboard.") : null,
      });
    });
    return () => {
      alive = false;
    };
  }, [routeId]);

  const current = result?.id === routeId ? result : null;
  const loading = current === null;
  const route = current?.route ?? null;
  const board = current?.board ?? null;
  const routeError = current?.routeError ?? null;
  const boardError = current?.boardError ?? null;

  const entries = board?.entries ?? [];
  const myName = session?.user?.username;
  const hasMyEntry = entries.some((e) => e.isMe);
  const thirdMs = entries[0]?.durationMs ?? senderTime(target);
  const thirdLabel = target.kind === 'toRace' ? 'To beat' : 'Fastest';
  const activityLabel = challenge.route.activity === 'bike' ? 'Bike' : 'Run';
  const away =
    route && position && route.points.length > 0 ? formatDistance(haversineDistance(position, route.points[0])) : null;

  let body: React.ReactNode;
  if (loading) {
    body = <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  } else if (routeError || !route) {
    body = (
      <View style={s.center}>
        <Text style={s.errorTitle}>Couldn&apos;t open this challenge</Text>
        <Text style={s.errorBody}>{routeError}</Text>
        <Pressable style={({ pressed }) => [s.errorBtn, pressed && { opacity: 0.8 }]} onPress={onBack}>
          <Text style={s.startText}>Back</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <>
        <View style={s.stats}>
          <Stat label="Distance" value={`${formatKm(route.distanceMeters)} km`} />
          <Stat label="Elev" value={`${Math.round(route.elevationGainMeters ?? 0)} m`} />
          <Stat label={thirdLabel} value={thirdMs != null ? formatMinSec(thirdMs) : '–'} />
        </View>

        <Text style={s.section}>Leaderboard</Text>
        {boardError && <Text style={s.note}>{boardError}</Text>}
        {entries.map((e) => (
          <View key={e.userId} style={[s.row, e.isMe && s.rowMe]}>
            <Text style={s.rank}>{e.rank}</Text>
            <Avatar name={e.username} size={36} />
            <Text style={s.name} numberOfLines={1}>
              {e.username}
              {e.isMe ? ' (you)' : ''}
            </Text>
            <Text style={s.time}>{formatMinSec(e.durationMs)}</Text>
          </View>
        ))}
        {board && !hasMyEntry && myName && (
          <View style={[s.row, s.rowMe]}>
            <Text style={s.rank}>–</Text>
            <Avatar name={myName} size={36} />
            <Text style={s.name} numberOfLines={1}>You</Text>
            <Text style={s.notRaced}>Not raced yet</Text>
          </View>
        )}
        {board && entries.length === 0 && !myName && <Text style={s.note}>No runs on this route yet.</Text>}
      </>
    );
  }

  const showStart = target.kind === 'toRace' && !!route && !routeError;

  return (
    <View style={s.root}>
      <View style={s.map}>
        {route && (
          <GhostMap path={route.points} fitPath interactive={false} showUser={false} showEndpoints />
        )}
        <Pressable
          style={[s.backBtn, { top: insets.top + 8 }]}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: showStart ? 96 : 24 }]}>
        <Text style={s.meta}>
          {activityLabel}
          {away ? ` · ${away} away` : ''}
        </Text>
        <Text style={s.title} numberOfLines={2}>{challenge.route.name}</Text>
        {body}
      </ScrollView>

      {showStart && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={({ pressed }) => [s.start, pressed && { opacity: 0.8 }]}
            onPress={() => route && onStart(route)}
            accessibilityRole="button"
            accessibilityLabel={`Start ${challenge.route.name}`}
          >
            <Text style={s.startText}>Start</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { height: '40%', backgroundColor: colors.border },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  meta: { fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, color: colors.text, marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 16 },
  stat: { flex: 1, borderRadius: 14, backgroundColor: colors.fieldBg, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 24, marginBottom: 4 },
  note: { fontSize: 13, color: colors.muted, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMe: { backgroundColor: colors.fieldBg, borderRadius: 12 },
  rank: { width: 20, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.muted },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  time: { fontSize: 15, fontWeight: '700', color: colors.text },
  notRaced: { fontSize: 13, color: colors.muted },
  center: { alignItems: 'center', gap: 10, paddingTop: 32 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  errorBody: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  errorBtn: {
    alignSelf: 'stretch',
    height: 48,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.bg },
  start: { height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.onPrimary, fontSize: 16, fontWeight: '600' },
});
