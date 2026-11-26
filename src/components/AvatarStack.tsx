// Overlapping row of avatars, e.g. next to "3 challenges nearby". Uses the app's own Avatar component.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/ghostTheme';
import Avatar from './Avatar';

export default function AvatarStack({ names, size = 28 }: { names: string[]; size?: number }) {
  if (names.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      {names.map((n, i) => (
        <View key={n} style={[s.ring, { borderRadius: size / 2 + 2, marginLeft: i === 0 ? 0 : -size * 0.3 }]}>
          <Avatar name={n} size={size} />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  ring: { borderWidth: 2, borderColor: colors.bg },
});