package com.bladeloop.game

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.google.android.gms.games.PlayGames
import java.io.File
import java.util.Date

/**
 * The one thing `react-native-google-play-games` does not do: hand out a
 * server auth code.
 *
 * That code is what Firebase takes in exchange for an account -- the
 * `playgames.google.com` provider -- so without it a Play Games player is only
 * ever signed in on the phone, and their board row stays on the anonymous
 * account this install opened. The package signs in and reads the player; this
 * asks the same signed-in client for the code, and `services/firebase` does
 * the rest over REST, the same way the Google door does.
 *
 * The Play Games SDK itself is already started by the package's
 * `GooglePlayGamesInitProvider`, so there is nothing to set up here.
 *
 * A legacy module for the reason `OrientationModule` gives: JS in this app can
 * only reach modules through the interop.
 */
@ReactModule(name = PlayGamesAuthModule.NAME)
class PlayGamesAuthModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName(): String = NAME

  /**
   * A one-use code for `serverClientId`, which has to be the web OAuth client
   * of the project Play Games is linked to -- the same client id Firebase's
   * Play Games provider is configured with. Rejects when the player is not
   * signed in to Play Games, or when that client is not registered as the
   * game's server credential in Play Console.
   */
  @ReactMethod
  fun requestServerAuthCode(serverClientId: String, promise: Promise) {
    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "Play Games needs a foreground activity")
      return
    }
    PlayGames.getGamesSignInClient(activity)
        .requestServerSideAccess(serverClientId, false)
        .addOnSuccessListener { code ->
          log("server auth code issued")
          promise.resolve(code)
        }
        .addOnFailureListener { err ->
          log("server auth code refused: $err")
          promise.reject("E_SERVER_AUTH_CODE", err.message ?: "No server auth code", err)
        }
  }

  /**
   * A line for JS to say how the Firebase half went: to logcat under
   * `BladeLoopAuth`, and appended to `auth.log` in the app's external files
   * directory. The file is the half that matters on the vivo test phone, which
   * drops every log line the app process writes; `adb pull
   * /sdcard/Android/data/com.bladeloop.game/files/auth.log` reads it off a
   * release build, where `run-as` cannot.
   */
  @ReactMethod
  fun log(message: String) {
    Log.i(TAG, message)
    try {
      val dir = reactApplicationContext.getExternalFilesDir(null) ?: return
      File(dir, "auth.log").appendText("${Date()}  $message\n")
    } catch (_: Exception) {}
  }

  companion object {
    const val NAME = "NativePlayGamesAuth"
    private const val TAG = "BladeLoopAuth"
  }
}
