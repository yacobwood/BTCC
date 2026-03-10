package com.btccfanhub.data

import android.content.Context

object OnboardingStore {

    private const val PREFS = "btcc_prefs"
    private const val KEY   = "onboarding_shown"

    fun shouldShow(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return !prefs.getBoolean(KEY, false)
    }

    fun markComplete(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY, true).apply()
    }
}
