import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { colors } from '../constants/ghostTheme';
import { ProfileDetails } from '../services/profileDetails';
import { cleanError } from '../services/friends';

type Props = {
  visible: boolean;
  initial: ProfileDetails;
  username: string;
  onClose: () => void;
  onSave: (details: ProfileDetails, username: string) => Promise<void>;
};

const MAX_NAME = 30;
const MAX_BIO = 150;
const MAX_USERNAME = 20;

export default function EditProfileModal({ visible, initial, username, onClose, onSave }: Props) {
  const [name, setName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [handle, setHandle] = useState(username);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the fields each time the sheet opens
  useEffect(() => {
    if (visible) {
      setName(initial.displayName);
      setBio(initial.bio);
      setHandle(username);
      setError(null);
    }
  }, [visible, initial.displayName, initial.bio, username]);

  const save = async () => {
    if (saving) return;
    const newHandle = handle.trim();
    if (!newHandle) return setError('Username can\u2019t be empty.');
    setSaving(true);
    setError(null);
    try {
      await onSave({ displayName: name.trim(), bio: bio.trim() }, newHandle);
      onClose();
    } catch (e) {
      // Shows the server's message, e.g. "Username already taken"
      setError(cleanError(e, "Couldn't save your profile. Try again."));
    }
    // Not in a finally block: React Compiler skips any component that uses one
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={s.link}>Cancel</Text>
            </Pressable>
            <Text style={s.title}>Edit profile</Text>
            <Pressable onPress={save} hitSlop={8} disabled={saving}>
              <Text style={[s.link, { fontWeight: '700' }, saving && { opacity: 0.5 }]}>Save</Text>
            </Pressable>
          </View>

          <Text style={s.label}>Display name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder={handle || username}
            placeholderTextColor={colors.muted}
            maxLength={MAX_NAME}
            autoCapitalize="words"
            returnKeyType="next"
          />
          <Text style={s.hint}>Leave blank to show your username.</Text>

          <Text style={s.label}>Username</Text>
          <TextInput
            style={s.input}
            value={handle}
            onChangeText={setHandle}
            placeholderTextColor={colors.muted}
            maxLength={MAX_USERNAME}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />

          <Text style={s.label}>Bio</Text>
          <TextInput
            style={[s.input, s.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about your runs"
            placeholderTextColor={colors.muted}
            maxLength={MAX_BIO}
            multiline
            textAlignVertical="top"
          />
          <Text style={[s.hint, { textAlign: 'right' }]}>{bio.length}/{MAX_BIO}</Text>

          {error && <Text style={s.error}>{error}</Text>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 16, fontWeight: '700', color: colors.primary },
  link: { fontSize: 15, color: colors.primary },
  label: { fontSize: 12, color: colors.muted, marginBottom: 6, marginTop: 8 },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.fieldBg,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.primary,
  },
  bioInput: { height: 88, paddingTop: 10 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  error: { color: '#d33', fontSize: 13, marginTop: 12 },
});