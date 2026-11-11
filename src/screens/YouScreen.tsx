import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthScreen, signOut, useAuthContext } from '../auth';
import { colors } from '../constants/ghostTheme';

type Tab = 'pinned' | 'history';

type Activity = {
  id: string;
  title: string;
  date: string;
  time: string;
  distance: string;
  winner: string;
};

// TODO: replace with real data once the server has an activities route.
const PLACEHOLDER_ACTIVITIES: Activity[] = [
  { id: '1', title: 'BCIT Track', date: 'November 6, 2026 at 10:49 AM', time: '8:23 min', distance: '2.32 km', winner: 'Jin' },
];
const PLACEHOLDER_FRIENDS = 0;

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, user } = useAuthContext();
  const [tab, setTab] = useState<Tab>('pinned');
  const [showSettings, setShowSettings] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  if (!isSignedIn) return <AuthScreen />;

  const username = user?.username ?? 'Runner';
  const handle = username.toLowerCase().replace(/\s+/g, '');
  const activities = PLACEHOLDER_ACTIVITIES;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 140 }]}
    >
      <View style={s.inner}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 40 }} />
              ) : (
                <Text style={s.avatarLetter}>{username.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Pressable style={s.avatarBadge} onPress={pickPhoto} accessibilityLabel="Change photo">
              <Ionicons name="add" size={16} color={colors.onPrimary} />
            </Pressable>
          </View>

          <View style={s.headerInfo}>
            <Text style={s.name} numberOfLines={1}>{username}</Text>
            <Text style={s.handle} numberOfLines={1}>@{handle}</Text>
            <View style={s.stats}>
              <View>
                <Text style={s.statNum}>{activities.length}</Text>
                <Text style={s.statLabel}>activities</Text>
              </View>
              <View>
                <Text style={s.statNum}>{PLACEHOLDER_FRIENDS}</Text>
                <Text style={s.statLabel}>friends</Text>
              </View>
            </View>
          </View>

          <Pressable
            style={s.gear}
            onPress={() => setShowSettings((v) => !v)}
            hitSlop={8}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-sharp" size={24} color={colors.primary} />
          </Pressable>
        </View>

        {/* Settings (sign out lives here) */}
        {showSettings && (
          <View style={s.settings}>
            <Text style={s.settingsEmail}>Signed in as {user?.email}</Text>
            <Pressable style={s.signOut} onPress={() => signOut()}>
              <Text style={s.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        )}

        {/* Buttons */}
        <View style={s.buttonRow}>
          <Pressable style={({ pressed }) => [s.pill, pressed && { opacity: 0.8 }]}>
            <Text style={s.pillText}>Edit profile</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.pill, pressed && { opacity: 0.8 }]}>
            <Text style={s.pillText}>Share profile</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          <TabButton icon="apps" active={tab === 'pinned'} onPress={() => setTab('pinned')} label="Pinned" />
          <TabButton icon="trail-sign-outline" active={tab === 'history'} onPress={() => setTab('history')} label="History" />
        </View>

        {tab === 'pinned' ? (
          <View style={s.pinned}>
            <View style={s.pinBox} />
            <Pressable style={({ pressed }) => [s.pinButton, pressed && { opacity: 0.8 }]}>
              <Text style={s.pinText}>+ Pin an activity</Text>
            </Pressable>
          </View>
        ) : activities.length === 0 ? (
          <Text style={s.empty}>No activities yet. Record your first run to see it here.</Text>
        ) : (
          activities.map((a) => (
            <View key={a.id} style={s.activity}>
              <Text style={s.actTitle}>{a.title}</Text>
              <Text style={s.actDate}>{a.date}</Text>
              <View style={s.actStats}>
                <Stat label="Time" value={a.time} />
                <Stat label="Distance" value={a.distance} />
                <Stat label="Winner" value={a.winner} />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function TabButton({
  icon,
  active,
  onPress,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      style={[s.tab, active && s.tabActive]}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={24} color={active ? colors.primary : colors.muted} />
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text style={s.actStatLabel}>{label}</Text>
      <Text style={s.actStatValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  avatarWrap: { width: 80, height: 80 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.fieldBg, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 34, fontWeight: '800', color: colors.primary },
  avatarBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, gap: 2 },
  name: { fontSize: 26, fontWeight: '800', color: colors.primary },
  handle: { fontSize: 13, color: colors.muted },
  stats: { flexDirection: 'row', gap: 32, marginTop: 10 },
  statNum: { fontSize: 18, fontWeight: '700', color: colors.primary },
  statLabel: { fontSize: 13, color: colors.muted },
  gear: { padding: 2 },

  settings: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 12 },
  settingsEmail: { fontSize: 14, color: colors.muted },
  signOut: { height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.primary, fontSize: 15, fontWeight: '700' },

  buttonRow: { flexDirection: 'row', gap: 12 },
  pill: { flex: 1, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pillText: { color: colors.onPrimary, fontSize: 15, fontWeight: '700' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabActive: { borderBottomColor: colors.primary },

  pinned: { gap: 20 },
  pinBox: { height: 280, borderRadius: 20, backgroundColor: colors.fieldBg },
  pinButton: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pinText: { color: colors.primary, fontSize: 15, fontWeight: '600' },

  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', paddingVertical: 24 },
  activity: { gap: 2, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  actTitle: { fontSize: 22, fontWeight: '800', color: colors.primary },
  actDate: { fontSize: 12, color: colors.muted },
  actStats: { flexDirection: 'row', gap: 24, marginTop: 10 },
  actStatLabel: { fontSize: 12, color: colors.muted },
  actStatValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
});