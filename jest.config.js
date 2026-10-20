module.exports = {
  preset: '@react-native/jest-preset',
  // Only *.test.* files are suites, so helpers can live beside them in
  // __tests__ without Jest trying to run them and failing for having no tests.
  testMatch: ['**/*.test.[jt]s?(x)'],
  // The preset's asset transform covers images and mp4 only, so a `require` of
  // a sound file reaches Jest as binary and fails to parse. Hand the audio
  // extensions to the same transformer, which stands a stub in for the file.
  transform: {
    '^.+\.(mp3|wav|m4a|aac)$': require.resolve(
      '@react-native/jest-preset/jest/assetFileTransformer.js',
    ),
  },
  // AsyncStorage and Google sign-in ship ES modules, and react-native-sound and
  // react-native-google-play-games both ship TypeScript, so all four have to go
  // through Babel like the rest of react-native rather than being passed over
  // as plain node_modules. `__mocks__` stands in for the sound and Google
  // modules by default -- this is here for a test that opts back into a real
  // one. Play Games matters even though no suite loads it today: `PlayGames`
  // reaches for it inside a try, so an untransformed module would be swallowed
  // as "not available" rather than failing where someone would see it.
  transformIgnorePatterns: [
    'node_modules/(?!(?:@react-native|react-native|@react-native-async-storage|@react-native-google-signin|react-native-google-play-games|react-native-sound)/)',
  ],
};
