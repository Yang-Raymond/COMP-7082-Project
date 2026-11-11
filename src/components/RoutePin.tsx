// Map pin for a route's start point: a teardrop with a round placeholder inside.
// Used as the content of a Mapbox MarkerView on the Home screen map (see GhostMap.tsx).
import { StyleSheet, View } from 'react-native';
import { colors, shadow } from '../constants/ghostTheme';

const BODY_SIZE = 44;
const INNER_SIZE = 34;
const POINTER_SIZE = 18;
const TIP_EXTENSTION_LENGTH = 8;
const HEIGHT = BODY_SIZE + TIP_EXTENSTION_LENGTH;
const POINTER_HALF_DIAGONAL = (POINTER_SIZE * Math.SQRT2) / 2;

/**
 * Renders the teardrop with profile picture
 */
export default function RoutePin() {
  return (
    <View style={styles.wrap}>
      <View style={styles.pointer} />
      <View style={styles.body}>
        {/* Placeholder. Replace with user's profile picture. */}
        <View style={styles.inner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: BODY_SIZE, height: HEIGHT, alignItems: 'center' },
  body: {
    width: BODY_SIZE,
    height: BODY_SIZE,
    borderRadius: BODY_SIZE / 2,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  inner: { width: INNER_SIZE, height: INNER_SIZE, borderRadius: INNER_SIZE / 2, backgroundColor: colors.lavender },
  pointer: {
    position: 'absolute',
    top: HEIGHT - POINTER_HALF_DIAGONAL - POINTER_SIZE / 2,
    width: POINTER_SIZE,
    height: POINTER_SIZE,
    backgroundColor: colors.bg,
    transform: [{ rotate: '45deg' }],
  },
});
