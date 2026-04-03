package com.btccfanhub.ui.calendar

import androidx.compose.ui.test.junit4.createComposeRule
import com.btccfanhub.ui.setThemedContent
import org.junit.Rule
import org.junit.Test

class CalendarScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun rendersWithoutCrash() {
        // Smoke test: CalendarScreen renders without throwing.
        // It fetches data from the network, so we just verify it composes.
        rule.setThemedContent {
            CalendarScreen(onRaceClick = {}, onLiveTimingClick = null)
        }
        rule.waitForIdle()
    }

    @Test
    fun rendersWithCallbacks() {
        var raceClicked = false
        rule.setThemedContent {
            CalendarScreen(
                onRaceClick = { raceClicked = true },
                onLiveTimingClick = null,
            )
        }
        rule.waitForIdle()
    }
}
