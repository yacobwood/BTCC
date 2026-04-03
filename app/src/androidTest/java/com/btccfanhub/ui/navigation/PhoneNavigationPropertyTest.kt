package com.btccfanhub.ui.navigation

import android.content.res.Configuration
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.test.DeviceConfigurationOverride
import androidx.compose.ui.test.ForcedSize
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.btccfanhub.ui.drivers.DriversScreen
import com.btccfanhub.ui.news.NewsScreen
import com.btccfanhub.ui.results.ResultsScreen
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import io.kotest.common.ExperimentalKotest
import io.kotest.property.Arb
import io.kotest.property.PropTestConfig
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

// Feature: tablet-master-detail, Property 3: Phone navigation behavior preserved

/**
 * **Validates: Requirements 1.3, 2.4, 3.3, 5.3**
 *
 * Property 3: For any screen on a phone device (screen width <600dp) and for any
 * selectable item, tapping that item shall trigger the existing navigation mechanism
 * (NavController route for Results and News, BackHandler-based in-screen navigation
 * for Drivers) — identical to the behavior before this feature.
 *
 * This test verifies that at phone widths (<600dp), none of the screens render the
 * tablet master-detail layout (no master pane, divider, or detail pane tags). This
 * confirms the phone code path is active, which preserves the original navigation:
 * - ResultsScreen: onRoundClick lambda (NavController navigation)
 * - NewsScreen: onArticleClick lambda (NavController navigation)
 * - DriversScreen: BackHandler-based in-screen navigation
 */
@OptIn(ExperimentalKotest::class)
class PhoneNavigationPropertyTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun resultsScreenUsesPhoneLayoutOnPhoneWidths() {
        var screenWidth by mutableIntStateOf(320)

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
                        ResultsScreen(
                            onRoundClick = { _, _ -> },
                        )
                    }
                }
            }
        }

        runBlocking {
            checkAll(PropTestConfig(iterations = 100), Arb.int(320..599)) { width ->
                screenWidth = width
                rule.waitForIdle()

                // Master-detail layout tags must NOT exist on phone
                rule.onNodeWithTag("results_master_pane").assertDoesNotExist()
                rule.onNodeWithTag("results_divider").assertDoesNotExist()
                rule.onNodeWithTag("results_detail_pane").assertDoesNotExist()
            }
        }
    }

    @Test
    fun newsScreenUsesPhoneLayoutOnPhoneWidths() {
        var screenWidth by mutableIntStateOf(320)

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
                        NewsScreen(onArticleClick = {})
                    }
                }
            }
        }

        runBlocking {
            checkAll(PropTestConfig(iterations = 100), Arb.int(320..599)) { width ->
                screenWidth = width
                rule.waitForIdle()

                // Master-detail layout tags must NOT exist on phone
                rule.onNodeWithTag("news_master_pane").assertDoesNotExist()
                rule.onNodeWithTag("news_divider").assertDoesNotExist()
                rule.onNodeWithTag("news_detail_pane").assertDoesNotExist()
            }
        }
    }

    @Test
    fun driversScreenUsesPhoneLayoutOnPhoneWidths() {
        var screenWidth by mutableIntStateOf(320)

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
            checkAll(PropTestConfig(iterations = 100), Arb.int(320..599)) { width ->
                screenWidth = width
                rule.waitForIdle()

                // Master-detail layout tags must NOT exist on phone
                rule.onNodeWithTag("drivers_master_pane").assertDoesNotExist()
                rule.onNodeWithTag("drivers_divider").assertDoesNotExist()
                rule.onNodeWithTag("drivers_detail_pane").assertDoesNotExist()
            }
        }
    }
}
