// One finished challenge (a route sent to friends): the recipient sees the challenger's avatar and "Challenger · Route",
// the creator sees the recipients' overlapping avatars and "To A, B +N · Route". The sub line is "Date · my time vs
// the time I'm compared with", with the time difference on the right and Won / Lost / Tied (worked out live from
// everyone who finished, see challengeOutcome). Tapping the card opens the challenge detail.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/ghostTheme';
import { challengeOutcome } from '../services/challengeOutcome';
import { formatDelta, formatMinSec, recipientAvatarNames, recipientNames } from '../services/format';
import type { FinishedChallenge } from '../types/challenge';
import Avatar from './Avatar';
import AvatarStack from './AvatarStack';

/** Result label colours, from the theme. */
const RESULT_COLOR = { Won: colors.ahead, Lost: colors.behind, Tied: colors.muted } as const;

/** the day the challenge was finished. */
const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

interface Props {
  challenge: FinishedChallenge;
  onPress: () => void;
}

export default function FinishedChallengeCard({ challenge: c, onPress }: Props) {
  const { result, mineMs, otherMs, deltaMs } = challengeOutcome(c.participants);
  const color = RESULT_COLOR[result];
  const sentByMe = c.role === 'sent';
  const who = sentByMe ? `To ${recipientNames(c.recipients)}` : c.sender;
  return (
    <Pressable
      style={s.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Finished challenge ${sentByMe ? 'you sent' : `from ${c.sender}`} on ${c.route.name}, ${result}, open details`}
    >
      {sentByMe ? <AvatarStack names={recipientAvatarNames(c.recipients)} size={36} /> : <Avatar name={c.sender} size={40} />}
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          {who} {'·'} {c.route.name}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          {day(c.finishedAt)} {'·'} {formatMinSec(mineMs)} vs {formatMinSec(otherMs)}
        </Text>
      </View>
      <View style={s.result}>
        <Text style={[s.delta, { color }]}>{formatDelta(deltaMs)}</Text>
        <Text style={[s.outcome, { color }]}>{result}</Text>
      </View>
    </Pressable>
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
