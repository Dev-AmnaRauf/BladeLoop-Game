/**
 * Sharing a score, and the one outbound link the settings screen still has.
 *
 * React Native's own `Share` opens the platform sheet, so there is no extra
 * dependency here -- and it is the sheet people already know, which is worth
 * more than a custom one. On Android the score also goes as a picture: the
 * app's own `NativeShareCard` draws a card and opens the same sheet with it.
 */
import { Linking, Share } from 'react-native';
import NativeShareCard from '../native/NativeShareCard';
import * as Analytics from './Analytics';
import { PRIVACY_URL, shareUrl, storeUrl } from './links';

/** What the player sends. Their score first: that is the part worth reading. */
function message(score: number, rank: number) {
  const lines = [
    score > 0
      ? `I threaded ${score} in BladeLoop.`
      : 'BladeLoop -- tap to fly, dodge the blades.',
  ];
  if (rank > 0) lines.push(`Ranked #${rank} in the world.`);
  lines.push('Beat it:');
  return lines.join(' ');
}

/**
 * Open the share sheet. Resolves to whether the player actually sent it, which
 * the caller can use to say thanks (and which is the number worth reporting --
 * how many people opened the sheet is not the same as how many shared).
 */
export async function shareScore(score: number, rank = 0, from = 'settings') {
  const url = shareUrl();
  if (NativeShareCard) {
    // A picture as well as the words. From a run the card carries the screen
    // the player is on; from a page there is no run to show.
    try {
      const sent = await NativeShareCard.share({
        message: `${message(score, rank)} ${url}`,
        title: 'BladeLoop',
        score,
        rank,
        link: url,
        snapshot: from === 'card',
      });
      Analytics.track('share', { from, score, sent, target: 'card' });
      return sent;
    } catch {
      // Fall through to the text-only sheet rather than share nothing.
    }
  }
  try {
    const result = await Share.share(
      // Android has no separate url field, so it goes in the message there.
      { message: `${message(score, rank)} ${url}`, url, title: 'BladeLoop' },
    );
    const sent = result.action === Share.sharedAction;
    Analytics.track('share', { from, score, sent, target: result.activityType ?? 'unknown' });
    return sent;
  } catch {
    // The player dismissed it, or no app can handle it.
    Analytics.track('share', { from, score, sent: false, target: 'failed' });
    return false;
  }
}

/** Best-effort `Linking.openURL`, with the fallback the market scheme needs. */
async function open(url: string, fallback?: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    if (!fallback) return false;
    try {
      await Linking.openURL(fallback);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Send the player to the store listing. On Android the `market://` scheme
 * opens the Play app directly; a device without it (an emulator, or a sideload)
 * falls back to the web listing.
 */
export async function rate() {
  Analytics.track('rate', {});
  return open(storeUrl(), shareUrl());
}

/**
 * Open the privacy policy in a browser.
 *
 * Both stores want one reachable from inside the app for anything that carries
 * analytics, and this game does -- so it is a row on the
 * settings page rather than a line in a store listing nobody opens.
 */
export async function privacy() {
  Analytics.track('privacy_open', {});
  return open(PRIVACY_URL);
}
