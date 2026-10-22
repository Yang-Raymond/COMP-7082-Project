
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../constants/ghostTheme';

type Snap = 'collapsed' | 'half' | 'expanded';

const HEADER = 84;
const COLLAPSED_VISIBLE = 96;
const native = Platform.OS !== 'web';
const ORDER: Snap[] = ['collapsed', 'half', 'expanded'];

export default function BottomSheet({ title, children }: { title: string; children: React.ReactNode }) {
  const [H, setH] = useState(0); 
  const [snap, setSnap] = useState<Snap>('half');
  const snapRef = useRef<Snap>('half');
  const ty = useRef(new Animated.Value(0)).current;
  const startY = useRef(0);

  const expandedH = Math.round(H * 0.88);
  const visible: Record<Snap, number> = {
    collapsed: COLLAPSED_VISIBLE,
    half: Math.min(Math.max(Math.round(H * 0.46), 260), expandedH),
    expanded: expandedH,
  };

  
  const dims = useRef({ expandedH, visible });
  dims.current = { expandedH, visible };
  const y = (s: Snap) => dims.current.expandedH - dims.current.visible[s];
  const clampY = (v: number) => Math.min(Math.max(v, y('expanded')), y('collapsed'));

  const snapTo = (s: Snap) => {
    snapRef.current = s;
    setSnap(s);
    Animated.spring(ty, { toValue: y(s), friction: 9, tension: 70, useNativeDriver: native }).start();
  };

  // Place the sheet once we know the container size (and again if it resizes)
  useEffect(() => {
    if (H > 0) ty.setValue(y(snapRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [H]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        ty.stopAnimation((v) => {
          startY.current = v;
        });
      },
      onPanResponderMove: (_, g) => ty.setValue(clampY(startY.current + g.dy)),
      onPanResponderRelease: (_, g) => {
        // A tap (barely moved) steps to the next position
        if (Math.abs(g.dx) < 5 && Math.abs(g.dy) < 5) {
          snapTo(ORDER[(ORDER.indexOf(snapRef.current) + 1) % ORDER.length]);
          return;
        }
        // A drag settles on the nearest position, nudged by flick speed
        const projected = clampY(startY.current + g.dy) + g.vy * 150;
        const best = ORDER.reduce((a, b) => (Math.abs(y(a) - projected) < Math.abs(y(b) - projected) ? a : b));
        snapTo(best);
      },
    })
  ).current;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"   
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
    >
      {H > 0 && (
        <Animated.View style={[s.sheet, shadow, { height: expandedH, transform: [{ translateY: ty }] }]}>
          <View {...pan.panHandlers} style={s.header}>
            <View style={s.handle} />
            <View style={s.titleRow}>
              <Text style={s.title}>{title}</Text>
            </View>
          </View>
          <ScrollView
            style={{ height: expandedH - HEADER }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: expandedH - visible[snap] + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const noSelect = Platform.OS === 'web' ? ({ userSelect: 'none', cursor: 'grab' } as object) : {};

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  header: { height: HEADER, paddingHorizontal: 20, paddingTop: 10, ...noSelect },
  handle: { alignSelf: 'center', width: 56, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: colors.primary },
});