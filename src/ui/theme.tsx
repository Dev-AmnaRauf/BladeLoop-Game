import React, { createContext, useContext } from 'react';
import type { WorldId } from '../game/worlds';

/** The colours every world shape reads. The level fades between two of these. */
export interface Theme {
  bg: string;
  /**
   * The two ends of the ground the corridor is actually painted on.
   *
   * `bg` is a flat colour and stays one: it is the page every still screen
   * stands on, and it is the hole punched through a saw's core and a console's
   * face. The corridor itself is a gradient between these two -- the water it
   * is flown down, a deep periwinkle up where the surface still reaches,
   * easing into a lilac-plum below -- because a whole screen of one flat value
   * is the one part of this look that read as cheap. Nothing is drawn
   * differently for it; only the room is.
   *
   * Both ends are deliberately *lighter* than `bg`, and by only a few points
   * of value. Lighter keeps the two shapes that fill with `bg` reading as
   * holes punched through the ground rather than as discs glued onto it: a
   * hole is darker than what surrounds it at every height on the screen. A few
   * points keeps the gradient a change of *hue* rather than of light, so a
   * hurdle at the bottom is exactly as legible as the same hurdle at the top.
   * That was the whole complaint against the daylight wash the run used to be
   * drawn over, and a gradient of the game's own night would earn it straight
   * back if it ran bright.
   */
  bgTop: string;
  bgBot: string;
  /** A lifted surface on that ground: a HUD chip, a pickup, a floating pop. */
  card: string;
  ink: string;
  pole: string;
  poleBack: string;
  ring: string;
  /**
   * The lethal furniture -- frames, brackets, the big wheels, the body of a
   * turret -- and the dark outline every piece of it is drawn over. Not the
   * hexagon: that one is a cage nothing collides with, so it is drawn in
   * `pole` with the rails.
   *
   * Separate from `pole` on purpose. A rod is a rail: the ball can lie against
   * it all day. The furniture bolted around it ends the run on contact, and
   * the two were once the same lit violet, on a ground that was itself violet.
   * So the rule is warm kills, cool does not.
   *
   * It is the blade's own hue now, a step deeper and heavier, rather than the
   * orange it was. Orange was a second warm hue spent telling apart two things
   * that do the identical thing to the player, and on the dark ground it came
   * out the loudest colour in the game -- louder than the saws carrying the
   * same meaning, and louder than the ball. Big slow furniture and small fast
   * blades are one family now, told apart by weight and silhouette, which is
   * what they were always actually told apart by.
   */
  hazard: string;
  hazardEdge: string;
  blade: string;
  bladeDark: string;
  bladeCore: string;
  live: string;
  gold: string;
  /**
   * The ball's own nine. `ballBody` is the middle of the sphere and the two
   * sweeps are the light raked across it: `ballCool` up the top-left corner,
   * `ballWarm` down the bottom-right. `ballDeep` is the rim and the shade
   * under it, and the shine and the ink of a pupil follow. The last three
   * are the character rather than the sphere: the iris that pupil sits in, the
   * pink of a cheek and of the tongue, and the pale lilac of an ear's bulb.
   */
  ballBody: string;
  ballCool: string;
  ballWarm: string;
  ballDeep: string;
  ballShine: string;
  ballEye: string;
  ballIris: string;
  ballBlush: string;
}

/**
 * The two grounds, named once because more than one thing has to be them.
 *
 * A saw's core and the face of a console are holes punched through the shape,
 * so they take whatever the room is. They used to be near-misses of it typed
 * out by hand, which was fine only while the room never moved.
 */
const NIGHT_BG = '#0C0A1C';
const DEEP_BG = '#180A20';

/**
 * The palette the run spends almost all of its time in: deep space.
 *
 * The game has been played on a pale page and in an indigo night before this,
 * and the trouble with the page was never that it was bright -- it was that a
 * neon edge has nothing to glow out of. Everything the player is actually
 * reading here is lit: the ball, the blades, a star, the road on the map. Lit
 * things need a dark room, and this is it.
 *
 * Nothing in here is a pure black or a pure white, for the same reason nothing
 * ever was. Flat black has no air in it and takes the life out of the very
 * edges this look is made of. But the ground had far more than air in it: it
 * was a saturated violet, and so are the rods, and so is the ball. Everything
 * the player was meant to read was being read against its own hue. On the
 * device the ball -- the one object being steered -- was the least legible
 * thing on the screen, behind every hazard, the rods, and the score.
 *
 * So the room gives up its chroma. It keeps a few points of violet, enough to
 * stay a night rather than a void, and every bit of saturation that used to be
 * spread across the ground is now spent on the handful of things the player is
 * actually reading. That is the whole of what "premium" means here: one light,
 * a near-neutral room, and colour only where it carries meaning.
 *
 * The rods are lit off that ground rather than inked onto it, and they are
 * quieter than they were -- a rail is safe to touch, so it has no business
 * being the brightest furniture in the corridor.
 */
