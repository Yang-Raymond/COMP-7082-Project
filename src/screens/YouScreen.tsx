import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthScreen, signOut, useAuthContext } from '../auth';
import PopoverMenu, { Anchor, MenuItem, ViewRef, measureAnchor } from '../components/PopoverMenu';
import ProfileHeader from '../components/ProfileHeader';
import RouteSketch from '../components/RouteSketch';
import { getRoutes } from '../services/storage';
import { onUploadsChanged } from '../services/routeSync';
import { getFriends } from '../services/friends';
import { getPinnedIds, savePinnedIds } from '../services/pins';
import {
  getProfilePhoto,
  peekProfilePhoto,
  pickProfilePhoto,
  recoverPickedPhoto,
  removeProfilePhoto,
} from '../services/profilePhoto';
import { confirmAction, showNotice } from '../services/dialog';
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
  // Remembers whose photo it is, so a different account signing in never sees the last one's
  const [photo, setPhoto] = useState<{ userId: number; uri: string | null } | null>(() =>
    user ? { userId: user.id, uri: peekProfilePhoto(user.id) } : null
  );
  const choosingPhoto = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    const loadRoutes = () => getRoutes().then((r) => setRoutes([...r].sort((a, b) => b.createdAt - a.createdAt)));
    loadRoutes();
    getFriends().then((f) => setFriendCount(f.length));
    getPinnedIds().then(setPinned);
    // Uploads finish in the background, so re-read the routes to show "Uploaded" without leaving the tab
    return onUploadsChanged(loadRoutes);
  }, []);

  useEffect(() => {
    if (userId == null) return;
    let live = true;
    const show = (uri: string | null) => {
      if (live) setPhoto({ userId, uri });
    };
    getProfilePhoto(userId)
      .then(show)
      // Android may have closed the app while the photo library was open
      .then(() => recoverPickedPhoto(userId))
      .then((uri) => uri && show(uri))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!isSignedIn || !user) return <AuthScreen />;

  const name = user.username.charAt(0).toUpperCase() + user.username.slice(1);
  const photoUri = photo?.userId === user.id ? photo.uri : null;
  // A pinned route that was deleted from Home just drops out here
  const pinnedRoutes = pinned.flatMap((id) => routes.filter((r) => r.id === id));
  const unpinned = routes.filter((r) => !pinned.includes(r.id));

  const updatePins = (ids: string[]) => {
    setPinned(ids);
    savePinnedIds(ids);
  };

  const shareProfile = async () => {
    const message = `Race my ghost on GhostRacer! Find me at @${user.username}.`;
    try {
      await Share.share({ message });
    } catch (e) {
      // Web throws when the browser can't share; cancelling the share sheet isn't an error
      if (!(e instanceof Error && e.name === 'AbortError')) showNotice('Share profile', message);
    }
  };

  const choosePhoto = async () => {
    if (choosingPhoto.current) return; // a second tap while the library is opening
    choosingPhoto.current = true;
    const id = user.id;
    try {
      const uri = await pickProfilePhoto(id);
      if (uri) setPhoto({ userId: id, uri });
    } catch (e) {
      showNotice('Profile photo', e instanceof Error ? e.message : "Couldn't save your photo. Try again.");
    }
    // Not in a finally block: React Compiler skips any component that uses one
    choosingPhoto.current = false;
  };

  const settingsItems: MenuItem[] = [
    ...(photoUri
      ? [
          {
            label: 'Remove photo',
            icon: 'trash-outline',
            onPress: () =>
              confirmAction('Remove your profile photo?', 'Your initial will show instead.', 'Remove', async () => {
                await removeProfilePhoto(user.id).catch(() => {});
                setPhoto(null);
              }),
          } satisfies MenuItem,
        ]
      : []),
    { label: 'Sign out', icon: 'log-out-outline', separated: !!photoUri, onPress: () => signOut() },
  ];

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
        <Pressable
          ref={gear}
          hitSlop={8}
          accessibilityLabel="Settings"
          onPress={() => measureAnchor(gear.current, root.current, setSettings)}
        >
          <Ionicons name="settings-outline" size={26} color={colors.primary} />
        </Pressable>
      </View>

      {/* The whole page scrolls, so on a small phone the list isn't squeezed under the header */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
        <ProfileHeader
          name={name}
          username={user.username}
          photo={photoUri}
          onAddPhoto={choosePhoto}
          stats={[
            { value: routes.length, label: routes.length === 1 ? 'activity' : 'activities' },
            { value: friendCount, label: friendCount === 1 ? 'friend' : 'friends' },
          ]}
        />

        <View style={s.buttons}>
          <Pressable style={s.btn} onPress={() => showNotice('Edit profile', 'Editing your profile is coming soon.')}>
            <Text style={s.btnText}>Edit profile</Text>
          </Pressable>
          <Pressable style={s.btn} onPress={shareProfile}>
            <Text style={s.btnText}>Share profile</Text>
          </Pressable>
        </View>

        <View style={s.tabs} accessibilityRole="tablist">
          <SectionTab label="Pinned activities" active={section === 'pinned'} onPress={() => setSection('pinned')}>
            <Ionicons name="apps" size={24} color={section === 'pinned' ? colors.primary : colors.muted} />
          </SectionTab>
          <SectionTab label="All activities" active={section === 'activities'} onPress={() => setSection('activities')}>
            <MaterialIcons name="route" size={26} color={section === 'activities' ? colors.primary : colors.muted} />
          </SectionTab>
        </View>

        {section === 'pinned' ? pinnedUI : activitiesUI}
      </ScrollView>

      {settings && (
        <PopoverMenu
          anchor={settings}
          items={settingsItems}
          onClose={() => setSettings(null)}
        />
      )}
    </View>
  );
}

