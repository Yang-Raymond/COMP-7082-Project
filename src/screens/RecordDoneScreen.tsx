import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GhostMap from '../components/GhostMap';
import { RouteDraft } from '../hooks/useRouteRecorder';
import { formatClock, formatKm } from '../services/format';
import { useAuthContext } from '../auth';
import { colors } from '../constants/ghostTheme';

interface Props {
  draft: RouteDraft;
  onSave: (name: string) => void;
  onSaveAndChallenge: (name: string) => void;
  onDiscard: () => void;
}

export default function RecordDoneScreen({ draft, onSave, onSaveAndChallenge, onDiscard }: Props) {
  const { canChallenge } = useAuthContext();
  const insets = useSafeAreaInsets();
  const defaultName = `${draft.activity === 'bike' ? 'Bike' : 'Run'} · ${new Date().toLocaleDateString()}`;
  const [name, setName] = useState('');
  const first = draft.points[0];
  const finalName = name.trim() || defaultName;

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: 16 }]}>
      <View style={s.inner}>
      <Pressable onPress={onDiscard} style={s.close} hitSlop={10}>
        <Ionicons name="close" size={30} color={colors.text} />
      </Pressable>

      <Text style={s.title}>Nice Work!</Text>
      <Text style={s.sub}>Now Challenge your friends.</Text>

      <View style={s.card}>
        <View style={s.map}>
          {first && (
            <GhostMap
              latitude={first.lat}
              longitude={first.lng}
              path={draft.points}
              showUser={false}
              fitPath
              interactive={false}
            />
          )}
        </View>
        <View style={s.stats}>
          <Stat value={formatClock(draft.durationMs)} unit="min" label="Time" />
          <Stat value={formatKm(draft.distanceMeters)} unit="km" label="Distance" />
          <Stat value={String(Math.round(draft.elevationGainMeters))} unit="m" label="Elev. gained" />
        </View>
      </View>

      <TextInput
        style={s.input}
        placeholder={`Name this route (${defaultName})`}
        placeholderTextColor={colors.muted}
        value={name}
        onChangeText={setName}
      />

      <View style={{ flex: 1 }} />

      {!canChallenge && (
        <Text style={s.hint}>Sign in to challenge friends. You can still save this run.</Text>
      )}
      <Pressable style={s.primary} onPress={() => onSaveAndChallenge(finalName)}>
        <Text style={s.primaryText}>Save & Challenge</Text>
        <Ionicons name={canChallenge ? 'arrow-forward' : 'lock-closed'} size={20} color="#fff" />
      </Pressable>
      <View style={s.row}>
        <Pressable style={s.secondary} onPress={() => onSave(finalName)}>
          <Ionicons name="save" size={18} color={colors.primary} />
          <Text style={s.secondaryText}>Save only</Text>
        </Pressable>
        <Pressable style={s.discard} onPress={onDiscard}>
          <Ionicons name="trash" size={18} color={colors.primary} />
          <Text style={s.secondaryText}>Discard</Text>
        </Pressable>
      </View>
      </View>
    </View>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.statValue}>{value}<Text style={s.statUnit}>{unit}</Text></Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  inner: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  close: { alignSelf: 'flex-start', marginBottom: 24 },
  title: { fontSize: 44, fontWeight: '800', color: colors.primary },
  sub: { fontSize: 17, color: colors.text, marginBottom: 22 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.bg },
  map: { height: 190 },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  statUnit: { fontSize: 15, fontWeight: '600' },
  statLabel: { fontSize: 12, color: colors.muted },
  input: { marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 13, marginBottom: 10 },
  primary: { height: 60, borderRadius: 30, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, marginTop: 14 },
  secondary: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  discard: { flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontSize: 16, fontWeight: '700', color: colors.primary },
});