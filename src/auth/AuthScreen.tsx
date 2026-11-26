import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/ghostTheme';
import { friendlyAuthError, signIn, signUp } from './auth';
import AuthField from './AuthField';
import { A } from './authTheme.ts';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import { checkUsernameAvailable, signInWithGoogle } from './pendingBackend';

type Mode = 'signin' | 'signup';
type NameState = 'idle' | 'checking' | 'available' | 'taken';

// Fill these in; the links do nothing while empty.
const TERMS_URL = '';
const PRIVACY_URL = '';
// The Figma shows "Step 1 of 2" on sign up. Turn off until a second step exists.
const SHOW_STEP_LABEL = true;

interface Props {
  initialMode?: Mode;
  /** Shows the back arrow, e.g. when opened from onboarding. */
  onBack?: () => void;
  /** Called once sign-in or sign-up succeeds. */
  onSuccess?: () => void;
}

const open = (url: string) => {
  if (url) Linking.openURL(url).catch(() => {});
};

function strength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let n = 0;
  if (pw.length >= 8) n++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)) n++;
  if (pw.length >= 12 || /[^A-Za-z0-9]/.test(pw)) n++;
  return Math.max(n, 1) as 1 | 2 | 3;
}
const STRENGTH_LABEL = ['', 'Weak', 'Good', 'Perfect!'];
const STRENGTH_COLOR = ['', A.red, A.amber, A.green];

export default function AuthScreen({ initialMode = 'signin', onBack, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [nameState, setNameState] = useState<NameState>('idle');

  const isSignIn = mode === 'signin';
  const level = strength(password);

  // Debounced "is this username free?" check. Stays idle if the backend call isn't built yet.
  useEffect(() => {
    if (isSignIn) return;
    const name = username.trim();
    if (name.length < 3) {
      setNameState('idle');
      return;
    }
    let cancelled = false;
    setNameState('checking');
    const t = setTimeout(async () => {
      try {
        const free = await checkUsernameAvailable(name);
        if (!cancelled) setNameState(free ? 'available' : 'taken');
      } catch {
        if (!cancelled) setNameState('idle');
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, isSignIn]);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!isSignIn && !username.trim()) {
      setError('Choose a username.');
      return;
    }
    if (!isSignIn && nameState === 'taken') {
      setError('That username is taken.');
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

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isSignIn ? 'signup' : 'signin');
    setError(null);
  };

  if (forgot) {
    return <ForgotPasswordScreen onBack={() => setForgot(false)} />;
  }

  const nameBadge =
    nameState === 'checking' ? (
      <ActivityIndicator size="small" color={A.muted} />
    ) : nameState === 'available' ? (
      <View style={s.badge}>
        <Ionicons name="checkmark" size={13} color={A.green} />
        <Text style={[s.badgeText, { color: A.green }]}>Available</Text>
      </View>
    ) : nameState === 'taken' ? (
      <Text style={[s.badgeText, { color: A.red }]}>Taken</Text>
    ) : undefined;

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) }]}
        keyboardShouldPersistTaps="handled"
      >
        {onBack && (
          <Pressable style={s.back} onPress={onBack} hitSlop={10} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color={A.ink} />
          </Pressable>
        )}

        <View style={{ gap: 6 }}>
          {!isSignIn && SHOW_STEP_LABEL && <Text style={s.step}>Step 1 of 2</Text>}
          <Text style={s.title}>{isSignIn ? 'Welcome back' : 'Create your account'}</Text>
        </View>

        <Pressable style={({ pressed }) => [s.google, pressed && { opacity: 0.7 }]} onPress={google} disabled={busy}>
          <Ionicons name="logo-google" size={18} color="#4285F4" />
          <Text style={s.googleText}>{isSignIn ? 'Continue with Google' : 'Sign up with Google'}</Text>
        </Pressable>

        <View style={s.divider}>
          <View style={s.line} />
          <Text style={s.dividerText}>or with email</Text>
          <View style={s.line} />
        </View>

        {!isSignIn && (
          <AuthField
            label="Username"
            placeholder="ghostrunner"
            maxLength={50}
            value={username}
            onChangeText={setUsername}
            right={nameBadge}
          />
        )}
        <AuthField
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View style={{ gap: 8 }}>
          <AuthField
            label="Password"
            placeholder="Password"
            password
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            labelRight={
              isSignIn ? (
                <Pressable onPress={() => setForgot(true)} hitSlop={8}>
                  <Text style={s.forgot}>Forgot password?</Text>
                </Pressable>
              ) : undefined
            }
          />
          {!isSignIn && level > 0 && (
            <>
              <View style={s.segments}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[s.segment, i <= level && { backgroundColor: STRENGTH_COLOR[level] }]} />
                ))}
              </View>
              <Text style={[s.strengthText, { color: STRENGTH_COLOR[level] }]}>{STRENGTH_LABEL[level]}</Text>
            </>
          )}
        </View>

        {error && <Text style={s.error}>{error}</Text>}

        <View style={{ flex: 1, minHeight: 16 }} />

        {!isSignIn && (
          <Text style={s.terms}>
            By signing up you agree to the{' '}
            <Text style={s.termsLink} onPress={() => open(TERMS_URL)}>Terms</Text> and{' '}
            <Text style={s.termsLink} onPress={() => open(PRIVACY_URL)}>Privacy Policy</Text>.
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [s.primary, (pressed || busy) && { opacity: 0.8 }]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryText}>{isSignIn ? 'Log in' : 'Create account'}</Text>
          )}
        </Pressable>

        <Pressable onPress={switchMode} hitSlop={8}>
          <Text style={s.switch}>
            {isSignIn ? 'New here? ' : 'Have an account? '}
            <Text style={s.switchLink}>{isSignIn ? 'Create an account' : 'Log in'}</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 20, gap: 16 },
  back: { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 12 },
  step: { fontSize: 11, color: A.muted },
  title: { fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6, color: A.ink },

  google: {
    height: 48, borderRadius: 24, borderWidth: 1, borderColor: A.border, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12,
  },
  googleText: { fontSize: 14, fontWeight: '600', color: A.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: A.segOff },
  dividerText: { fontSize: 11, color: A.muted },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  forgot: { fontSize: 12, fontWeight: '700', color: A.maroon },

  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: A.segOff },
  strengthText: { fontSize: 11, fontWeight: '600' },

  error: { color: A.red, fontSize: 14 },
  terms: { fontSize: 11, color: A.muted, textAlign: 'center' },
  termsLink: { color: A.ink, textDecorationLine: 'underline' },
  primary: { height: 52, borderRadius: 26, backgroundColor: A.maroon, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  switch: { color: A.muted, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  switchLink: { color: A.maroon, fontWeight: '700' },
});