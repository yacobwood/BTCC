package com.btccfanhub.navigation

import org.junit.Assert.assertEquals
import org.junit.Test

class ScreenRouteTest {

    @Test
    fun `news route is correct`() {
        assertEquals("news", Screen.News.route)
    }

    @Test
    fun `calendar route is correct`() {
        assertEquals("calendar", Screen.Calendar.route)
    }

    @Test
    fun `drivers route is correct`() {
        assertEquals("drivers", Screen.Drivers.route)
    }

    @Test
    fun `results route is correct`() {
        assertEquals("results", Screen.Results.route)
    }

    @Test
    fun `more route is correct`() {
        assertEquals("more", Screen.More.route)
    }

    @Test
    fun `settings route is correct`() {
        assertEquals("settings", Screen.Settings.route)
    }

    @Test
    fun `track route builds correctly`() {
        assertEquals("track/3", Screen.Track.route(3))
    }

    @Test
    fun `round results route builds correctly`() {
        assertEquals("round_results/2025/5", Screen.RoundResults.route(2025, 5))
    }

    @Test
    fun `live timing route builds correctly`() {
        assertEquals("live_timing/42", Screen.LiveTiming.route(42))
    }

    @Test
    fun `info page route builds correctly`() {
        assertEquals("info_page/new-to-btcc", Screen.InfoPage.route("new-to-btcc"))
    }

    @Test
    fun `track route template has placeholder`() {
        assertEquals("track/{round}", Screen.Track.route)
    }

    @Test
    fun `round results route template has placeholders`() {
        assertEquals("round_results/{year}/{round}", Screen.RoundResults.route)
    }
}
