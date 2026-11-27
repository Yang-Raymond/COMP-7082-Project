// Challenges tab: challenges between users and his friends, in three tabs.
//   To race:  challenges friends sent to the user that the user haven't raced yet, soonest expiry first. Start opens the race.
//   Sent:     challenges the user sent that are still open, one card per challenge with all its recipients.
//   Finished: races that are done, with who won.
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FinishedChallengeCard from '../components/FinishedChallengeCard';
import SegmentedTabs from '../components/SegmentedTabs';
import SentChallengeCard from '../components/SentChallengeCard';
import ToRaceCard from '../components/ToRaceCard';
import { colors } from '../constants/ghostTheme';
import type { Challenges } from '../hooks/useChallenges';
import type { ToRaceChallenge } from '../types/challenge';

type TabKey = 'toRace' | 'sent' | 'finished';

interface Props {
  challenges: Challenges;
  /** Start racing a To race challenge. */
  onStart: (c: ToRaceChallenge) => void;
  /** The "Record a route" button in the empty To race state. */
  onRecord: () => void;
}

/** Shows the title, the three tabs and the selected list, or a loading, error or empty state. */
export default function ChallengesScreen({ challenges, onStart, onRecord }: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>('toRace');
  const { toRace, sent, finished, loading, error, reload } = challenges;
  const firstLoad = loading && toRace.length + sent.length + finished.length === 0;
  const [now, setNow] = useState(() => Date.now());  // The time the cards count down from, refreshes every minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  let body: React.ReactNode;
  if (firstLoad) {
    body = <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />;
  } else if (error && toRace.length + sent.length + finished.length === 0) {
    body = (
      <View style={s.center}>
        <Text style={s.emptyTitle}>Couldn&apos;t load challenges</Text>
        <Text style={s.emptyBody}>{error}</Text>
        <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={reload}>
          <Text style={s.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (tab === 'toRace') {
    body =
      toRace.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyTitle}>No challenges to race</Text>
          <Text style={s.emptyBody}>When a friend sends you their race, it shows up here. Or start a challenge yourself.</Text>
          <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={onRecord}>
            <Ionicons name="radio-button-on" size={18} color={colors.onPrimary} />
            <Text style={s.btnText}>Record a route</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={s.order}>Soonest first</Text>
          {toRace.map((c) => (
            <ToRaceCard key={c.id} challenge={c} now={now} onStart={() => onStart(c)} />
          ))}
        </>
      );
  } else if (tab === 'sent') {
    body =
      sent.length === 0 ? (
        <Text style={s.emptyText}>You haven&apos;t sent any open challenges.</Text>
      ) : (
        sent.map((c) => <SentChallengeCard key={c.id} challenge={c} now={now} />)
      );
  } else {
    body =
      finished.length === 0 ? (
        <Text style={s.emptyText}>No finished challenges yet.</Text>
      ) : (
        finished.map((c) => <FinishedChallengeCard key={c.id} challenge={c} />)
      );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Challenges</Text>
      <View style={s.tabs}>
        <SegmentedTabs
          segments={[
            { key: 'toRace', label: 'To race', count: toRace.length },
            { key: 'sent', label: 'Sent', count: sent.length },
            { key: 'finished', label: 'Finished' },
          ]}
          selected={tab}
          onChange={setTab}
        />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { paddingHorizontal: 20, fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  tabs: { paddingHorizontal: 16, marginTop: 14, marginBottom: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  order: { fontSize: 12, fontWeight: '600', color: colors.muted },
  center: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  emptyText: { fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', paddingTop: 32 },
  btn: {
    alignSelf: 'stretch',
    height: 48,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
});
