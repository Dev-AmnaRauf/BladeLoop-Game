package com.bladeloop.game

import android.content.pm.ActivityInfo
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Sets which way up the phone is held, at the app's asking.
 *
 * The game is sideways on every screen and the manifest already says so
 * (`android:screenOrientation="sensorLandscape"`), so on Android this is belt
 * and braces: JS asks once at launch for the thing the activity has already
 * come up as. It is kept for two reasons. It is the only lock on a platform
 * whose native half is not built, so the JS call has somewhere to go on the
 * day iOS gets one; and `requestedOrientation` is the only thing that can
 * override the manifest while the app is running, which is what any future
 * screen wanting a different answer would have to reach for.
 *
 * It used to be load-bearing. The game was read upright and played sideways,
 * the manifest said `portrait`, and this was what turned the phone on the way
 * into a level and back on the way out. That went away when the pages were
 * rebuilt to fit a short, wide window -- see `src/ui/layout.ts`.
 *
 * A plain `ReactContextBaseJavaModule` rather than a codegen TurboModule spec,
 * on purpose and against the grain of the new architecture. This app runs
 * bridgeless, but on the device its JS has no `__turboModuleProxy` at all: a
 * module registered as a TurboModule is then unreachable from JS, which is
 * exactly what the first build of this did -- `TurboModuleRegistry.get`
 * returned null while the core modules, which come from C++, resolved fine.
 * Everything JS can reach here comes through the interop, and the interop only
 * hands back modules that are *not* TurboModules (see
 * `ReactPackageTurboModuleManagerDelegate.getLegacyModule`). Hence this, and
 * `isTurboModule = false` in `OrientationPackage`.
 *
 * `SENSOR_LANDSCAPE` rather than `LANDSCAPE`: both ways of holding the phone
 * sideways are allowed, so it can be turned end for end mid-descent and the
 * cutout put on whichever side the player likes. `sensor*` also means the
 * system auto-rotate switch is not consulted, which matters because most
 * players have it locked -- and a locked switch must not be able to pin the
 * game to one side. This matches what the manifest asks for, so the ask at
 * launch changes nothing on a phone that is already obeying it.
 *
 * A flip end for end is cheap: `orientation|screenLayout|screenSize|
 * smallestScreenSize` are in the activity's `configChanges`, so Android
 * resizes it rather than recreating it and a run keeps its world, its score
 * and its checkpoint.
 */
@ReactModule(name = OrientationModule.NAME)
class OrientationModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), LifecycleEventListener {

  /** The last thing JS asked for, kept so it can be applied late. */
  private var wanted: Int? = null

  init {
    context.addLifecycleEventListener(this)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun lock(mode: String) {
    wanted =
        when (mode) {
          "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
          // Nothing in the game asks for this any more. It stays because the
          // module takes a way round rather than a boolean, and a lock that
          // could only say one thing would be a lock nobody could read.
          "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
          // Anything else hands the phone back to the system rather than
          // guessing, so a typo cannot pin the game to one way up.
          else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    apply()
  }

  /**
   * Put the last ask to the activity, if there is one to put it to.
   *
   * There may not be: the activity is null while the app is on its way back
   * from the background, and an ask made in that window would otherwise be
   * dropped for good -- JS remembers what it asked for and would not ask
   * again. `onHostResume` is the second go at it.
   */
  private fun apply() {
    val want = wanted ?: return
    val activity = getCurrentActivity() ?: return
    activity.runOnUiThread { activity.requestedOrientation = want }
  }

  override fun onHostResume() {
    apply()
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() = Unit

  override fun invalidate() {
    reactApplicationContext.removeLifecycleEventListener(this)
    super.invalidate()
  }

  companion object {
    const val NAME = "NativeOrientation"
  }
}
