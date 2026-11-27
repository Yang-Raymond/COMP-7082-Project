// One challenge a user sent, with all its recipients: overlapping avatars, "To users · Route name",
// "user's time · sent ago" and a status line ("race status · days until expiration", or "how many users have raced" plus the latest result).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/ghostTheme';
import { formatMinSec, formatTimeLeft, timeAgo } from '../services/format';
import type { SentChallenge } from '../types/challenge';
import AvatarStack from './AvatarStack';

const SHOWN_NAMES = 2; // names spelled out before "+N"

/** "user1", "user1, user2" or "user1, user2 +1": the recipients' names, at most SHOWN_NAMES spelled out. */
function recipientNames(names: string[]): string {
  const shown = names.slice(0, SHOWN_NAMES).join(', ');
  return names.length > SHOWN_NAMES ? `${shown} +${names.length - SHOWN_NAMES}` : shown;
}

/** The most recent result as a sentence (eg "user1 beat you by 0:02"), or null if nobody raced. */
function latestResult(c: SentChallenge): string | null {
  const raced = c.recipients.filter((r) => r.durationMs != null && r.racedAt != null);
  if (raced.length === 0) return null;
  const last = raced.reduce((a, b) => (b.racedAt! > a.racedAt! ? b : a));
  const diff = last.durationMs! - c.senderMs;
  if (diff === 0) return `${last.username} tied you`;
  return diff < 0
    ? `${last.username} beat you by ${formatMinSec(-diff)}`
    : `You beat ${last.username} by ${formatMinSec(diff)}`;
}

interface Props {
  challenge: SentChallenge;
  /** The current time in milliseconds. */
  now: number;
}

export default function SentChallengeCard({ challenge: c, now }: Props) {
  const names = c.recipients.map((r) => r.username);
  const racedCount = c.recipients.filter((r) => r.racedAt != null).length;
  const result = latestResult(c);
  const left = c.expiresAt != null ? formatTimeLeft(c.expiresAt, now) : null;
  const status = [
    result ? `${racedCount} of ${c.recipients.length} raced` : "Hasn't raced yet",
    result,
    left,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.card}>
      <AvatarStack names={names.slice(0, 3)} size={36} />
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          To {recipientNames(names)} {'·'} {c.route.name}
        </Text>
        <Text style={s.sub} numberOfLines={1}>
          Your time {formatMinSec(c.senderMs)} {'·'} sent {timeAgo(c.createdAt, now)}
        </Text>
        <Text style={s.status} numberOfLines={2}>{status}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '600', color: colors.accent, marginTop: 4 },
});
