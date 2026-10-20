import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import * as Analytics from '../services/Analytics';
import * as Board from '../services/Leaderboard';
import * as Region from '../services/Region';
import { shareScore } from '../services/Sharing';
import { useSettings } from '../state/settings';
import Icon from './Icon';
import Screen from './Screen';
import { TYPE } from './type';

/** How far a lit face rides above its under-edge, the way every pill here does. */
const DEPTH = 4;

/**
 * What a row is painted in, named for the place rather than for the colour.
 *
 * Every one of these is the game's own button anatomy bent into a row: a dark
 * under-edge, a pale rim catching the light, and the lit face inside it. That
 * is what makes a board read as a stack of *objects* rather than as lines of
 * text at regular intervals -- the three podium places are gold, silver and
 * bronze pills, and everyone below them stands on the same quiet lavender one.
 */
interface Tone {
  face: string;
  edge: string;
  rim: string;
  ink: string;
  /** The second line under a name, which is always the quieter of the two. */
  sub: string;
  /** Dropped under the name where the face is loud enough to need it. */
  shadow?: string;
}

const PODIUM: Tone[] = [
  {
    face: '#FFC24D',
    edge: '#CE8608',
    rim: '#FFE9AC',
    ink: COLORS.onCard,
    sub: COLORS.onCardSoft,
    shadow: '#A96606',
  },
  {
    face: '#B7C9EC',
    edge: '#7C94C1',
    rim: '#E8EFFF',
    ink: COLORS.onCard,
    sub: COLORS.onCardSoft,
    shadow: '#5E7399',
  },
  {
    face: '#EF9F5C',
    edge: '#B56720',
    rim: '#FFD8B2',
    ink: COLORS.onCard,
    sub: COLORS.onCardSoft,
    shadow: '#8C4810',
  },
];

/** Everyone off the podium. */
const PLAIN: Tone = {
  face: '#EBE9FC',
  edge: '#B3ABE2',
  rim: COLORS.onCard,
  ink: COLORS.ink,
  sub: COLORS.muted,
};

/** The player's own row, wherever on the board it lands. */
const MINE: Tone = {
  face: COLORS.rowMine,
  edge: '#74C6A6',
  rim: COLORS.onCard,
  ink: COLORS.onMine,
  sub: '#3F8C74',
};

function rowTone(index: number, mine: boolean) {
  if (mine) return MINE;
  return index < PODIUM.length ? PODIUM[index] : PLAIN;
}

const TABS: { scope: Board.Scope; label: string }[] = [
  { scope: 'world', label: 'WORLD' },
  { scope: 'country', label: 'COUNTRY' },
  { scope: 'city', label: 'CITY' },
];

/**
 * The colours a face is picked from, so two rows side by side are rarely the
 * same one. Nobody here has a photograph, so a player is a letter on a candy
 * disc -- which is a face at a glance, and never a broken image.
 */
const FACES = [COLORS.gradB, '#38B6FF', '#FF6FA5', '#12B981', '#FFA030', COLORS.gradC];

/** Stable per player: the same name always comes back the same colour. */
function faceHue(key: string) {
  let n = 0;
  // Kept inside a safe integer by hand rather than with a shift: the numbers
  // never need to be a hash, only to be spread and to be the same every time.
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) % 65521;
  return FACES[n % FACES.length];
}

function initial(name: string) {
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : '?';
}

/** The round portrait at the head of a row: a disc, a letter, and a gloss. */
function Avatar({ name, seed }: { name: string; seed: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: faceHue(seed) }]}>
      <View style={styles.avatarGloss} />
      <Text style={styles.avatarTxt}>{initial(name)}</Text>
    </View>
  );
}

/**
 * The place: a trophy for the first three, a plain number for everyone else.
 *
 * The trophy carries the number on a bead at its foot rather than instead of
 * it, so a row being read for its rank still has one to read.
 */
function Place({ place, tone }: { place: number; tone: Tone }) {
  if (place < 1 || place > PODIUM.length) {
    return (
      <View style={styles.placeBox}>
        <Text style={[styles.place, { color: tone.ink }]}>{place || ''}</Text>
      </View>
    );
  }
  return (
    <View style={styles.placeBox}>
      <Icon name="podium" size={30} color={COLORS.onCard} style={styles.trophy} />
      <View style={[styles.placeBead, { backgroundColor: tone.edge }]}>
        <Text style={styles.placeBeadTxt}>{place}</Text>
      </View>
    </View>
  );
}

