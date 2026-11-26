// Challenges tab: routes your friends made that you can race, newest first.
// A "challenge" is a route made by a friend. There is no separate challenge record on the server yet.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChallengeCard from '../components/ChallengeCard';
import LiveStrip from '../components/LiveStrip';
import { colors } from '../constants/ghostTheme';
import type { Challenges } from '../hooks/useChallenges';
import { useCurrentPosition } from '../hooks/useCurrentPosition';
import { useLiveChallengers } from '../hooks/useLiveChallengers';
import { showNotice } from '../services/dialog';
import { formatDistance, haversineDistance } from '../services/distance';
import type { SavedRoute } from '../types/route';
import LeaderboardScreen from './LeaderboardScreen';

interface Props {
  challenges: Challenges;
  onRace: (r: SavedRoute) => void;
  onAddFriends: () => void;
}

export default function ChallengesScreen({ challenges, onRace, onAddFriends }: Props) {
  const insets = useSafeAreaInsets();
  const { position, isLive } = useCurrentPosition();
  const live = useLiveChallengers();
  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<{ id: string; name: string } | null>(null);
  const list = challenges.friendChallenges;

  const openBoard = (r: SavedRoute) => {
    if (r.upload?.state === 'done') setBoard({ id: r.upload.serverId, name: r.name });
    else showNotice('Leaderboard', 'This route has no leaderboard yet.');
  };

  if (board) return <LeaderboardScreen routeId={board.id} routeName={board.name} onBack={() => setBoard(null)} />;

  return (
    <View style={[s.root, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Challenges</Text>
      <Text style={s.sub}>{list.length === 1 ? '1 route from your friends' : `${list.length} routes from your friends`}</Text>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <LiveStrip challengers={live} />
        {list.length === 0 ? (
          <View style={{ gap: 12, paddingTop: 8 }}>
            <Text style={s.empty}>No challenges yet. When a friend records a route, it shows up here for you to beat.</Text>
            <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]} onPress={onAddFriends}>
              <Text style={s.btnText}>Add friends</Text>
            </Pressable>
          </View>
        ) : (
          list.map((r) => {
            const start = r.points[0];
            const away = isLive && position && start ? formatDistance(haversineDistance(position, start)) : null;
            return (
              <ChallengeCard
                key={r.id}
                route={r}
                mine={false}
                info={challenges.infoOf(r)}
                away={away}
                expanded={r.id === openId}
                onPress={() => setOpenId(r.id === openId ? null : r.id)}
                onStart={() => onRace(r)}
                onBoard={() => openBoard(r)}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { paddingHorizontal: 20, fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  sub: { paddingHorizontal: 20, fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 12 },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  empty: { fontSize: 14, lineHeight: 20, color: colors.muted },
  btn: { height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
});