export const NIGHT: Theme = {
  bg: NIGHT_BG,
  // Water, and it is the game's own daylight seen from under it. The front
  // page, the door and the road all stand in `SKY` -- a periwinkle that warms
  // through lilac into rose -- so the run is that same light, at the depth the
  // light has reached by the time it gets down here: a deep periwinkle
  // overhead easing into a lilac-plum below. One family above the surface and
  // below it, which is what the run being a different colour to every other
  // screen in the game had been getting wrong.
  //
  // Deep is not optional. The ball rides at `CAM_ANCHOR`, a third of the way
  // down, so most of a run is read against the top half of this, and the
  // player is reading a violet ball and a pink-red hazard against it. Taking
  // `SKY` itself down here at its own value is the daylight wash of stage 1
  // over again -- same hue as the ball, and a hurdle that fades out the nearer
  // it comes. So: the hue of the day, the value of a night. The two ends stay
  // a few points of value apart and most of a hue apart, never the reverse.
  bgTop: '#221C4C',
  bgBot: '#2E2248',
  card: '#1A1630',
  ink: '#F3EEFF',
  pole: '#4C4780',
  poleBack: '#2A2750',
  ring: '#322E58',
  hazard: '#E8365C',
  hazardEdge: '#4A0A1E',
  blade: '#FF4D6D',
  bladeDark: '#C21B4B',
  // The core of a saw reads as a hole punched through it, so it *is* the
  // ground rather than a colour that resembles it.
  bladeCore: NIGHT_BG,
  live: '#2BE0A8',
  gold: '#FFC93C',
  ballBody: '#7A4BFF',
  ballCool: '#38E0FF',
  ballWarm: '#C64BFF',
  ballDeep: '#3B1C9E',
  ballShine: '#FFFFFF',
  ballEye: '#231A52',
  ballIris: '#6B3FD6',
  ballBlush: '#FF8FCF',
};

/**
 * The stretch near the end of a level.
 *
 * Both palettes are dark, so the change is a *hue* rather than a value: the
 * indigo warms through to the magenta end of the nebula, the rods and the ink
 * go with it, and the ground picks up the rose the dish at the bottom is
 * painted in. Nothing about the run gets harder to see for it -- but the
 * player can tell at a glance that the corridor is not the one they started
 * in, which is the whole job this palette has.
 *
 * The ball does not follow. It is the one thing on screen being tracked, and a
 * ball that changed colour under the player would read as a different object.
 */
export const DEEP: Theme = {
  bg: DEEP_BG,
  // The same water, further down. The closing stretch of a level is deeper
  // than its opening, so less of the day reaches it -- the periwinkle gives up
  // most of what it had left and the floor turns toward the plum the rest of
  // this palette turns toward. The gap between the two ends stays the small
  // one it is above: depth changes the whole room, never the contrast between
  // the top of a screen and the bottom of it.
  bgTop: '#1B1440',
  bgBot: '#2B1940',
  card: '#261730',
  ink: '#FFEAF9',
  pole: '#5A4778',
  poleBack: '#332748',
  ring: '#3C2E50',
  // Warmer again with the ground, so it stays the same distance off it.
  hazard: '#F03A5A',
  hazardEdge: '#500A1A',
  blade: '#FF3D63',
  bladeDark: '#AE1140',
  bladeCore: DEEP_BG,
  live: '#17D39B',
  gold: '#FFB524',
  ballBody: '#7A4BFF',
  ballCool: '#38E0FF',
  ballWarm: '#C64BFF',
  ballDeep: '#3B1C9E',
  ballShine: '#FFFFFF',
  ballEye: '#231A52',
  ballIris: '#6B3FD6',
  ballBlush: '#FF8FCF',
};

