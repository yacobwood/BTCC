package com.btccfanhub.ui.drivers

import android.content.res.Configuration
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.test.DeviceConfigurationOverride
import androidx.compose.ui.test.ForcedSize
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import io.kotest.property.Arb
import io.kotest.property.PropTestConfig
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import kotlin.math.abs

// Feature: tablet-master-detail, Property 1: Master-detail layout structure on tablet

/**
 * **Validates: Requirements 2.1, 4.1, 4.2, 4.3**
 *
 * Property 1: For any master-detail screen (Drivers) rendered at a screen width
 * ≥600dp, the screen shall display a master pane of exactly 360dp width, a 1dp
 * vertical divider, and a detail pane that fills the remaining horizontal space
 * — all visible simultaneously.
 */
class DriversMasterDetailPropertyTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun masterDetailLayoutStructureOnTablet() {
        var screenWidth by mutableIntStateOf(600)

        rule.setContent {
            val widthDp = screenWidth
            val config = Configuration(LocalConfiguration.current).apply {
                screenWidthDp = widthDp
            }
            DeviceConfigurationOverride(
                DeviceConfigurationOverride.ForcedSize(DpSize(widthDp.dp, 800.dp))
            ) {
                CompositionLocalProvider(LocalConfiguration provides config) {
                    BTCCFanHubTheme {
                        DriversScreen()
                    }
                }
            }
        }

        runBlocking {
            checkAll(PropTestConfig(iterations = 100), Arb.int(600..1200)) { width ->
                screenWidth = width
                rule.waitForIdle()

                // Master pane exists and has 360dp width
                rule.onNodeWithTag("drivers_master_pane")
                    .assertIsDisplayed()
                    .assertWidthIsEqualTo(360.dp)

                // Divider exists and has 1dp width
                rule.onNodeWithTag("drivers_divider")
                    .assertIsDisplayed()
                    .assertWidthIsEqualTo(1.dp)

                // Detail pane exists and fills remaining space
                val detailBounds = rule.onNodeWithTag("drivers_detail_pane")
                    .assertIsDisplayed()
                    .getBoundsInRoot()
                val detailWidth = detailBounds.right - detailBounds.left
                val expectedDetailWidth = (width - 360 - 1).dp
                val tolerance = 2.dp
                assertTrue(
                    "Detail pane width ${detailWidth} should be ~${expectedDetailWidth} " +
                        "(tolerance ${tolerance}) for screen width ${width}dp",
                    abs(detailWidth.value - expectedDetailWidth.value) <= tolerance.value
                )

                // Placeholder text visible when no driver/team selected
                rule.onNodeWithText("Select a driver or team")
                    .assertIsDisplayed()
            }
        }
    }
}
