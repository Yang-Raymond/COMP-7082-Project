import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { AuthScreen, signOut, useAuthContext } from '../auth';
import PopoverMenu, { Anchor, ViewRef, measureAnchor } from '../components/PopoverMenu';
import ProfileHeader from '../components/ProfileHeader';
import RouteSketch from '../components/RouteSketch';
import { getRoutes } from '../services/storage';
import { onUploadsChanged } from '../services/routeSync';
import { getFriends } from '../services/friends';
import { getPinnedIds, savePinnedIds } from '../services/pins';
import { showNotice } from '../services/dialog';
import { formatDateTime, formatKm, formatMinSec } from '../services/format';
import { colors } from '../constants/ghostTheme';
import { SavedRoute } from '../types/route';

type Section = 'pinned' | 'activities';

export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, user } = useAuthContext();
  const root = useRef<ViewRef>(null);
  const gear = useRef<ViewRef>(null);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [pinned, setPinned] = useState<string[]>([]);
  const [section, setSection] = useState<Section>('pinned');
  const [picking, setPicking] = useState(false);
  const [settings, setSettings] = useState<Anchor | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const loadRoutes = () => getRoutes().then((r) => setRoutes([...r].sort((a, b) => b.createdAt - a.createdAt)));
    loadRoutes();
    getFriends().then((f) => setFriendCount(f.length));
    getPinnedIds().then(setPinned);
    return onUploadsChanged(loadRoutes);
  }, []);

  useEffect(() => {
    const loadPhoto = async () => {
      if (user?.username) {
        const savedPhoto = await AsyncStorage.getItem(`profile_photo_${user.username}`);
        if (savedPhoto) setPhoto(savedPhoto);
      }
    };
    loadPhoto();
  }, [user?.username]);

  if (!isSignedIn || !user) return <AuthScreen />;

  const name = user.username.charAt(0).toUpperCase() + user.username.slice(1);
  const handle = user.username.toLowerCase().replace(/\s+/g, '');
  
  const pinnedRoutes = pinned.flatMap((id) => routes.filter((r) => r.id === id));
  const unpinned = routes.filter((r) => !pinned.includes(r.id));

  const updatePins = (ids: string[]) => {
    setPinned(ids);
    savePinnedIds(ids);
  };

  const uploadLabel = (r: SavedRoute) => {
    return r.upload ? '' : ' • Not uploaded';
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    
    if (!res.canceled) {
      const newUri = res.assets[0].uri;
      setPhoto(newUri);
      if (user?.username) {
        await AsyncStorage.setItem(`profile_photo_${user.username}`, newUri);
      }
    }
  };

  const shareProfile = async () => {
    const message = `Race my ghost on GhostRacer! Find me at @${user.username}.`;
    try {
      await Share.share({ message });
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) showNotice('Share profile', message);
    }
  };

  const picker = (
    <View style={s.picker}>
      <View style={s.pickerHead}>
        <Text style={s.pickerTitle}>Choose an activity</Text>
        <Pressable onPress={() => setPicking(false)} hitSlop={8}>
          <Text style={s.link}>Cancel</Text>
        </Pressable>
      </View>
      {unpinned.length === 0 ? (
        <Text style={s.empty}>
          {routes.length === 0 ? 'Record an activity first, then pin it here.' : 'All your activities are pinned.'}
        </Text>
      ) : (
        unpinned.map((r) => (
          <Pressable
            key={r.id}
            style={s.pickRow}
            onPress={() => {
              updatePins([...pinned, r.id]);
              setPicking(false);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.pickName} numberOfLines={1}>{r.name}</Text>
              <Text style={s.date}>{formatDateTime(r.createdAt)}</Text>
            </View>
            <RouteSketch points={r.points} width={56} height={36} />
          </Pressable>
        ))
      )}
    </View>
  );

  const pinnedUI = (
    <View style={s.pinWrap}>
      {pinnedRoutes.length === 0 && !picking && (
        <View style={s.pinEmpty}>
          <Ionicons name="pin-outline" size={28} color={colors.muted} />
          <Text style={s.pinEmptyText}>Pin your favourite activities to show them off here.</Text>
        </View>
      )}
      {pinnedRoutes.map((r) => (
        <PinnedCard key={r.id} route={r} onUnpin={() => updatePins(pinned.filter((id) => id !== r.id))} />
      ))}
      {picking ? (
        picker
      ) : (
        <Pressable style={s.pinBtn} onPress={() => setPicking(true)}>
          <Text style={s.pinBtnText}>+ Pin an activity</Text>
        </Pressable>
      )}
    </View>
  );

  const activitiesUI =
    routes.length === 0 ? (
      <Text style={[s.empty, { paddingHorizontal: 14 }]}>No activities yet. Tap Record to make your first one.</Text>
    ) : (
      routes.map((r) => (
        <View key={r.id} style={s.activity}>
          <Text style={s.actName} numberOfLines={1}>{r.name}</Text>
          <Text style={s.date}>{formatDateTime(r.createdAt)}{uploadLabel(r)}</Text>
          <Stats route={r} />
        </View>
      ))
    );

  return (
    <View ref={root} style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.topRow}>
        <Pressable ref={gear} onPress={() => measureAnchor(gear.current, root.current, setSettings)} hitSlop={8}>
          <Ionicons name="settings-sharp" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <ProfileHeader 
          photo={photo} 
          onAddPhoto={pickPhoto}
          name={name} 
          username={handle} 
          stats={[
            { value: routes.length, label: 'activities' },
            { value: friendCount, label: 'friends' }
          ]}
        />

        <View style={s.buttons}>
          <Pressable style={s.btn}>
            <Text style={s.btnText}>Edit profile</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={shareProfile}>
            <Text style={s.btnText}>Share profile</Text>
          </Pressable>
        </View>

        <View style={s.tabs}>
          <Pressable style={s.tab} onPress={() => setSection('pinned')}>
            <Ionicons name="apps" size={24} color={section === 'pinned' ? colors.primary : colors.muted} />
            <View style={[s.underline, section === 'pinned' && s.underlineOn]} />
          </Pressable>
          <Pressable style={s.tab} onPress={() => setSection('activities')}>
            <Ionicons name="trail-sign-outline" size={24} color={section === 'activities' ? colors.primary : colors.muted} />
            <View style={[s.underline, section === 'activities' && s.underlineOn]} />
          </Pressable>
        </View>

        {section === 'pinned' ? pinnedUI : activitiesUI}
      </ScrollView>

      {settings && (
        <PopoverMenu 
          anchor={settings} 
          onClose={() => setSettings(null)}
          items={[
            { label: 'Sign out', icon: 'log-out-outline', onPress: () => signOut() }
          ]}
        />
      )}
    </View>
  );
}

