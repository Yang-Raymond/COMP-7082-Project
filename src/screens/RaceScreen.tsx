// Race screen: map showing the route being raced, the ghost replaying the previous run, the user's
// live path, an ahead/behind pill, and pause/end controls. The race starts automatically with a
// 3-2-1-GO countdown once the user is at the route's start point (see useRaceStart). While racing,
// an off-route check (see useOffRoute) shows a warning banner and ends the race if the user stays
// too far from the route, replacing the controls with a "Race ended" card. Reaching the route's
// finish (see useRaceFinish) ends the race too, showing a result card with both times and the winner.
// A finished race on a route that is on the server is sent there, and the card shows the user's rank
// on that route's leaderboard (see submitRun).
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import GhostMap from '../components/GhostMap';
import LocationButton from '../components/LocationButton';
import { colors, shadow } from '../constants/ghostTheme';
import { useCurrentPosition } from '../hooks/useCurrentPosition';
import { useOffRoute, WARN_M } from '../hooks/useOffRoute';
import { useRaceFinish } from '../hooks/useRaceFinish';
import { useGhostRace } from '../hooks/useGhostRace';
import { COUNTDOWN_FROM, START_RADIUS_M, useRaceStart } from '../hooks/useRaceStart';
import { formatDistance } from '../services/distance';
import { formatClock } from '../services/format';
import { cleanError } from '../services/friends';
import { formatDelta } from '../services/ghostCompare';
import { RunResult, submitRun } from '../services/leaderboard';
import type { GhostMapHandle } from '../types/map';
import { useRouteRecorder } from '../hooks/useRouteRecorder';
import { SavedRoute } from '../types/route';
import LeaderboardScreen from './LeaderboardScreen';

/** How a race ended: off-route termination, or reaching the finish with both times (ms). */
type RaceOutcome = { kind: 'offRoute' } | { kind: 'finished'; userMs: number; ghostMs: number };

/** What happened when a finished race was sent to the server. */
type RankState =
  | { status: 'saving' }
  | { status: 'done'; run: RunResult }
  | { status: 'failed'; message: string }
  | { status: 'local' }; // the route isn't on the server, so it has no leaderboard

