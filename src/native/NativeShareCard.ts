import { NativeModules } from 'react-native';

/**
 * A score shared as a picture: the Android half draws a card (the run on
 * screen, the score, the rank, the link) and hands it to the share sheet with
 * the message beside it. See
 * `android/app/src/main/java/com/bladeloop/game/ShareCardModule.kt`.
 *
 * A plain `NativeModules` lookup for the reason `NativeOrientation` gives.
 * Undefined on iOS and in a test, which `Sharing` reads as "share the text".
 */
export interface ShareCardOptions {
  /** The text sent with the card, link included. */
  message: string;
  title: string;
  score: number;
  /** 0 for no rank. */
  rank: number;
  /** Printed along the card's foot. */
  link: string;
  /** Put what is on screen on the card -- true from a run. */
  snapshot: boolean;
}

export interface ShareCard {
  /** Resolves once the sheet is open. */
  share(options: ShareCardOptions): Promise<boolean>;
}

const NativeShareCard: ShareCard | undefined = (
  NativeModules as { NativeShareCard?: ShareCard }
).NativeShareCard;

export default NativeShareCard;
