import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../constants/ghostTheme';

interface Props {
  reason: string;
  onSignIn: () => void;
  onCancel: () => void;
}


export default function SignInPrompt({ reason, onSignIn, onCancel }: Props) {
  return (
    <View style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Close" />
      <View style={[s.card, shadow]}>
        <View style={s.iconWrap}>
          <Ionicons name="lock-closed" size={26} color={colors.primary} />
        </View>
        <Text style={s.title}>Sign in to continue</Text>
        <Text style={s.body}>{reason}</Text>
        <Pressable style={({ pressed }) => [s.primary, pressed && { opacity: 0.8 }]} onPress={onSignIn}>
          <Text style={s.primaryText}>Sign in</Text>
        </Pressable>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={s.cancel}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,5,12,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100, elevation: 100 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.bg, borderRadius: 24, padding: 24, alignItems: 'center', gap: 10 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.chipActive, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  primary: { alignSelf: 'stretch', height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  cancel: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: 4 },
});