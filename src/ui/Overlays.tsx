/* eslint-disable react-native/no-inline-styles -- the game-over stage is placed by hand */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './theme';
import { speedPct } from '../game/config';
import { LEVEL_COUNT, isEndless } from '../game/level';
import { opensWorld, worldOf } from '../game/worlds';
import Button, { RoundButton } from './Button';
import { Chip, HUES, PopCard, useLandscape, type Hue } from './Card';
import { Ball, Saw } from './entities';
import Icon from './Icon';
import Sticker from './Sticker';
import { TYPE } from './type';

/**
 * Thousands separators, done by hand.
 *
 * `toLocaleString` is at the mercy of whatever ICU data the engine shipped
 * with, and a score is the one number on the card the player reads character
 * by character. A four-figure run coming out as 1234 on one phone and 1,234 on
 * the next is exactly the kind of small wrongness that makes a card look
 * cheap, so the grouping is ours.
 */
function group(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export interface CardActions {
  onLeaderboard: () => void;
  onSettings: () => void;
  onShare: () => void;
}

/** Where the player is in the game, carried by every card. */
export interface LevelInfo {
  /** Which level the run was, 1-based. */
  level: number;
  /**
   * How many levels have been cleared. Only the finish card reads it, to know
   * whether the level it is closing was the last one in the game.
   */
  cleared: number;
}

/**
 * The card's one block of numbers: which level it was, what the run scored,
 * and the two things it earned.
 *
 * No labels. A gem beside a number is a number of gems and a cup beside one is
 * a best, and anybody who has played a game like this for ten seconds knows
 * both -- where "GEMS" and "BEST" in small capitals are two more words to read
 * before getting back to the run.
 */
function Readout({
  level,
  score,
  best,
  runCoins,
  hue,
  land,
}: {
  level: number;
  score: number;
  best: number;
  runCoins: number;
  hue: Hue;
  land: boolean;
}) {
  return (
    <>
      {/* Out of twenty while the authored game lasts; past that there is no
          denominator to quote, because the road does not end. */}
      <Text style={styles.levelTxt}>
        {isEndless(level)
          ? `LEVEL ${level}`
          : `LEVEL ${level} / ${LEVEL_COUNT}`}
      </Text>
      <View style={[styles.scorePill, { backgroundColor: HUES[hue].well }]}>
        <Text style={[styles.scoreTxt, land && styles.scoreTxtLand]}>
          {group(score)}
        </Text>
      </View>
      <View style={styles.chipRow}>
        <Chip icon="gem" value={`+${group(runCoins)}`} hue={hue} />
        <Chip icon="leaderboard" value={group(best)} hue={hue} />
      </View>
    </>
  );
}

/** The row the thumb lands on: one big bead in the middle, two beside it. */
function MainRow({
  children,
  land,
}: {
  children: React.ReactNode;
  land: boolean;
}) {
  return (
    <View style={[styles.mainRow, land && styles.rowLand]}>{children}</View>
  );
}

/** The quieter row under it: the pages. */
function SideRow({
  children,
  land,
}: {
  children: React.ReactNode;
  land: boolean;
}) {
  return (
    <View style={[styles.sideRow, land && styles.rowLand]}>{children}</View>
  );
}

/** How big the two rows of beads are drawn, upright and on a short screen. */
const BIG = 64;
const BIG_LAND = 50;
const SMALL = 46;
const SMALL_LAND = 38;
/** The level-complete card's beads, which are drawn at full size. */
const BIG_FULL = 76;
const SMALL_FULL = 54;

/** How big the character is drawn on the screen a run ends on. */
const HERO = 150;

/**
 * The screen a failed run ends on.
 *
 * It is the one place in the game that is not a card. A card is a thing that
 * has come up *over* the game and can be dismissed off it again; a run that has
 * ended has nowhere to be dismissed to, and the two decisions -- go again, or
 * go home -- are the whole screen rather than two of six beads on a pop-up. So
 * the character is drawn big with the face it has just earned, the score and
 * the best are read straight off the dark, and the two pills underneath are
 * the size of decisions.
 *
 * The four small beads at the bottom are everything the pop-up used to carry
 * in the same weight as the retry: the flag a revive buys -- with what it
 * costs pinned to its corner -- the share, and the two pages. They are down
 * there and small on purpose. None of them is what the player came to this
 * screen to do, and a revive that is as loud as the retry is a game asking for
 * money at the worst moment it has.
 *
 * No close button: an X that silently picks one of the buttons for the player
 * is worse than no X at all.
 */
export const GameOverOverlay = React.memo(function GameOverScreen({
  score,
  best,
  reviveCost,
  canRevive,
  isBest,
  onRetry,
  onStartOver,
  onRevive,
  onLeaderboard,
  onSettings,
  onShare,
}: CardActions &
  LevelInfo & {
    score: number;
    best: number;
    runCoins: number;
    reviveCost: number;
    canRevive: boolean;
    /** True when this run is the one that set the best, worth calling out. */
    isBest: boolean;
    /** Picks the run back up where it ended. */
    onRetry: () => void;
    /** Throws the run away and opens this level from the top. */
    onStartOver: () => void;
    onRevive: () => void;
  }) {
  const land = useLandscape();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: 1,
      // The same spring the cards land on, so the game answers a death the way
      // it answers everything else.
      friction: 6.5,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [pop]);

  const fade = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });
  const slide = pop.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });

  // A run that ends on a best is still a run that ended, but it is not a
  // failure, and painting it in the failure's raspberry is the screen calling
  // the player's best run of the day a loss.
  const banner = isBest
    ? { face: COLORS.clearFace, rim: COLORS.clearRim, edge: COLORS.clearEdge }
    : { face: COLORS.failFace, rim: COLORS.failRim, edge: COLORS.failEdge };
  const small = land ? SMALL_LAND : SMALL;

  return (
    // The screen claims every touch its own controls do not. Without this a tap
    // beside it reaches the run underneath and steers a game nobody can see.
    <View style={styles.overFill} onStartShouldSetResponder={() => true}>
      <Animated.View
        style={[styles.overScrim, { opacity: fade }]}
        pointerEvents="none"
      />
      {/* Three parts: who you were, how it went, and what to do next.
          Stacked down the screen where there is height for it, and set side
          by side where there is not -- which, the game being sideways
          throughout, is every phone. Stacked on a phone the last of the three
          runs off the bottom of the screen: the card came to about 385dp
          against the 384 a 720px phone gives, so RETRY sat on the very edge
          and HOME and the beads under it were not on screen at all. This card
          has no scroll and nowhere to be dismissed to, so anything off the
          bottom of it is simply gone. */}
      <Animated.View
        style={[
          styles.overStack,
          land && styles.overStackLand,
          { opacity: fade, transform: [{ scale }, { translateY: slide }] },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.overPart, land && styles.overPartLand]}>
          {/* The character, with the face the run just gave it -- and, still
            turning either side of it, the two things that put it there. */}
          <View
            style={[styles.hero, land && styles.heroLand]}
            pointerEvents="none"
          >
            <View style={[styles.heroHalo, land && styles.heroHaloLand]} />
            {[-1, 1].map(s => (
              <View
                key={s}
                style={[styles.heroSaw, { left: HERO / 2 + s * HERO * 0.38 }]}
              >
                <Saw x={0} y={0} size={land ? 22 : 28} rot={s} />
              </View>
            ))}
            {/* Three stars thrown round its head, the way a knock-out is drawn. */}
            {[-0.62, 0, 0.62].map((a, i) => (
              <View
                key={a}
                style={{
                  position: 'absolute',
                  left: HERO / 2 + Math.sin(a) * HERO * 0.44 - 9,
                  top: HERO / 2 - Math.cos(a) * HERO * 0.44 - 9,
                }}
              >
                <Icon
                  name="star"
                  size={i === 1 ? 20 : 16}
                  color={COLORS.gold}
                />
              </View>
            ))}
            <Ball x={HERO / 2} y={HERO / 2} scale={land ? 2.6 : 3.4} dead />
          </View>

          <View
            style={[
              styles.banner,
              land && styles.bannerLand,
              { backgroundColor: banner.face, borderColor: banner.rim },
            ]}
          >
            <Sticker
              size={land ? 24 : 30}
              face={COLORS.onCard}
              edge={banner.edge}
              weight={3}
              tilt={-1}
            >
              {isBest ? 'NEW BEST' : 'GAME OVER'}
            </Sticker>
          </View>
        </View>

        <View style={[styles.overPart, land && styles.overPartLand]}>
          <Text style={styles.statLabel}>SCORE</Text>
          <Text style={[styles.statBig, land && styles.statBigLand]}>
            {group(score)}
          </Text>
          <Text style={styles.statLabel}>BEST SCORE</Text>
          <View style={styles.bestRow}>
            <Icon name="crown" size={land ? 17 : 21} color={COLORS.gold} />
            <Text style={[styles.bestTxt, land && styles.bestTxtLand]}>
              {group(best)}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.overPart,
            land && styles.overPartLand,
            land && styles.overDoLand,
          ]}
        >
          <View style={styles.pills}>
            <Button
              label="RETRY"
              a11y="RETRY HERE"
              icon="retry"
              onPress={onRetry}
              tone="go"
            />
            <Button
              label="HOME"
              a11y="START OVER"
              icon="home"
              onPress={onStartOver}
              tone="violet"
            />
          </View>

          {/* Everything else, quiet and out of the thumb's way. */}
          <View style={styles.beads}>
            {canRevive ? (
              <RoundButton
                icon="flag"
                label={`LAST FLAG  ${reviveCost}`}
                onPress={onRevive}
                tone="warm"
                size={small}
                badge={String(reviveCost)}
              />
            ) : null}
            <RoundButton
              icon="share"
              label="Share your score"
              onPress={onShare}
              tone="blue"
              size={small}
            />
            <RoundButton
              icon="leaderboard"
              label="Leaderboard"
              onPress={onLeaderboard}
              tone="blue"
              size={small}
            />
            <RoundButton
              icon="settings"
              label="Settings"
              onPress={onSettings}
              tone="blue"
              size={small}
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
});