/**
 * The cloud world behind every page.
 *
 * It lived inside `Backdrop.tsx` and so was the third palette in the game,
 * outside both of the other two and fading with neither. It is here now for
 * the same reason `COLORS` is: there is one place a colour is written down.
 *
 * Two hues are deliberately kept out of it -- the blade's pink-red and the
 * ball's violet-cyan gradient. A cloud must never be mistaken for the one
 * thing that can end the run, or for the thing the player is steering, and a
 * merely paler version of either is not far enough away.
 */
export const SKY = {
  /**
   * The gradient, top of the screen down: a periwinkle high up that warms
   * through lilac into the rose the cloud banks sit in. Nothing in it is a
   * pure white, for the same reason nothing in the old night sky was a pure
   * black -- a flat white has no air in it and takes the softness out of the
   * very clouds this look is made of.
   */
  stops: [
    { at: 0.0, c: '#6F5AD8' },
    { at: 0.14, c: '#8A73E6' },
    { at: 0.32, c: '#A98FEC' },
    { at: 0.5, c: '#C4A9EC' },
    { at: 0.68, c: '#DCBFEA' },
    { at: 0.85, c: '#EDD4EC' },
    { at: 1.0, c: '#F8E6F0' },
  ] as { at: number; c: string }[],
  /** The three cloud values: the far bank, the middle one, the near one. */
  cloudFar: '#B9A2EC',
  cloudMid: '#E3CDF2',
  cloudNear: '#FBF0F8',
  /** A floating island: grass, its shaded underside, and the rock below. */
  grass: '#7FD59A',
  grassDark: '#4FB177',
  bush: '#3F9E68',
  rock: '#8F6FD0',
  rockDark: '#6B4CB0',
  /** The creatures. Two bodies, so a crowd never reads as one repeated toy. */
  mint: '#86DDA0',
  lilac: '#C79BEE',
  /** Their faces. The eye is off-black violet -- the world has no true black. */
  eye: '#3A2270',
  blush: 'rgba(255,140,190,0.45)',
  white: '#FFFFFF',
  /** The shaded half of anything round. Never grey -- the light here is warm. */
  shade: 'rgba(120,86,190,0.22)',
};

/**
 * The water the corridor is flown down.
 *
 * The run is under the surface now: the ground deepens toward the floor, light
 * comes down through the surface in shafts, and bubbles and plankton rise past
 * the ball. `bgTop`/`bgBot` on the two world palettes are the water itself;
 * everything here is what is *in* it, and it is all drawn by `Water.tsx`.
 *
 * It is the same light the rest of the game stands in. `SKY` is the day above
 * the surface -- the front page, the door, the road, the board -- and this is
 * that day from underneath, which is why every value here comes off the pale
 * end of that gradient rather than out of a second palette. One family above
 * the water and below it.
 *
 * Two things are kept out of it. Nothing here is warm: gold means "fly into
 * this" and the blade's pink-red means "this ends the run", and a bubble
 * catching a gold glint the way a real one would is a bubble a player reaches
 * for. Real bubbles are iridescent; these are not, and that is the trade. And
 * nothing here carries the ball's chroma: these are pale, near-white films at
 * a low alpha, not lit violet, so a bubble can never be read as the thing the
 * player is steering.
 */
export const WATER = {
  /**
   * The lit surface overhead, and the shafts of light coming down from it.
   *
   * This is `SKY`'s own light rather than a second one: the pale end of that
   * gradient, which is the rose-white the front page's near cloud bank is
   * drawn in. The day is above the surface and the run is under it, so the
   * light down here has to be the light up there.
   */
  surface: '#EBDCF7',
  ray: '#D9C6F2',
  /** A bubble: its film, the light on its rim, and the shine on its cheek. */
  film: 'rgba(226,210,250,0.16)',
  rim: '#EADDFB',
  sheen: '#FFFFFF',
  /** Plankton and the glitter hanging in the beams. */
  spark: '#DCCBF6',
};

/**
 * What each world has drifting behind its corridor -- see `Scenery`.
 *
 * The same two exclusions as the water: no blade red and no coin gold at any
 * strength a player could mistake, and nothing at the ball's violet. The lava
 * embers are the nearest call, and they are an orange held small and dim
 * enough never to read as a coin.
 */
