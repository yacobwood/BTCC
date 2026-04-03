package com.btccfanhub.ui.more

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.btccfanhub.ui.setThemedContent
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MoreScreenTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun displaysTopBarTitle() {
        rule.setThemedContent {
            MoreScreen(
                onSettingsClick = {},
                onBugReportClick = {},
                onRadioClick = {},
                onInfoPageClick = {},
            )
        }
        rule.onNodeWithText("MORE").assertIsDisplayed()
    }

    @Test
    fun displaysSectionHeaders() {
        rule.setThemedContent {
            MoreScreen(
                onSettingsClick = {},
                onBugReportClick = {},
                onRadioClick = {},
                onInfoPageClick = {},
            )
        }
        rule.onNodeWithText("NEW HERE?").assertIsDisplayed()
        rule.onNodeWithText("APP").assertIsDisplayed()
    }

    @Test
    fun displaysStaticMenuItems() {
        rule.setThemedContent {
            MoreScreen(
                onSettingsClick = {},
                onBugReportClick = {},
                onRadioClick = {},
                onInfoPageClick = {},
            )
        }
        rule.onNodeWithText("New to BTCC?").assertIsDisplayed()
        rule.onNodeWithText("Settings").assertIsDisplayed()
        rule.onNodeWithText("Feedback & Bugs").assertIsDisplayed()
        rule.onNodeWithText("Buy me a coffee").assertIsDisplayed()
    }

    @Test
    fun settingsClickCallsCallback() {
        var clicked = false
        rule.setThemedContent {
            MoreScreen(
                onSettingsClick = { clicked = true },
                onBugReportClick = {},
                onRadioClick = {},
                onInfoPageClick = {},
            )
        }
        rule.onNodeWithText("Settings").performClick()
        assertTrue(clicked)
    }

    @Test
    fun bugReportClickCallsCallback() {
        var clicked = false
        rule.setThemedContent {
            MoreScreen(
                onSettingsClick = {},
                onBugReportClick = { clicked = true },
                onRadioClick = {},
                onInfoPageClick = {},
            )
        }
        rule.onNodeWithText("Feedback & Bugs").performClick()
        assertTrue(clicked)
    }

    @Test
    fun newToBtccClickCallsInfoPageCallback() {
        var pageId = ""
        rule.setThemedContent {
            MoreScreen(
                onSettingsClick = {},
                onBugReportClick = {},
                onRadioClick = {},
                onInfoPageClick = { pageId = it },
            )
        }
        rule.onNodeWithText("New to BTCC?").performClick()
        assertTrue(pageId == "new-to-btcc")
    }
}
