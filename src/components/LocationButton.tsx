// Round floating locate button overlayed on a map. 
// Tapping it requests location (on Android, prompting to turn location on if it is off using Android's location prompt) and recenters the given map.
import type { RefObject } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../constants/ghostTheme';
import { useCurrentPosition } from '../hooks/useCurrentPosition';
import type { GhostMapHandle } from '../types/map';

/** The map to recenter. */
interface LocationButtonProps {
  mapRef: RefObject<GhostMapHandle | null>;
}

/**
 * Renders the themed locate button. On press it
 * asks the location provider for a usable location and recenters only if one is
 * available. It is never disabled, so the "turn on location" prompt stays reachable.
 */
export default function LocationButton({ mapRef }: LocationButtonProps) {
  const { requestLocation } = useCurrentPosition();

  const onPress = async () => {
    if (await requestLocation()) mapRef.current?.recenter();
  };

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Center map on my location"
      style={({ pressed }) => [s.btn, shadow, pressed && s.dim]}
    >
      <Ionicons name="locate" size={24} color={colors.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
});
