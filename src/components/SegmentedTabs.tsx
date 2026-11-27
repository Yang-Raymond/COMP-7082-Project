// Pill-shaped segmented control: a light track with one white "selected" pill, each segment showing a label and an optional count

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/ghostTheme';

export interface Segment<K extends string> {
  key: K;
  label: string;
  count?: number;
}

interface Props<K extends string> {
  segments: Segment<K>[];
  selected: K;
  onChange: (key: K) => void;
}

/** Renders the segments in a row. Tapping one calls onChange with its key. */
export default function SegmentedTabs<K extends string>({ segments, selected, onChange }: Props<K>) {
  return (
    <View style={s.track} accessibilityRole="tablist">
      {segments.map((seg) => {
        const on = seg.key === selected;
        const text = seg.count == null ? seg.label : `${seg.label} · ${seg.count}`;
        return (
          <Pressable
            key={seg.key}
            style={[s.pill, on && s.pillOn]}
            onPress={() => onChange(seg.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: 22, padding: 4, gap: 4 },
  pill: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pillOn: { backgroundColor: '#fff' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  labelOn: { color: colors.text, fontWeight: '700' },
});
