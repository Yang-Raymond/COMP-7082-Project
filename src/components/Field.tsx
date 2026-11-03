import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/ghostTheme';

interface Props extends TextInputProps {
  label: string;
  /** Hides the text and adds the show/hide eye toggle. */
  password?: boolean;
}

export default function Field({ label, password = false, style, ...input }: Props) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View style={s.box}>
        <TextInput
          style={[s.input, style]}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={password && hidden}
          {...input}
        />
        {password && (
          <Pressable
            onPress={() => setHidden(!hidden)}
            hitSlop={8}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14, fontWeight: '700', color: colors.primary },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.lavender, backgroundColor: colors.fieldBg, paddingHorizontal: 16 },
  input: { flex: 1, height: '100%', fontSize: 15, color: colors.text },
});
