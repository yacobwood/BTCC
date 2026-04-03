package com.btccfanhub.ui.components

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.btccfanhub.ui.setThemedContent
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class PillToggleTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun displaysOptions() {
        rule.setThemedContent {
            PillToggle(
                options = listOf("Drivers", "Teams"),
                selectedIndex = 0,
                onSelectionChanged = {},
            )
        }
        rule.onNodeWithText("Drivers").assertIsDisplayed()
        rule.onNodeWithText("Teams").assertIsDisplayed()
    }

    @Test
    fun clickSecondOptionCallsCallback() {
        var selected = -1
        rule.setThemedContent {
            PillToggle(
                options = listOf("km", "miles"),
                selectedIndex = 0,
                onSelectionChanged = { selected = it },
            )
        }
        rule.onNodeWithText("miles").performClick()
        assertEquals(1, selected)
    }

    @Test
    fun toggleSwitchesSelection() {
        rule.setThemedContent {
            var idx by remember { mutableIntStateOf(0) }
            PillToggle(
                options = listOf("On", "Off"),
                selectedIndex = idx,
                onSelectionChanged = { idx = it },
            )
        }
        // Tap "Off"
        rule.onNodeWithText("Off").performClick()
        // Tap "On" again
        rule.onNodeWithText("On").performClick()
        // Both labels still visible
        rule.onNodeWithText("On").assertIsDisplayed()
        rule.onNodeWithText("Off").assertIsDisplayed()
    }
}
