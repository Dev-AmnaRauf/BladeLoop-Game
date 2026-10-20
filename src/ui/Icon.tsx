import React from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons/static';
import { COLORS } from './theme';

/**
 * Every icon the game draws, named for what it does rather than what it looks
 * like.
 *
 * These used to be emoji in `Text`, which each platform -- and each Android
 * skin -- drew in its own house style: a colour trophy on one phone, a flat
 * grey one on the next, and a couple (the bin, the megaphone) missing outright
 * on older systems and coming out as a blank box. They are one font now, so a
 * button looks the same everywhere and takes the game's ink colour like the
 * rest of the artwork.
 *
 * Going through a map rather than spelling glyph names at the call sites means
 * the whole set can be re-pointed at a different family in one place, and a
 * typo is a type error instead of a blank square at runtime.
 */
const GLYPHS = {
  leaderboard: 'trophy',
  /** The badge the first three rows of the board wear. */
  podium: 'trophy-variant',
  settings: 'cog',
  share: 'share-variant',
  rate: 'star-circle-outline',
  reset: 'trash-can-outline',
  soundOn: 'volume-high',
  soundOff: 'volume-off',
  /** The background loop, which is its own switch on the settings page. */
  music: 'music-note',
  /** The buzz on a death, a pickup and a button. */
  vibrate: 'vibrate',
  /** The row that opens the privacy policy in a browser. */
  privacy: 'shield-check',
  /** The mark on the right of a settings row that leads somewhere else. */
  chevron: 'chevron-right',
  /** The level stars, and nothing else: this is progress, not money. */
  star: 'star',
  /** The currency: gems are what runs pay out and what a revive costs. */
  gem: 'diamond-stone',
  /** On to the next level. */
  next: 'arrow-right-bold',
  close: 'close',
  back: 'chevron-left',
  pause: 'pause',
  google: 'google',
  /** The Play Games door on the login screen, which wears a pad for a mark. */
  playGames: 'controller',
  /** The guest button: play without an account of any kind. */
  guest: 'account-circle-outline',
  /** The settings row that hands the game back to the login screen. */
  signOut: 'logout',
  play: 'play',
  /** The face a failed run wears on its card. */
  heartBroken: 'heart-broken',
  /** A cleared level. */
  crown: 'crown',
  /** The checkpoint a revive buys back. */
  flag: 'flag-variant',
  /** Picks the same run back up from where it ended. */
  retry: 'refresh',
  /** Throws the run away and opens a fresh one. */
  home: 'home-variant',
  /** A level the map has behind it, and one it has not reached yet. */
  check: 'check-bold',
  lock: 'lock',
} as const;

export type IconName = keyof typeof GLYPHS;

function Icon({
  name,
  size = 20,
  color = COLORS.ink,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialDesignIcons name={GLYPHS[name]} size={size} color={color} style={style} />;
}

export default React.memo(Icon);
