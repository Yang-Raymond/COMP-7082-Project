// Web placeholder for GhostMap. 
// Delete later.
// Map not available on web.
// Used for quick testing purpose. 
import { useImperativeHandle } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/ghostTheme';
import type { GhostMapProps } from '../types/map';

/**
 * Renders a themed placeholder with the center coordinates; map props are otherwise ignored.
 * Exposes the same `ref` handle as the native map, with `recenter` as a no-op.
 */
export default function GhostMap({ center, ref }: GhostMapProps) {
  useImperativeHandle(ref, () => ({ recenter: () => {} }), []);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Map available on iOS/Android</Text>
      <Text style={styles.coords}>
        {center ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : 'Locating…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  title: { color: colors.text, fontWeight: '600' },
  coords: { color: colors.muted, marginTop: 4 },
});
