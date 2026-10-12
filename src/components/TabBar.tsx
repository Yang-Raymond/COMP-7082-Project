import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/ghostTheme';

export type Tab = 'home' | 'record' | 'social' | 'you';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: Tab; label: string; icon: IconName; active: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home-outline', active: 'home' },
  { key: 'record', label: 'Record', icon: 'radio-button-on-outline', active: 'radio-button-on' },
  { key: 'social', label: 'Social', icon: 'people-outline', active: 'people' },
  { key: 'you', label: 'You', icon: 'person-outline', active: 'person' },
];

export default function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((t) => {
        const active = t.key === tab;
        return (
          <Pressable key={t.key} style={styles.item} onPress={() => onChange(t.key)}>
            <Ionicons
              name={active ? t.active : t.icon}
              size={24}
              color={active ? colors.primary : colors.muted}
            />
            <Text style={[styles.label, active && { color: colors.primary, fontWeight: '700' }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  label: { fontSize: 11, color: colors.muted },
});