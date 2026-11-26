// Friends tab: your requests, your crew (each with a menu to view, mute or remove), and a button to add people.
// Muting a friend hides their challenges from you: their routes drop out of Explore, Challenges and the tab badge.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../auth';
import Avatar from '../components/Avatar';
import PopoverMenu, { Anchor, MenuItem, ViewRef, measureAnchor } from '../components/PopoverMenu';
import ProfileHeader from '../components/ProfileHeader';
import { colors } from '../constants/ghostTheme';
import type { Challenges } from '../hooks/useChallenges';
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
  setMuted,
} from '../services/friends';
import { fetchRoute } from '../services/serverRoutes';
import type { SavedRoute } from '../types/route';
import AddFriendsScreen from './AddFriendsScreen';

interface Props {
  /** Opens the sign-in screen and comes back here afterwards. */
  onSignIn: () => void;
  /** Starts a race on a route. */
  onRace?: (r: SavedRoute) => void;
  /** Shared routes loaded by the app shell; reloaded here after a mute so hidden challenges disappear right away. */
  challenges: Challenges;
}

export default function FriendsScreen({ onSignIn, onRace, challenges }: Props) {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuthContext();
  const root = useRef<ViewRef>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState<{ friend: Friend; anchor: Anchor } | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

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

  // Runs a server action, then reloads the lists here and the shared routes (a mute, remove or accept changes
  // which challenges you should see). Errors show as a notice.
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await refresh();
      challenges.reload();
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

  const crew = useMemo(() => {
    const q = query.trim().replace(/^@+/, '').toLowerCase();
    return friends.filter((f) => f.name.toLowerCase().includes(q) || f.username.toLowerCase().includes(q));
  }, [friends, query]);

  // The newest route each friend made, which is the challenge to show next to their name
  const nextByFriend = useMemo(() => {
    const m = new Map<string, SavedRoute>();
    for (const r of challenges.friendChallenges) {
      const who = challenges.infoOf(r)?.creator?.toLowerCase();
      if (who && !m.has(who)) m.set(who, r);
    }
    return m;
  }, [challenges.friendChallenges, challenges.infoOf]);

  if (!isSignedIn) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 8 }]}>
        <View style={[s.titleRow, { marginTop: 40 }]}>
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

  if (adding) return <AddFriendsScreen suggestions={suggestions} friends={friends} onBack={() => setAdding(false)} />;

  const viewing = viewingId ? friends.find((f) => f.id === viewingId) : undefined;

  const toggleMute = (f: Friend) => run(() => setMuted(f.id, !f.muted));
  const confirmRemove = (f: Friend) =>
    confirmAction(`Remove ${f.name}?`, "You won't see their challenges any more.", 'Remove', () => run(() => removeFriend(f.id)));

  if (viewing) {
    return (
      <FriendProfile
        friend={viewing}
        onBack={() => setViewingId(null)}
        onRace={onRace}
        onMute={() => toggleMute(viewing)}
        onRemove={() => confirmRemove(viewing)}
      />
    );
  }

  const openMenu = (friend: Friend, target: ViewRef | null) =>
    measureAnchor(target, root.current, (anchor) => setMenu({ friend, anchor }));

  const menuItems = (f: Friend): MenuItem[] => [
    { label: 'View profile', icon: 'person-outline', onPress: () => setViewingId(f.id) },
    {
      label: f.muted ? 'Unmute challenges' : 'Mute challenges',
      icon: f.muted ? 'notifications-outline' : 'notifications-off-outline',
      onPress: () => toggleMute(f),
    },
    { label: 'Remove friend', icon: 'person-remove-outline', separated: true, onPress: () => confirmRemove(f) },
  ];

  const shownRequests = showAllRequests ? requests : requests.slice(0, 1);

  return (
    <View ref={root} style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.titleRow}>
        <Text style={s.title}>Friends</Text>
        <Pressable style={s.addBtn} onPress={() => setAdding(true)} hitSlop={6} accessibilityLabel="Add friends">
          <Ionicons name="person-add-outline" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={s.search}>
        <Ionicons name="search" size={16} color={colors.text} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name or @handle"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {requests.length > 0 && (
          <View style={s.section}>
            <View style={s.labelRow}>
              <Text style={s.smallLabel}>Requests · {requests.length}</Text>
              {requests.length > 1 && (
                <Pressable onPress={() => setShowAllRequests(!showAllRequests)} hitSlop={8}>
                  <Text style={s.seeAll}>{showAllRequests ? 'Show less' : 'See all'}</Text>
                </Pressable>
              )}
            </View>
            <View style={s.requests}>
              {shownRequests.map((r) => (
                <View key={r.id} style={s.requestRow}>
                  <Avatar name={r.username} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name} numberOfLines={1}>{r.username}</Text>
                    <Text style={s.sub} numberOfLines={1}>@{r.username} wants to be friends</Text>
                  </View>
                  <Pressable style={s.decline} onPress={() => run(() => declineRequest(r.id))} hitSlop={6} accessibilityLabel={`Decline ${r.username}`}>
                    <Ionicons name="close" size={16} color={colors.text} />
                  </Pressable>
                  <Pressable style={s.accept} onPress={() => run(() => acceptRequest(r.id))} hitSlop={6} accessibilityLabel={`Accept ${r.username}`}>
                    <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={[s.smallLabel, { marginBottom: 4 }]}>YOUR CREW · {friends.length}</Text>
          {crew.length === 0 && (
            <Text style={s.empty}>
              {friends.length === 0 ? 'No friends yet. Tap the add button to find people.' : 'No friends match your search.'}
            </Text>
          )}
          {crew.map((f) => (
            <FriendRow
              key={f.id}
              friend={f}
              next={f.muted ? undefined : nextByFriend.get(f.username.toLowerCase())}
              open={menu?.friend.id === f.id}
              onMenu={(target) => openMenu(f, target)}
              onOpen={() => setViewingId(f.id)}
              onRace={onRace}
            />
          ))}
        </View>
      </ScrollView>

      {menu && <PopoverMenu anchor={menu.anchor} items={menuItems(menu.friend)} onClose={() => setMenu(null)} />}
    </View>
  );
}

