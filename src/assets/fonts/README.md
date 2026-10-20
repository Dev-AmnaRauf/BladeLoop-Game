# Fonts

The UI is drawn in Poppins -- the round, chunky face the pop-up cards are
built around. The faces themselves are not checked in, because they are a
third-party download rather than something this repo generated.

To put them in:

1. Download Poppins (SIL Open Font License) from Google Fonts and drop these
   four files in this folder, named exactly as they come:

   - `Poppins-ExtraBold.ttf`
   - `Poppins-Bold.ttf`
   - `Poppins-SemiBold.ttf`
   - `Poppins-Medium.ttf`

2. `npx react-native-asset` -- this folder is already declared in
   `react-native.config.js`, so it copies the faces into the Android assets
   and registers them with the iOS target.

3. Flip `POPPINS` to `true` at the top of `src/ui/type.ts`.

4. Rebuild the app. A JS reload is not enough: the faces are linked natively.

Until step 3, every label falls back to the chunkiest stock face each platform
has -- Roboto Black on Android, the system face at weight 900 on iOS -- which
is the same shape of type, just a little less round.
