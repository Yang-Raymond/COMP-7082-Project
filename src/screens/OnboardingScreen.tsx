import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthScreen } from '../auth';
import { colors } from '../constants/ghostTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Only the first page is designed in Figma; the other two are placeholder copy.
const PAGES: { icon: IconName; title: string; body: string }[] = [
  { icon: 'people', title: 'Challenge your friends', body: 'Create a track by running or biking. Challenge your friends after.' },
  { icon: 'radio-button-on', title: 'Record any route', body: 'Tap Start and go. Ghost Racer tracks your time, distance and elevation.' },
  { icon: 'flash', title: 'Race your ghost', body: 'Run a saved track again and see live whether you are ahead or behind.' },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [signingUp, setSigningUp] = useState(false);

  // Signing up (or logging in from here) counts as finishing onboarding
  if (signingUp) return <AuthScreen initialMode="signup" onBack={() => setSigningUp(false)} onSuccess={onDone} />;

  const last = page === PAGES.length - 1;
  const { icon, title, body } = PAGES[page];

  return (
    <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={s.header}>
        <View style={s.logo}>
          <Text style={s.logoText}>👻</Text>
        </View>
        <Text style={s.brand}>Ghost Racer</Text>
        <Pressable onPress={onDone} hitSlop={10}>
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      {/* Swap the icon for the exported Figma artwork once it's in assets/images */}
      <View style={s.hero}>
        <Ionicons name={icon} size={88} color={colors.primary} />
      </View>

      <View style={s.dots}>
        {PAGES.map((_, i) => (
          <Pressable key={i} onPress={() => setPage(i)} hitSlop={6} accessibilityLabel={`Page ${i + 1}`}>
            <View style={[s.dot, i === page && s.dotOn]} />
          </Pressable>
        ))}
      </View>

      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>

      <View style={{ flex: 1 }} />

      <Pressable style={s.primary} onPress={() => (last ? setSigningUp(true) : setPage(page + 1))}>
        <Text style={s.primaryText}>{last ? 'Get started' : 'Next'}</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  logo: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 22 },
  brand: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.primary },
  skip: { fontSize: 15, fontWeight: '600', color: colors.muted },
  hero: { flex: 1, minHeight: 180, maxHeight: 360, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.fieldBg, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, marginTop: 12, marginBottom: 28 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.lavender },
  dotOn: { width: 36, backgroundColor: colors.primary },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 21, color: colors.muted },
  primary: { height: 60, borderRadius: 30, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  primaryText: { color: colors.onPrimary, fontSize: 20, fontWeight: '700' },
});
