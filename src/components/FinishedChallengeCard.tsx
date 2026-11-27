// One finished race against one opponent: avatar, "Opponent · Route", "Date · your time vs their time",
// the time difference on the right and Won / Lost / Tied.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/ghostTheme';
import { formatDelta, formatMinSec } from '../services/format';
import type { FinishedChallenge } from '../types/challenge';
import Avatar from './Avatar';

type Outcome = { label: 'Won' | 'Lost' | 'Tied'; color: string };

/** Won when my time is lower, Lost when higher, Tied when equal. Colours come from the theme. */
function outcomeOf(mineMs: number, theirsMs: number): Outcome {
  if (mineMs < theirsMs) return { label: 'Won', color: colors.ahead };
  if (mineMs > theirsMs) return { label: 'Lost', color: colors.behind };
  return { label: 'Tied', color: colors.muted };
}

/** the day the race was finished. */
const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function FinishedChallengeCard({ challenge: c }: { challenge: FinishedChallenge }) {
  const outcome = outcomeOf(c.mineMs, c.theirsMs);
  return (
    <View style={s.card}>
      <Avatar name={c.opponent} size={40} />
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          {c.opponent} {'·'} {c.route.name}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {day(c.racedAt)} {'·'} {formatMinSec(c.mineMs)} vs {formatMinSec(c.theirsMs)}
        </Text>
      </View>
      <View style={s.result}>
        <Text style={[s.delta, { color: outcome.color }]}>{formatDelta(c.mineMs - c.theirsMs)}</Text>
        <Text style={[s.outcome, { color: outcome.color }]}>{outcome.label}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  result: { alignItems: 'flex-end' },
  delta: { fontSize: 15, fontWeight: '700' },
  outcome: { fontSize: 12, fontWeight: '700', marginTop: 1 },
});
