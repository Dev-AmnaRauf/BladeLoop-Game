import React from 'react';
import { StyleSheet, View } from 'react-native';
import Sticker, { CAP_BOT, CAP_TOP, LINE } from './Sticker';
import { MARK } from './theme';

/**
 * How far the whole lockup is turned, in degrees.
 *
 * Negative: the mark rises to the right. It is turned as one piece -- both
 * words and the hoop behind them inside a single rotated box -- rather than
 * word by word. Turning them separately puts each word's centre where an
 * upright stack would have left it, and the pair comes out as two words that
 * happen to lean the same way; turning the box moves the lower word along the
 * tilt as well, which is the difference between a tilted logo and a logo with
 * tilted words in it.
 */
const TILT = -15;

/**
 * LOOP's type size, as a share of BLADE's.
 *
 * The two words are set at nearly the same size in the mark -- LOOP a shade
 * down, which is what keeps the shorter word from coming out as wide as the
 * longer one. The whole silhouette of the mark is in this number: at 1 the
 * stack reads as a square block, and much under 0.9 it reads as a word with a
 * subtitle rather than as two lines of one name.
 */
const LOOP = 0.95;

/**
 * Where LOOP's line box starts, relative to the end of BLADE's.
 *
 * The two words are set to meet: LOOP's cap line lands on BLADE's baseline, so
 * the bands round them overlap and the pair reads as one sticker rather than
 * as two stacked ones. It is worked out from the caps' own band inside the line
 * box rather than typed in, because the box carries an ascender and a descender
 * that no capital reaches into -- stacking the boxes themselves would leave a
 * fifth of a line of air between two words that are meant to touch.
 */
const MEET = CAP_BOT * LINE - CAP_TOP * LINE * LOOP - LINE;

/** The stack's own height, in BLADE type sizes, once the words have met. */
const STACK = LINE + MEET + LINE * LOOP;

/** Where LOOP's feet are inside that stack. The hoop is hung off this. */
const FEET = LINE + MEET + CAP_BOT * LINE * LOOP;

/**
 * The game's name, drawn the way the mark draws it.
 *
 * Three screens wear this -- the front page, the door and the loading screen --
 * and between them they are every first impression the game gets, so it is one
 * component rather than three copies of a dozen coupled numbers. Everything is
 * a share of `size`, which is BLADE's type size: hand it the room the page has
 * and the mark comes out in proportion, hoop and overlap and all.
 */
function Wordmark({ size }: { size: number }) {
  return (
    // The box is padded rather than sized: a rotated view still lays out at the
    // size it had upright, so without this the corners of a tilted mark reach
    // into whatever is set above and below it -- on the front page, the ribbon.
    // The two numbers are what a fifteen-degree turn costs a box this shape,
    // bands and all: about six tenths of a type size off each end of the long
    // side, and a third off each of the short ones.
    <View style={[styles.box, { paddingVertical: size * 0.6, paddingHorizontal: size * 0.36 }]}>
      <View style={[styles.stack, { transform: [{ rotate: `${TILT}deg` }] }]}>
        {/* The loop the game is named after, thrown round its own name: a
            sand-gold hoop behind both words, drawn first so the letters sit in
            front of it. Its top edge is deliberately buried in the middle of
            BLADE -- the letters there are a solid run of ink with no sky
            showing between them, so the hoop passes behind the word rather
            than crossing it. Its sides line up with BLADE's own box, which is
            the wider of the two words, so what shows is the bottom of the hoop
            and the two corners either side of LOOP. */}
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: size * 0.45,
              bottom: size * (STACK - FEET - 0.09),
              borderRadius: size * 0.5,
              borderWidth: size * 0.055,
            },
          ]}
        />
        <Sticker
          size={size}
          face={MARK.bladeTop}
          faceBot={MARK.bladeBot}
          edge={MARK.edge}
          rim={MARK.band}
          bubble>
          BLADE
        </Sticker>
        <View style={{ marginTop: size * MEET }}>
          <Sticker
            size={size * LOOP}
            face={MARK.loopTop}
            faceBot={MARK.loopBot}
            edge={MARK.edge}
            rim={MARK.band}
            bubble>
            LOOP
          </Sticker>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center' },
  stack: { alignItems: 'center' },
  // Left and right are pinned to the stack's own box, which BLADE sets: the
  // hoop grows with the words rather than needing a width of its own on every
  // screen size.
  ring: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderColor: MARK.ring,
  },
});

export default React.memo(Wordmark);
