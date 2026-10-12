import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GhostMap from '../components/GhostMap';
import StartButton from '../components/StartButton';
import { useAuthContext } from '../auth';
import RecordDoneScreen from './RecordDoneScreen';
import { GpsTracker } from '../services/gpsTracker';
import { RouteDraft, saveDraft, useRouteRecorder } from '../hooks/useRouteRecorder';
import { formatClock, formatKm } from '../services/format';
import { colors, shadow } from '../constants/ghostTheme';
import { ActivityType } from '../types/route';

const FALLBACK = { lat: 49.2494, lng: -122.9987 };

interface Props {
  /** Recorder state lives in AppShell so a run survives tab switches. */
  rec: ReturnType<typeof useRouteRecorder>;
  draft: RouteDraft | null;
  onDraft: (d: RouteDraft | null) => void;
  onSaved: () => void;
}

export default function RecordScreen({ rec, draft, onDraft, onSaved }: Props) {
  const { requireAuth } = useAuthContext();
  const [pos, setPos] = useState(FALLBACK);
  const tracker = useRef(new GpsTracker());

  // Center the map on the user before recording starts
  useEffect(() => {
    tracker.current.getCurrent().then((fix) => {
      if (fix) setPos({ lat: fix.lat, lng: fix.lng });
    });
  }, []);

  const recording = rec.status !== 'idle';
  const last = rec.points[rec.points.length - 1];
  const center = last ? { lat: last.lat, lng: last.lng } : pos;

  const finish = () => onDraft(rec.finish());

  const save = async (name: string) => {
    if (!draft) return;
    await saveDraft(draft, name);
    onDraft(null);
    onSaved();
  };

  if (draft) {
    return <RecordDoneScreen
        draft={draft}
        onSave={save}
        onSaveAndChallenge={(name) => requireAuth('Sign in to challenge your friends.', () => save(name))}
        onDiscard={() => onDraft(null)}
      />;
  }

  const Mode = ({ type, label, icon }: { type: ActivityType; label: string; icon: 'walk' | 'bicycle' }) => (
    <Pressable style={[s.mode, rec.activity === type && s.modeOn]} onPress={() => rec.setActivity(type)}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={s.modeText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>
        <GhostMap
          latitude={center.lat}
          longitude={center.lng}
          path={rec.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
        />
      </View>

      {/* Full-width dock; the card inside is capped so it never stretches on wide screens */}
      <View style={[s.dock, { pointerEvents: 'box-none' } as object]}>
        {!recording ? (
          <View style={[s.panel, shadow]}>
            <StartButton onPress={rec.start} />
            <View style={s.modes}>
              <Mode type="run" label="Run" icon="walk" />
              <Mode type="bike" label="Bike" icon="bicycle" />
            </View>
          </View>
        ) : (
          <View style={s.recordWrap}>
            <View style={[s.stats, shadow]}>
              <Stat value={formatClock(rec.elapsedMs)} label="Time" />
              <Stat value={formatKm(rec.distanceMeters)} label="Distance (km)" />
              <Stat value={String(Math.round(rec.elevationGainMeters))} label="Elevation Gained" />
            </View>
            <View style={s.controls}>
              <Pressable style={s.pause} onPress={rec.status === 'recording' ? rec.pause : rec.resume}>
                <Ionicons name={rec.status === 'recording' ? 'pause' : 'play'} size={28} color={colors.primary} />
              </Pressable>
              <Pressable style={s.finish} onPress={finish}>
                <Ionicons name="stop" size={18} color="#fff" />
                <Text style={s.finishText}>Finish</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  panel: { width: '100%', maxWidth: 460, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 76, paddingBottom: 16, alignItems: 'center' },
  modes: { flexDirection: 'row', backgroundColor: '#f6f3f8', borderRadius: 24, padding: 4, gap: 4 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  modeOn: { backgroundColor: colors.lavender },
  modeText: { fontSize: 14, fontWeight: '600', color: colors.text },
  recordWrap: { width: '100%', maxWidth: 460, paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  stats: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: 18, paddingVertical: 16, borderWidth: 1, borderColor: colors.border },
  statValue: { fontSize: 28, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted, textAlign: 'center' },
  controls: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  pause: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  finish: { flex: 1, height: 68, borderRadius: 34, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  finishText: { color: '#fff', fontSize: 24, fontWeight: '700' },
});