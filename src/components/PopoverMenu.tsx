import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadow } from '../constants/ghostTheme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** What a `ref` on a View or Pressable holds. */
export type ViewRef = React.ComponentRef<typeof View>;

export interface MenuItem {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Draws a line above this item. */
  separated?: boolean;
}

/** Where the button that opened the menu sits, relative to the screen that draws the menu. */
export interface Anchor {
  top: number;
  bottom: number;
  /** Distance from the button's right edge to the screen's right edge. */
  right: number;
  containerHeight: number;
}

/**
 * Works out where `target` (the button) sits inside `container` (the screen's root view).
 * The menu is drawn inside the screen rather than in a Modal, so a confirm dialog opened
 * from a menu item isn't swallowed by a closing Modal on iOS, and on web it stays in the phone frame.
 */
export function measureAnchor(target: ViewRef | null, container: ViewRef | null, done: (a: Anchor) => void): void {
  if (!target || !container) return;
  container.measureInWindow((cx, cy, cw, ch) => {
    target.measureInWindow((tx, ty, tw, th) => {
      done({ top: ty - cy, bottom: ty - cy + th, right: cx + cw - (tx + tw), containerHeight: ch });
    });
  });
}

const ITEM_H = 40;
const GAP = 4;

/** A small menu under a button. Render it as the last child of the view passed to measureAnchor. */
export default function PopoverMenu({ anchor, items, onClose }: { anchor: Anchor; items: MenuItem[]; onClose: () => void }) {
  // Open upward when there isn't room below (e.g. the last friend in a long list)
  const menuH = items.length * ITEM_H + 12;
  const below = anchor.bottom + GAP;
  const top = below + menuH > anchor.containerHeight - 8 ? Math.max(8, anchor.top - GAP - menuH) : below;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[s.menu, shadow, { top, right: Math.max(8, anchor.right) }]} accessibilityRole="menu">
        {items.map((it) => (
          <View key={it.label}>
            {it.separated && <View style={s.line} />}
            <Pressable
              accessibilityRole="menuitem"
              style={({ pressed }) => [s.item, pressed && s.pressed]}
              onPress={() => {
                onClose();
                it.onPress();
              }}
            >
              <Ionicons name={it.icon} size={18} color={colors.primary} />
              <Text style={s.label}>{it.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  menu: {
    position: 'absolute',
    minWidth: 170,
    paddingVertical: 6,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lavender,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, height: ITEM_H, paddingHorizontal: 14 },
  pressed: { backgroundColor: colors.fieldBg },
  label: { fontSize: 15, color: colors.primary },
  line: { height: 1, backgroundColor: colors.lavender, marginVertical: 2 },
});
