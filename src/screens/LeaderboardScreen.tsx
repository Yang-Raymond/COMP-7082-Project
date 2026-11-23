// Leaderboard for one route: the fastest run of each person, ranked. Opened from a route card on Home.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { colors } from '../constants/ghostTheme';
import { formatDateTime, formatKm, formatMinSec } from '../services/format';
import { cleanError } from '../services/friends';
import { getLeaderboard, Leaderboard } from '../services/leaderboard';

interface Props {
  /** The server's id for the route. */
  routeId: string;
  /** Shown while the board loads. */
  routeName: string;
  onBack: () => void;
}

const MEDAL = ['#F5B301', '#9AA0A6', '#C77B30']; 

export default function LeaderboardScreen({ routeId, routeName, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    getLeaderboard(routeId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(cleanError(e, "Couldn't load the leaderboard.")));
    return () => {
      alive = false;
    };
  }, [routeId]);

  const entries = data?.entries ?? [];
  const leader = entries[0];

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <Pressable style={s.back} onPress={onBack} hitSlop={8} accessibilityLabel="Back">
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={s.backText}>Back</Text>
      </Pressable>

      <View style={s.header}>
        <Text style={s.title} numberOfLines={2}>{data?.route.name ?? routeName}</Text>
        <Text style={s.sub}>
          {data
            ? `${formatKm(data.route.distanceMeters)} km · ${data.route.activity === 'bike' ? 'Bike' : 'Run'} · ${entries.length} ${entries.length === 1 ? 'runner' : 'runners'}`
            : 'Leaderboard'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {!data && !error && <Text style={s.empty}>Loading…</Text>}
        {error && <Text style={s.empty}>{error}</Text>}
        {data && entries.length === 0 && <Text style={s.empty}>No runs on this route yet. Be the first.</Text>}

        {entries.map((e) => (
          <View key={e.userId} style={[s.row, e.isMe && s.rowMe]}>
            <View style={[s.rank, e.rank <= 3 && { backgroundColor: MEDAL[e.rank - 1] }]}>
              <Text style={[s.rankText, e.rank <= 3 && { color: '#fff' }]}>{e.rank}</Text>
            </View>
            <Avatar name={e.username} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {e.username}
                {e.isMe ? ' (you)' : ''}
              </Text>
              <Text style={s.date}>{formatDateTime(e.startedAt)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.time}>
                {formatMinSec(e.durationMs)} <Text style={s.unit}>min</Text>
              </Text>
              {leader && e.rank > 1 && (
                <Text style={s.gap}>+{formatMinSec(e.durationMs - leader.durationMs)}</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, marginBottom: 12 },
  backText: { fontSize: 16, color: colors.primary },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  empty: { color: colors.muted, fontSize: 14, paddingHorizontal: 20, paddingVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMe: { backgroundColor: colors.fieldBg },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border },
  rankText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  name: { fontSize: 15, fontWeight: '600', color: colors.primary },
  date: { fontSize: 11, color: colors.muted },
  time: { fontSize: 17, fontWeight: '700', color: colors.primary },
  unit: { fontSize: 12, fontWeight: '500' },
  gap: { fontSize: 11, color: colors.muted },
});