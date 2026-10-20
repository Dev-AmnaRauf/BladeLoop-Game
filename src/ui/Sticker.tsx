/* eslint-disable react-native/no-inline-styles -- a wordmark is a one-off */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { mixHex } from './theme';
import { BUBBLE, TYPE } from './type';

/**
 * The eight directions a plain sticker throws its outline in.
 *
 * Nothing on this platform strokes text, so the outline is the same word drawn
 * eight times in the edge colour underneath the face -- which is what every
 * game of this kind is doing behind its logo. Eight is enough at the weight a
 * card's heading wears.
 */
const RING: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

/**
 * The same idea at twenty-four points on the circle, for the bubble treatment.
 *
 * The bubble rings are two to three times heavier than a plain outline, and at
 * that radius the eight-point ring stops being a ring: the diagonals fall
 * short of the axes by a factor of root two, and the gap between them is wide
 * enough to see as a scallop along a round letter. Sixteen still showed facets
 * on the shoulder of a B at the front page's size; twenty-four does not.
 *
 * Every vector is unit length, so a ring's radius is the multiplier alone.
 */
const BUBBLE_RING: [number, number][] = Array.from({ length: 24 }, (_, i) => {
  const a = (i / 24) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)] as [number, number];
});

/**
 * How many bands a two-colour face is cut into.
 *
 * Nothing on this platform fills text with a gradient, so the face is the word
 * drawn once per band, each band clipped to its own slice of the line and
 * painted a step further along between the two colours. Twelve is where the
 * steps stop reading as steps at the size the front page wears the mark: the
 * two ends of either word are about seventy points of value apart, so a band
 * is under six, which is below what the eye picks out as an edge.
 */
const SLICES = 12;

/**
 * Where the capitals sit inside the line box, as a share of its height.
 *
 * The ramp has to run top to bottom of the *letters*, not of the box they are
 * set in: a line box carries an ascender and a descender that a run of
 * capitals never reaches into, so spreading the two colours over the whole box
 * spends a fifth of the ramp above the caps and a fifth below them, and the
 * word comes out as the middle of the gradient rather than as the whole of it.
 * This is the caps' own band at `LINE`, near enough on both of the faces the
 * game can end up set in.
 */
export const CAP_TOP = 0.16;
export const CAP_BOT = 0.82;

/**
 * Every copy of the word is held to one line.
 *
 * Android measures a line of its black face a hair narrower than it then
 * draws it, and a word that does not fit its box is wrapped -- so the last
 * letter dropped to a second line under the first and vanished, and VICTORY
 * came out as VICTOR. A single line cannot wrap, and a hair is not a letter.
 * See `text` below for the one way it still can.
 */
const ONE_LINE = { numberOfLines: 1, ellipsizeMode: 'clip' } as const;

/** The line box a sticker reserves, as a share of its type size. */
export const LINE = 1.06;

/**
 * A word drawn as a sticker: a coloured face over a heavy outline.
 *
 * The copies are laid out absolutely over a transparent one that does the
 * measuring, so the line takes exactly the size of the text no matter which
 * font the device ends up with.
 *
 * It is the game's loud voice -- the logo, and the one word a card leads with.
 * Everything else is set in plain type, because a screen where everything
 * shouts is a screen where nothing does.
 *
 * `bubble` is the loudest setting of all, and it is the game's name and
 * nothing else. It is built the way the mark itself is built: a white band
 * round the outside of the whole word, a dark ring inside that hugging every
 * letter, and the face over both. The order is the point -- white outermost is
 * what lifts the word off the sky as one sticker, and the dark ring inside it
 * is what keeps the letters apart from each other within that one shape. The
 * letters themselves are set in Lilita One (`BUBBLE` in `type.ts`), the round
 * capitals the mark is drawn in.
 */
