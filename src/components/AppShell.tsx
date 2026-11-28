// Owns auth gating, tab state, the record, save flow, the race flow and the challenge detail, and switches between the screens in src/screens/.
// It loads shared routes and my challenges once and passes them down.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { AuthProvider, SignInPrompt, useAuthContext } from '../auth';
import { colors } from '../constants/ghostTheme';
import { useChallenges } from '../hooks/useChallenges';
import { LocationProvider } from '../hooks/useCurrentPosition';
import { useLiveHeartbeat } from '../hooks/useLiveHeartbeat';
import { RouteDraft, useRouteRecorder } from '../hooks/useRouteRecorder';
import { useSharedRoutes } from '../hooks/useSharedRoutes';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import ChallengesScreen, { ChallengeTab } from '../screens/ChallengesScreen';
import FriendsScreen from '../screens/FriendsScreen';
import HomeScreen from '../screens/HomeScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import RaceScreen from '../screens/RaceScreen';
import RecordScreen from '../screens/RecordScreen';
import YouScreen from '../screens/YouScreen';
import { showNotice } from '../services/dialog';
import { fetchRoute } from '../services/serverRoutes';
import { setUploadAccount, uploadPendingRoutes } from '../services/routeSync';
import type { ChallengeDetailTarget, ToRaceChallenge } from '../types/challenge';
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
  const [challengeTab, setChallengeTab] = useState<ChallengeTab>('toRace');
  const [detail, setDetail] = useState<ChallengeDetailTarget | null>(null);

  const rec = useRouteRecorder();
  // Shared routes and who made them
  const sharedRoutes = useSharedRoutes(session?.user?.id);
  // My challenges (To race / Sent / Finished)
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
    setDetail(null);
    setReturnTab(null);
    setTab(t);
    if (t === 'home') sharedRoutes.reload(); 
    if (t === 'challenges') challenges.reload();
  };

  // Leaving a race returns to the challenge list and refreshes the challenges so the raced one moves to Finished.
  const exitRace = () => {
    setRaceRoute(null);
    setDetail(null);
    challenges.reload();
  };

  // Start racing a challenge: fetch the route, then show the race screen. If the route can't be fetched, show an error and reload challenges.
  const startChallenge = (c: ToRaceChallenge) =>
    requireAuth('Sign in to race this challenge.', async () => {
      try {
        setRaceRoute(await fetchRoute(c.route.id));
      } catch (e) {
        showNotice('Challenges', e instanceof Error && e.message ? e.message : "Couldn't open this challenge.");
        challenges.reload();
      }
    });

  const goSignIn = () => {
    setReturnTab(activeTab);
    dismissPrompt();
    setRaceRoute(null);
    setTab('you');
  };

  let content: React.ReactNode;
  if (raceRoute) {
    content = <RaceScreen route={raceRoute} rec={rec} onExit={exitRace} />;
  } else if (activeTab === 'home') {
    content = (
      <HomeScreen
        onRace={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))}
        sharedRoutes={sharedRoutes}
        onAddFriends={() => changeTab('friends')}
        onRecord={() => changeTab('record')}
      />
    );
  } else if (activeTab === 'challenges' && detail) {
    content = (
      <ChallengeDetailScreen
        target={detail}
        onBack={() => setDetail(null)}
        onStart={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))}
      />
    );
  } else if (activeTab === 'challenges') {
    content = (
      <ChallengesScreen
        challenges={challenges}
        tab={challengeTab}
        onTabChange={setChallengeTab}
        onOpen={setDetail}
        onStart={startChallenge}
        onRecord={() => changeTab('record')}
      />
    );
  } else if (activeTab === 'record') {
    content = <RecordScreen rec={rec} draft={draft} onDraft={setDraft} onSaved={() => changeTab('home')} />;
  } else if (activeTab === 'friends') {
    content = (
      <FriendsScreen
        onSignIn={goSignIn}
        onRace={(r) => requireAuth('Sign in to race this challenge.', () => setRaceRoute(r))}
        sharedRoutes={sharedRoutes}
      />
    );
  } else {
    content = <YouScreen />;
  }

  // Recording, reviewing a run, racing and the challenge detail are full-screen in the Figma
  const fullScreen = rec.status !== 'idle' || draft !== null || raceRoute !== null || (activeTab === 'challenges' && detail !== null);

  return (
    <PhoneFrame>
      <View style={{ flex: 1 }}>{content}</View>
      {!fullScreen && <TabBar tab={activeTab} onChange={changeTab} badges={{ challenges: challenges.toRaceCount }} />}
      {prompt && <SignInPrompt reason={prompt.reason} onSignIn={goSignIn} onCancel={dismissPrompt} />}
    </PhoneFrame>
  );
}