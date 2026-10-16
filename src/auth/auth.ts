// Install: npx expo install expo-secure-store
// .env:    EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:3000   (not localhost; your phone can't reach that)
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = 'ghostracer_token';
export const isAuthConfigured = Boolean(API_URL);
export type AuthUser = { id: number; username: string; email: string; points: number };
export type Session = { token: string; user: AuthUser };

const listeners = new Set<(s: Session | null) => void>();
const notify = (s: Session | null) => listeners.forEach((cb) => cb(s));

async function api<T>(path: string, body?: unknown, token?: string): Promise<T> {
  if (!API_URL) throw new Error('Login is not configured. Add EXPO_PUBLIC_API_URL to your .env file.');
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
    return data as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${msg} [${API_URL}${path}]`);
  }
}

export async function signUp(
  username: string,
  email: string,
  password: string
): Promise<{ needsConfirmation: boolean }> {
  const session = await api<Session>('/auth/signup', { username, email, password });
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  notify(session);
  return { needsConfirmation: false };
}

export async function signIn(email: string, password: string): Promise<void> {
  const session = await api<Session>('/auth/login', { email, password });
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  notify(session);
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  notify(null);
}

export async function getSession(): Promise<Session | null> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  try {
    const { user } = await api<{ user: AuthUser }>('/auth/me', undefined, token);
    return { token, user };
  } catch (e) {
    const m = (e instanceof Error ? e.message : '').toLowerCase();
    // Only drop the token if the server rejected it, not if we're just offline
    if (m.includes('invalid login credentials')) await SecureStore.deleteItemAsync(TOKEN_KEY);
    return null;
  }
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function friendlyAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('already registered')) return 'An account with this email or username already exists. Try signing in.';
  if (m.includes('network request failed') || m.includes('failed to fetch'))
    return "Can't reach the server. Check your connection.";
  if (m.includes('password should be')) return 'Password is too weak. Use at least 6 characters.';
  return msg;
}