export const SCENERY = {
  nature: {
    far: '#9BE8B0',
    hill: '#1F4A2C',
    trunk: '#2A3F22',
    leaf: '#2F6B3E',
    mote: '#B8F5C4',
  },
  candy: {
    far: '#FFD1EC',
    stick: '#F4E9F4',
    pop: ['#7FE6D2', '#9CC8FF', '#FFB3DA', '#C7F28F'],
    drop: '#5AD6C4',
    mote: '#FFFFFF',
  },
  frozen: {
    far: '#7CF2D8',
    peak: '#2C5878',
    peakLit: '#8CC6E8',
    mote: '#FFFFFF',
  },
  lava: { far: '#FF5A1F', rock: '#2A0D08', glow: '#FF6A2A', mote: '#FF8A3D' },
  neon: {
    far: '#FF4FD8',
    tower: '#0E1430',
    edge: ['#38E0FF', '#FF4FD8', '#7CFFB2'],
    mote: '#9BE9FF',
  },
  moon: {
    ground: '#3A3E4E',
    crater: '#262935',
    earth: '#3E8BE0',
    land: '#5BC98A',
    mote: '#E4E8F5',
  },
  galaxy: {
    nebula: ['#6A3BFF', '#FF4FD8', '#2F8BFF'],
    planet: '#E08BFF',
    ring: '#FFD9F5',
    rock: '#3A3358',
    mote: '#FFFFFF',
  },
};

/**
 * The pill each world's name is lettered on at its gate on the road. Bright
 * and light, because the road is the pastel day and the name is dark ink.
 */
export const WORLD_SIGN: Record<WorldId, string> = {
  nature: '#9EE6A8',
  candy: '#FFB8DE',
  frozen: '#A9DDF7',
  lava: '#FFB27A',
  neon: '#8CEBFF',
  moon: '#D5D9E6',
  galaxy: '#C9B3FF',
};

/**
 * The screen palette: everything that is not a shape in the corridor.
 *
 * Three families, and they are not interchangeable.
 *
 * The first is the game's own ground and ink. It is not a second opinion
 * about them -- every token here that a world shape also uses is *read off*
 * `NIGHT` rather than typed again, which is the whole reason this moved. It
 * used to live in `game/config.ts`, a file the simulation never read a colour
 * out of, with its own copy of `bg`, `pole`, `blade`, `hazard`, `gold` and a
 * dozen more sitting a directory away from this one's copy. Two copies of a
 * colour are two colours the moment somebody edits one.
 *
 * The second is the sweet shop the pop-up cards are painted out of. Those are
 * the loudest thing on screen either way, and none of it changed when the
 * ground went dark -- a candy card over a dimmed page reads the same over a
 * night sky as it did over a morning one.
 *
 * The third is the quiet scale -- `panel`, `line`, `muted` -- which on a dark
 * ground runs *upward* in lightness from the page in violet rather than grey:
 * a panel is a lifted indigo surface, and the hairline between two of them is
 * a brighter violet rather than a darker one.
 *
 * Nothing here is a pure black. Flat black space has no air in it and kills a
 * neon edge stone dead; a ground with a few points of violet left in it is
 * what lets the ball's gradient and a blade's red glow out of the same night.
 * Only a few points, though -- see `NIGHT` for why the ground had to give the
 * rest of them up.
 */
