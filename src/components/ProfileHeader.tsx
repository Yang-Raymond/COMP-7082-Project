import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { colors } from '../constants/ghostTheme';

interface Props {
  name: string;
  username: string;
  stats?: { value: number; label: string }[];
  /** Shows the "+" badge on the avatar. */
  onAddPhoto?: () => void;
  photo?: string | null;
}

/** Big avatar with name, @handle and counts beside it. Used on the You tab and a friend's profile. */
export default function ProfileHeader({ name, username, stats, onAddPhoto }: Props) {
  return (
    <View style={s.row}>
      <Avatar name={name} size={104} onAdd={onAddPhoto} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <Text style={s.handle} numberOfLines={1}>@{username}</Text>
        {stats && (
          <View style={s.stats}>
            {stats.map((st) => (
              <View key={st.label} style={s.stat}>
                <Text style={s.value}>{st.value}</Text>
                <Text style={s.label}>{st.label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14 },
  info: { flex: 1 },
  name: { fontSize: 26, fontWeight: '800', color: colors.primary },
  handle: { fontSize: 13, color: colors.muted },
  stats: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1 },
  value: { fontSize: 17, fontWeight: '700', color: colors.primary },
  label: { fontSize: 14, color: colors.muted },
});
