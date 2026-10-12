import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../constants/ghostTheme';

export default function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: colors.primary }}>{title}</Text>
      <Text style={{ color: colors.muted, marginTop: 6 }}>Coming soon</Text>
    </View>
  );
}