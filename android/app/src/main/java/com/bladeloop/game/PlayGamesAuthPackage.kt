package com.bladeloop.game

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers `PlayGamesAuthModule`, handed to React Native by `MainApplication`
 * the same way `OrientationPackage` is.
 */
class PlayGamesAuthPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == PlayGamesAuthModule.NAME) PlayGamesAuthModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        PlayGamesAuthModule.NAME to
            ReactModuleInfo(
                PlayGamesAuthModule.NAME,
                PlayGamesAuthModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                // Not a TurboModule: see OrientationModule.
                isTurboModule = false,
            )
    )
  }
}