function SectionTab({ label, active, onPress, children }: { label: string; active: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable
      style={s.tab}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {children}
      <View style={[s.underline, active && s.underlineOn]} />
    </Pressable>
  );
}

function PinnedCard({ route, onUnpin }: { route: SavedRoute; onUnpin: () => void }) {
  const [width, setWidth] = useState(0);
  const sketchW = width - 32;
  return (
    <View style={s.pinCard} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[s.pinSketch, { height: Math.max(sketchW * 0.7, 120) }]}>
        {sketchW > 0 && <RouteSketch points={route.points} width={sketchW} height={sketchW * 0.7} />}
      </View>
      <Pressable style={s.unpin} onPress={onUnpin} hitSlop={8} accessibilityLabel={`Unpin ${route.name}`}>
        <Ionicons name="close" size={18} color={colors.primary} />
      </Pressable>
      <Text style={s.actName} numberOfLines={1}>{route.name}</Text>
      <Text style={s.date}>{formatDateTime(route.createdAt)}</Text>
      <Stats route={route} />
    </View>
  );
}

/** " · Uploaded" and so on for "Save & Challenge" routes; nothing for routes kept on the phone. */
function uploadLabel(route: SavedRoute): string {
  switch (route.upload?.state) {
    case 'done':
      return ' · Uploaded';
    case 'pending':
      return ' · Waiting to upload';
    case 'failed':
      return ` · Upload failed: ${route.upload.error}`;
    default:
      return '';
  }
}

function Stats({ route }: { route: SavedRoute }) {
  return (
    <View style={s.stats}>
      <Stat label="Time" value={formatMinSec(route.durationMs)} unit="min" />
      <Stat label="Distance" value={formatKm(route.distanceMeters)} unit="km" />
    </View>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>
        {value} <Text style={s.statUnit}>{unit}</Text>
      </Text>
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
  // Pinned
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
  // Activities
  activity: { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  actName: { fontSize: 22, fontWeight: '800', color: colors.primary },
  date: { fontSize: 11, color: colors.muted },
  stats: { flexDirection: 'row', marginTop: 10 },
  stat: { minWidth: 88 },
  statLabel: { fontSize: 12, color: colors.muted },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.primary },
  statUnit: { fontSize: 12, fontWeight: '500' },
});
