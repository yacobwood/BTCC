package com.btccfanhub.ui.onboarding

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.btccfanhub.ui.setThemedContent
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class WhatsNewDialogTest {

    @get:Rule
    val rule = createComposeRule()

    private val changes = listOf(
        "Live timing support",
        "Bug fixes and improvements",
        "New driver profiles",
    )

    @Test
    fun displaysHeaderAndChanges() {
        rule.setThemedContent {
            WhatsNewDialog(changes = changes, onDismiss = {})
        }
        rule.onNodeWithText("WHAT'S NEW").assertIsDisplayed()
        rule.onNodeWithText("Latest update").assertIsDisplayed()
        changes.forEach { change ->
            rule.onNodeWithText(change).assertIsDisplayed()
        }
    }

    @Test
    fun gotItButtonDismisses() {
        var dismissed = false
        rule.setThemedContent {
            WhatsNewDialog(changes = changes, onDismiss = { dismissed = true })
        }
        rule.onNodeWithText("GOT IT").performClick()
        assertTrue(dismissed)
    }
}
