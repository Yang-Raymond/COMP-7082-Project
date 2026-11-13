// Install: npx expo install expo-secure-store
// .env:    EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000   (not localhost; your phone can't reach that)
//          or run `npm run tunnel` in server/ to set it to a public URL when the LAN IP doesn't work
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Drop a trailing slash so paths don't end up as "//auth/signup"
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const TOKEN_KEY = 'ghostracer_token';
// Give up instead of spinning forever when the server can't be reached
const REQUEST_TIMEOUT_MS = 15_000;
export const isAuthConfigured = Boolean(API_URL);
export type AuthUser = { id: number; username: string; email: string; points: number };
export type Session = { token: string; user: AuthUser };

// SecureStore only works on iOS/Android. In the browser, fall back to localStorage.
const ls = () => (globalThis as any).localStorage as Storage | undefined;
const store = {
  get: (k: string): Promise<string | null> =>
    Platform.OS === 'web'
      ? Promise.resolve(ls()?.getItem(k) ?? null)
      : SecureStore.getItemAsync(k),
  set: (k: string, v: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(void ls()?.setItem(k, v))
      : SecureStore.setItemAsync(k, v),
  del: (k: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(void ls()?.removeItem(k))
      : SecureStore.deleteItemAsync(k),
};

const listeners = new Set<(s: Session | null) => void>();
const notify = (s: Session | null) => listeners.forEach((cb) => cb(s));

class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null
  ) {
    super(message);
  }
}

async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  if (!API_URL) throw new Error('Login is not configured. Add EXPO_PUBLIC_API_URL to your .env file.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const retryAfter = Number(res.headers.get('Retry-After'));
      throw new AuthApiError(
        data.error ?? `Request failed (${res.status})`,
        res.status,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof AuthApiError) throw e;
    const msg = controller.signal.aborted ? 'Request timed out' : e instanceof Error ? e.message : String(e);
    throw new Error(`${msg} [${API_URL}${path}]`);
  } finally {
    clearTimeout(timer);
  }
}

export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<{ needsConfirmation: boolean }> {
  const session = await api<Session>('/auth/signup', { username, email, password });
  await store.set(TOKEN_KEY, session.token);
  notify(session);
  return { needsConfirmation: false };
}

export async function signIn(email: string, password: string): Promise<void> {
  const session = await api<Session>('/auth/login', { email, password });
  await store.set(TOKEN_KEY, session.token);
  notify(session);
}

export async function signOut(): Promise<void> {
  await store.del(TOKEN_KEY);
  notify(null);
}

export async function getSession(): Promise<Session | null> {
  const token = await store.get(TOKEN_KEY);
  if (!token) return null;
  try {
    const { user } = await api<{ user: AuthUser }>('/auth/me', undefined, token);
    return { token, user };
  } catch (e) {
    const m = (e instanceof Error ? e.message : '').toLowerCase();
    // Only drop the token if the server rejected it, not if we're just offline
    if (m.includes('invalid login credentials')) await store.del(TOKEN_KEY);
    return null;
  }
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Sends a 6-digit reset code. Always succeeds, so it can't be used to check which emails exist. */
export async function requestPasswordReset(email: string): Promise<void> {
  await api<{ ok: boolean }>('/auth/forgot-password', { email: email.trim() });
}

/** Checks the code and sets the new password. */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await api<{ ok: boolean }>('/auth/reset-password', {
    email: email.trim(),
    code: code.trim(),
    password: newPassword,
  });
}

export function friendlyAuthError(e: unknown): string {
  if (e instanceof AuthApiError && e.status === 429) {
    if (e.retryAfterSeconds === null) return 'Too many attempts. Please wait a moment and try again.';
    const wait = e.retryAfterSeconds >= 60
      ? `${Math.ceil(e.retryAfterSeconds / 60)} minute${Math.ceil(e.retryAfterSeconds / 60) === 1 ? '' : 's'}`
      : `${e.retryAfterSeconds} second${e.retryAfterSeconds === 1 ? '' : 's'}`;
    return `Too many attempts. Please try again in ${wait}.`;
  }

  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('already registered')) return 'An account with this email or username already exists. Try signing in.';
  if (m.includes('network request failed') || m.includes('failed to fetch') || m.includes('timed out'))
    return `Can't reach the server${API_URL ? ` at ${API_URL}` : ''}. Check that it's running and your phone can reach it.`;
  if (m.includes('password should be')) return 'Password is too weak. Use at least 6 characters.';
  if (m.includes('invalid or expired code')) return 'That code is wrong or has expired. Request a new one.';
  return msg;
}
