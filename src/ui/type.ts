import { Platform, type TextStyle } from 'react-native';

/**
 * The game's type.
 *
 * Every card, pill and label in the UI goes through here rather than spelling
 * a weight at the call site, because the look the cards are after -- the round
 * chunky lettering a casual puzzle game's pop-ups carry -- is a *family*
 * decision, not a weight one. Roboto Black is as close as a stock Android gets
 * to it; the real thing is Poppins.
 *
 * To use the real thing:
 *   1. drop Poppins-SemiBold/Bold/ExtraBold .ttf into `src/assets/fonts`
 *   2. run `npx react-native-asset` (the folder is already declared in
 *      `react-native.config.js`, so this links it into both platforms)
 *   3. flip `POPPINS` below to true
 *
 * Until then the fallbacks are picked per platform so nothing ever renders in
 * a family the phone does not have: an unknown `fontFamily` silently falls
 * back to the system face, which is a *lighter* face, and a card whose heading
 * quietly lost its weight is worse than one that never asked for the family.
 */
const POPPINS = false;

type Face = 'black' | 'bold' | 'semi' | 'medium';

const POPPINS_FACES: Record<Face, string> = {
  black: 'Poppins-ExtraBold',
  bold: 'Poppins-Bold',
  semi: 'Poppins-SemiBold',
  medium: 'Poppins-Medium',
};

/**
 * Android names its stock weights as separate families; iOS takes the system
 * face plus a weight. Both branches are spelled out so neither platform is
 * left asking for a family the other one invented.
 */
const STOCK: Record<Face, TextStyle> = Platform.select({
  android: {
    black: { fontFamily: 'sans-serif-black' },
    bold: { fontFamily: 'sans-serif', fontWeight: '700' as const },
    semi: { fontFamily: 'sans-serif-medium', fontWeight: '600' as const },
    medium: { fontFamily: 'sans-serif-medium' },
  },
  default: {
    black: { fontWeight: '900' as const },
    bold: { fontWeight: '800' as const },
    semi: { fontWeight: '700' as const },
    medium: { fontWeight: '600' as const },
  },
}) as Record<Face, TextStyle>;

/**
 * Every face the UI asks for comes out in the bubble lettering the name is set
 * in: one voice across the whole game, the way the mark reads. Lilita One has
 * a single weight, so the four names below differ in where they are used, not
 * in how heavy they are.
 */
const ALL_BUBBLE = true;

function face(name: Face): TextStyle {
  if (ALL_BUBBLE) return BUBBLE;
  return POPPINS ? { fontFamily: POPPINS_FACES[name] } : STOCK[name];
}

/**
 * The game's name, and nothing else: Lilita One, the round bubble capitals the
 * mark is drawn in. It ships in the build (`src/assets/fonts`, copied into the
 * Android assets and listed in the iOS plist), so unlike Poppins it is never
 * switched off. It has one weight, and asking for another makes iOS go looking
 * for a face the family does not have.
 */
export const BUBBLE: TextStyle = Platform.select({
  ios: { fontFamily: 'LilitaOne', fontWeight: 'normal' as const },
  default: { fontFamily: 'LilitaOne-Regular' },
});

/**
 * The four weights the UI is allowed to use.
 *
 * `black` is for numbers and headings, `bold` for button faces, `semi` for row
 * titles and `medium` for the quiet supporting lines.
 */
export const TYPE = {
  black: face('black'),
  bold: face('bold'),
  semi: face('semi'),
  medium: face('medium'),
} as const;

/**
 * A heading in the pop-up style: chunky, tight, and carrying the soft shadow
 * that lifts it off a coloured card. `color` is the face; the shadow is always
 * a darkening of the card behind it, passed in by the caller.
 */
export function heading(size: number, color: string, shadow?: string): TextStyle {
  return {
    ...TYPE.black,
    fontSize: size,
    color,
    letterSpacing: -0.5,
    ...(shadow
      ? {
          textShadowColor: shadow,
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 0,
        }
      : null),
  };
}
