import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthScreen, signOut, useAuthContext } from '../auth';
import { colors } from '../constants/ghostTheme';


export default function YouScreen() {
  const insets = useSafeAreaInsets();
  const { isSignedIn, user } = useAuthContext();

  if (!isSignedIn) return <AuthScreen />;

  return (
    <View style={[s.root, { paddingTop: insets.top + 24 }]}>
      <View style={s.inner}>
        <Text style={s.title}>You</Text>
        <Text style={s.label}>Signed in as</Text>
        <Text style={s.email}>{user?.email}</Text>
        <Pressable style={s.btn} onPress={() => signOut()}>
          <Text style={s.btnText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: colors.primary, marginBottom: 24 },
  label: { fontSize: 12, color: colors.muted },
  email: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 24 },
  btn: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});