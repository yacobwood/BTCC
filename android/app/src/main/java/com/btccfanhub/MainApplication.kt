package com.btccfanhub

import android.app.Application
import androidx.work.WorkManager
import com.btccfanhub.service.RadioPackage
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
          add(RadioPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    scheduleWorkers()
  }

  private fun scheduleWorkers() {
    // Cancel legacy on-device workers — notifications are now handled by FCM via Cloud Functions
    val wm = WorkManager.getInstance(this)
    wm.cancelUniqueWork("btcc_news_check")
    wm.cancelUniqueWork("btcc_results_check")
    wm.cancelUniqueWork("btcc_race_notification")
  }
}