function Sticker({
  children,
  size,
  face,
  faceBot,
  edge,
  weight,
  tilt = 0,
  bubble = false,
  rim = '#FFFFFF',
}: {
  children: string;
  size: number;
  /** The face colour -- the top of it, where `faceBot` is given as well. */
  face: string;
  /** The foot of the face, if it is painted as a ramp rather than flat. */
  faceBot?: string;
  edge: string;
  /**
   * How heavy the outline is, in px -- in `bubble`, the radius of the dark
   * ring round each letter. Left alone, a flat sticker takes the 3px it has
   * always taken, and a bubble takes a share of its own type size: the rings
   * are what the treatment reads as, so they have to grow with the word rather
   * than thin out to a hairline on the front page's big setting of it.
   */
  weight?: number;
  /** Degrees the word is turned, so a stacked logo is not square. */
  tilt?: number;
  /** Draw it as bubble lettering rather than a flat sticker. */
  bubble?: boolean;
  /** The band thrown round the outside of the word. `bubble` only. */
  rim?: string;
}) {
  // There is deliberately no extrusion under any of it. A run of copies stepped
  // straight down does give the word a side, and at this size it reads as the
  // word printed twice -- a solid shadow letter sitting under every real one,
  // close enough to be a ghost and far enough to be seen. The depth a bubble
  // wordmark has comes from the ramp down the face instead: see `faceBot`.
  const ink = weight ?? (bubble ? size * 0.085 : 3);
  const halo = ink + size * 0.07;

  // The dark ring runs `ink` past the glyph on every side, and the mark this is
  // drawn after sets its letters close enough that those rings meet and read as
  // the single line between two bubbles. So the tracking stays near what plain
  // type wears: opening it up by the ring's own width would set the word as a
  // row of separate stickers, which is a different logo.
  const track = size * (bubble ? 0.02 : 0.03);
  const height = size * LINE;
  // Held to one line, a word with a space in it still breaks at the space and
  // shows only the first half -- ALL CLEAR came out as ALL. So the spaces are
  // made ones a line cannot break at.
  const text = children.replace(/ /g, ' ');

  // Room past the last letter on every copy. Android measures a line of the
  // bubble face narrower than it draws it, by enough at the front page's size
  // that the last letter of LOOP no longer fit the copies laid over the measure
  // and came out as a bare black P. The spare room is the same on every copy,
  // so the letters still land on each other, and it is taken back off below.
  const spare = size * 0.12;

  const base = {
    ...(bubble ? BUBBLE : TYPE.black),
    fontSize: size,
    lineHeight: height,
    letterSpacing: track,
    paddingRight: spare,
  } as const;

  return (
    // The tracking above is added after the last letter too, so the measured
    // box runs a step wider than the word does and a centred wordmark would sit
    // half a step left of true. Taking it back off the right, along with the
    // spare room, is what keeps the two stacked words centred on each other.
    <View style={{ transform: [{ rotate: `${tilt}deg` }], marginRight: -track - spare }}>
      {/* Measures the line and reserves its space; never seen. */}
      <Text {...ONE_LINE} style={[base, { color: 'transparent' }]}>
        {text}
      </Text>

      {bubble ? (
        <>
          {BUBBLE_RING.map(([dx, dy], i) => (
            <Text
              key={`r${i}`}
              {...ONE_LINE}
              style={[
                base,
                styles.layer,
                {
                  color: rim,
                  transform: [{ translateX: dx * halo }, { translateY: dy * halo }],
                },
              ]}>
              {text}
            </Text>
          ))}
          {BUBBLE_RING.map(([dx, dy], i) => (
            <Text
              key={`o${i}`}
              {...ONE_LINE}
              style={[
                base,
                styles.layer,
                {
                  color: edge,
                  transform: [{ translateX: dx * ink }, { translateY: dy * ink }],
                },
              ]}>
              {text}
            </Text>
          ))}
        </>
      ) : (
        RING.map(([dx, dy]) => (
          <Text
            key={`${dx},${dy}`}
            {...ONE_LINE}
            style={[
              base,
              styles.layer,
              {
                color: edge,
                transform: [{ translateX: dx * ink }, { translateY: dy * ink }],
              },
            ]}>
            {text}
          </Text>
        ))
      )}

      {faceBot === undefined ? (
        <Text {...ONE_LINE} style={[base, styles.layer, { color: face }]}>
          {text}
        </Text>
      ) : (
        // Every band is the whole word again, pulled back up by as much as its
        // own window was pushed down, so all twelve copies land in exactly the
        // same place and the only thing that changes down the stack is which
        // slice is showing and what colour it is painted.
        Array.from({ length: SLICES }, (_, i) => {
          const top = (i * height) / SLICES;
          const t = ((i + 0.5) / SLICES - CAP_TOP) / (CAP_BOT - CAP_TOP);
          // Each band reaches a point into the next one, which is drawn over it.
          // Cut edge to edge, the bands round to whole pixels on their own and
          // leave a hairline between some of them, and at a card title's size
          // the dark ring showing through those reads as stripes across the word.
          return (
            <View
              key={`f${i}`}
              style={[styles.layer, { top, height: height / SLICES + 1, overflow: 'hidden' }]}>
              <Text
                {...ONE_LINE}
                style={[
                  base,
                  {
                    marginTop: -top,
                    color: mixHex(face, faceBot, Math.min(1, Math.max(0, t))),
                  },
                ]}>
                {text}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
});

export default React.memo(Sticker);
