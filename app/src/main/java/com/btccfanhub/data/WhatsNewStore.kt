package com.btccfanhub.data

import android.content.Context
import com.btccfanhub.BuildConfig
import com.btccfanhub.Constants

object WhatsNewStore {

    private const val KEY_SEEN_VERSION = "whats_new_seen_version"

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
        13 to listOf(
            "Race history back to 2014 — browse full results for every season from 2014 to 2025",
            "Year navigator — swipe left/right between seasons in Results using the new arrow navigator",
            "Driver season history — each driver profile now shows their full career stats back to 2014",
            "Champion entries — trophy rows now correctly display points and race wins alongside the champion badge",
        ),
        14 to listOf(
            "Push notifications — get notified for race results; toggle on/off in Settings",
            "Driver career stats — season history now shows podiums, poles and fastest laps alongside wins",
        ),
        15 to listOf(
            "Calendar — next race countdown stays fixed at the top while you scroll through all rounds",
            "Circuit pages — updated hero photos for every track on the calendar",
            "Schedule & standings — race dates and championship standings now refresh automatically from btcc.net",
        ),
        16 to listOf(
            "Single source of truth — all standings and results (2014–2025) now come from your Excel sheets",
            "Results tab — full venue names and dates restored; round results show both time and points",
            "Championship chart — R1–R10 labels directly under each round line; drivers sorted by points",
            "2026 results — app now loads from results2026.json for the current season",
        ),
        18 to listOf(
            "Refreshed app icon and monochrome icon for Android 13+",
            "New splash screen with BTCC blue",
        ),
        19 to listOf(
            "BTCC logo on the news hero — refreshed header",
            "Radio moved to More tab",
            "Headlines on images easier to read — stronger gradients and text shadow",
        ),
        20 to listOf(
            "Widget themes — choose from standard or team-themed colour schemes when adding the widget to your home screen"
        ),
        21 to listOf(
            "Accurate race gaps"
        ),
        22 to listOf(
            "Improve teams pages",
            "Added New to BTCC page"
        ),
        23 to listOf(
            "Live timing - real-time classification with gaps, best laps and flag status during race weekends",
            "Results back to 2004 - browse full race results for every season from 2004 to 2025",
            "Offline mode - calendar, standings, and news are now cached locally so the app works without connectivity",
            "Qualifying alerts - get notified when qualifying sessions are about to start",
        ),
        24 to listOf(
            "Share articles - share any news article and it opens directly in the app for other BTCCHub users",
            "Does anyone actually read these???",
        ),
        26 to listOf(
            "2026 season — Qualifying Race support with correct points scale",
            "Home screen widget — session schedule restored with improved layout",
        ),
        29 to listOf(
            "Season stats — wins, poles and fastest laps now shown alongside podiums and DNFs",
            "Lap records side by side — qualifying and race records shown next to each other on tablets",
            "Pull to refresh — swipe down on the calendar to force a refresh",
            "Bug fixes and performance improvements",
        )
    )

    val changes: List<String>
        get() = changelog[BuildConfig.VERSION_CODE] ?: emptyList()

    fun shouldShow(context: Context): Boolean {
        if (changes.isEmpty()) return false
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        val seen = prefs.getInt(KEY_SEEN_VERSION, 0)
        if (seen >= BuildConfig.VERSION_CODE) return false
        if (!prefs.getBoolean("onboarding_shown", false)) {
            markSeen(context)
            return false
        }
        return true
    }

    fun markSeen(context: Context) {
        context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_SEEN_VERSION, BuildConfig.VERSION_CODE)
            .apply()
    }
}
