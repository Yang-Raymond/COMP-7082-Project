import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Field from '../components/Field';
import { colors } from '../constants/ghostTheme';
import { friendlyAuthError, signIn, signUp } from './auth';

type Mode = 'signin' | 'signup';

interface Props {
  initialMode?: Mode;
  /** Shows the back arrow, e.g. when opened from onboarding. */
  onBack?: () => void;
  /** Called once sign-in or sign-up succeeds. */
  onSuccess?: () => void;
}

export default function AuthScreen({ initialMode = 'signin', onBack, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
    if (!isSignIn && password !== confirm) {
      setError("Passwords don't match.");
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
      onSuccess?.();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isSignIn ? 'signup' : 'signin');
    setConfirm('');
    setError(null);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) }]}
        keyboardShouldPersistTaps="handled"
      >
        {onBack && (
          <Pressable style={s.back} onPress={onBack} hitSlop={8} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={colors.primary} />
          </Pressable>
        )}

        <Text style={s.title}>{isSignIn ? 'Welcome back!' : 'Create your account'}</Text>

        {!isSignIn && (
          <Field label="Username" placeholder="ghostrunner" maxLength={50} value={username} onChangeText={setUsername} />
        )}
        <Field
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Password"
          placeholder={isSignIn ? 'Your password' : 'At least 6 characters'}
          password
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={isSignIn ? submit : undefined}
        />
        {!isSignIn && (
          <Field
            label="Confirm password"
            placeholder="Type it again"
            password
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={submit}
          />
        )}

        {error && <Text style={s.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.8 }]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : (
            <Text style={s.primaryText}>{isSignIn ? 'Log in' : 'Sign up'}</Text>
          )}
        </Pressable>

        <View style={{ flex: 1 }} />

        <Pressable onPress={switchMode} hitSlop={8}>
          <Text style={s.switch}>
            {isSignIn ? "Don't have an account? " : 'Already have an account? '}
            <Text style={s.switchLink}>{isSignIn ? 'Sign up' : 'Log in'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, gap: 16 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.fieldBg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 34, fontWeight: '800', color: colors.primary, marginTop: 24, marginBottom: 8 },
  error: { color: colors.behind, fontSize: 14 },
  primary: { height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { color: colors.onPrimary, fontSize: 20, fontWeight: '700' },
  switch: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  switchLink: { color: colors.primary, fontWeight: '700' },
});
