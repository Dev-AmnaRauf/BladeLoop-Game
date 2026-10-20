package com.bladeloop.game

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** The app's own share-card module, handed over by `MainApplication`. */
class ShareCardPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == ShareCardModule.NAME) ShareCardModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        ShareCardModule.NAME to
            ReactModuleInfo(
                ShareCardModule.NAME,
                ShareCardModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                // Not a TurboModule: see OrientationModule for why.
                isTurboModule = false,
            )
    )
  }
}
