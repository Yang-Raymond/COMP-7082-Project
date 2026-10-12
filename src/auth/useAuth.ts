import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, onAuthChange } from './auth';
import { isAuthConfigured } from './supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isAuthConfigured);

  useEffect(() => {
    if (!isAuthConfigured) return;
    let active = true;
    getSession().then((s) => {
      if (!active) return;
      setSession(s);
      setLoading(false);
    });
    const unsubscribe = onAuthChange(setSession);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { session, loading, configured: isAuthConfigured };
}