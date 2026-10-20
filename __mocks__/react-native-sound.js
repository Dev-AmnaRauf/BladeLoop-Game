/**
 * There is no audio stack under Jest, so the real module's native calls throw.
 * This stands in for it: clips "load" successfully and every method is a spy,
 * which is enough for the components that fire sound effects to render and for
 * a test to assert that a given effect was played.
 */
class Sound {
  constructor(source, basePathOrCallback, callback) {
    this.source = source;
    this.loaded = true;
    const done =
      typeof basePathOrCallback === 'function' ? basePathOrCallback : callback;
    // The real module decodes asynchronously; calling back synchronously here
    // keeps tests free of a tick they would otherwise have to await.
    if (done) done(null, { duration: 1, numberOfChannels: 1 });
  }

  isLoaded() {
    return this.loaded;
  }

  play(onEnd) {
    if (onEnd) onEnd(true);
    return this;
  }

  stop(cb) {
    if (cb) cb();
    return this;
  }

  pause(cb) {
    if (cb) cb();
    return this;
  }

  reset() {
    return this;
  }

  release() {
    this.loaded = false;
    return this;
  }

  setVolume() {
    return this;
  }

  getVolume() {
    return 1;
  }

  setPan() {
    return this;
  }

  getPan() {
    return 0;
  }

  setNumberOfLoops() {
    return this;
  }

  getNumberOfLoops() {
    return 0;
  }

  setSpeed() {
    return this;
  }

  getSpeed() {
    return 1;
  }

  setCurrentTime() {
    return this;
  }

  getCurrentTime(cb) {
    if (cb) cb(0, false);
  }

  getDuration() {
    return 1;
  }

  getNumberOfChannels() {
    return 1;
  }
}

Sound.MAIN_BUNDLE = '';
Sound.DOCUMENT = '';
Sound.LIBRARY = '';
Sound.CACHES = '';
Sound.setCategory = jest.fn();
Sound.setMode = jest.fn();
Sound.setActive = jest.fn();
Sound.enable = jest.fn();

module.exports = Sound;
module.exports.default = Sound;
