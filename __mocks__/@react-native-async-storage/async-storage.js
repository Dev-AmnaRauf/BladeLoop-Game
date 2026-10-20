/**
 * There is no native storage under Jest, so the real module's calls reject.
 * This is the same key/value store kept in memory, which is all the persisted
 * stores need: they write on change and read once at import.
 *
 * `reset` is for a test that wants to start from an empty disk; the stores
 * themselves are module singletons, so a test that needs a fresh one also has
 * to `jest.resetModules()`.
 */
let store = new Map();

const AsyncStorage = {
  getItem: jest.fn(key => Promise.resolve(store.has(key) ? store.get(key) : null)),
  setItem: jest.fn((key, value) => {
    store.set(key, String(value));
    return Promise.resolve();
  }),
  removeItem: jest.fn(key => {
    store.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    store.clear();
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve([...store.keys()])),
  multiGet: jest.fn(keys =>
    Promise.resolve(keys.map(k => [k, store.has(k) ? store.get(k) : null])),
  ),
  multiSet: jest.fn(pairs => {
    pairs.forEach(([k, v]) => store.set(k, String(v)));
    return Promise.resolve();
  }),
  multiRemove: jest.fn(keys => {
    keys.forEach(k => store.delete(k));
    return Promise.resolve();
  }),
  /** Test helper: empty the store and forget every recorded call. */
  __reset(seed = {}) {
    store = new Map(Object.entries(seed));
    Object.values(AsyncStorage).forEach(fn => {
      if (typeof fn === 'function' && fn.mockClear) fn.mockClear();
    });
  },
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
