package com.btccfanhub.data

import android.content.Context

object OnboardingStore {

    private const val PREFS = "btcc_prefs"
    private const val KEY   = "onboarding_shown"

    fun shouldShow(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY, false)) return false

        val pi = context.packageManager.getPackageInfo(context.packageName, 0)
        if (pi.firstInstallTime != pi.lastUpdateTime) {
            // Existing user upgrading — mark complete silently so they never see it
            prefs.edit().putBoolean(KEY, true).apply()
            return false
        }
        return true
    }

    fun markComplete(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY, true).apply()
    }
}