function FriendRow({
  friend,
  next,
  open,
  onMenu,
  onOpen,
  onRace,
}: {
  friend: Friend;
  next?: SavedRoute;
  open: boolean;
  onMenu: (target: ViewRef | null) => void;
  onOpen: () => void;
  onRace?: (r: SavedRoute) => void;
}) {
  const kebab = useRef<ViewRef>(null);
  return (
    <Pressable style={s.row} onPress={onOpen}>
      <Avatar name={friend.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>{friend.name}</Text>
        {friend.muted ? (
          <View style={s.mutedRow}>
            <Ionicons name="notifications-off-outline" size={12} color={colors.muted} />
            <Text style={s.sub}>Challenges muted</Text>
          </View>
        ) : next ? (
          <Text style={[s.sub, { color: colors.behind, fontWeight: '600' }]} numberOfLines={1}>Has a challenge for you</Text>
        ) : (
          <Text style={s.sub} numberOfLines={1}>@{friend.username}</Text>
        )}
      </View>
      {next && onRace && (
        <Pressable style={({ pressed }) => [s.raceBtn, pressed && { opacity: 0.8 }]} onPress={() => onRace(next)} accessibilityLabel={`Race ${friend.name}`}>
          <Text style={s.raceText}>Race</Text>
        </Pressable>
      )}
      <Pressable
        ref={kebab}
        hitSlop={8}
        accessibilityLabel={`More options for ${friend.name}`}
        style={[s.kebab, open && s.kebabOpen]}
        onPress={() => onMenu(kebab.current)}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
      </Pressable>
    </Pressable>
  );
}

const km = (m: number) => `${(m / 1000).toFixed(2)} km`;

function FriendProfile({
  friend,
  onBack,
  onRace,
  onMute,
  onRemove,
}: {
  friend: Friend;
  onBack: () => void;
  onRace?: (r: SavedRoute) => void;
  onMute: () => void;
  onRemove: () => void;
}) {
  const insets = useSafeAreaInsets();
  const root = useRef<ViewRef>(null);
  const dots = useRef<ViewRef>(null);
  const [menu, setMenu] = useState<Anchor | null>(null);
  const [routes, setRoutes] = useState<SharedRoute[] | null>(null); // null = loading

  useEffect(() => {
    let alive = true;
    setRoutes(null);
    getFriendRoutes(friend.id)
      .then((r) => alive && setRoutes(r))
      .catch((e) => {
        if (!alive) return;
        setRoutes([]);
        showNotice('Friends', cleanError(e, "Couldn't load their routes."));
      });
    return () => {
      alive = false;
    };
  }, [friend.id]);

  // Loads the tapped route from the server and starts a race on it
  const race = async (r: SharedRoute) => {
    if (!onRace) return;
    try {
      onRace(await fetchRoute(String(r.id)));
    } catch (e) {
      showNotice('Friends', cleanError(e, "Couldn't load that route."));
    }
  };

  const items: MenuItem[] = [
    {
      label: friend.muted ? 'Unmute challenges' : 'Mute challenges',
      icon: friend.muted ? 'notifications-outline' : 'notifications-off-outline',
      onPress: onMute,
    },
    { label: 'Remove friend', icon: 'person-remove-outline', separated: true, onPress: onRemove },
  ];

  return (
    <View ref={root} style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.profileTop}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back to friends">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          ref={dots}
          style={[s.kebab, !!menu && s.kebabOpen]}
          hitSlop={8}
          accessibilityLabel="More options"
          onPress={() => measureAnchor(dots.current, root.current, setMenu)}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ProfileHeader name={friend.name} username={friend.username} />
      {friend.muted && <Text style={s.note}>You&apos;ve muted challenges from {friend.name}.</Text>}

      <Text style={[s.smallLabel, { paddingHorizontal: 16, marginTop: 24, marginBottom: 4 }]}>{friend.name.toUpperCase()}&apos;S ROUTES</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {routes === null && <Text style={s.empty}>Loading…</Text>}
        {routes?.length === 0 && <Text style={s.empty}>{friend.name} hasn&apos;t saved any routes yet.</Text>}
        {routes?.map((r) => (
          <Pressable key={r.id} style={s.routeRow} onPress={() => race(r)} accessibilityLabel={`Race ${r.name}`}>
            <Ionicons name={r.activity === 'run' ? 'walk-outline' : 'bicycle-outline'} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{r.name}</Text>
              <Text style={s.sub}>
                {km(r.distance_m)}
                {r.elevation_gain_m ? ` · ${Math.round(r.elevation_gain_m)} m climb` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ))}
      </ScrollView>

      {menu && <PopoverMenu anchor={menu} items={items} onClose={() => setMenu(null)} />}
    </View>
  );
}

const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12 },
  title: { fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: colors.text },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    marginHorizontal: 20,
    marginTop: 18,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#8E8AAE',
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, height: '100%', fontSize: 14, color: colors.text, ...noOutline },

  section: { paddingHorizontal: 20, marginTop: 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  smallLabel: { fontSize: 10, letterSpacing: 0.8, color: colors.muted },
  seeAll: { fontSize: 12, fontWeight: '700', color: colors.primary },

  requests: { backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 4 },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  decline: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#8E8AAE', alignItems: 'center', justifyContent: 'center' },
  accept: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  sub: { fontSize: 11, color: colors.muted, marginTop: 1 },
  mutedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  raceBtn: { height: 34, paddingHorizontal: 20, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  raceText: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  kebab: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kebabOpen: { backgroundColor: colors.border },
  empty: { color: colors.muted, fontSize: 14, paddingVertical: 12 },

  signedOut: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32, paddingBottom: 60 },
  signedOutText: { fontSize: 16, color: colors.text, textAlign: 'center' },
  loginBtn: { height: 42, paddingHorizontal: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: colors.onPrimary, fontSize: 15, fontWeight: '600' },

  // friend profile
  profileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  note: { color: colors.muted, fontSize: 13, paddingHorizontal: 20, marginTop: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
});