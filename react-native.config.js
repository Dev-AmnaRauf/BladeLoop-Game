/**
 * Where `npx react-native-asset` looks for files to link into both platforms.
 *
 * Only the fonts folder for now: the game's type wants Poppins, and `src/ui/
 * type.ts` switches over to it the moment the faces are actually in the build.
 */
module.exports = {
  assets: ['./src/assets/fonts'],
};
