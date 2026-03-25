package com.btccfanhub.data.store

import android.content.Context

/**
 * Tracks app launches and when to show the Play In-App Review prompt.
 * Criteria: 7 days since first launch, 3+ launches, and only ask once.
 * Stored in SharedPreferences so it survives "Clear cache" (but not "Clear data").
 */
object ReviewPromptStore {

    private const val PREFS_NAME = "btcc_review_prompt"
    private const val KEY_FIRST_LAUNCH_MS = "first_launch_ms"
    private const val KEY_LAUNCH_COUNT = "launch_count"
    private const val KEY_REVIEW_REQUESTED = "review_requested"

    private const val DAYS_UNTIL_PROMPT = 7L
    private const val MIN_LAUNCHES = 3

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** Call on every app launch. Records first launch time and increments launch count. */
    fun recordLaunch(context: Context) {
        val p = prefs(context)
        val now = System.currentTimeMillis()
        if (p.getLong(KEY_FIRST_LAUNCH_MS, 0L) == 0L) {
            p.edit().putLong(KEY_FIRST_LAUNCH_MS, now).apply()
        }
        p.edit().putInt(KEY_LAUNCH_COUNT, p.getInt(KEY_LAUNCH_COUNT, 0) + 1).apply()
    }

    /** True if we should request the in-app review: 7+ days, 3+ launches, not yet asked. */
    fun shouldRequestReview(context: Context): Boolean {
        val p = prefs(context)
        if (p.getBoolean(KEY_REVIEW_REQUESTED, false)) return false
        val firstLaunch = p.getLong(KEY_FIRST_LAUNCH_MS, 0L)
        if (firstLaunch == 0L) return false
        val daysSinceFirst = (System.currentTimeMillis() - firstLaunch) / (24 * 60 * 60 * 1000)
        if (daysSinceFirst < DAYS_UNTIL_PROMPT) return false
        if (p.getInt(KEY_LAUNCH_COUNT, 0) < MIN_LAUNCHES) return false
        return true
    }

    /** Call after launching the review flow so we never ask again. */
    fun markReviewRequested(context: Context) {
        prefs(context).edit().putBoolean(KEY_REVIEW_REQUESTED, true).apply()
    }
}
