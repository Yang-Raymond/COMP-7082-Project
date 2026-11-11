import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import PopoverMenu, { Anchor, MenuItem, ViewRef, measureAnchor } from '../components/PopoverMenu';
import ProfileHeader from '../components/ProfileHeader';
import { useAuthContext } from '../auth';
import { Friend, getFriends, removeFriend, setMuted } from '../services/friends';
import { confirmAction, showNotice } from '../services/dialog';
import { colors } from '../constants/ghostTheme';

/** `onSignIn` opens the sign-in screen and comes back here afterwards. */
export default function FriendsScreen({ onSignIn }: { onSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuthContext();
  const root = useRef<ViewRef>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ friend: Friend; anchor: Anchor } | null>(null);
  const [viewing, setViewing] = useState<Friend | null>(null);

  useEffect(() => {
    getFriends().then(setFriends);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends.filter((f) => f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q));
  }, [friends, query]);

  if (!isSignedIn) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 8 }]}>
        <View style={[s.header, { marginTop: 40 }]}>
          <Text style={s.title}>Friends</Text>
        </View>
        <View style={s.signedOut}>
          <Ionicons name="people-outline" size={48} color={colors.primary} />
          <Text style={s.signedOutText}>Please log in to see friends</Text>
          <Pressable style={s.loginBtn} onPress={onSignIn}>
            <Text style={s.loginText}>Log in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (viewing) return <FriendProfile friend={viewing} onBack={() => setViewing(null)} />;

  const openMenu = (friend: Friend, target: ViewRef | null) =>
    measureAnchor(target, root.current, (anchor) => setMenu({ friend, anchor }));

  const menuItems = (f: Friend): MenuItem[] => [
    { label: 'View profile', icon: 'person-outline', onPress: () => setViewing(f) },
    {
      label: f.muted ? 'Unmute challenges' : 'Mute challenges',
      icon: f.muted ? 'notifications-outline' : 'notifications-off-outline',
      onPress: async () => setFriends(await setMuted(f.id, !f.muted)),
    },
    {
      label: 'Remove friend',
      icon: 'person-remove-outline',
      separated: true,
      onPress: () =>
        confirmAction(`Remove ${f.name}?`, "You won't see their challenges any more.", 'Remove', async () =>
          setFriends(await removeFriend(f.id))
        ),
    },
  ];

  return (
    <View ref={root} style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.topRow}>
        <Pressable
          hitSlop={8}
          accessibilityLabel="Notifications"
          onPress={() => showNotice('Notifications', 'Friend requests and challenge alerts are coming soon.')}
        >
          <Ionicons name="notifications-outline" size={26} color={colors.primary} />
        </Pressable>
      </View>

      <View style={s.header}>
        <Text style={s.title}>Friends</Text>
        <Text style={s.count}>
          {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
        </Text>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={22} color={colors.primary} />
        <TextInput
          style={s.searchInput}
          placeholder="Search friends"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
        {visible.length === 0 && (
          <Text style={s.empty}>{friends.length === 0 ? 'No friends yet.' : 'No friends match your search.'}</Text>
        )}
        {visible.map((f) => (
          <FriendRow key={f.id} friend={f} open={menu?.friend.id === f.id} onMenu={(target) => openMenu(f, target)} />
        ))}
      </ScrollView>

      {menu && <PopoverMenu anchor={menu.anchor} items={menuItems(menu.friend)} onClose={() => setMenu(null)} />}
    </View>
  );
}

function FriendRow({ friend, open, onMenu }: { friend: Friend; open: boolean; onMenu: (target: ViewRef | null) => void }) {
  const kebab = useRef<ViewRef>(null);
  return (
    <View style={s.row}>
      <Avatar name={friend.name} size={40} />
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{friend.name}</Text>
          {friend.muted && (
            <Ionicons name="notifications-off-outline" size={13} color={colors.muted} accessibilityLabel="Challenges muted" />
          )}
        </View>
        <Text style={s.handle} numberOfLines={1}>@{friend.username}</Text>
      </View>
      <Pressable
        ref={kebab}
        hitSlop={8}
        accessibilityLabel={`More options for ${friend.name}`}
        style={[s.kebab, open && s.kebabOpen]}
        onPress={() => onMenu(kebab.current)}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function FriendProfile({ friend, onBack }: { friend: Friend; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <Pressable style={s.back} onPress={onBack} hitSlop={8} accessibilityLabel="Back to friends">
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={s.backText}>Friends</Text>
      </Pressable>
      <ProfileHeader name={friend.name} username={friend.username} />
      {friend.muted && <Text style={s.note}>You&apos;ve muted challenges from {friend.name}.</Text>}
      <Text style={s.empty}>No shared activities yet.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, height: 32 },
  header: { paddingHorizontal: 16, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  count: { fontSize: 13, color: colors.muted, marginTop: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 6,
    paddingHorizontal: 16,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: colors.lavender,
    backgroundColor: colors.fieldBg,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: colors.primary, flexShrink: 1 },
  handle: { fontSize: 12, color: colors.muted },
  kebab: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kebabOpen: { backgroundColor: colors.border },
  empty: { color: colors.muted, fontSize: 14, paddingHorizontal: 28, paddingVertical: 16 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, marginBottom: 16 },
  backText: { fontSize: 16, color: colors.primary },
  note: { color: colors.muted, fontSize: 13, paddingHorizontal: 14, marginTop: 16 },
  signedOut: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32, paddingBottom: 60 },
  signedOutText: { fontSize: 16, color: colors.text, textAlign: 'center' },
  loginBtn: {
    height: 42,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },
});
