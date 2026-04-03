package com.btccfanhub.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.createComposeRule
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ThemeTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun primaryColorIsBtccYellow() {
        var primary = BtccBackground // placeholder
        rule.setContent {
            BTCCFanHubTheme {
                primary = MaterialTheme.colorScheme.primary
            }
        }
        assertEquals(BtccYellow, primary)
    }

    @Test
    fun onPrimaryColorIsBtccNavy() {
        var onPrimary = BtccBackground
        rule.setContent {
            BTCCFanHubTheme {
                onPrimary = MaterialTheme.colorScheme.onPrimary
            }
        }
        assertEquals(BtccNavy, onPrimary)
    }

    @Test
    fun backgroundColorIsBtccBackground() {
        var bg = BtccYellow
        rule.setContent {
            BTCCFanHubTheme {
                bg = MaterialTheme.colorScheme.background
            }
        }
        assertEquals(BtccBackground, bg)
    }

    @Test
    fun surfaceColorIsBtccSurface() {
        var surface = BtccYellow
        rule.setContent {
            BTCCFanHubTheme {
                surface = MaterialTheme.colorScheme.surface
            }
        }
        assertEquals(BtccSurface, surface)
    }

    @Test
    fun surfaceVariantIsBtccCard() {
        var surfaceVariant = BtccYellow
        rule.setContent {
            BTCCFanHubTheme {
                surfaceVariant = MaterialTheme.colorScheme.surfaceVariant
            }
        }
        assertEquals(BtccCard, surfaceVariant)
    }
}
