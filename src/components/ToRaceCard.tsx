// One challenge waiting for the user to race: the sender's avatar, "Sender · Route name", the distance, the time to beat
// and how long is left, with a Start button. A challenge with less than 24 hours left is highlighted and labelled
// "Expiring soon · 5h left". Tapping the card opens the challenge detail. The Start button races it directly.
// The two are sibling buttons, not nested, so both stay reachable by screen readers.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/ghostTheme';
import { formatKm, formatMinSec, formatTimeLeft } from '../services/format';
import type { ToRaceChallenge } from '../types/challenge';
import Avatar from './Avatar';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  challenge: ToRaceChallenge;
  /** Opens the challenge detail. */
  onPress: () => void;
  /** Starts the race straight away, without opening the detail. */
  onStart: () => void;
  /** The current time in milliseconds, passed in so the card stays a pure function of its props. */
  now: number;
}

export default function ToRaceCard({ challenge: c, onPress, onStart, now }: Props) {
  const soon = c.expiresAt != null && c.expiresAt - now < DAY_MS;
  const detail = [`${formatKm(c.route.distanceMeters)} km`, `beat ${formatMinSec(c.senderMs)}`]
    .concat(c.expiresAt != null && !soon ? [formatTimeLeft(c.expiresAt, now)] : [])
    .join(' · ');

  return (
    <View style={[s.card, soon && s.cardSoon]}>
      <Pressable
        style={({ pressed }) => [s.details, pressed && { opacity: 0.8 }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${c.route.name}, challenge from ${c.sender}, open details`}
      >
        {soon && <Text style={s.soon}>Expiring soon {'·'} {formatTimeLeft(c.expiresAt!, now)}</Text>}
        <View style={s.row}>
          <Avatar name={c.sender} size={40} />
          <View style={s.body}>
            <Text style={s.title} numberOfLines={1}>
              {c.sender} {'·'} {c.route.name}
            </Text>
            <Text style={s.sub} numberOfLines={1}>{detail}</Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [s.start, pressed && { opacity: 0.8 }]}
        onPress={onStart}
        accessibilityRole="button"
        accessibilityLabel={`Start ${c.route.name}, challenge from ${c.sender}`}
      >
        <Text style={s.startText}>Start</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, borderRadius: 18, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  cardSoon: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
  soon: { fontSize: 12, fontWeight: '700', color: colors.warning },
  details: { flex: 1, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  start: { height: 36, marginBottom: 2, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.onPrimary, fontSize: 14, fontWeight: '600' },
});
