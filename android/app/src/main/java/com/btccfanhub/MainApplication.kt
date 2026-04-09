package com.btccfanhub

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.btccfanhub.worker.NewsCheckWorker
import com.btccfanhub.worker.RaceNotificationWorker
import com.btccfanhub.worker.ResultsCheckWorker
import com.btccfanhub.service.RadioPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import java.util.concurrent.TimeUnit

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
    val wm = WorkManager.getInstance(this)
    wm.enqueueUniquePeriodicWork(
      NewsCheckWorker.WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<NewsCheckWorker>(15, TimeUnit.MINUTES).build(),
    )
    wm.enqueueUniquePeriodicWork(
      ResultsCheckWorker.WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<ResultsCheckWorker>(15, TimeUnit.MINUTES).build(),
    )
    wm.enqueueUniquePeriodicWork(
      RaceNotificationWorker.WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      PeriodicWorkRequestBuilder<RaceNotificationWorker>(15, TimeUnit.MINUTES).build(),
    )
  }
}
