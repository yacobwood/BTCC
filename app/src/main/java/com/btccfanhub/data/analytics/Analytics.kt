package com.btccfanhub.data.analytics

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

    fun videoFullRaceClicked(venue: String) {
        fa.logEvent("video_full_race_clicked") {
            param("venue", venue)
        }
    }

    fun videoHighlightsClicked(venue: String) {
        fa.logEvent("video_highlights_clicked") {
            param("venue", venue)
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

    fun merchItemTapped(itemId: String, sellerId: String, sellerType: String, sponsored: Boolean, affiliateMissing: Boolean) {
        fa.logEvent("merch_item_tapped") {
            param("item_id", itemId)
            param("seller_id", sellerId)
            param("seller_type", sellerType)
            param("sponsored", if (sponsored) "true" else "false")
            param("affiliate_missing", if (affiliateMissing) "true" else "false")
        }
    }

    fun discountCodeCopied(sellerId: String, discountCode: String) {
        fa.logEvent("discount_code_copied") {
            param("seller_id", sellerId)
            param("discount_code", discountCode.take(50))
        }
    }

    fun merchSectionViewed(sectionTitle: String) {
        fa.logEvent("merch_section_viewed") {
            param("section_title", sectionTitle)
        }
    }

    fun youtubeCircuitGuideClicked(venue: String) {
        fa.logEvent("youtube_circuit_guide_clicked") {
            param("venue", venue)
        }
    }

    fun radioStationPlayed(stationName: String) {
        fa.logEvent("radio_station_played") {
            param("station_name", stationName)
        }
    }

    fun radioStationStopped(stationName: String) {
        fa.logEvent("radio_station_stopped") {
            param("station_name", stationName)
        }
    }

    /** Fired when a notification is actually delivered to the device. */
    fun notificationDelivered(type: String, venue: String = "") {
        fa.logEvent("notification_delivered") {
            param("type", type)
            if (venue.isNotEmpty()) param("venue", venue)
        }
    }

    /** Fired when the user taps a notification to open the app. */
    fun notificationOpened(type: String) {
        fa.logEvent("notification_opened") {
            param("type", type)
        }
    }

    fun lightboxImageViewed(venue: String, imageIndex: Int) {
        fa.logEvent("lightbox_image_viewed") {
            param("venue", venue)
            param("image_index", imageIndex.toLong())
        }
    }

    /** Sets a Firebase user property so audiences can be segmented by favourite driver. */
    fun setFavouriteDriverProperty(name: String) {
        fa.setUserProperty("favourite_driver", name.take(36))
    }

    fun whatsNewShown() {
        fa.logEvent("whats_new_shown") {}
    }

    fun gridTabSwitched(tab: String) {
        fa.logEvent("grid_tab_switched") {
            param("tab", tab)
        }
    }

    fun articleExternalLinkClicked(articleTitle: String, url: String) {
        fa.logEvent("article_external_link_clicked") {
            param(FirebaseAnalytics.Param.ITEM_NAME, articleTitle.take(100))
            param("url", url.take(100))
        }
    }

    fun pullToRefresh(screen: String) {
        fa.logEvent("pull_to_refresh") {
            param("screen", screen)
        }
    }

    fun retryClicked(screen: String) {
        fa.logEvent("retry_clicked") {
            param("screen", screen)
        }
    }

    fun searchOpened() {
        fa.logEvent("search_opened") {}
    }

    fun searchClosed() {
        fa.logEvent("search_closed") {}
    }
}
