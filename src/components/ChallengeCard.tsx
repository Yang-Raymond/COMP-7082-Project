// One route card on Explore. Collapsed: who, how far, and the time to beat. Expanded: the numbers and a Start button.
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../constants/ghostTheme';
import type { Info } from '../hooks/useSharedRoutes';
import { formatKm, formatMinSec, timeAgo } from '../services/format';
import type { SavedRoute } from '../types/route';
import Avatar from './Avatar';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

interface Props {
  route: SavedRoute;
  mine: boolean;
  info?: Info;
  away: string | null;
  expanded: boolean;
  onPress: () => void;
  onStart: () => void;
  onBoard: () => void;
  /** Only passed for your own routes; shows a Delete link. */
  onDelete?: () => void;
}

export default function ChallengeCard({ route: r, mine, info, away, expanded, onPress, onStart, onBoard, onDelete }: Props) {
  const activity = (r.activity ?? 'run') === 'bike' ? 'Bike' : 'Run';
  const byFriend = !mine && !!info?.byFriend && !!info.creator;
  const title = byFriend ? `${info!.creator} challenged you` : r.name;
  const sub = [
    activity,
    mine ? 'Your route' : !byFriend && info?.creator ? `by ${info.creator}` : null,
    away ? `${away} away` : null,
    timeAgo(r.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable style={[s.card, expanded && s.cardOn]} onPress={onPress}>
      <View style={s.head}>
        <Avatar name={byFriend ? info!.creator : r.name} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </View>
        {expanded ? (
          <Ionicons name={activity === 'Bike' ? 'bicycle' : 'walk'} size={20} color={colors.primary} />
        ) : (
          <Text style={s.time}>{formatMinSec(r.durationMs)}</Text>
        )}
      </View>

      {expanded && (
        <>
          <View style={s.stats}>
            <View style={s.stat}>
              <Text style={s.statLabel}>Distance</Text>
              <Text style={s.statValue}>
                {formatKm(r.distanceMeters)}
                <Text style={s.statUnit}> km</Text>
              </Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Time to beat</Text>
              <Text style={s.statValue}>
                {formatMinSec(r.durationMs)}
                <Text style={s.statUnit}> min</Text>
              </Text>
            </View>
          </View>
          <Pressable style={({ pressed }) => [s.start, pressed && { opacity: 0.8 }]} onPress={onStart}>
            <Text style={s.startText}>Start</Text>
          </Pressable>
          <View style={s.links}>
            <Pressable onPress={onBoard} hitSlop={8}>
              <Text style={s.link}>Leaderboard</Text>
            </Pressable>
            {onDelete && (
              <Pressable onPress={onDelete} hitSlop={8}>
                <Text style={[s.link, { color: colors.behind }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        </>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 18, padding: 14, backgroundColor: '#fff', gap: 12, borderWidth: 1, borderColor: colors.border },
  cardOn: { ...shadow, shadowOpacity: 0.1, borderColor: '#fff' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  time: { fontFamily: MONO, fontSize: 16, fontWeight: '700', color: colors.text },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.fieldBg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  statLabel: { fontSize: 11, color: colors.muted },
  statValue: { fontFamily: MONO, fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 2 },
  statUnit: { fontSize: 12, fontWeight: '600', color: colors.muted },
  start: { height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 24 },
  link: { fontSize: 12, fontWeight: '700', color: colors.primary },
});