/** Formats a time margin as e.g. "12s" or "1m 5s" (no ahead/behind wording). */
function formatMargin(ms: number): string {
  const seconds = Math.round(Math.abs(ms) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

interface Props {
  route: SavedRoute;
  rec: ReturnType<typeof useRouteRecorder>;
  onExit: () => void;
}


/**
 * Full-screen race view. Uses the shared recorder for the user's run; the ghost replays the saved
 * route on the recorder's active clock (waits at the start before the race, freezes on pause,
 * stays at the finish when its run is over). The camera opens fitted to the route and snaps to the
 * user when the countdown begins and at GO. Before the race, the panel guides the user to the start
 * point if the user is not located near the start point. Within the start radius a 3-2-1 countdown runs automatically and then starts the race.
 * The delta pill shows once the user has a point. While recording, going farther than WARN_M from
 * the route shows a banner, and staying beyond END_M for END_GRACE_MS ends the race (discarding the
 * run) and shows a "Race ended" card. Getting within the finish radius of the route's last point
 * after covering most of the route ends the race and shows a result card (winner, both times,
 * margin) and, for a route on the server, the user's rank. Exits via onExit.
 */
export default function RaceScreen({ route, rec, onExit }: Props) {
  const { position, isLive } = useCurrentPosition();
  const mapRef = useRef<GhostMapHandle>(null);

  const [outcome, setOutcome] = useState<RaceOutcome | null>(null);
  const [rank, setRank] = useState<RankState | null>(null);
  const [showBoard, setShowBoard] = useState(false);
  const submitted = useRef(false);
  const recording = rec.status !== 'idle';
  const last = rec.points[rec.points.length - 1];
  const center = last ? { lat: last.lat, lng: last.lng } : position;
  const { ghostPosition, delta } = useGhostRace(route, rec.points, rec.elapsedMs);

  // The server's id for this route. Only routes that were uploaded (or loaded from the server) have one.
  const up = route.upload;
  const serverId = up?.state === 'done' ? up.serverId : null;

  const start = useMemo(() => {
    const p = route.points[0];
    return p ? { lat: p.lat, lng: p.lng } : null;
  }, [route.points]);

  const [showGo, setShowGo] = useState(false);
  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (goTimer.current) clearTimeout(goTimer.current);
    },
    []
  );

  // Called by the countdown at zero: starts the recorder, snaps the camera to the user, flashes GO.
  const startRace = useCallback(() => {
    rec.start();
    mapRef.current?.recenter();
    setShowGo(true);
    if (goTimer.current) clearTimeout(goTimer.current);
    goTimer.current = setTimeout(() => setShowGo(false), 1000);
  }, [rec]);

  const { distanceM, countdown } = useRaceStart({
    start,
    position,
    isLive,
    enabled: rec.status === 'idle' && start !== null && outcome === null,
    onGo: startRace,
  });

  // The user is standing at the start when the countdown begins, so bring the camera to them.
  useEffect(() => {
    if (countdown === COUNTDOWN_FROM) mapRef.current?.recenter();
  }, [countdown]);

  // Off-route check on the latest accepted fix; paused/idle states are not checked.
  const userPoint = useMemo(() => (last ? { lat: last.lat, lng: last.lng } : null), [last]);
  // Stops the recorder, discards the run, and flips to the "Race ended" card. Run not saved.
  const terminate = useCallback(() => {
    rec.finish();
    setOutcome({ kind: 'offRoute' });
  }, [rec]);
  const { offRouteM, level, secondsLeft } = useOffRoute({
    route: route.points,
    userPoint,
    active: rec.status === 'recording',
    onTerminate: terminate,
  });

  // Finish detection: stops the recorder, shows the result card with the user's finish time, and sends
  // the run to the server (if the route is there) to get the user's rank on its leaderboard.
  const handleFinish = useCallback(
    (finishMs: number) => {
      if (submitted.current) return; // the finish can be reported twice before the recorder stops
      submitted.current = true;
      const draft = rec.finish();
      setOutcome({ kind: 'finished', userMs: finishMs, ghostMs: route.durationMs });

      if (!serverId || draft.points.length < 2) {
        setRank({ status: 'local' });
        return;
      }
      setRank({ status: 'saving' });
      // The server needs the duration to cover the last point's time
      const durationMs = Math.round(Math.max(finishMs, draft.points[draft.points.length - 1].t));
      submitRun(serverId, {
        durationMs,
        startedAt: Date.now() - durationMs,
        points: draft.points.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, ...(p.alt != null ? { alt: p.alt } : {}) })),
      })
        .then((run) => setRank({ status: 'done', run }))
        .catch((e) => setRank({ status: 'failed', message: cleanError(e, "Couldn't save your result.") }));
    },
    [rec, route.durationMs, serverId]
  );
  useRaceFinish({
    route,
    userPoint: last,
    coveredM: rec.distanceMeters,
    active: rec.status === 'recording',
    onFinish: handleFinish,
  });

  // Pre-race panel message: no points, waiting for GPS, counting down, or distance to the start.
  const gateMessage = (() => {
    if (!start) return { title: 'This route has no points' };
    if (countdown !== null) return { title: 'Get ready…' };
    if (!isLive || distanceM === null) return { title: 'Waiting for GPS…' };
    return { title: 'Head to the start point', sub: `${formatDistance(distanceM)} away (start within ${START_RADIUS_M} m)` };
  })();

  // Ends the recorder and leaves the screen.
  const finish = () => {
    rec.finish();
    onExit();
  };

  // Leaderboard open: show it instead of the race screen (all hooks are above, so this early return is safe)
  if (showBoard && serverId) {
    return <LeaderboardScreen routeId={serverId} routeName={route.name} onBack={() => setShowBoard(false)} />;
  }

  return (
    <View style={s.root}>
      <View style={StyleSheet.absoluteFill}>
        <GhostMap
          ref={mapRef}
          center={center}
          showUser={isLive || recording}
          path={rec.points.map((p) => ({ lat: p.lat, lng: p.lng }))}
          ghostPath={route.points}
          initialBounds={route.points}
          ghostPosition={ghostPosition ?? undefined}
        />
      </View>

      {outcome === null && (countdown !== null || showGo) && (
        <View style={[s.countdownWrap, { pointerEvents: 'none' } as object]}>
          <Text style={s.countdownText}>{countdown !== null ? countdown : 'GO!'}</Text>
        </View>
      )}

      <View style={[s.topNav, { pointerEvents: 'box-none' } as object]}>
        <Pressable onPress={onExit} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={s.titleCard}>
          <Text style={s.title}>Racing: {route.name}</Text>
        </View>
      </View>

      {outcome === null && level !== 'ok' && offRouteM !== null && (
        <View
          style={[
            s.banner,
            shadow,
            { backgroundColor: level === 'off' ? colors.behind : colors.warning, pointerEvents: 'none' } as object,
          ]}
        >
          <Text style={s.bannerText}>
            {level === 'off'
              ? `Get back on route · ${secondsLeft}s`
              : `Veering off route · ${Math.round(offRouteM)} m (limit ${WARN_M} m)`}
          </Text>
        </View>
      )}

      {outcome !== null && (
        <View style={s.endedWrap}>
          <View style={[s.endedCard, shadow]}>
            {outcome.kind === 'offRoute' ? (
              <>
                <Text style={s.endedTitle}>Race ended</Text>
                <Text style={s.endedSub}>You went off route.</Text>
              </>
            ) : (
              <>
                <Text style={s.endedTitle}>{outcome.userMs < outcome.ghostMs ? 'You won!' : 'Ghost won'}</Text>
                <Text style={s.endedSub}>Your time: {formatClock(outcome.userMs)}</Text>
                <Text style={s.endedSub}>Ghost time: {formatClock(outcome.ghostMs)}</Text>
                <Text style={s.endedSub}>
                  {outcome.userMs < outcome.ghostMs ? 'You won' : 'Ghost won'} by{' '}
                  {formatMargin(outcome.userMs - outcome.ghostMs)}
                </Text>
                {rank?.status === 'saving' && <Text style={s.endedSub}>Saving your result…</Text>}
                {rank?.status === 'done' && (
                  <Text style={s.endedSub}>
                    You&apos;re #{rank.run.rank} of {rank.run.totalRunners} on this route
                    {rank.run.isPersonalBest ? ' · personal best' : ''}
                  </Text>
                )}
                {rank?.status === 'failed' && <Text style={s.endedSub}>{rank.message}</Text>}
                {rank?.status === 'local' && (
                  <Text style={s.endedSub}>Only routes shared with Save & Challenge have a leaderboard.</Text>
                )}
              </>
            )}
            {serverId && outcome.kind === 'finished' && rank?.status !== 'saving' && (
              <Pressable style={[s.endedBtn, s.boardBtn]} onPress={() => setShowBoard(true)}>
                <Text style={[s.finishText, { color: colors.primary }]}>Leaderboard</Text>
              </Pressable>
            )}
            <Pressable style={s.endedBtn} onPress={onExit}>
              <Text style={s.finishText}>Back</Text>
            </Pressable>
          </View>
        </View>
      )}

      {outcome === null && (
      <View style={[s.dock, { pointerEvents: 'box-none' } as object]}>
        <View style={[s.locateRow, { pointerEvents: 'box-none' } as object]}>
          {recording && delta && (
            <View style={[s.pill, shadow, { backgroundColor: delta.deltaMs < 0 ? colors.ahead : colors.behind }]}>
              <Text style={s.pillText}>{formatDelta(delta.deltaMs)}</Text>
            </View>
          )}
          <View style={s.locateBtn}>
            <LocationButton mapRef={mapRef} />
          </View>
        </View>
        <View style={[s.panel, shadow]}>
          {!recording ? (
            <View style={s.gate}>
              <Text style={s.gateTitle}>{gateMessage.title}</Text>
              {gateMessage.sub && <Text style={s.gateSub}>{gateMessage.sub}</Text>}
            </View>
          ) : (
            <View style={s.controls}>
               <Pressable style={s.pause} onPress={rec.status === 'recording' ? rec.pause : rec.resume}>
                <Ionicons name={rec.status === 'recording' ? 'pause' : 'play'} size={28} color={colors.primary} />
              </Pressable>
              <Pressable style={s.finish} onPress={finish}>
                <Ionicons name="stop" size={18} color={colors.onPrimary} />
                <Text style={s.finishText}>End Race</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topNav: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', ...shadow },
  titleCard: { flex: 1, backgroundColor: colors.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, ...shadow },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  locateRow: { width: '100%', maxWidth: 460, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  locateBtn: { marginLeft: 'auto' },
  pill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  pillText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  panel: { width: '100%', maxWidth: 460, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, alignItems: 'center' },
  gate: { width: '100%', minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4 },
  gateTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  gateSub: { fontSize: 14, color: colors.text },
  banner: { position: 'absolute', top: 106, left: 16, right: 16, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  bannerText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  endedWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  endedCard: { width: '100%', maxWidth: 360, backgroundColor: colors.bg, borderRadius: 28, padding: 24, alignItems: 'center', gap: 8 },
  endedTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  endedSub: { fontSize: 16, color: colors.text, marginBottom: 12 },
  endedBtn: { alignSelf: 'stretch', height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  boardBtn: { backgroundColor: colors.lavender },
  countdownWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countdownText: { fontSize: 120, fontWeight: '800', color: colors.primary, textShadowColor: colors.bg, textShadowRadius: 12 },
  controls: { flexDirection: 'row', gap: 14, alignItems: 'center', width: '100%' },
  pause: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  finish: { flex: 1, height: 68, borderRadius: 34, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  finishText: { color: colors.onPrimary, fontSize: 24, fontWeight: '700' },
});