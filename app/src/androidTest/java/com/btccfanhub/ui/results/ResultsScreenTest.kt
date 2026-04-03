package com.btccfanhub.ui.results

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.btccfanhub.ui.setThemedContent
import org.junit.Rule
import org.junit.Test

class ResultsScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun rendersWithoutCrash() {
        rule.setThemedContent {
            ResultsScreen()
        }
        rule.waitForIdle()
    }

    @Test
    fun rendersWithInitialTab() {
        rule.setThemedContent {
            ResultsScreen(initialTab = 1)
        }
        rule.waitForIdle()
    }

    @Test
    fun rendersWithRoundClickCallback() {
        var clickedYear = -1
        var clickedRound = -1
        rule.setThemedContent {
            ResultsScreen(onRoundClick = { year, round ->
                clickedYear = year
                clickedRound = round
            })
        }
        rule.waitForIdle()
    }
}