export const COLORS = {
  // --- read off the world palette, never typed twice ----------------------
  /** Page and world ground: deep space indigo, never a flat black. */
  bg: NIGHT.bg,
  /** A surface lifted off that page: a card, a row, a chip, a well. */
  panel: NIGHT.card,
  /** Everything written and drawn on the page: a pale violet, never white. */
  ink: NIGHT.ink,
  /** The corridor rods, and the shaded face behind them. */
  pole: NIGHT.pole,
  poleBack: NIGHT.poleBack,
  ring: NIGHT.ring,
  ballShine: NIGHT.ballShine,
  /** The lethal furniture, over the dark edge it is outlined with. */
  hazard: NIGHT.hazard,
  hazardEdge: NIGHT.hazardEdge,
  blade: NIGHT.blade,
  bladeDark: NIGHT.bladeDark,
  /** The hole punched through a saw, so it takes the ground's own colour. */
  bladeCore: NIGHT.bladeCore,
  live: NIGHT.live,
  gold: NIGHT.gold,
  /** The gradient the ball and everything branded after it are painted in. */
  gradA: NIGHT.ballCool,
  gradB: NIGHT.ballBody,
  gradC: NIGHT.ballWarm,
  /**
   * The dark edge under anything painted in that gradient -- the stickers on
   * the front page, the door and the loading screen all sit on it. It is the
   * ball's own rim, and it was typed out by hand in three separate files
   * before it had a name.
   */
  gradEdge: NIGHT.ballDeep,

  // --- its own ------------------------------------------------------------
  /**
   * Ink for the other case: a glyph or a label sitting on a *pale* surface --
   * the white `cool` button, the gold mute chip -- which on this ground are
   * the only light things a mark ever lands on.
   *
   * It matches `bladeCore` today and is deliberately not derived from it: one
   * is a mark on a pale button, the other is a hole that takes whatever the
   * ground happens to be, and the ground is due to change.
   */
  inkOnLight: '#1B0E3F',
  ringSoft: '#262244',
  mint: '#BFF5DA',
  teal: '#2BE0C8',
  /** The same case again, on the one surface painted in `teal`. */
  inkOnTeal: '#0A5745',

  // --- the map ------------------------------------------------------------
  /**
   * The road between the levels is read in daylight, like every page outside
   * the corridor. It is the one screen that is about the whole game instead of
   * one run, and it is the screen a player comes back to between every level,
   * so it is the one that opens rather than closes.
   *
   * It used to be a flat lavender of its very own -- not the sky the splash
   * and the door are drawn on, not the night the run is, a third ground that
   * existed on exactly one screen. It is the shared sky's own mid-value now,
   * and the road and its weather are read off `SKY` rather than restated, so
   * the map cannot drift away from the pages either side of it again.
   */
  mapSky: SKY.stops[2].c,
  /**
   * The wide pale band the road is drawn as, and the lighter lane down the
   * middle of it. Both are flat tints of the page's own lavender rather than a
   * white laid over it at part opacity: the road is drawn as a string of
   * overlapping pieces, and part-opaque pieces would stack into a brighter
   * patch everywhere two of them meet.
   */
  mapRoad: mixHex(SKY.stops[2].c, SKY.cloudNear, 0.22),
  mapLane: mixHex(SKY.stops[2].c, SKY.cloudNear, 0.38),
  /**
   * The weather over the road: the same three cloud values the sky behind
   * every other page uses, and the specks of light between them.
   */
  mapCloud: SKY.cloudFar,
  mapCloudHi: SKY.cloudMid,
  mapSpark: SKY.cloudNear,
  /**
   * The beads, in the same language the corridor speaks.
   *
   * A cleared level was magenta, the stop the player is aimed at wore a green
   * ring, and a level not yet reached was `#9EA2B8` -- a true slate grey, and
   * the only grey anywhere in this game. Three hues that appeared on no other
   * screen, saying things the corridor already has colours for. So a cleared
   * level is mint and the one to play is ringed in gold, which is what mint
   * and gold mean everywhere else: something won, something to go and get.
   */
  nodeDone: NIGHT.live,
  nodeDoneEdge: '#10855F',
  /** Not reached yet: the same bead, drained down into the page's own violet. */
  nodeLock: '#8A83AD',
  nodeLockEdge: '#665F87',
  /** The pale disc the padlock on a locked bead is drawn in. */
  nodeLockFace: '#E6E2F2',
  /** The ring round the stop the play button is aimed at. */
  nodeLive: NIGHT.gold,
  /** The last level, which the road crowns. */
  bossRim: NIGHT.gold,
  /** A star the level has but the player has not picked up yet. */
  starOff: 'rgba(56,30,102,0.35)',
  /** The dark edge every star on the road -- and every gold sticker -- sits on. */
  starEdge: '#8A4A05',

  // --- the pop-up cards ---------------------------------------------------
  /**
   * The scrim a card sits on. It is the ground's own indigo taken darker
   * rather than a black, so dimming the run reads as the sky closing over it
   * rather than as soot laid on top.
   */
  dim: 'rgba(8,4,26,0.78)',
  shade: 'rgba(8,4,26,0.5)',
  /**
   * Night laid over the pastel sky.
   *
   * The world behind every page is the same cloud world the run is played in,
   * and two of the pages -- the settings list and the board -- want a dark,
   * quiet ground with pale type on it instead. They get it by drawing dusk
   * over the sky rather than by leaving the sky out: the player can still make
   * out a cloud bank and a creature or two down at the bottom, so the page
   * still reads as somewhere in this game rather than as a panel of navy that
   * arrived from a different one.
   */
  night: 'rgba(16,9,44,0.88)',
  /**
   * Ink for the third case: type set straight onto the pastel sky -- the front
   * page's hint line, the star count, the sign-in door's lead. The sky is
   * light, so these are the dark end of its own violet rather than the pale
   * violet everything on the night ground is written in.
   */
  skyInk: '#3B2470',
  skyInkSoft: 'rgba(59,36,112,0.72)',
  /**
   * A failed run: raspberry, and named for the card rather than for being the
   * default one. Warm is simply what a failure should be, and it borrows the
   * blade's own hue, since the blade is what ended the run.
   */
  failRim: '#FFC0D4',
  failFace: '#F0537D',
  failWell: '#AE1B4C',
  failEdge: '#75092F',
  /** The other two card hues: a cleared level and a paused one. */
  clearRim: '#A8F0CE',
  clearFace: '#3FCB92',
  clearWell: '#1F7F63',
  clearEdge: '#125C48',
  pauseRim: '#D8C0FF',
  pauseFace: '#9C7BF0',
  pauseWell: '#5E3FAF',
  pauseEdge: '#42287F',
  /** Button faces, each over its own darker under-edge. */
  goFace: '#5FD06A',
  goEdge: '#37953F',
  warmFace: '#FFB23F',
  warmEdge: '#C97B10',
  coolFace: '#FFFFFF',
  coolEdge: '#C7D2E8',
  /** The sign-in pill, which is a blue the way every game's login pill is. */
  blueFace: '#3E8BF0',
  blueEdge: '#1F5FB8',
  /** The one destructive button, in the blade's own red. */
  dangerFace: NIGHT.blade,
  dangerEdge: '#C1123F',
  /** Text on a coloured card: the bright face and the quiet supporting one. */
  onCard: '#FFFFFF',
  onCardSoft: 'rgba(255,255,255,0.78)',

  // --- the quiet scale, named for the job rather than the value ------------
  /** Kickers, hints, the second line of a row. */
  muted: '#A79EDA',
  /** Fainter still: a placeholder, an empty list. */
  faint: '#7A70B0',
  /** Hairlines and the outline of anything that is not solid -- the same
      stroke the world's faint rings are drawn in. */
  line: NIGHT.ring,
  /** Body copy that is not a heading. */
  body: '#CFC6F5',
  /** Row tints on the page: a run of the player's own, and a podium place. */
  rowMine: '#12503E',
  rowMedal: '#4A3510',
  /** The bright text those two tints are read with. */
  onMine: '#5FE8B8',
  onMedal: NIGHT.gold,
};

