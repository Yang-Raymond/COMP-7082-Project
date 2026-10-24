import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
  Pressable,
  StyleSheet,
  Text, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/ghostTheme';
import { friendlyAuthError, signIn, signUp } from './auth';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignIn = mode === 'signin';

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!isSignIn && !username.trim()) {
      setError('Choose a username.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isSignIn) {
        await signIn(email.trim(), password); // session change updates the whole app
      } else {
        await signUp(username.trim(), email.trim(), password); // signs you in on success
      }
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top + 40 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={s.title}>{isSignIn ? 'Welcome back' : 'Create account'}</Text>
      <Text style={s.sub}>Sign in to race your ghost and challenge friends.</Text>

      {!isSignIn && (
        <TextInput
          style={s.input}
          placeholder="Username"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={50}
          value={username}
          onChangeText={setUsername}
        />
      )}
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

      <Pressable
        style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.8 }]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color={colors.onPrimary} /> : (
          <Text style={s.primaryText}>{isSignIn ? 'Sign in' : 'Sign up'}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(null); }}
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
  primary: { height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  switch: { color: colors.primary, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});