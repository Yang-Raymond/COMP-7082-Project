
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/ghostTheme';

const useNative = Platform.OS !== 'web';

export default function StartButton({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const hovered = useRef(false);

  // Gentle breathing ring while idle
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.in(Easing.quad), useNativeDriver: useNative }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const springTo = (value: number) =>
    Animated.spring(scale, { toValue: value, friction: 6, tension: 140, useNativeDriver: useNative }).start();

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.12] });

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => {
        hovered.current = true;
        springTo(1.08);
      }}
      onHoverOut={() => {
        hovered.current = false;
        springTo(1);
      }}
      onPressIn={() => springTo(0.92)}
      onPressOut={() => springTo(hovered.current ? 1.08 : 1)}
      accessibilityRole="button"
      accessibilityLabel="Start recording"
      style={[s.wrap, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
    >
      <Animated.View
        style={[s.ring, { opacity: ringOpacity, transform: [{ scale: Animated.multiply(scale, ringScale) }] }]}
      />
      <Animated.View style={[s.button, { transform: [{ scale }] }]}>
        <Ionicons name="play" size={38} color="#0b2b25" />
        <Text style={s.text}>Start</Text>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', top: -60, width: 124, height: 124, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: colors.mint },
  button: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 17, fontWeight: '700', color: '#0b2b25' },
});