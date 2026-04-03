package com.btccfanhub.ui.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.btccfanhub.ui.setThemedContent
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SettingsScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun displaysTopBarTitle() {
        rule.setThemedContent {
            SettingsScreen()
        }
        rule.onNodeWithText("SETTINGS").assertIsDisplayed()
    }

    @Test
    fun displaysNotificationsSection() {
        rule.setThemedContent {
            SettingsScreen()
        }
        rule.onNodeWithText("NOTIFICATIONS").assertIsDisplayed()
    }

    @Test
    fun displaysBackButton() {
        rule.setThemedContent {
            SettingsScreen()
        }
        rule.onNodeWithContentDescription("Back").assertIsDisplayed()
    }

    @Test
    fun backButtonCallsOnBack() {
        var backCalled = false
        rule.setThemedContent {
            SettingsScreen(onBack = { backCalled = true })
        }
        rule.onNodeWithContentDescription("Back").performClick()
        assertTrue(backCalled)
    }
}
