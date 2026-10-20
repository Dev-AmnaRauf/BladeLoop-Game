# BladeLoop — Privacy Policy

**Last updated:** 24 September 2026
**Applies to:** the BladeLoop mobile game (`com.bladeloop.game`) on Android and
iOS.

<!-- TODO before this is published anywhere: replace the address in §9 with the
     support mailbox you want players and Google to write to. Everything else
     on this page was written against what the code actually does; if the app
     starts collecting something new, change this file and re-publish it. -->

BladeLoop is an arcade game. It is built to be played without an account and
without asking for anything you would not expect a game to need — no contacts,
no photos, no microphone, no GPS. This page explains the data the game does
handle, who it is shared with, and what you can do about it.

## 1. Who is responsible

BladeLoop is published by the developer whose contact address appears in
section 9 and on the app's store listing. That developer is the controller of
the data described here.

## 2. What the game collects

### A game account

The first time you play, the game opens an anonymous account with Firebase
Authentication and stores a random account identifier. That identifier is what
lets your score reach the leaderboard. It is not tied to your name or your
email.

You may instead sign in with Google or with Google Play Games. If you do, the
game receives and stores on your device your **display name** and, for Google
Sign-In, your **email address**, or, for Play Games, your **gamer tag and
player ID**. Signing in is optional; the game is fully playable as a guest.

### Your leaderboard entry

When you submit a score, one row is written for your account containing: the
display name you chose (up to 14 characters), your best score, the number of
runs you have played, the time of the submission, and a two-letter country code
and city name.

> **The leaderboard is public.** Every player of the game can read every row,
> including the name you pick. Choose a name you are happy for other players to
> see, and do not use your real name or any other detail you want kept private.
> Your email address is never written to the leaderboard.

### Approximate location

The country and city boards need to know roughly where a score came from.
Rather than ask for the device location permission, the game sends a request to
[ipapi.co](https://ipapi.co/privacy/), which reads the IP address the request
arrives from and returns a country and a city. The game never requests GPS or
precise location, and the result is accurate only to roughly the level of a
city. If the lookup fails, the game falls back to the country your device
language is set to, or puts you on the world board with no place at all.

### Analytics

The game records a fixed, closed set of gameplay events — app opened, run
started, run ended, level cleared, leaderboard opened, settings
changed and similar — so we can see which levels are too hard and which screens
people get stuck on. These events carry game state, such as a level number or a
score. They do not carry your email address or the content of anything you
type.

### Data kept only on your device

Your progress, stars and coins, sound and vibration preferences, your chosen
display name, your privacy choices and the cached country and city are stored
in the app's own storage on your device. Deleting the app deletes them.

## 3. What the game never collects

- Precise or GPS location
- Contacts, photos, files, calendar, microphone or camera
- Health, financial or biometric data
- SMS or call history

## 4. Who the data is shared with

| Service | What it receives | Its policy |
| --- | --- | --- |
| Google Firebase (Authentication, Cloud Firestore) | Account identifier, sign-in token, leaderboard row | [firebase.google.com/support/privacy](https://firebase.google.com/support/privacy) |
| Google Analytics for Firebase | Gameplay events and an app instance identifier | [firebase.google.com/support/privacy](https://firebase.google.com/support/privacy) |
| Google Play Games | Player ID and gamer tag, if you sign in that way | [policies.google.com/privacy](https://policies.google.com/privacy) |
| ipapi.co | The IP address of the lookup request | [ipapi.co/privacy](https://ipapi.co/privacy/) |
| Other players | Your public leaderboard row: name, score, runs, country, city | — |

Data is not sold, and it is not shared with anyone else for their own
advertising purposes.

## 5. Why we are allowed to handle it

Where the UK GDPR or EU GDPR applies: the account and the leaderboard are
processed to perform the service you asked for, which is playing the game and
appearing on the board; analytics rests on our legitimate interest in keeping
the game working.

## 6. How long it is kept

Your leaderboard row stays on the board until you ask us to remove it.
Analytics events are kept in aggregate for up to 14 months. Data held on your
device lasts until you clear the app's storage or uninstall it.

## 7. Your choices and your rights

- **Play as a guest.** You never have to sign in with Google or Play Games.
- **Pick a name that is not yours.** The name on the board is yours to choose,
  and you can change it.
- **Stay off the board.** If you do not submit a score, no row is written.
- **Reset your progress.** The game's settings screen clears the progress
  stored on your device.
- **Delete everything.** Write to the address below and we will delete your
  account, your leaderboard row and any data held against it. Uninstalling the
  app removes everything held on the device.
- **Access, correction, objection and portability.** If you are in the UK, the
  EEA or another region with equivalent law, write to us and we will answer
  within one month. You may also complain to your local data protection
  authority.

## 8. Children

BladeLoop is not directed at children under 13, and we do not knowingly collect
personal information from them. If you believe a child has provided information
through the game, write to the address below and we will delete it.

## 9. Contact

Questions, deletion requests and anything else about this policy:
<amnarauf545@gmail.com>.

## 10. Changes

If this policy changes, the new version is published on this page and the date
at the top is updated. Material changes will also be noted in the app's store
listing release notes.