function PinnedCard({ route, onUnpin }: { route: SavedRoute; onUnpin: () => void }) {
  return (
    <View style={s.pinCard}>
      <Pressable style={s.unpin} onPress={onUnpin} hitSlop={10}>
        <Ionicons name="close" size={20} color={colors.muted} />
      </Pressable>
      <Text style={s.actName} numberOfLines={1}>{route.name}</Text>
      <Text style={s.date}>{formatDateTime(route.createdAt)}</Text>
      <View style={s.pinSketch}>
        <RouteSketch points={route.points} width={200} height={100} />
      </View>
      <Stats route={route} />
    </View>
  );
}

function Stats({ route }: { route: SavedRoute }) {
  return (
    <View style={s.stats}>
      <View style={s.stat}>
        <Text style={s.statLabel}>Distance</Text>
        <Text style={s.statValue}>{formatKm((route as any).distanceMeters || 0)} <Text style={s.statUnit}>km</Text></Text>
      </View>
      <View style={s.stat}>
        <Text style={s.statLabel}>Time</Text>
        <Text style={s.statValue}>{formatMinSec(route.durationMs)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, height: 32 },
  buttons: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, marginTop: 24 },
  btn: { flex: 1, height: 42, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginTop: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', gap: 8, paddingTop: 6 },
  underline: { width: 32, height: 2, borderRadius: 1 },
  underlineOn: { backgroundColor: colors.primary },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 16 },
  pinWrap: { paddingHorizontal: 30, paddingTop: 22, gap: 16 },
  pinEmpty: {
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: colors.fieldBg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 32,
  },
  pinEmptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  pinCard: { borderRadius: 16, backgroundColor: colors.fieldBg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 2 },
  pinSketch: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  unpin: { position: 'absolute', top: 10, right: 10 },
  pinBtn: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBtnText: { color: colors.primary, fontSize: 15, fontWeight: '500' },
  picker: { borderRadius: 12, borderWidth: 1, borderColor: colors.lavender, paddingHorizontal: 14, paddingVertical: 10 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: colors.primary },
  link: { fontSize: 14, color: colors.primary },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  pickName: { fontSize: 15, fontWeight: '600', color: colors.primary },
  activity: { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  actName: { fontSize: 22, fontWeight: '800', color: colors.primary },
  date: { fontSize: 11, color: colors.muted },
  stats: { flexDirection: 'row', marginTop: 10 },
  stat: { minWidth: 88 },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  statUnit: { fontSize: 12, fontWeight: '500' },
});