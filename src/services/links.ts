/**
 * The addresses the app points people at.
 *
 * Gathered in one file because they are the parts of the app that are wrong
 * until it is actually published: the store listings do not exist yet, so
 * rating and sharing both point at ids that have to be filled in. Search for
 * `TODO` here before a release.
 */
import { Platform } from 'react-native';

/** Matches `applicationId` in `android/app/build.gradle`. */
export const ANDROID_PACKAGE = 'com.bladeloop.game';

/**
 * What the settings page prints at the bottom.
 *
 * Kept here rather than read off the native bundle so the app needs no device-
 * info dependency for one line of text -- which means it has to be moved in
 * step with `versionName` in `android/app/build.gradle` and `MARKETING_VERSION`
 * in the Xcode project. Search for `TODO` in this file before a release.
 */
export const APP_VERSION = '1.0.0';

/** TODO: the numeric App Store id, once the app has a listing. */
export const IOS_APP_ID = '0000000000';

/** Where "Rate us" sends the player. */
export function storeUrl() {
  return Platform.OS === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_ID}?action=write-review`
    : `market://details?id=${ANDROID_PACKAGE}`;
}

/**
 * The privacy policy the settings page links out to.
 *
 * Both stores require a reachable privacy policy for an app that carries
 * analytics, and this is the same page the store listings point at. It is
 * served by Firebase Hosting on the project the game already uses, from
 * `public/privacy.html`; `cleanUrls` in `firebase.json` is what drops the
 * `.html`. A custom domain can be pointed at the same site later without
 * touching this line -- the path stays `/privacy`.
 */
export const PRIVACY_URL = 'https://bladeloop-4d203.web.app/privacy';

/** The same listing as a plain link, for putting inside a shared message. */
export function shareUrl() {
  return Platform.OS === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_ID}`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
}