/** How long the flag banner stays up, and how long it takes to leave. */
const FLASH_HOLD = 1300;
const FLASH_OUT = 320;

/**
 * The banner a flag puts up over the run.
 *
 * Taking a flag used to be a chime and a small "+25" chip drifting off the
 * ball, which on a corridor this busy is not something a player notices, let
 * alone reads. It is now the one landmark a level has: the checkpoint a revive
 * comes back to, a payout in both currencies, and a rung on the speed ladder.
 * All three of those are worth knowing about, and the last one is worth
 * knowing about *before* the corridor starts arriving faster.
 *
 * So it is said out loud, in the middle of the screen, and then it goes away
 * on its own. Nothing here takes a touch and nothing waits for one: the run is
 * still going on underneath, and a banner over a live run that had to be
 * dismissed would be a banner that kills the player.
 */
export const FlagFlash = React.memo(function FlagBanner({
  score,
  coins,
  gear,
  onDone,
}: {
  score: number;
  coins: number;
  /**
   * The gear the descent has just been wound up to, as a multiplier on the
   * level's opening pace. 1 means it has not been wound up at all.
   */
  gear: number;
  onDone: () => void;
}) {
  const land = useLandscape();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.sequence([
      Animated.spring(pop, {
        toValue: 1,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }),
      Animated.delay(FLASH_HOLD),
      Animated.timing(pop, {
        toValue: 0,
        duration: FLASH_OUT,
        useNativeDriver: true,
      }),
    ]);
    run.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => run.stop();
  }, [pop, onDone]);

  const fade = pop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

  return (
    <View pointerEvents="none" style={styles.flashWrap}>
      <Animated.View
        style={{ opacity: fade, transform: [{ scale }], alignItems: 'center' }}
      >
        <Sticker
          size={land ? 26 : 34}
          face={COLORS.gold}
          edge={COLORS.starEdge}
          weight={3.5}
          tilt={-3}
        >
          CHECKPOINT
        </Sticker>
        <View style={styles.flashRow}>
          <View style={styles.flashChip}>
            <Icon name="leaderboard" size={14} color={COLORS.gold} />
            <Text style={styles.flashTxt}>{`+${group(score)}`}</Text>
          </View>
          <View style={styles.flashChip}>
            <Icon name="gem" size={14} color={COLORS.gradA} />
            <Text style={styles.flashTxt}>{`+${coins}`}</Text>
          </View>
        </View>
        {gear > 1 && (
          <View style={styles.flashSpeed}>
            <Text style={styles.flashSpeedTxt}>{`SPEED  +${speedPct(
              gear,
            )}%`}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
});

/**
 * What a cleared level is cheered with. It moves on with the level, so the
 * word the player earns is not the same one twenty times over.
 */
const CHEERS = ['AWESOME!', 'SUPERB!', 'BRILLIANT!', 'AMAZING!', 'FANTASTIC!'];

export function cheerFor(level: number) {
  return CHEERS[(level - 1) % CHEERS.length];
}

/**
 * The card a cleared level ends on.
 *
 * The big bead is the next level wherever there is one, and it goes back out
 * to the road rather than straight into it: the road is where a level is
 * chosen, and it is also where the stars this run just won are shown landing
 * over the stop that was cleared. Only on the last level does the bead become
 * the same level again, because there is nowhere else to send them.
 */
export const FinishOverlay = React.memo(function FinishCard({
  score,
  best,
  runCoins,
  level,
  cleared,
  onNext,
  onReplay,
  onLeaderboard,
  onSettings,
  onShare,
}: CardActions &
  LevelInfo & {
    score: number;
    best: number;
    runCoins: number;
    /** Given only while there is a level after this one. */
    onNext?: () => void;
    onReplay: () => void;
  }) {
  const land = useLandscape();
  // There is always a level after this one now, so the card only closes the
  // run out when the screen behind it has not offered one.
  const last = !onNext;
  const big = land ? BIG_FULL : BIG;
  const small = land ? SMALL_FULL : SMALL;
  // What was won, and what to do next. On a wide screen they sit side by side
  // across the whole card; upright, one over the other as before.
  const won = (
    <>
      {/* Said in words as well as in the card's colour and its one loud word.
          A level is five to seven minutes of run now, and the cheer over a
          green card is the same thing a player sees at the end of a level they
          skipped and at the end of one they fought for -- so the card names
          the level it just closed, in the first line, at a size that is read
          rather than glanced at. */}
      <Text
        style={[styles.clearTxt, land && styles.clearTxtFull]}
      >{`LEVEL ${level} COMPLETE`}</Text>
      {/* The level that opens a world is what unlocks it, so the card that
          lets the player through to it says so -- once, in the world's name. */}
      {level < LEVEL_COUNT && opensWorld(level + 1) ? (
        <Text
          style={[styles.worldTxt, land && styles.worldTxtFull]}
        >{`NEW WORLD UNLOCKED: ${worldOf(level + 1).name.toUpperCase()}`}</Text>
      ) : null}
      <Readout
        level={level}
        score={score}
        best={best}
        runCoins={runCoins}
        hue="clear"
        land={false}
      />
    </>
  );
  const buttons = (
    <>
      <MainRow land={false}>
        <RoundButton
          icon="share"
          label="Share your score"
          onPress={onShare}
          tone="blue"
          size={small}
        />
        {last ? (
          <RoundButton
            icon="play"
            label="PLAY AGAIN"
            onPress={onReplay}
            tone="go"
            size={big}
          />
        ) : (
          <RoundButton
            icon="next"
            label="NEXT LEVEL"
            onPress={onNext}
            tone="go"
            size={big}
          />
        )}
        <RoundButton
          icon="retry"
          label={last ? 'Replay' : 'REPLAY LEVEL'}
          onPress={onReplay}
          tone="blue"
          size={small}
        />
      </MainRow>
      <SideRow land={false}>
        <RoundButton
          icon="leaderboard"
          label="Leaderboard"
          onPress={onLeaderboard}
          tone="blue"
          size={small}
        />
        <RoundButton
          icon="settings"
          label="Settings"
          onPress={onSettings}
          tone="blue"
          size={small}
        />
      </SideRow>
    </>
  );
  return (
    <PopCard
      hue="clear"
      // The last authored level is still worth marking as the end of the
      // written game, once. Everything past it is another victory.
      title={
        level === LEVEL_COUNT && cleared >= LEVEL_COUNT
          ? 'ALL CLEAR'
          : cheerFor(level)
      }
      titleFace={COLORS.gold}
      titleEdge={COLORS.starEdge}
      land={land}
      full
      cheer
    >
      {land ? (
        <View style={styles.finishRow}>
          <View style={styles.finishCol}>{won}</View>
          <View style={styles.finishCol}>{buttons}</View>
        </View>
      ) : (
        <>
          {won}
          {buttons}
        </>
      )}
    </PopCard>
  );
});

/**
 * The paused run. This one does close: the X and the big bead both mean the
 * same unambiguous thing -- put me back where I was.
 */
export const PauseOverlay = React.memo(function PauseCard({
  level,
  score,
  best,
  runCoins,
  onResume,
  onRetry,
  onLeaderboard,
  onSettings,
  onShare,
}: CardActions &
  LevelInfo & {
    /** The run so far, which is what a pause is a look at. */
    score: number;
    best: number;
    runCoins: number;
    onResume: () => void;
    onRetry: () => void;
  }) {
  const land = useLandscape();
  const big = land ? BIG_LAND : BIG;
  const small = land ? SMALL_LAND : SMALL;
  return (
    <PopCard
      hue="pause"
      title="PAUSED"
      titleFace={COLORS.onCard}
      titleEdge={COLORS.pauseEdge}
      land={land}
      onClose={onResume}
    >
      <Readout
        level={level}
        score={score}
        best={best}
        runCoins={runCoins}
        hue="pause"
        land={land}
      />
      <MainRow land={land}>
        <RoundButton
          icon="share"
          label="Share your score"
          onPress={onShare}
          tone="blue"
          size={small}
        />
        <RoundButton
          icon="play"
          label="RESUME"
          onPress={onResume}
          tone="go"
          size={big}
        />
        <RoundButton
          icon="home"
          label="START OVER"
          onPress={onRetry}
          tone="blue"
          size={small}
        />
      </MainRow>
      <SideRow land={land}>
        <RoundButton
          icon="leaderboard"
          label="Leaderboard"
          onPress={onLeaderboard}
          tone="blue"
          size={small}
        />
        <RoundButton
          icon="settings"
          label="Settings"
          onPress={onSettings}
          tone="blue"
          size={small}
        />
      </SideRow>
    </PopCard>
  );
});

const styles = StyleSheet.create({
  levelTxt: {
    ...TYPE.black,
    fontSize: 11,
    letterSpacing: 2.2,
    color: COLORS.onCardSoft,
  },
  /** The cleared level, said once and said large, over the card's own word. */
  finishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-evenly',
  },
  finishCol: { flex: 1, alignItems: 'center', gap: 8 },
  clearTxtFull: { fontSize: 26 },
  worldTxtFull: { fontSize: 17 },
  clearTxt: {
    ...TYPE.black,
    fontSize: 20,
    letterSpacing: 1.4,
    color: COLORS.onCard,
    textAlign: 'center',
  },
  worldTxt: {
    ...TYPE.black,
    fontSize: 15,
    letterSpacing: 1.2,
    color: COLORS.gold,
    textAlign: 'center',
    marginTop: 4,
  },
  // Sits a third of the way down rather than dead centre: the ball flies in a
  // band around the camera line, and the middle of the screen is exactly where
  // the player is looking for the next gap.
  flashWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '27%',
    alignItems: 'center',
  },
  flashRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  flashChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.line,
  },
  flashTxt: { ...TYPE.black, fontSize: 15, color: COLORS.ink },
  // The same rule as the HUD's gear chip: the hazard colour belongs to shapes
  // the ball can hit, and nothing else may borrow it.
  flashSpeed: {
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.line,
  },
  flashSpeedTxt: {
    ...TYPE.black,
    fontSize: 15,
    letterSpacing: 1.6,
    color: COLORS.gold,
  },
  scorePill: {
    borderRadius: 999,
    paddingHorizontal: 26,
    paddingVertical: 4,
    marginTop: -2,
  },
  scoreTxt: {
    ...TYPE.black,
    fontSize: 42,
    letterSpacing: -1.2,
    color: COLORS.onCard,
  },
  scoreTxtLand: { fontSize: 30 },
  chipRow: { flexDirection: 'row', gap: 10 },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 2,
  },
  rowLand: { gap: 10, marginTop: 0 },

  // --- the game-over screen, which is not a card --------------------------
  overFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.dim,
  },
  overStack: {
    width: '86%',
    maxWidth: 380,
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  // Side by side, and wider to hold the three of them. `center` down the
  // cross axis so a short column sits level with the tall one beside it
  // rather than hanging off its top.
  overStackLand: {
    flexDirection: 'row',
    width: '94%',
    maxWidth: 720,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    gap: 18,
  },
  // One of the three. Stacked it is a plain pass-through and changes nothing;
  // side by side it is the column.
  overPart: { alignItems: 'center' },
  overPartLand: { flexShrink: 1 },
  // The decisions get their width first: they are the only part of this card
  // that has to be hit, and a RETRY squeezed to nothing is the run over for
  // good. The other two shrink around it.
  overDoLand: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 240,
    alignSelf: 'center',
  },
  hero: {
    width: HERO,
    height: HERO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLand: { transform: [{ scale: 0.72 }] },
  // A soft disc behind the character, so it reads as lit on a dark ground
  // rather than as a sticker laid on one.
  heroHalo: {
    position: 'absolute',
    width: HERO * 0.82,
    height: HERO * 0.82,
    borderRadius: HERO,
    backgroundColor: COLORS.gradB,
    opacity: 0.16,
  },
  heroHaloLand: { opacity: 0.12 },
  heroSaw: { position: 'absolute', top: HERO * 0.56, width: 0, height: 0 },
  banner: {
    paddingHorizontal: 26,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 3,
    marginTop: -6,
    marginBottom: 6,
    elevation: 8,
  },
  bannerLand: { paddingHorizontal: 20, paddingVertical: 5, marginBottom: 2 },
  statLabel: {
    ...TYPE.black,
    fontSize: 11,
    letterSpacing: 2.4,
    color: COLORS.onCardSoft,
  },
  statBig: {
    ...TYPE.black,
    fontSize: 52,
    letterSpacing: -1.6,
    color: COLORS.onCard,
  },
  statBigLand: { fontSize: 34 },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bestTxt: {
    ...TYPE.black,
    fontSize: 26,
    letterSpacing: -0.5,
    color: COLORS.gold,
  },
  bestTxtLand: { fontSize: 20 },
  pills: { alignSelf: 'stretch', gap: 10, marginTop: 12 },
  beads: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
  },
});
