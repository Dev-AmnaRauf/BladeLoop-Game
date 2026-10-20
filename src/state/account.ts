/**
 * Who is playing: the account the login screen settled on.
 *
 * Kept apart from `settings` and `progress` for the same reason those two are
 * apart from each other. Progress is what was earned, settings are how the app
 * is liked, and this is who the device is signed in as -- it changes once, on
 * the login screen, and a reset of the other two must not sign anybody out.
 *
 * `provider` is the whole state machine: 'none' means nobody has been past the
 * login screen yet and it is what gets shown, and the other three all mean the
 * player is in. A guest is still a real Firebase account (the anonymous one
 * `services/firebase` opens on its own) -- it is just one that lives and dies
 * with this install.
 */
import { createStore } from './store';

export type Provider = 'none' | 'guest' | 'google' | 'playgames';

export interface Account {
  provider: Provider;
  /** The account's own name, when there is one. Empty for a guest. */
  name: string;
  /** Only Google carries one: Play Games hands out a gamer tag, not an email. */
  email: string;
  /**
   * The Play Games player id, for a player who came in that way. Empty
   * otherwise. Kept because it is the only stable name Play Games gives a
   * player -- the gamer tag beside it is theirs to change whenever they like.
   */
  playerId: string;
  /**
   * True once a Play Games player has been attached to a Firebase account.
   * Kept because that step can fail on its own -- the sign-in worked, the
   * trade did not -- and a false here is what asks for it again next launch.
   */
  linked: boolean;
}

const DEFAULTS: Account = {
  provider: 'none',
  name: '',
  email: '',
  playerId: '',
  linked: false,
};

export const account = createStore<Account>('bladeloop.account.v1', DEFAULTS);

export const getAccount = account.get;
export const useAccount = account.use;

/** True once the player has been past the login screen, either way. */
export function isSignedIn() {
  return getAccount().provider !== 'none';
}

export function signInAsGuest() {
  account.set({
    provider: 'guest',
    name: '',
    email: '',
    playerId: '',
    linked: false,
  });
}

export function signInAsGoogle(name: string, email: string) {
  account.set({ provider: 'google', name, email, playerId: '', linked: false });
}

/**
 * Signed in through Play Games. There is no email to keep -- Play Games shares
 * a gamer tag and a player id with the game and nothing else -- so the row the
 * settings page shows is labelled with the tag.
 */
export function signInAsPlayGames(name: string, playerId: string) {
  account.set({
    provider: 'playgames',
    name,
    email: '',
    playerId,
    linked: false,
  });
}

/** The Play Games player now has a Firebase account behind them. */
export function markLinked() {
  account.set({ linked: true });
}

/**
 * Back to the login screen. The board row the account owns stays put, and so
 * does a Play Games session -- that one belongs to the phone rather than to
 * this app, and v2 of the service has no way to end it. See `PlayGames`.
 */
export function signOut() {
  account.reset();
}
