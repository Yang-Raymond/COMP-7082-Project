import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signIn, signUp, friendlyAuthError } from './auth';
import { colors } from '../constants/ghostTheme';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password); // session change updates the whole app
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const isSignIn = mode === 'signin';

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top + 40 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={s.title}>{isSignIn ? 'Welcome back' : 'Create account'}</Text>
      <Text style={s.sub}>Sign in to race your ghost and challenge friends.</Text>

      <TextInput
        style={s.input}
        placeholder="Email"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={s.input}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={submit}
      />

      {error && <Text style={s.error}>{error}</Text>}
      {info && <Text style={s.info}>{info}</Text>}

      <Pressable
        style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.8 }]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text style={s.primaryText}>{isSignIn ? 'Sign in' : 'Sign up'}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(null); setInfo(null); }}
        hitSlop={8}
      >
        <Text style={s.switch}>
          {isSignIn ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  sub: { fontSize: 15, color: colors.muted, marginBottom: 12 },
  input: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, fontSize: 16, color: colors.text },
  error: { color: colors.behind, fontSize: 14 },
  info: { color: colors.ahead, fontSize: 14 },
  primary: { height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  switch: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});