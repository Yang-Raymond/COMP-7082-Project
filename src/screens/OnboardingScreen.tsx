import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthScreen } from '../auth';
import { colors } from '../constants/ghostTheme';

// Palette taken from the Figma frames. Move into ghostTheme if you want them app-wide.
const MAROON = '#5B0A24';
const MINT = '#19FFD6';
const INK = '#1A0A10';
const BODY = '#5E5866';
const SEGMENT_OFF = '#D5D6E6';
const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const PAGES = [
  {
    title: 'Race anyone.\nAnytime.',
    body: 'Run or ride a route, then challenge friends to beat your time on their own schedule or accept their challenge to see who comes out on top.',
  },
  {
    title: 'Keep score\nwith friends.',
    body: 'Every race adds to your head-to-head record. No need to be in the same place at the same time.',
  },
];

// Stylised stand-in for the map in Figma. Swap for an exported image when you have one.
function MapHero() {
  return (
    <View style={s.hero}>
      <View style={[s.road, { top: 40, left: 0, right: 0, height: 2 }]} />
      <View style={[s.road, { top: 110, left: 0, right: 0, height: 2 }]} />
      <View style={[s.road, { top: 180, left: 0, right: 0, height: 2 }]} />
      <View style={[s.road, { left: 70, top: 0, bottom: 0, width: 2 }]} />
      <View style={[s.road, { left: 170, top: 0, bottom: 0, width: 2 }]} />
      <View style={[s.road, { left: 250, top: 0, bottom: 0, width: 2 }]} />

      <View style={[s.route, { left: 34, top: 150, width: 5, height: 160 }]} />
      <View style={[s.route, { left: 34, top: 150, width: 160, height: 5 }]} />
      <View style={[s.route, { left: 189, top: 62, width: 5, height: 93 }]} />

      <View style={s.you}>
        <View style={s.youDot} />
        <View style={s.youTag}>
          <Text style={s.youTagText}>You</Text>
        </View>
      </View>

      <View style={s.beatCard}>
        <View>
          <Text style={s.beatLabel}>TIME TO BEAT</Text>
          <Text style={s.beatTime}>8:32</Text>
        </View>
        <View style={s.aheadPill}>
          <Text style={s.aheadText}>-0:14 ahead</Text>
        </View>
      </View>
    </View>
  );
}

function Row({ name, score, highlight, avatar }: { name: string; score: string; highlight?: boolean; avatar: React.ReactNode }) {
  return (
    <View style={[s.row, highlight ? s.rowHighlight : { marginRight: 20 }, highlight && { marginLeft: 20 }]}>
      <View style={s.avatar}>{avatar}</View>
      <Text style={s.rowName}>{name}</Text>
      <Text style={s.rowScore}>{score}</Text>
    </View>
  );
}

function ScoreHero() {
  return (
    <View style={[s.hero, s.scoreHero]}>
      <Row name="Jin" score="4–2" avatar={<Ionicons name="logo-discord" size={22} color="#fff" />} />
      <Row name="Russell" score="7–7" highlight avatar={<Text style={s.initial}>R</Text>} />
      <Row name="Raymond" score="1–1" avatar={<Text style={s.initial}>R</Text>} />
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [auth, setAuth] = useState<null | 'signup' | 'signin'>(null);

  // Signing in changes the session, and the shell then swaps this screen out, so there is nothing to do on success.
  if (auth) return <AuthScreen initialMode={auth} onBack={() => setAuth(null)} onSuccess={() => {}} />;

  const last = page === PAGES.length - 1;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (last) return setAuth('signup');
    scroller.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage(page + 1);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 44, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <Text style={s.brand}>GHOST RACER</Text>

      <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
          >
            {PAGES.map((p, i) => (
              <View key={i} style={{ width, paddingHorizontal: 20 }}>
                {i === 0 ? <MapHero /> : <ScoreHero />}
                <View style={s.segments}>
                  {PAGES.map((_, j) => (
                    <View key={j} style={[s.segment, j === page && s.segmentOn]} />
                  ))}
                </View>
                <Text style={s.title}>{p.title}</Text>
                <Text style={s.body}>{p.body}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Pressable style={s.primary} onPress={next} accessibilityRole="button">
          <Text style={s.primaryText}>{last ? 'Get started' : 'Next'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setAuth('signin')} hitSlop={10} style={s.secondary}>
          <Text style={s.secondaryText}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: { paddingHorizontal: 20, fontSize: 16, fontWeight: '800', letterSpacing: 0.4, color: INK, marginBottom: 28 },

  hero: { height: 286, borderRadius: 20, overflow: 'hidden', backgroundColor: '#E9EDF3' },
  road: { position: 'absolute', backgroundColor: '#FFFFFF' },
  route: { position: 'absolute', backgroundColor: '#0A7CFF', borderRadius: 3 },
  you: { position: 'absolute', left: 178, top: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  youDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#0A7CFF', borderWidth: 3, borderColor: '#fff' },
  youTag: { backgroundColor: INK, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  youTagText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  beatCard: {
    position: 'absolute', left: 14, right: 14, bottom: 14, backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  beatLabel: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.6, color: BODY },
  beatTime: { fontFamily: MONO, fontSize: 26, fontWeight: '700', color: INK },
  aheadPill: { backgroundColor: MINT, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  aheadText: { fontFamily: MONO, fontSize: 14, fontWeight: '700', color: INK },

  scoreHero: { backgroundColor: MAROON, padding: 20, justifyContent: 'center', gap: 10 },
  row: { height: 58, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 12 },
  rowHighlight: { backgroundColor: MINT },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#5865F2', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rowName: { flex: 1, fontSize: 14, fontWeight: '600', color: INK },
  rowScore: { fontFamily: MONO, fontSize: 15, fontWeight: '700', color: INK },

  segments: { flexDirection: 'row', gap: 4, marginTop: 20, marginBottom: 14 },
  segment: { width: 24, height: 4, borderRadius: 2, backgroundColor: SEGMENT_OFF },
  segmentOn: { backgroundColor: MAROON },

  title: { fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: INK, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 23, color: BODY },

  primary: { height: 52, borderRadius: 26, backgroundColor: MAROON, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { fontSize: 15, fontWeight: '700', color: INK },
});