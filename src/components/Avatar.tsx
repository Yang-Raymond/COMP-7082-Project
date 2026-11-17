import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/ghostTheme';

const FILLS = [colors.primary, colors.accent, colors.blue, colors.ahead];

interface Props {
  name: string;
  size?: number;
  /** A photo to show over the letter. The letter shows while it loads, or if it can't load. */
  photo?: string | null;
  /** Shows the "+" badge. */
  onAdd?: () => void;
}

/** A round avatar with a photo, or the first letter of a name. The colour comes from the name, so a person keeps the same one. */
export default function Avatar({ name, size = 40, photo, onAdd }: Props) {
  const [broken, setBroken] = useState<string | null>(null);
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const fill = FILLS[Math.abs(hash) % FILLS.length];
  const badge = Math.max(22, Math.round(size * 0.26));
  const showPhoto = photo && photo !== broken;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[s.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}>
        <Text style={[s.letter, { fontSize: Math.round(size * 0.42) }]}>{name.charAt(0).toUpperCase()}</Text>
        {showPhoto && (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            onError={() => setBroken(photo)}
            accessibilityIgnoresInvertColors
          />
        )}
      </View>
      {onAdd && (
        <Pressable
          onPress={onAdd}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={showPhoto ? 'Change profile photo' : 'Add a profile photo'}
          style={[s.badge, { width: badge, height: badge, borderRadius: badge / 2 }]}
        >
          <Ionicons name="add" size={Math.round(badge * 0.7)} color={colors.onPrimary} />
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letter: { color: colors.onPrimary, fontWeight: '700' },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
