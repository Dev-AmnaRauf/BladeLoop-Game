package com.bladeloop.game

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * The app's own module, handed to React Native by `MainApplication`.
 *
 * It is not autolinked, because it is not a library -- it lives in the app and
 * exists for one screen transition. See `OrientationModule`.
 */
class OrientationPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == OrientationModule.NAME) OrientationModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        OrientationModule.NAME to
            ReactModuleInfo(
                OrientationModule.NAME,
                OrientationModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                // Not a TurboModule: see OrientationModule for why the
                // interop path is the only one JS can reach in this app.
                isTurboModule = false,
            )
    )
  }
}
