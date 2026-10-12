
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useAuth } from './useAuth';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isSignedIn: boolean;
 
  canChallenge: boolean;
  loading: boolean;
  configured: boolean;
  requireAuth: (reason: string, action: () => void) => void;
  /** Non-null while the "please sign in" prompt should be showing. */
  prompt: { reason: string } | null;
  dismissPrompt: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { session, loading, configured } = useAuth();
  const [prompt, setPrompt] = useState<{ reason: string } | null>(null);

  const isSignedIn = Boolean(session);
  const canChallenge = isSignedIn || !configured;

  const requireAuth = useCallback(
    (reason: string, action: () => void) => {
      if (canChallenge) {
        action();
      } else {
        setPrompt({ reason });
      }
    },
    [canChallenge]
  );

  // Signing in closes any open prompt
  useEffect(() => {
    if (isSignedIn) setPrompt(null);
  }, [isSignedIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isSignedIn,
      canChallenge,
      loading,
      configured,
      requireAuth,
      prompt,
      dismissPrompt: () => setPrompt(null),
    }),
    [session, isSignedIn, canChallenge, loading, configured, requireAuth, prompt]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}