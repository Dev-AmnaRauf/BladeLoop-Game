This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

# BladeLoop services

The leaderboard, analytics, the settings screen and the login screen
are set up in
[`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md), along with the checklist of
what has to be filled in before the app is listed.

The leaderboard works today over the Firestore REST API once Anonymous sign-in
is enabled and [`firestore.rules`](firestore.rules) is deployed. Analytics
records and stubs itself until its native SDK is installed, so the game runs
either way. The login screen is the same shape: the guest button
works in every build, and the Google button needs an Android rebuild after the
install plus the app's SHA-1 registered with Firebase.

# Project documents

[`PROJECT.md`](PROJECT.md) is the canonical reference for planning and
delivery, and points at the four standard documents:

| Document | What it holds |
| --- | --- |
| [`docs/PR.md`](docs/PR.md) | Purpose, users, goals, scope, assumptions, constraints, success criteria |
| [`docs/ER.md`](docs/ER.md) | Firestore, on-device and in-memory data model, with Mermaid diagrams |
| [`docs/FUNCTIONAL-REQUIREMENTS.md`](docs/FUNCTIONAL-REQUIREMENTS.md) | Features, flows, validation, error/empty/loading states, acceptance criteria |
| [`docs/CHECKLIST.md`](docs/CHECKLIST.md) | Planning → design → implementation → testing → release → post-release |

And, for the simulation itself:

| Document | What it holds |
| --- | --- |
| [`docs/GAME-ALGORITHM.md`](docs/GAME-ALGORITHM.md) | The frame loop, the physics as equations, the controls, the level builder, collision, death and respawn, scoring, and what a turn of the phone does |

When a decision, requirement, tool or scope changes, update `PROJECT.md` and
add a dated entry to its change log.
