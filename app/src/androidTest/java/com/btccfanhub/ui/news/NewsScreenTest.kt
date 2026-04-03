package com.btccfanhub.ui.news

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import com.btccfanhub.ui.setThemedContent
import org.junit.Rule
import org.junit.Test

class NewsScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun rendersWithoutCrash() {
        // Smoke test: NewsScreen composes and shows loading state initially
        rule.setThemedContent {
            NewsScreen(onArticleClick = {})
        }
        rule.waitForIdle()
    }

    @Test
    fun rendersWithScrollToTopTrigger() {
        rule.setThemedContent {
            NewsScreen(onArticleClick = {}, scrollToTopTrigger = 0)
        }
        rule.waitForIdle()
    }
}
