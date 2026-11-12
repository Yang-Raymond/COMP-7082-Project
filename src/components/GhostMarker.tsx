// Marker for the ghost during a race: a round placeholder circle.
// Used as the content of a Mapbox MarkerView in GhostMap.tsx.
import { StyleSheet, View } from 'react-native';
import { colors, shadow } from '../constants/ghostTheme';

const SIZE = 30;

/**
 * Renders the ghost circle. Placeholder: it will later show the racer's profile picture.
 */
export default function GhostMarker() {
  return <View style={styles.circle} />;
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 3,
    borderColor: colors.bg,
    ...shadow,
  },
});
