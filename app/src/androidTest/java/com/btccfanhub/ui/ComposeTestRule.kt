package com.btccfanhub.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import com.btccfanhub.ui.theme.BTCCFanHubTheme

/**
 * Sets themed content for tests — wraps composable in BTCCFanHubTheme.
 */
fun ComposeContentTestRule.setThemedContent(content: @Composable () -> Unit) {
    setContent {
        BTCCFanHubTheme {
            content()
        }
    }
}
