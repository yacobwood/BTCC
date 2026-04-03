package com.btccfanhub.ui.drivers

import androidx.compose.ui.test.junit4.createComposeRule
import com.btccfanhub.ui.setThemedContent
import org.junit.Rule
import org.junit.Test

class DriversScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun rendersWithoutCrash() {
        // Smoke test: DriversScreen fetches grid data from network.
        // Verify it composes and shows loading/content without throwing.
        rule.setThemedContent {
            DriversScreen()
        }
        rule.waitForIdle()
    }
}