/**
 * The wordmark's own colours, read straight off the mark.
 *
 * These are kept out of `COLORS` on purpose. Everything in that table is a
 * role -- "the thing that can kill you", "type on a pale surface" -- and it is
 * free to move when the palette moves. A logo is not a role. It is one fixed
 * piece of artwork that has to come out the same on the front page, the door
 * and the loading screen, and it stays the same whatever the sky behind it is
 * doing, so it is written down once, here, as itself.
 *
 * Both words are painted as a ramp rather than flat: the mark's letters are
 * lit from above, and a flat fill is the one thing that gives a stacked-text
 * wordmark away as text. See `Sticker`.
 */
export const MARK = {
  /** BLADE: gold at the top of the letter, amber at its foot. */
  bladeTop: '#FFD400',
  bladeBot: '#FF9400',
  /** LOOP: orchid at the top, deep violet at its foot. */
  loopTop: '#D63FF2',
  loopBot: '#8A0AF0',
  /** The dark ring both words are outlined in. */
  edge: '#5A0BB0',
  /** The band round the outside of the pair: white, with the sky's warmth. */
  band: '#FFF3FF',
  /** The loop the game is named after: a sand-gold hoop behind the words. */
  ring: '#E9BD83',
} as const;

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c: number[]) {
  return `#${c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Blend two hexes. The tail is drawn along one, so it is worth having. */
export function mixHex(a: string, b: string, t: number) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t));
}

const KEYS = Object.keys(NIGHT) as (keyof Theme)[];

/**
 * The room each world is flown in: its ground, its rails and the rings
 * behind its blades. Only the room -- the blades stay the blade's red, the
 * ball its violet and a coin its gold in every world, because those three are
 * what the player reads, and a hazard that changed colour with the scenery
 * would be a hazard nobody recognised.
 *
 * Every ground is a night of its own hue, dark enough that the red and the
 * violet still glow out of it; the scenery drawn over it by `Scenery` is where
 * a world gets to be bright.
 */
type Room = Pick<
  Theme,
  'bg' | 'bgTop' | 'bgBot' | 'card' | 'pole' | 'poleBack' | 'ring'
>;

const ROOMS: Record<WorldId, Room> = {
  nature: {
    bg: '#08170F',
    bgTop: '#123421',
    bgBot: '#1D3B22',
    card: '#122619',
    pole: '#4E7C58',
    poleBack: '#224229',
    ring: '#2A4A31',
  },
  candy: {
    bg: '#1C0B22',
    bgTop: '#3A1745',
    bgBot: '#16374A',
    card: '#2A1331',
    pole: '#8C5AA0',
    poleBack: '#4A2756',
    ring: '#4B2C5A',
  },
  frozen: {
    bg: '#07172A',
    bgTop: '#12314C',
    bgBot: '#1D445C',
    card: '#10243A',
    pole: '#6B9EC0',
    poleBack: '#25496A',
    ring: '#244866',
  },
  lava: {
    bg: '#140604',
    bgTop: '#2B0F0B',
    bgBot: '#43180C',
    card: '#24100C',
    pole: '#7C4B3A',
    poleBack: '#3F1F16',
    ring: '#4A2419',
  },
  neon: {
    bg: '#060513',
    bgTop: '#170C33',
    bgBot: '#0A1B36',
    card: '#120E28',
    pole: '#2F7090',
    poleBack: '#19304C',
    ring: '#1F3B5A',
  },
  moon: {
    bg: '#0C0D14',
    bgTop: '#1C1F2B',
    bgBot: '#2B2E3A',
    card: '#181A24',
    pole: '#6C7188',
    poleBack: '#33374B',
    ring: '#3A3E52',
  },
  galaxy: {
    bg: NIGHT_BG,
    bgTop: '#1B1552',
    bgBot: '#3A1552',
    card: '#1A1434',
    pole: '#5B4D9C',
    poleBack: '#2A2459',
    ring: '#342A6C',
  },
};

/** How far a world's room turns toward `DEEP` for a level's closing stretch. */
const ROOM_DEEPEN = 0.4;

function blend(a: Theme, b: Theme, t: number): Theme {
  const out = {} as Theme;
  for (const k of KEYS) {
    const x = hexToRgb(a[k]);
    const y = hexToRgb(b[k]);
    out[k] = toHex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t));
  }
  return out;
}

/** A world's two palettes, the opening and the closing stretch, built once. */
const worldPalettes = new Map<WorldId, [Theme, Theme]>();

function palettesOf(world: WorldId): [Theme, Theme] {
  const known = worldPalettes.get(world);
  if (known) return known;
  const room = ROOMS[world];
  const open: Theme = { ...NIGHT, ...room, bladeCore: room.bg };
  // The closing stretch is the same room further on: pulled a share of the
  // way toward the night the default closing palette is, so every world
  // visibly turns before its dish while staying itself.
  const deepRoom = blend(open, DEEP, ROOM_DEEPEN);
  const close: Theme = {
    ...DEEP,
    ...pickRoom(deepRoom),
    bladeCore: deepRoom.bg,
  };
  const pair: [Theme, Theme] = [open, close];
  worldPalettes.set(world, pair);
  return pair;
}

function pickRoom(t: Theme): Room {
  const { bg, bgTop, bgBot, card, pole, poleBack, ring } = t;
  return { bg, bgTop, bgBot, card, pole, poleBack, ring };
}

/**
 * Blend the two palettes so the turn into the closing stretch is a fade. With
 * a `world`, they are that world's two.
 */
export function mixTheme(t: number, world?: WorldId): Theme {
  const [open, close] = world ? palettesOf(world) : [NIGHT, DEEP];
  if (t <= 0.001) return open;
  if (t >= 0.999) return close;
  return blend(open, close, t);
}

const ThemeContext = createContext<Theme>(NIGHT);

export function ThemeProvider({
  value,
  children,
}: {
  value: Theme;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
