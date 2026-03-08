package com.btccfanhub.data

import android.content.Context
import android.content.pm.PackageManager
import com.btccfanhub.BuildConfig

object WhatsNewStore {

    private const val PREFS_NAME        = "btcc_prefs"
    private const val KEY_SEEN_VERSION  = "whats_new_seen_version"

    /**
     * Changelog entries keyed by versionCode.
     * Add a new entry here whenever you bump versionCode in build.gradle.kts.
     */
    private val changelog: Map<Int, List<String>> = mapOf(
        10 to listOf(
            "Favourite driver — star a driver to highlight them across the Grid, Standings and Results",
            "News search — filter the news feed by keyword",
            "Scroll-to-top button on the news feed",
            "Infinite scroll — news feed now loads more articles as you scroll",
            "Race results per-round — tap a round in Results to see Race 1, 2 and 3 results",
        ),
        11 to listOf(
            "Season stats — new STATS tab in Results showing wins, podiums, poles and DNFs per driver",
            "Team detail — tap a team in the Grid for a full view with car image and 2025 championship result",
            "Star from Grid — star or unstar your favourite driver directly from the driver list and detail screen",
            "Notification onboarding — new install flow explains what notifications the app sends before asking",
        ),
        12 to listOf(
            "Raise a Bug — report issues directly in the app from Settings without leaving the app",
            "Audio embeds — podcast and audio players in articles now load and play correctly",
            "Gallery images fixed — no more duplicate photos in image galleries",
            "Round labels — widget and track detail now correctly show the full round range (e.g. Rounds 1–3)",
        ),
    )

    val changes: List<String>
        get() = changelog[BuildConfig.VERSION_CODE] ?: emptyList()

    fun shouldShow(context: Context): Boolean {
        if (changes.isEmpty()) return false
        val seen = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getInt(KEY_SEEN_VERSION, 0)
        if (seen >= BuildConfig.VERSION_CODE) return false
        // Don't show to fresh installs — only to users upgrading from a previous version
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        if (info.firstInstallTime == info.lastUpdateTime) {
            markSeen(context)
            return false
        }
        return true
    }

    fun markSeen(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_SEEN_VERSION, BuildConfig.VERSION_CODE)
            .apply()
    }
}
