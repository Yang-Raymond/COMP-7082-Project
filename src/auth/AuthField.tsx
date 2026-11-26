import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { A } from './authTheme.ts';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  /** Adds the show/hide eye and hides the text by default. */
  password?: boolean;
  /** Sits opposite the label, e.g. "Forgot password?". */
  labelRight?: React.ReactNode;
  /** Sits inside the field on the right, e.g. "Available". Ignored for password fields. */
  right?: React.ReactNode;
}

export default function AuthField({ label, password, labelRight, right, editable = true, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={{ gap: 6 }}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {labelRight}
      </View>
      <View style={[s.box, focused && s.boxFocus, !editable && s.boxOff]}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={A.muted}
          {...input}
          editable={editable}
          secureTextEntry={password && hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={s.input}
        />
        {password ? (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={A.ink} />
          </Pressable>
        ) : (
          right
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '700', color: A.ink },
  box: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: A.border, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  boxFocus: { borderColor: A.maroon, borderWidth: 1.5 },
  boxOff: { backgroundColor: A.disabled },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: A.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
});