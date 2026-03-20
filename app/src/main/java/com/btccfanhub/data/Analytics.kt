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

    /** Article tapped from the news feed. position = "hero" | "grid" | "list" | "search" */
    fun articleClicked(title: String, position: String) {
        fa.logEvent(FirebaseAnalytics.Event.SELECT_CONTENT) {
            param(FirebaseAnalytics.Param.CONTENT_TYPE, "article")
            param(FirebaseAnalytics.Param.ITEM_NAME, title.take(100))
            param("position", position)
        }
    }

    fun articleShared(title: String) {
        fa.logEvent(FirebaseAnalytics.Event.SHARE) {
            param(FirebaseAnalytics.Param.CONTENT_TYPE, "article")
            param(FirebaseAnalytics.Param.ITEM_NAME, title.take(100))
        }
    }

    /** depth = 25 | 50 | 75 | 100 */
    fun articleScrollDepth(title: String, depthPercent: Int) {
        fa.logEvent("article_scroll_depth") {
            param(FirebaseAnalytics.Param.ITEM_NAME, title.take(100))
            param("depth_percent", depthPercent.toLong())
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

    fun resultsYearChanged(year: Int) {
        fa.logEvent("results_year_changed") {
            param("year", year.toLong())
        }
    }

    fun resultsTabChanged(year: Int, tab: String) {
        fa.logEvent("results_tab_changed") {
            param("year", year.toLong())
            param("tab", tab)
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

    fun driverClicked(name: String) {
        fa.logEvent("driver_clicked") {
            param("driver_name", name)
        }
    }

    fun teamClicked(name: String) {
        fa.logEvent("team_clicked") {
            param("team_name", name)
        }
    }

    fun favouriteToggled(name: String, added: Boolean) {
        fa.logEvent("favourite_toggled") {
            param("driver_name", name)
            param("action", if (added) "added" else "removed")
        }
    }

    fun newsSearched(query: String) {
        fa.logEvent(FirebaseAnalytics.Event.SEARCH) {
            param(FirebaseAnalytics.Param.SEARCH_TERM, query.take(100))
        }
    }

    fun raceClicked(round: Int, venue: String) {
        fa.logEvent("race_clicked") {
            param("round", round.toLong())
            param("venue", venue)
        }
    }

    fun moreItemClicked(item: String) {
        fa.logEvent("more_item_clicked") {
            param("item", item)
        }
    }

    fun notificationToggled(enabled: Boolean) {
        fa.logEvent("notification_toggled") {
            param("enabled", if (enabled) "true" else "false")
        }
    }

    /** type = "news" | "race" | "qualifying" | "results" */
    fun notificationTypeToggled(type: String, enabled: Boolean) {
        fa.logEvent("notification_type_toggled") {
            param("type", type)
            param("enabled", if (enabled) "true" else "false")
        }
    }

    fun unitSystemChanged(unit: String) {
        fa.logEvent("unit_system_changed") {
            param("unit", unit)
        }
    }

    fun bugReportCategorySelected(category: String) {
        fa.logEvent("bug_report_category_selected") {
            param("category", category)
        }
    }

    fun bugReportSubmitted(category: String) {
        fa.logEvent("bug_report_submitted") {
            param("category", category)
        }
    }

    fun onboardingAction(action: String) {
        fa.logEvent("onboarding_action") {
            param("action", action)
        }
    }

    fun whatsNewDismissed() {
        fa.logEvent("whats_new_dismissed") {}
    }

    fun navItemClicked(label: String) {
        fa.logEvent("nav_item_clicked") {
            param("label", label)
        }
    }

    fun infoPageLinkClicked(pageId: String, linkUrl: String) {
        fa.logEvent("info_page_link_clicked") {
            param("page_id", pageId)
            param("link_url", linkUrl.take(100))
        }
    }

    fun raceTabClicked(venue: String, tab: String) {
        fa.logEvent("race_tab_clicked") {
            param("venue", venue)
            param("tab", tab)
        }
    }

    fun raceVideoClicked(venue: String, label: String) {
        fa.logEvent("race_video_clicked") {
            param("venue", venue)
            param("label", label)
        }
    }

    fun trackImageClicked(venue: String) {
        fa.logEvent("track_image_clicked") {
            param("venue", venue)
        }
    }

    fun liveTimingCardClicked(venue: String) {
        fa.logEvent("live_timing_card_clicked") {
            param("venue", venue)
        }
    }
}
