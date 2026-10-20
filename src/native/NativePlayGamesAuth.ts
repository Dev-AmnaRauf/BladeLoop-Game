import { NativeModules } from 'react-native';

/**
 * The Play Games server auth code, which is what Firebase takes in exchange
 * for an account. `react-native-google-play-games` signs the player in but has
 * no way to ask for this, so the app carries its own module for it -- see
 * `android/app/src/main/java/com/bladeloop/game/PlayGamesAuthModule.kt`.
 *
 * A plain `NativeModules` lookup for the reason `NativeOrientation` gives.
 * Undefined on iOS and in a test, which `PlayGames` reads as "the board stays
 * on the anonymous account".
 */
export interface PlayGamesAuth {
  /** A one-use code for the given web OAuth client id. */
  requestServerAuthCode(serverClientId: string): Promise<string>;
  /** A line in logcat under `BladeLoopAuth`: the one JS log this phone shows. */
  log(message: string): void;
}

const NativePlayGamesAuth: PlayGamesAuth | undefined = (
  NativeModules as { NativePlayGamesAuth?: PlayGamesAuth }
).NativePlayGamesAuth;

export default NativePlayGamesAuth;