function Row({
  place,
  name,
  score,
  from,
  mine,
}: {
  place: number;
  name: string;
  score: number;
  /** Where the row was set, shown on the world board only. */
  from?: string;
  mine: boolean;
}) {
  const tone = rowTone(place - 1, mine);
  return (
    <View style={[styles.rowShell, { backgroundColor: tone.edge, borderColor: tone.rim }]}>
      <View style={[styles.row, { backgroundColor: tone.face }]}>
        <Place place={place} tone={tone} />
        <Avatar name={name} seed={`${name}${place}`} />
        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              { color: tone.ink },
              tone.shadow ? styles.nameLift : null,
              tone.shadow ? { textShadowColor: tone.shadow } : null,
            ]}>
            {mine ? `${name}  (you)` : name}
          </Text>
          {from ? (
            <Text numberOfLines={1} style={[styles.from, { color: tone.sub }]}>
              {from}
            </Text>
          ) : null}
        </View>
        <View style={styles.scoreBox}>
          <Icon name="star" size={30} color={COLORS.gold} style={styles.scoreStar} />
          <Text style={[styles.score, { color: tone.ink }]}>{score}</Text>
        </View>
      </View>
    </View>
  );
}

/** Where a row was set, as it reads under a name. */
function fromLabel(entry: Board.Entry) {
  if (entry.city && entry.country) return `${entry.city}, ${entry.country}`;
  return entry.country || '';
}

/**
 * The leaderboard.
 *
 * Three boards off one collection: everyone, everyone in the player's country,
 * and everyone in their city. The narrow two only exist once the app knows
 * where the player is -- which it works out from their connection rather than
 * by asking for the location permission -- so each tab says plainly what it is
 * waiting on rather than showing an empty list.
 *
 * The list itself is whatever the service could get: a fresh page when the
 * device is online, and the last page it saw when it is not. The screen says
 * which, and never blocks on the network -- an offline player still gets a
 * board, their own best still shows at the bottom, and the score they set goes
 * up on its own the next time this opens.
 *
 * The rows sit on a deep violet board rather than straight on the page. A list
 * of dark rows on a dark page has no edges to it; the same list on a board
 * has a frame, and the gold, silver and bronze of the first three rows finally
 * have something to be bright against.
 */
