// Bottom sheet component that can be dragged up and down to reveal more content. 
// Sheet has 3 positions: collapsed, half, and expanded.
// The sheet has an optional accessory that can follow the sheet up to a certain point. 
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, PanResponder, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, shadow } from '../constants/ghostTheme';

type Snap = 'collapsed' | 'half' | 'expanded';

const HEADER = 84;
const COLLAPSED_VISIBLE = 96;
const ACCESSORY_GAP = 16;
const native = Platform.OS !== 'web';
const ORDER: Snap[] = ['collapsed', 'half', 'expanded'];

/** Visible sheet height at each snap position for a container of height `H`. */
function visibleFor(H: number): Record<Snap, number> {
  const expandedH = Math.round(H * 0.88);
  return {
    collapsed: COLLAPSED_VISIBLE,
    half: Math.min(Math.max(Math.round(H * 0.46), 260), expandedH),
    expanded: expandedH,
  };
}

/**
 * Accessory pinned above the sheet's top-right edge.
 * It rides up with the sheet from collapsed to half, then stays put while the sheet
 * expands further and covers it.
 */
interface BottomSheetProps {
  title: string;
  children: React.ReactNode;
  accessory?: React.ReactNode;
}

export default function BottomSheet({ title, children, accessory }: BottomSheetProps) {
  const [H, setH] = useState(0);
  const [snap, setSnap] = useState<Snap>('half');
  // Bumped on every drag release so the sheet re-settles even when the snap is unchanged.
  const [release, setRelease] = useState(0);
  const [ty] = useState(() => new Animated.Value(0));

  const expandedH = Math.round(H * 0.88);
  const visible = visibleFor(H);

  // translateY of the sheet for a snap position: 0 is fully expanded, larger values push it down.
  const y = (s: Snap) => expandedH - visible[s];

  // Animate to the current snap position whenever it changes or the container resizes.
  useEffect(() => {
    if (H <= 0) return;
    Animated.spring(ty, {
      toValue: expandedH - visibleFor(H)[snap],
      friction: 9,
      tension: 70,
      useNativeDriver: native,
    }).start();
  }, [H, expandedH, snap, release, ty]);

  // Drag handling. Rebuilt when the container height changes so it uses current snap offsets.
  const pan = useMemo(() => {
    const yAt = (s: Snap) => expandedH - visibleFor(H)[s];
    const clampY = (v: number) => Math.min(Math.max(v, yAt('expanded')), yAt('collapsed'));
    let startY = 0; // translateY when the current drag began
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        ty.stopAnimation((v) => {
          startY = v;
        });
      },
      onPanResponderMove: (_, g) => ty.setValue(clampY(startY + g.dy)),
      onPanResponderRelease: (_, g) => {

        // A drag settles on the nearest position, flick speed adjusts the target position in the drag direction.
        const projected = clampY(startY + g.dy) + g.vy * 150;
        const best = ORDER.reduce((a, b) => (Math.abs(yAt(a) - projected) < Math.abs(yAt(b) - projected) ? a : b));
        setSnap(best);
        setRelease((n) => n + 1);
      },
    });
  }, [H, expandedH, ty]);

  // Accessory follows the sheet from collapsed to half. Hides when the sheet expands further and covers it.
  const halfY = y('half');
  const collapsedY = y('collapsed');
  const accessoryY =
    collapsedY > halfY
      ? ty.interpolate({ inputRange: [halfY, collapsedY], outputRange: [halfY, collapsedY], extrapolate: 'clamp' })
      : collapsedY;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
    >
      {H > 0 && accessory && (
        <Animated.View
          pointerEvents="box-none"
          style={[s.accessory, { bottom: expandedH + ACCESSORY_GAP, transform: [{ translateY: accessoryY }] }]}
        >
          {accessory}
        </Animated.View>
      )}
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
  accessory: { position: 'absolute', right: 16 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  header: { height: HEADER, paddingHorizontal: 20, paddingTop: 10, ...noSelect },
  handle: { alignSelf: 'center', width: 56, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: colors.primary },
});