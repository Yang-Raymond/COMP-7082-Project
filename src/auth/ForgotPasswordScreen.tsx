import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/ghostTheme';
import { friendlyAuthError, requestPasswordReset, resetPassword } from './auth';
import AuthField from './AuthField';
import { A } from './authTheme';

// Keep these in step with the server: how long the emailed code lasts, and the wait before "Resend".
const CODE_MINUTES = 15;
const RESEND_SECONDS = 60;

type Step = 'request' | 'reset' | 'done';

const mmss = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

export default function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const sendCode = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setStep('reset');
      setSecs(RESEND_SECONDS);
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email.trim(), code, password);
      setStep('done');
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const action = step === 'request' ? sendCode : step === 'reset' ? submitReset : onBack;
  const actionLabel = step === 'request' ? 'Send code' : step === 'reset' ? 'Update password' : 'Log in';

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={s.back} onPress={onBack} hitSlop={10} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color={A.ink} />
        </Pressable>

        <Text style={s.title}>Reset password</Text>

        {step !== 'done' && (
          <AuthField
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={step === 'request' && !busy}
            onSubmitEditing={step === 'request' ? sendCode : undefined}
          />
        )}

        {step === 'reset' && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Check your inbox</Text>
              <Text style={s.cardBody}>
                We sent a 6-digit code to {email.trim()}. It expires in {CODE_MINUTES} minutes.
              </Text>
              {secs > 0 ? (
                <Text style={s.cardBody}>You can resend in {mmss(secs)}</Text>
              ) : (
                <Pressable onPress={sendCode} disabled={busy} hitSlop={8}>
                  <Text style={s.resend}>Resend</Text>
                </Pressable>
              )}
            </View>

            <AuthField
              label="Code"
              placeholder="6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              editable={!busy}
            />
            <AuthField
              label="New password"
              placeholder="At least 6 characters"
              password
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              onSubmitEditing={submitReset}
            />
          </>
        )}

        {step === 'done' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Password updated</Text>
            <Text style={s.cardBody}>You can now log in with your new password.</Text>
          </View>
        )}

        {error && <Text style={s.error}>{error}</Text>}

        <View style={{ flex: 1, minHeight: 16 }} />

        <Pressable style={({ pressed }) => [s.primary, (busy || pressed) && { opacity: 0.8 }]} onPress={action} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{actionLabel}</Text>}
        </Pressable>

        {step !== 'done' && (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={s.switch}>
              Remembered it? <Text style={s.switchLink}>Log in</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, gap: 16 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 12 },
  title: { fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: A.ink, marginBottom: 8 },
  error: { color: A.red, fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 6,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: A.ink },
  cardBody: { fontSize: 12, lineHeight: 17, color: A.muted },
  resend: { fontSize: 12, fontWeight: '700', color: A.maroon },
  primary: { height: 52, borderRadius: 26, backgroundColor: A.maroon, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switch: { color: A.muted, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  switchLink: { color: A.maroon, fontWeight: '700' },
});