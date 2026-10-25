import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import TabBar, { Tab } from './TabBar';
import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import RaceScreen from '../screens/RaceScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import YouScreen from '../screens/YouScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { AuthProvider, SignInPrompt, useAuthContext } from '../auth';
import { RouteDraft, useRouteRecorder } from '../hooks/useRouteRecorder';
import { hasOnboarded, markOnboarded } from '../services/storage';
import { SavedRoute } from '../types/route';
import { colors } from '../constants/ghostTheme';

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.lavender, alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 430,
          backgroundColor: colors.bg,
          overflow: 'hidden',
          ...(Platform.OS === 'web' ? { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border } : {}),
        }}
      >
        {children}
      </View>
    </View>
  );
}

export default function AppShell() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { session, loading, requireAuth, prompt, dismissPrompt } = useAuthContext();
  const [tab, setTab] = useState<Tab>('home');
  const [returnTab, setReturnTab] = useState<Tab | null>(null); 
  const [raceRoute, setRaceRoute] = useState<SavedRoute | null>(null);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  
  const rec = useRouteRecorder();
  const [draft, setDraft] = useState<RouteDraft | null>(null);

  useEffect(() => {
    hasOnboarded().then(setOnboarded).catch(() => setOnboarded(true));
  }, []);

  const finishOnboarding = () => {
    markOnboarded();
    setOnboarded(true);
  };

  useEffect(() => {
    if (session && returnTab) {
      setTab(returnTab);
      setReturnTab(null);
    }
  }, [session, returnTab]);

  if (loading || onboarded === null) {
    return (
      <PhoneFrame>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </PhoneFrame>
    );
  }

  if (!onboarded && !session) {
    return (
      <PhoneFrame>
        <OnboardingScreen onDone={finishOnboarding} />
      </PhoneFrame>
    );
  }

  const changeTab = (t: Tab) => {
    setRaceRoute(null); 
    setReturnTab(null);
    setTab(t);
  };

  const goSignIn = () => {
    setReturnTab(tab);
    dismissPrompt();
    setRaceRoute(null);
    setTab('you');
  };

  let content: React.ReactNode;
  if (raceRoute) {
    
    content = <RaceScreen route={raceRoute} rec={rec} onExit={() => setRaceRoute(null)} />;
  } else if (tab === 'home') {
    content = (
      <HomeScreen onRace={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))} />
    );
  } else if (tab === 'record') {
    content = <RecordScreen rec={rec} draft={draft} onDraft={setDraft} onSaved={() => changeTab('home')} />;
  } else if (tab === 'social') {
    content = <PlaceholderScreen title="Social" />;
  } else {
    content = <YouScreen />;
  }

  // Recording, reviewing a run and racing are full-screen in the Figma
  const fullScreen = rec.status !== 'idle' || draft !== null || raceRoute !== null;

  return (
    <PhoneFrame>
      <View style={{ flex: 1 }}>{content}</View>
      {!fullScreen && <TabBar tab={tab} onChange={changeTab} />}
      {prompt && <SignInPrompt reason={prompt.reason} onSignIn={goSignIn} onCancel={dismissPrompt} />}
    </PhoneFrame>
  );
}