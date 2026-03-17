package com.btccfanhub.data

import com.google.firebase.Firebase
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.analytics
import com.google.firebase.analytics.logEvent

object Analytics {

    private val fa: FirebaseAnalytics get() = Firebase.analytics

    fun screen(name: String) {
        fa.logEvent(FirebaseAnalytics.Event.SCREEN_VIEW) {
            param(FirebaseAnalytics.Param.SCREEN_NAME, name)
        }
    }

    fun articleRead(title: String) {
        fa.logEvent(FirebaseAnalytics.Event.SELECT_CONTENT) {
            param(FirebaseAnalytics.Param.CONTENT_TYPE, "article")
            param(FirebaseAnalytics.Param.ITEM_NAME, title.take(100))
        }
    }

    fun trackDetailViewed(round: Int, venue: String) {
        fa.logEvent("track_detail_viewed") {
            param("round", round.toLong())
            param("venue", venue)
        }
    }

    fun liveTimingOpened(eventId: Int) {
        fa.logEvent("live_timing_opened") {
            param("tsl_event_id", eventId.toLong())
        }
    }

    fun resultsYearViewed(year: Int) {
        fa.logEvent("results_year_viewed") {
            param("year", year.toLong())
        }
    }

    fun roundResultsViewed(year: Int, round: Int) {
        fa.logEvent("round_results_viewed") {
            param("year", year.toLong())
            param("round", round.toLong())
        }
    }

    fun infoPageViewed(pageId: String) {
        fa.logEvent("info_page_viewed") {
            param("page_id", pageId)
        }
    }

    fun driverDetailViewed(name: String) {
        fa.logEvent("driver_detail_viewed") {
            param("driver_name", name)
        }
    }

    fun notificationToggled(enabled: Boolean) {
        fa.logEvent("notification_toggled") {
            param("enabled", if (enabled) "true" else "false")
        }
    }
}
