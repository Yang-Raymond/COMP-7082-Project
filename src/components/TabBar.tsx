import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/ghostTheme';

// The 'home' key stays so nothing else has to change; it's shown as "Explore".
export type Tab = 'home' | 'record' | 'challenges' | 'friends' | 'you';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { key: Tab; label: string; icon: IconName; active: IconName }[] = [
  { key: 'home', label: 'Explore', icon: 'map-outline', active: 'map' },
  { key: 'record', label: 'Record', icon: 'radio-button-on-outline', active: 'radio-button-on' },
  { key: 'challenges', label: 'Challenges', icon: 'flash-outline', active: 'flash' },
  { key: 'friends', label: 'Friends', icon: 'people-outline', active: 'people' },
  { key: 'you', label: 'You', icon: 'person-outline', active: 'person' },
];

interface Props {
  tab: Tab;
  onChange: (t: Tab) => void;
  /** Red count on a tab's icon, e.g. { challenges: 2 }. Hidden at 0. */
  badges?: Partial<Record<Tab, number>>;
}

export default function TabBar({ tab, onChange, badges }: Props) {
  const insets = useSafeAreaInsets();
  return (
    // Full-width bar attached to the bottom, with a short maroon line above the active tab
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((t) => {
        const active = t.key === tab;
        const count = badges?.[t.key] ?? 0;
        return (
          <Pressable key={t.key} style={s.item} onPress={() => onChange(t.key)} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <View style={[s.indicator, active && s.indicatorOn]} />
            <View>
              <Ionicons name={active ? t.active : t.icon} size={22} color={active ? colors.primary : colors.muted} />
              {count > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </View>
            <Text style={[s.label, active && { color: colors.primary, fontWeight: '700' }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 2 },
  indicator: { width: 28, height: 2, borderRadius: 1, backgroundColor: 'transparent', marginBottom: 6 },
  indicatorOn: { backgroundColor: colors.primary },
  label: { fontSize: 10, color: colors.muted },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.behind, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});