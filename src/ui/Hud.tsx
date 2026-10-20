import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { speedPct } from '../game/config';
import Icon from './Icon';
import { COLORS, useTheme } from './theme';
import { TYPE } from './type';

function Hud({
  score,
  coins,
  level,
  top,
  left,
  right,
  onPause,
  bonusLeft,
  gear,
}: {
  score: number;
  /** The currency, which flags and stars pay out and a revive spends. */
  coins: number;
  /** Which level this run is, 1-based. */
  level: number;
  top: number;
  /**
   * Safe area down each side, in px.
   *
   * Held upright these are both zero and the HUD sits on its own margin. Held
   * sideways they are not: the cutout, the curve of the corner and the
   * gesture bar all move to the sides of the screen, and the two chips at the
   * ends of this row are exactly what would go under them. Added to the
   * margin rather than replacing it, so a screen with no inset keeps the
   * spacing it has always had.
   */
  left: number;
  right: number;
  onPause: () => void;
  /** Whole seconds left on the TV bonus, or 0 when it is not running. */
  bonusLeft: number;
  /**
   * How fast the descent is running, as a multiplier on the level's opening
   * pace: the flags' gear and the creep the run has flown for, together. 1 is
   * that opening pace and is not shown -- the corridor running at the speed it
   * has always run at is not news. Anything above it is, and it stays up for
   * the rest of the level, because the player is owed an answer to "why is
   * this a little quicker than it was a minute ago".
   *
   * It is shown as the per cent it is -- `+6%`, `+12%` -- since the ladder is
   * a nudge at a time rather than a multiplication, and it is rounded, so the
   * chip appears once the creep has actually bought a whole per cent rather
   * than flashing `+0%` at a player a second into the level.
   */
  gear: number;
}) {
  // The HUD rides the level's palette, so the closing stretch carries it too.
  const t = useTheme();

  const ink = { color: t.ink };
  // The two side chips are the corridor's own violet lifted off the sky, which
  // is what keeps them reading as the game's furniture rather than as clouds.
  const chip = { backgroundColor: t.card, borderColor: t.ring };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.wrap,
          {
            paddingTop: top + 8,
            paddingLeft: left + 16,
            paddingRight: right + 16,
          },
        ]}>
        <Pressable
          onPress={onPause}
          accessibilityRole="button"
          accessibilityLabel="Pause"
          style={[styles.round, chip]}
          hitSlop={10}>
          <Icon name="pause" size={20} color={t.ink} />
        </Pressable>

        <View style={styles.middle}>
          {/* The one thing on screen the player is actually accumulating, so it
              is the one chip drawn the other way round: a white plate with the
              number inked on it, rather than pale ink on the corridor's violet.
              On a sky this light nothing else reads from the corner of an eye
              mid-run. */}
          <View style={styles.scorePill}>
            <Text style={styles.score}>{score}</Text>
          </View>
          <Text style={styles.levelTxt}>{`LEVEL ${level}`}</Text>
          {speedPct(gear) >= 1 && (
            <View style={styles.gear}>
              <Text style={styles.gearTxt}>{`+${speedPct(gear)}%`}</Text>
            </View>
          )}
        </View>

        <View accessibilityLabel="Gems" style={[styles.coins, chip]}>
          <Icon name="gem" size={16} color={t.ballBody} />
          <Text style={[styles.coinTxt, ink]}>{coins}</Text>
        </View>
      </View>

      {bonusLeft > 0 && (
        <View pointerEvents="none" style={[styles.timer, { top: top + 92, right: right + 18 }]}>
          <Text style={styles.timerTxt}>{bonusLeft}</Text>
          <Text style={styles.timerLabel}>x2</Text>
        </View>
      )}
    </>
  );
}

export default React.memo(Hud);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // The side margin is passed in rather than set here: it is 16 plus
    // whatever the screen's own inset is, which is nothing upright and the
    // cutout's width sideways.
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { alignItems: 'center' },
  scorePill: {
    // Sits over the rods, so it needs its own ground to stay readable.
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 2,
    backgroundColor: COLORS.onCard,
    elevation: 4,
  },
  score: {
    fontSize: 38,
    ...TYPE.black,
    letterSpacing: -1,
    color: COLORS.inkOnLight,
  },
  levelTxt: {
    fontSize: 10,
    ...TYPE.black,
    letterSpacing: 2.2,
    marginTop: 3,
    color: COLORS.onCard,
    // The one label on the run that sits straight on the sky rather than on a
    // plate, so it carries its own shadow to hold it off a pale cloud.
    textShadowColor: COLORS.shade,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
  },
  // The gear the flags have wound the descent up to. It rides under the level
  // label rather than beside the score: the score is the number the player
  // watches, and nothing may crowd it.
  //
  // It used to be painted in the hazard colour, on the reasoning that that is
  // the one colour already meaning "this is what is coming at you". But the
  // hazard colour means something narrower and more useful than that -- it
  // means *this shape, here, ends the run on contact* -- and a chip wearing it
  // permanently in the corner of the HUD spends it on something the ball can
  // never hit. It is a HUD chip now, like every other one, with the number in
  // gold so the climb still reads as a thing being won.
  gear: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 1,
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.line,
  },
  gearTxt: {
    ...TYPE.black,
    fontSize: 13,
    letterSpacing: 0.5,
    color: COLORS.gold,
  },
  // `right` is supplied per screen, for the same reason the row's margin is.
  timer: { position: 'absolute', alignItems: 'center' },
  // Also read straight off the sky, so it carries the same shadow the level
  // label does rather than a pale ink that a cloud would swallow.
  timerTxt: {
    fontSize: 34,
    ...TYPE.black,
    letterSpacing: -1,
    color: COLORS.onCard,
    textShadowColor: COLORS.shade,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timerLabel: {
    fontSize: 11,
    ...TYPE.black,
    letterSpacing: 2,
    marginTop: -4,
    color: COLORS.gold,
    textShadowColor: COLORS.shade,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  coinTxt: { fontSize: 16, ...TYPE.bold, minWidth: 14 },
});
