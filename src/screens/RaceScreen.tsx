import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import GhostMap from '../components/GhostMap';
import { colors, shadow } from '../constants/ghostTheme';
import { useRouteRecorder } from '../hooks/useRouteRecorder';
import { SavedRoute } from '../types/route';

interface Props {
  route: SavedRoute;
  rec: ReturnType<typeof useRouteRecorder>;
  onExit: () => void;
}

const FALLBACK = { lat: 49.2494, lng: -122.9987 };

export default function RaceScreen({ route, rec, onExit }: Props) {
  const [pos, setPos] = useState(FALLBACK);

  // Safely check status and points to prevent undefined crashes
  const recording = rec?.status !== 'idle';
  const last = rec?.points?.[rec.points.length - 1];
  const center = last ? { lat: last.lat, lng: last.lng } : pos;

  
  const finish = () => {
    rec?.finish();
    onExit();
  };

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>
        <GhostMap
          latitude={center.lat}
          longitude={center.lng}
          path={rec?.points?.map((p) => ({ lat: p.lat, lng: p.lng })) || []}
        />
      </View>

      <View style={[s.topNav, { pointerEvents: 'box-none' } as object]}>
        <Pressable onPress={onExit} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={s.titleCard}>
          <Text style={s.title}>Racing: {route.name}</Text>
        </View>
      </View>

      <View style={[s.dock, { pointerEvents: 'box-none' } as object]}>
        <View style={[s.panel, shadow]}>
          {!recording ? (
            <Pressable style={s.startBtn} onPress={rec?.start}>
              <Text style={s.startText}>Start Race</Text>
            </Pressable>
          ) : (
            <View style={s.controls}>
               <Pressable style={s.pause} onPress={rec?.status === 'recording' ? rec.pause : rec.resume}>
                <Ionicons name={rec?.status === 'recording' ? 'pause' : 'play'} size={28} color={colors.primary} />
              </Pressable>
              <Pressable style={s.finish} onPress={finish}>
                <Ionicons name="stop" size={18} color={colors.onPrimary} />
                <Text style={s.finishText}>End Race</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topNav: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  titleCard: { flex: 1, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  panel: { width: '100%', maxWidth: 460, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, alignItems: 'center' },
  startBtn: { width: '100%', height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.onPrimary, fontSize: 18, fontWeight: '700' },
  controls: { flexDirection: 'row', gap: 14, alignItems: 'center', width: '100%' },
  pause: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  finish: { flex: 1, height: 68, borderRadius: 34, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  finishText: { color: colors.onPrimary, fontSize: 24, fontWeight: '700' },
});