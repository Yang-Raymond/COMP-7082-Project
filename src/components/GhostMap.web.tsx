// Web placeholder for GhostMap. The app targets iOS/Android only; web is used
// for quick UI checks. This file keeps Metro from bundling the native Mapbox SDK
// on web and shows a simple box with the current coordinates instead.
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/ghostTheme';
import type { GhostMapProps } from '../types/map';

/** Renders a themed placeholder with the center coordinates; map props are otherwise ignored. */
export default function GhostMap({ latitude, longitude }: GhostMapProps) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>Map available on iOS/Android</Text>
      <Text style={styles.coords}>
        {latitude.toFixed(5)}, {longitude.toFixed(5)}
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
