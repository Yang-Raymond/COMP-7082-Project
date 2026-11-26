import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { AuthProvider, SignInPrompt, useAuthContext } from '../auth';
import { colors } from '../constants/ghostTheme';
import { useChallenges } from '../hooks/useChallenges';
import { LocationProvider } from '../hooks/useCurrentPosition';
import { useLiveHeartbeat } from '../hooks/useLiveHeartbeat';
import { RouteDraft, useRouteRecorder } from '../hooks/useRouteRecorder';
import ChallengesScreen from '../screens/ChallengesScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HomeScreen from '../screens/HomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RaceScreen from '../screens/RaceScreen';
import RecordScreen from '../screens/RecordScreen';
import YouScreen from '../screens/YouScreen';
import { setUploadAccount, uploadPendingRoutes } from '../services/routeSync';
import { SavedRoute } from '../types/route';
import TabBar, { Tab } from './TabBar';

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
      <LocationProvider>
        <Shell />
      </LocationProvider>
    </AuthProvider>
  );
}

function Shell() {
  const { session, loading, requireAuth, prompt, dismissPrompt } = useAuthContext();
  const [tab, setTab] = useState<Tab>('home');
  const [returnTab, setReturnTab] = useState<Tab | null>(null);
  const [raceRoute, setRaceRoute] = useState<SavedRoute | null>(null);

  const rec = useRouteRecorder();
  // Shared routes and who made them: used by Explore, Challenges and the tab badge
  const challenges = useChallenges(session?.user?.id);
  // While racing a route that's on the server, tell the server so the route's creator sees "Live now"
  const racing = raceRoute?.upload;
  useLiveHeartbeat(racing?.state === 'done' ? racing.serverId : null);
  const [draft, setDraft] = useState<RouteDraft | null>(null);

  // Upload any "Save & Challenge" routes still waiting (saved while offline, or before the server was reachable):
  // when the app starts signed in, when someone signs in, and whenever the app comes back to the foreground
  useEffect(() => {
    setUploadAccount(session);
    if (session) uploadPendingRoutes().catch(() => {});
  }, [session]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') uploadPendingRoutes().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // After signing in from a prompt, show the tab the user was on before being sent to sign in.
  const activeTab = session && returnTab ? returnTab : tab;

  if (loading) {
    return (
      <PhoneFrame>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </PhoneFrame>
    );
  }

  // Not signed in: always onboarding. Signing out lands here too.
  if (!session) {
    return (
      <PhoneFrame>
        <OnboardingScreen />
      </PhoneFrame>
    );
  }

  const changeTab = (t: Tab) => {
    setRaceRoute(null);
    setReturnTab(null);
    setTab(t);
    if (t === 'home' || t === 'challenges') challenges.reload(); // pick up new routes from friends
  };

  const goSignIn = () => {
    setReturnTab(activeTab);
    dismissPrompt();
    setRaceRoute(null);
    setTab('you');
  };

  let content: React.ReactNode;
  if (raceRoute) {
    content = <RaceScreen route={raceRoute} rec={rec} onExit={() => setRaceRoute(null)} />;
  } else if (activeTab === 'home') {
    content = (
      <HomeScreen
        onRace={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))}
        challenges={challenges}
        onAddFriends={() => changeTab('friends')}
        onRecord={() => changeTab('record')}
      />
    );
  } else if (activeTab === 'challenges') {
    content = (
      <ChallengesScreen
        challenges={challenges}
        onRace={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))}
        onAddFriends={() => changeTab('friends')}
      />
    );
  } else if (activeTab === 'record') {
    content = <RecordScreen rec={rec} draft={draft} onDraft={setDraft} onSaved={() => changeTab('home')} />;
  } else if (activeTab === 'friends') {
    content = (
      <FriendsScreen
        onSignIn={goSignIn}
        onRace={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))}
        challenges={challenges}
      />
    );
  } else {
    content = <YouScreen />;
  }

  // Recording, reviewing a run and racing are full-screen in the Figma
  const fullScreen = rec.status !== 'idle' || draft !== null || raceRoute !== null;

  return (
    <PhoneFrame>
      <View style={{ flex: 1 }}>{content}</View>
      {!fullScreen && <TabBar tab={activeTab} onChange={changeTab} badges={{ challenges: challenges.newCount }} />}
      {prompt && <SignInPrompt reason={prompt.reason} onSignIn={goSignIn} onCancel={dismissPrompt} />}
    </PhoneFrame>
  );
}