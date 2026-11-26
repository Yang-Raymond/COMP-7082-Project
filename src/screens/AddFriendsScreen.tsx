// Add friends: search by @handle, or pick someone you may know. Opens from the round "add" button on Friends.
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthContext } from '../auth';
import Avatar from '../components/Avatar';
import { colors } from '../constants/ghostTheme';
import { showNotice } from '../services/dialog';
import { cleanError, sendRequest, type Friend, type Suggestion } from '../services/friends';

interface Person {
  username: string;
  detail: string;
}

interface Props {
  suggestions: Suggestion[];
  friends: Friend[];
  onBack: () => void;
}

export default function AddFriendsScreen({ suggestions, friends, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [query, setQuery] = useState('');
  // Requests sent from this screen. The server has no list of outgoing requests yet, so this lasts until you leave.
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const typed = query.trim().replace(/^@+/, '').toLowerCase();

  const people = useMemo<Person[]>(() => {
    const friendNames = new Set(friends.map((f) => f.username.toLowerCase()));
    const list: Person[] = suggestions
      .filter((u) => u.username.toLowerCase().includes(typed) && !friendNames.has(u.username.toLowerCase()))
      .map((u) => ({
        username: u.username,
        detail: u.mutual > 0 ? `@${u.username} · ${u.mutual} mutual` : `@${u.username}`,
      }));
    // The server can only look up an exact username, so offer the typed handle when it isn't already listed
    const isMe = typed === (user?.username ?? '').toLowerCase();
    const listed = list.some((p) => p.username.toLowerCase() === typed) || friendNames.has(typed);
    if (typed.length >= 3 && !listed && !isMe) list.push({ username: typed, detail: 'Send a friend request' });
    return list;
  }, [suggestions, friends, typed, user?.username]);

  const add = async (username: string) => {
    setBusy(username);
    try {
      await sendRequest(username);
      setSent((prev) => new Set(prev).add(username.toLowerCase()));
    } catch (e) {
      showNotice('Add friends', cleanError(e, "Couldn't send the request."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.header}>
        <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back" style={s.headerSide}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Add friends</Text>
        <View style={s.headerSide} />
      </View>

      <View style={s.field}>
        <Ionicons name="search" size={18} color={colors.text} />
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by @handle"
          placeholderTextColor={colors.muted}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear">
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <Text style={s.label}>{typed ? 'RESULTS' : 'PEOPLE YOU MAY KNOW'}</Text>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {people.length === 0 && (
          <Text style={s.empty}>
            {typed ? 'No one found. Check the spelling of their handle.' : 'No suggestions yet. Type a username to send a request.'}
          </Text>
        )}
        {people.map((p) => {
          const requested = sent.has(p.username.toLowerCase());
          return (
            <View key={p.username} style={s.row}>
              <Avatar name={p.username} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{p.username}</Text>
                <Text style={s.detail} numberOfLines={1}>{p.detail}</Text>
              </View>
              {requested ? (
                <View style={[s.btn, s.btnRequested]}>
                  <Text style={s.requestedText}>Requested</Text>
                </View>
              ) : (
                <Pressable style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }, busy === p.username && { opacity: 0.6 }]} onPress={() => add(p.username)} disabled={busy !== null}>
                  <Ionicons name="person-add-outline" size={14} color={colors.onPrimary} />
                  <Text style={s.btnText}>Add</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40, marginBottom: 12 },
  headerSide: { width: 40 },
  headerTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#fff', paddingHorizontal: 16 },
  input: { flex: 1, height: '100%', fontSize: 14, color: colors.text, ...noOutline },
  label: { fontSize: 10, letterSpacing: 0.8, color: colors.muted, marginTop: 18, marginBottom: 6 },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  detail: { fontSize: 11, color: colors.muted, marginTop: 1 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.primary },
  btnText: { color: colors.onPrimary, fontSize: 13, fontWeight: '600' },
  btnRequested: { backgroundColor: colors.lavender },
  requestedText: { color: colors.text, fontSize: 13, fontWeight: '600' },
});