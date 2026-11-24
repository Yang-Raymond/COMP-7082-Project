import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../auth';
import Avatar from '../components/Avatar';
import PopoverMenu, { Anchor, MenuItem, ViewRef, measureAnchor } from '../components/PopoverMenu';
import ProfileHeader from '../components/ProfileHeader';
import { colors } from '../constants/ghostTheme';
import { confirmAction, showNotice } from '../services/dialog';
import {
  Friend,
  FriendRequest,
  SharedRoute,
  Suggestion,
  acceptRequest,
  cleanError,
  declineRequest,
  getFriendRoutes,
  getFriends,
  getRequests,
  getSuggestions,
  removeFriend,
  sendRequest,
  setMuted,
} from '../services/friends';
import { fetchRoute } from '../services/serverRoutes';
import type { SavedRoute } from '../types/route';

/** `onSignIn` opens the sign-in screen and comes back here afterwards. `onRace` starts a race on a route. */
export default function FriendsScreen({
  onSignIn,
  onRace,
}: {
  onSignIn: () => void;
  onRace?: (r: SavedRoute) => void;
}) {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuthContext();
  const root = useRef<ViewRef>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ friend: Friend; anchor: Anchor } | null>(null);
  const [viewing, setViewing] = useState<Friend | null>(null);

  const refresh = useCallback(async () => {
    try {
      // Suggestions are a nice-to-have, so a failure there shouldn't hide the friends list
      const [f, r, sg] = await Promise.all([getFriends(), getRequests(), getSuggestions().catch(() => [] as Suggestion[])]);
      setFriends(f);
      setRequests(r);
      setSuggestions(sg);
    } catch (e) {
      showNotice('Friends', cleanError(e, "Couldn't load friends."));
    }
  }, []);

  // Runs a server action, then reloads both lists. Errors show as a notice.
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      showNotice('Friends', cleanError(e));
    }
  };

  // Load when signed in (also after logging in from this screen); clear when signed out.
  useEffect(() => {
    if (!isSignedIn) {
      setFriends([]);
      setRequests([]);
      setSuggestions([]);
      return;
    }
    refresh();
  }, [isSignedIn, refresh]);

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

  if (viewing) return <FriendProfile friend={viewing} onBack={() => setViewing(null)} onRace={onRace} />;

  const openMenu = (friend: Friend, target: ViewRef | null) =>
    measureAnchor(target, root.current, (anchor) => setMenu({ friend, anchor }));

  const menuItems = (f: Friend): MenuItem[] => [
    { label: 'View profile', icon: 'person-outline', onPress: () => setViewing(f) },
    {
      label: f.muted ? 'Unmute challenges' : 'Mute challenges',
      icon: f.muted ? 'notifications-outline' : 'notifications-off-outline',
      onPress: () => run(() => setMuted(f.id, !f.muted)),
    },
    {
      label: 'Remove friend',
      icon: 'person-remove-outline',
      separated: true,
      onPress: () =>
        confirmAction(`Remove ${f.name}?`, "You won't see their challenges any more.", 'Remove', () =>
          run(() => removeFriend(f.id))
        ),
    },
  ];

  const submitNewFriend = () => {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await sendRequest(name);
      setNewName('');
      showNotice('Friends', 'Request sent.');
    });
  };

  return (
    <View ref={root} style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.topRow}>
        <Pressable hitSlop={8} accessibilityLabel="Friend requests" onPress={() => setShowRequests((v) => !v)}>
          <Ionicons name="notifications-outline" size={26} color={colors.primary} />
          {requests.length > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{requests.length}</Text>
            </View>
          )}
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
        {showRequests && (
          <View>
            <Text style={s.sectionTitle}>Requests</Text>
            {requests.length === 0 && <Text style={s.empty}>No pending requests.</Text>}
            {requests.map((r) => (
              <View key={r.id} style={s.row}>
                <Avatar name={r.username} size={40} />
                <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>
                  @{r.username}
                </Text>
                <Pressable style={s.accept} onPress={() => run(() => acceptRequest(r.id))}>
                  <Text style={s.acceptText}>Accept</Text>
                </Pressable>
                <Pressable onPress={() => run(() => declineRequest(r.id))}>
                  <Text style={s.decline}>Decline</Text>
                </Pressable>
              </View>
            ))}
            <Text style={[s.sectionTitle, { marginTop: 16 }]}>Friends</Text>
          </View>
        )}

        {visible.length === 0 && (
          <Text style={s.empty}>{friends.length === 0 ? 'No friends yet.' : 'No friends match your search.'}</Text>
        )}
        {visible.map((f) => (
          <FriendRow key={f.id} friend={f} open={menu?.friend.id === f.id} onMenu={(target) => openMenu(f, target)} />
        ))}

        {!query.trim() && suggestions.length > 0 && (
          <View>
            <Text style={[s.sectionTitle, { marginTop: 20 }]}>People you may know</Text>
            {suggestions.map((u) => (
              <View key={u.id} style={s.row}>
                <Avatar name={u.username} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{u.username}</Text>
                  <Text style={s.handle} numberOfLines={1}>
                    {u.mutual > 0 ? `${u.mutual} mutual ${u.mutual === 1 ? 'friend' : 'friends'}` : `@${u.username}`}
                  </Text>
                </View>
                <Pressable
                  style={s.accept}
                  accessibilityLabel={`Send friend request to ${u.username}`}
                  onPress={() =>
                    run(async () => {
                      await sendRequest(u.username);
                      showNotice('Friends', `Request sent to ${u.username}.`);
                    })
                  }
                >
                  <Text style={s.acceptText}>Add</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
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

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;

function FriendProfile({
  friend,
  onBack,
  onRace,
}: {
  friend: Friend;
  onBack: () => void;
  onRace?: (r: SavedRoute) => void;
}) {
  const insets = useSafeAreaInsets();
  const [activity, setActivity] = useState<'run' | 'bike'>('run');
  const [routes, setRoutes] = useState<SharedRoute[] | null>(null); // null = loading

  useEffect(() => {
    let alive = true;
    setRoutes(null);
    getFriendRoutes(friend.id, activity)
      .then((r) => alive && setRoutes(r))
      .catch((e) => {
        if (!alive) return;
        setRoutes([]);
        showNotice('Friends', cleanError(e, "Couldn't load their routes."));
      });
    return () => {
      alive = false;
    };
  }, [friend.id, activity]);

  // Loads the tapped route from the server and starts a race on it
  const race = async (r: SharedRoute) => {
    if (!onRace) return;
    try {
      onRace(await fetchRoute(String(r.id)));
    } catch (e) {
      showNotice('Friends', cleanError(e, "Couldn't load that route."));
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <Pressable style={s.back} onPress={onBack} hitSlop={8} accessibilityLabel="Back to friends">
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={s.backText}>Friends</Text>
      </Pressable>
      <ProfileHeader name={friend.name} username={friend.username} />
      {friend.muted && <Text style={s.note}>You&apos;ve muted challenges from {friend.name}.</Text>}

      <View style={s.toggle}>
        {(['run', 'bike'] as const).map((a) => (
          <Pressable key={a} style={[s.toggleBtn, activity === a && s.toggleOn]} onPress={() => setActivity(a)}>
            <Ionicons
              name={a === 'run' ? 'walk-outline' : 'bicycle-outline'}
              size={18}
              color={activity === a ? colors.onPrimary : colors.primary}
            />
            <Text style={[s.toggleText, activity === a && { color: colors.onPrimary }]}>
              {a === 'run' ? 'Running' : 'Biking'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        {routes === null && <Text style={s.empty}>Loading…</Text>}
        {routes?.length === 0 && (
          <Text style={s.empty}>{friend.name} hasn&apos;t saved any {activity === 'run' ? 'running' : 'biking'} challenges yet.</Text>
        )}
        {routes?.map((r) => (
          <Pressable key={r.id} style={s.row} onPress={() => race(r)} accessibilityLabel={`Race ${r.name}`}>
            <Ionicons name={r.activity === 'run' ? 'walk-outline' : 'bicycle-outline'} size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{r.name}</Text>
              <Text style={s.handle}>
                {km(r.distance_m)}
                {r.elevation_gain_m ? ` · ${Math.round(r.elevation_gain_m)} m climb` : ''}
              </Text>
            </View>
            <View style={s.tag}>
              <Ionicons
                name={r.visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
                size={12}
                color={colors.muted}
              />
              <Text style={s.tagText}>{r.visibility === 'public' ? 'Public' : 'Friends'}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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

  // requests
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, paddingHorizontal: 28, marginTop: 12 },
  accept: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  acceptText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
  decline: { color: colors.muted, fontSize: 13, paddingHorizontal: 8 },

  // friend profile routes
  toggle: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lavender,
    backgroundColor: colors.fieldBg,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { fontSize: 11, color: colors.muted },
});