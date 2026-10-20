package com.bladeloop.game

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // The app's own module rather than a library, so nothing autolinks
          // it: it turns the phone sideways for a run and upright again after.
          add(OrientationPackage())
          // Also the app's own: the Play Games server auth code that Firebase
          // takes in exchange for an account. See PlayGamesAuthModule.
          add(PlayGamesAuthPackage())
          // And the share card: a score shared as a picture, not just a line.
          add(ShareCardPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
