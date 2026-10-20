/**
 * There is no Play Services under Jest, and the real module reaches for a
 * native module at import time -- so a test that so much as renders the login
 * screen would take the "Google sign-in is not available" path and never
 * exercise the button. This stands in a fake SDK of the shape v16 returns:
 * `signIn` resolves `{ type: 'success', data: { idToken, user } }`, and a test
 * that wants a dismissed picker sets `{ type: 'cancelled' }` instead.
 *
 * Auto-applied, like the async-storage mock next door: a `__mocks__` folder
 * beside `node_modules` replaces a node module in every suite without anyone
 * having to call `jest.mock`.
 */
const user = {
  id: 'mockId',
  email: 'mock@example.com',
  name: 'Mock Player',
  givenName: 'Mock',
  familyName: 'Player',
  photo: null,
};

let next = { type: 'success', data: { idToken: 'mockIdToken', user } };

const GoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(() => Promise.resolve(true)),
  signIn: jest.fn(() => Promise.resolve(next)),
  signOut: jest.fn(() => Promise.resolve(null)),
  revokeAccess: jest.fn(() => Promise.resolve(null)),
  hasPreviousSignIn: jest.fn(() => false),
};

module.exports = {
  GoogleSignin,
  GoogleSigninButton: () => null,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
  /** Test helper: what the next `signIn` resolves with, or an error to throw. */
  __setSignInResult(result) {
    next = result;
    GoogleSignin.signIn.mockImplementation(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    );
  },
};
