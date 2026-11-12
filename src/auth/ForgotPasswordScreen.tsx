import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/ghostTheme';
import { friendlyAuthError, requestPasswordReset, resetPassword } from './auth';

type Step = 'request' | 'reset' | 'done';

export default function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setStep('reset');
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email, code, password);
      setStep('done');
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 24 }]}>
      <View style={s.inner}>
        <Text style={s.title}>Reset password</Text>

        {step === 'request' && (
          <>
            <Text style={s.body}>Enter your email and we'll send you a 6-digit code.</Text>
            <TextInput
              style={s.input}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
              onSubmitEditing={sendCode}
            />
            {error && <Text style={s.error}>{error}</Text>}
            <Pressable style={[s.primary, busy && { opacity: 0.6 }]} onPress={sendCode} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryText}>Send code</Text>}
            </Pressable>
            <Pressable style={s.link} onPress={onBack} disabled={busy}>
              <Text style={s.linkText}>Back to sign in</Text>
            </Pressable>
          </>
        )}

        {step === 'reset' && (
          <>
            <Text style={s.body}>
              If an account exists for {email.trim()}, we've emailed a 6-digit code. It expires in 15 minutes.
            </Text>
            <TextInput
              style={s.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.muted}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
            />
            <TextInput
              style={s.input}
              placeholder="New password"
              placeholderTextColor={colors.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
            />
            <TextInput
              style={s.input}
              placeholder="Confirm new password"
              placeholderTextColor={colors.muted}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
              onSubmitEditing={submitReset}
            />
            {error && <Text style={s.error}>{error}</Text>}
            <Pressable style={[s.primary, busy && { opacity: 0.6 }]} onPress={submitReset} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={s.primaryText}>Update password</Text>}
            </Pressable>
            <Pressable
              style={s.link}
              onPress={() => { setStep('request'); setError(null); }}
              disabled={busy}
            >
              <Text style={s.linkText}>Send a new code</Text>
            </Pressable>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={s.body}>Your password has been updated. You can now sign in.</Text>
            <Pressable style={s.primary} onPress={onBack}>
              <Text style={s.primaryText}>Back to sign in</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  input: { height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, fontSize: 16, color: colors.text },
  error: { color: colors.behind, fontSize: 14 },
  primary: { height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700' },
  link: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});