function LeaderboardScreen({
  visible,
  best,
  runs,
  onBack,
  onOpenSettings,
}: {
  visible: boolean;
  /** This device's best run, which is what it would be ranked on. */
  best: number;
  runs: number;
  onBack: () => void;
  /** The board can only show a name the player has set, so it offers the way. */
  onOpenSettings: () => void;
}) {
  const settings = useSettings();
  const cache = Board.useBoard();
  const region = Region.useRegion();
  const [scope, setScope] = useState<Board.Scope>('world');
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(true);

  const load = useCallback(
    async (which: Board.Scope, force: boolean) => {
      setBusy(true);
      // Anything that never made it up goes first, so the board the player is
      // about to read already has their score in it.
      await Board.flush(runs);
      if (force) Board.invalidate();
      const [{ entries, live: fresh }, id] = await Promise.all([
        Board.fetchTop(which),
        Board.myUid(),
      ]);
      setUid(id);
      setLive(fresh);
      // Only worth an extra round trip when the player is not on the page, and
      // only the world board has a rank to put a number to.
      if (which === 'world' && fresh && id && !entries.some(e => e.uid === id) && best > 0) {
        await Board.fetchRank(best);
      }
      setBusy(false);
    },
    [best, runs],
  );

  useEffect(() => {
    if (!visible) return;
    Analytics.track('leaderboard_open', { best, scope });
    // The country and city boards need somewhere to point at; the lookup is
    // cached, so this is free after the first open.
    Region.resolve();
    load(scope, false);
    // Re-running this on every cache change would refetch in a loop; the open
    // and the tab are the events worth reacting to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scope]);

  const entries = Board.page(scope, cache).entries;
  const ready = Board.canShow(scope, region);
  const mineOnPage = uid ? entries.findIndex(e => e.uid === uid) : -1;
  // A rank number is only meaningful on the whole board; on the narrow ones
  // the row is shown where it sits or not at all.
  const rank = mineOnPage >= 0 ? mineOnPage + 1 : cache.rank;

  const onShare = useCallback(() => {
    shareScore(best, scope === 'world' ? rank : 0, 'leaderboard');
  }, [best, rank, scope]);

  const where = Region.placeLabel(region);

  // Mounted for the whole session so the chosen tab survives a trip into the
  // settings and back; nothing is drawn -- and no back handler is claimed --
  // until it is actually the page on screen.
  if (!visible) return null;

  return (
    <Screen
      title="LEADERBOARD"
      subtitle={where ? `You are playing from ${where}` : 'Working out where you are...'}
      onBack={onBack}>
      <View style={styles.tabs}>
        {TABS.map(tab => {
          const on = tab.scope === scope;
          return (
            <Pressable
              key={tab.scope}
              onPress={() => setScope(tab.scope)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.tabShell,
                on ? styles.tabShellOn : styles.tabShellOff,
                pressed && styles.tabPressed,
              ]}>
              <View style={[styles.tab, on ? styles.tabOn : styles.tabOff]}>
                <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{tab.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.status}>
          {busy
            ? 'Loading...'
            : !ready
            ? 'Waiting on your location'
            : live
            ? `Top ${entries.length}`
            : 'Offline - showing the last board seen'}
        </Text>
        <Pressable onPress={() => load(scope, true)} hitSlop={10} disabled={busy}>
          <Text style={[styles.refresh, busy && styles.refreshBusy]}>REFRESH</Text>
        </Pressable>
      </View>

      {!settings.name && (
        <Pressable style={styles.notice} onPress={onOpenSettings}>
          <Text style={styles.noticeTxt}>
            Your runs go up as <Text style={styles.noticeBold}>Anonymous</Text>. Tap to pick a name.
          </Text>
        </Pressable>
      )}

      {!settings.submitScores && (
        <View style={[styles.notice, styles.noticeWarn]}>
          <Text style={styles.noticeTxt}>
            Sending scores is off in settings, so your runs stay on this device.
          </Text>
        </View>
      )}

      {/* The board the rows stand on: a dark outline, a pale rim, a violet face. */}
      <View style={styles.boardShell}>
        <View style={styles.boardFace}>
          {!ready ? (
            <View style={styles.empty}>
              {busy ? (
                <ActivityIndicator color={COLORS.onCard} />
              ) : (
                <Text style={styles.emptyTxt}>
                  {scope === 'city'
                    ? 'Your city is not known yet, so there is no city board to show. The world board still has you.'
                    : 'Your country is not known yet, so there is no country board to show. The world board still has you.'}
                </Text>
              )}
            </View>
          ) : entries.length === 0 ? (
            <View style={styles.empty}>
              {busy ? (
                <ActivityIndicator color={COLORS.onCard} />
              ) : (
                <Text style={styles.emptyTxt}>
                  {live
                    ? scope === 'world'
                      ? 'Nobody has posted a score yet. Be first.'
                      : `Nobody around ${where} has posted a score yet. Be first.`
                    : 'No board saved on this device.'}
                </Text>
              )}
            </View>
          ) : (
            entries.map((e, i) => (
              <Row
                key={e.uid}
                place={i + 1}
                name={e.name}
                score={e.score}
                from={scope === 'world' ? fromLabel(e) : undefined}
                mine={e.uid === uid}
              />
            ))
          )}

          {/* Off the end of the page: the player still gets to see where they sit. */}
          {ready && mineOnPage < 0 && entries.length > 0 && best > 0 && (
            <>
              <Text style={styles.gap}>...</Text>
              <Row
                place={scope === 'world' ? rank || 0 : 0}
                name={settings.name || 'You'}
                score={best}
                from={scope === 'world' ? where : undefined}
                mine
              />
            </>
          )}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onShare}
        style={({ pressed }) => [styles.shareShell, pressed && styles.sharePressed]}>
        <View style={styles.share}>
          <Text style={styles.shareTxt}>SHARE MY SCORE</Text>
        </View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tabShell: { flex: 1, borderRadius: 999, paddingBottom: DEPTH, borderWidth: 2 },
  tabShellOn: { backgroundColor: COLORS.warmEdge, borderColor: PODIUM[0].rim },
  tabShellOff: { backgroundColor: COLORS.pauseEdge, borderColor: COLORS.pauseRim },
  tabPressed: { paddingBottom: 1, transform: [{ translateY: DEPTH - 1 }] },
  tab: { borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.warmFace },
  tabOff: { backgroundColor: COLORS.pauseFace },
  tabTxt: { fontSize: 12, ...TYPE.black, letterSpacing: 1.2, color: COLORS.onCardSoft },
  tabTxtOn: { color: COLORS.onCard },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  status: { flex: 1, fontSize: 12, ...TYPE.semi, color: COLORS.muted },
  refresh: { fontSize: 12, ...TYPE.black, letterSpacing: 1.5, color: COLORS.ink },
  refreshBusy: { opacity: 0.35 },
  notice: {
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeWarn: { backgroundColor: COLORS.rowMedal },
  noticeTxt: { fontSize: 13, ...TYPE.medium, color: COLORS.body },
  noticeBold: { ...TYPE.black, color: COLORS.ink },
  boardShell: {
    borderRadius: 26,
    backgroundColor: COLORS.pauseEdge,
    borderWidth: 3,
    borderColor: COLORS.pauseRim,
    padding: 6,
  },
  boardFace: {
    borderRadius: 20,
    backgroundColor: COLORS.pauseWell,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 9,
  },
  rowShell: { borderRadius: 20, paddingBottom: DEPTH, borderWidth: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 10,
  },
  placeBox: { width: 32, alignItems: 'center', justifyContent: 'center' },
  place: { fontSize: 18, ...TYPE.black },
  trophy: {
    // Lifts the cup off the face it is sitting on, the way a medal hangs.
    textShadowColor: 'rgba(28,22,72,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  placeBead: {
    position: 'absolute',
    left: -2,
    bottom: -4,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.onCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBeadTxt: { fontSize: 10, ...TYPE.black, color: COLORS.onCard },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: COLORS.onCard,
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the gloss to the disc, so the light curves with it.
    overflow: 'hidden',
  },
  // An oversized white disc hanging off the top: what survives the clip is a
  // crescent of light across the crown, the same one every bead here wears.
  avatarGloss: {
    position: 'absolute',
    left: -10,
    top: -28,
    width: 58,
    height: 46,
    borderRadius: 29,
    backgroundColor: COLORS.onCard,
    opacity: 0.24,
  },
  avatarTxt: { fontSize: 19, ...TYPE.black, color: COLORS.onCard },
  rowText: { flex: 1 },
  name: { fontSize: 17, ...TYPE.black, letterSpacing: -0.3 },
  nameLift: { textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  from: { fontSize: 11, ...TYPE.semi, marginTop: 1 },
  scoreBox: { width: 52, alignItems: 'center' },
  scoreStar: {
    textShadowColor: 'rgba(28,22,72,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  score: { fontSize: 14, ...TYPE.black, marginTop: -5 },
  gap: { textAlign: 'center', fontSize: 16, color: COLORS.pauseRim, ...TYPE.black },
  empty: { paddingVertical: 30, paddingHorizontal: 20, alignItems: 'center' },
  emptyTxt: { fontSize: 14, ...TYPE.medium, color: COLORS.onCardSoft, textAlign: 'center' },
  shareShell: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: COLORS.warmEdge,
    paddingBottom: 5,
  },
  sharePressed: { paddingBottom: 1, transform: [{ translateY: 4 }] },
  share: {
    borderRadius: 999,
    backgroundColor: COLORS.warmFace,
    paddingVertical: 13,
    alignItems: 'center',
  },
  shareTxt: { fontSize: 13, ...TYPE.black, letterSpacing: 1.5, color: COLORS.onCard },
});

/** Memoised: the run re-renders every frame, and this does not move with it. */
export default React.memo(LeaderboardScreen);
