// The space above the challenge cards that shows who is racing you right now.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/ghostTheme';
import type { LiveChallenger } from '../hooks/useLiveChallengers';
import Avatar from './Avatar';

export default function LiveStrip({ challengers }: { challengers: LiveChallenger[] }) {
  const first = challengers[0];
  const more = challengers.length - 1;
  return (
    <View style={s.box}>
      <View style={s.label}>
        <View style={[s.dot, challengers.length === 0 && { backgroundColor: colors.muted }]} />
        <Text style={s.labelText}>Live now</Text>
      </View>
      {first ? (
        <View style={s.row}>
          <View style={{ flexDirection: 'row' }}>
            {challengers.slice(0, 3).map((c, i) => (
              <View key={c.id} style={[s.ring, { marginLeft: i === 0 ? 0 : -10 }]}>
                <Avatar name={c.name} photo={c.photo} size={32} />
              </View>
            ))}
          </View>
          <Text style={s.text} numberOfLines={1}>
            <Text style={s.bold}>{first.name}</Text>
            {more > 0 ? ` and ${more} more are` : ' is'} racing {first.routeName}
          </Text>
        </View>
      ) : (
        <Text style={s.empty}>No one is racing you right now.</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.fieldBg, borderRadius: 16, padding: 12, gap: 8 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ahead },
  labelText: { fontSize: 11, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ring: { borderWidth: 2, borderColor: colors.fieldBg, borderRadius: 18 },
  text: { flex: 1, fontSize: 13, color: colors.text },
  bold: { fontWeight: '700' },
  empty: { fontSize: 13, color: colors.muted },
});