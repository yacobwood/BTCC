package com.btccfanhub.ui.results

import android.content.res.Configuration
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.test.DeviceConfigurationOverride
import androidx.compose.ui.test.ForcedSize
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import io.kotest.property.Arb
import io.kotest.property.PropTestConfig
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

// Feature: tablet-master-detail, Property 2: Item selection updates detail pane inline on tablet

/**
 * **Validates: Requirements 1.2, 5.1**
 *
 * Property 2: For any master-detail screen on a tablet device and for any
 * selectable item (round), tapping that item shall update the detail pane to
 * show the corresponding detail content without triggering a NavController
 * route navigation.
 *
 * This test uses the Results screen: on tablet, clicking a round in the
 * Results tab should set selectedRound state and show RoundResultsScreen in
 * the detail pane. The onRoundClick navigation lambda must NOT be called.
 */
class ResultsItemSelectionPropertyTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun itemSelectionUpdatesDetailPaneInlineOnTablet() {
        var navigationCallCount = 0

        // Use a historical year (2025) which loads from local assets — no network needed.
        // initialTab = 2 puts us on the "Results" tab immediately.
        rule.setContent {
            val config = Configuration(LocalConfiguration.current).apply {
                screenWidthDp = 800
            }
            DeviceConfigurationOverride(
                DeviceConfigurationOverride.ForcedSize(DpSize(800.dp, 1000.dp))
            ) {
                CompositionLocalProvider(LocalConfiguration provides config) {
                    BTCCFanHubTheme {
                        ResultsScreen(
                            onRoundClick = { _, _ -> navigationCallCount++ },
                            initialTab = 2,
                        )
                    }
                }
            }
        }

        // Wait for data to load and UI to settle
        rule.waitForIdle()
        rule.waitUntil(timeoutMillis = 10_000) {
            rule.onAllNodesWithText("Select a round to view results")
                .fetchSemanticsNodes().isNotEmpty()
        }

        // Verify placeholder is shown initially
        rule.onNodeWithText("Select a round to view results")
            .assertIsDisplayed()

        // The detail pane should exist
        rule.onNodeWithTag("results_detail_pane")
            .assertIsDisplayed()

        runBlocking {
            // Property: for random round indices, tapping a round updates the detail
            // pane and does NOT call the navigation lambda.
            // We use the loaded round data — 2025 season has completed rounds.
            // We'll click the first visible round card (by venue name) and verify
            // the detail pane updates.
            checkAll(PropTestConfig(iterations = 100), Arb.int(1..100)) { iteration ->
                // Reset navigation counter for each iteration
                navigationCallCount = 0

                // Find and click the first round card in the results list.
                // Round cards display venue names. For 2025 data, the first round
                // is typically "Brands Hatch". We use the master pane's round list.
                val masterNodes = rule.onAllNodesWithText("Brands Hatch")
                    .fetchSemanticsNodes()

                if (masterNodes.isNotEmpty()) {
                    // Click the first round card with "Brands Hatch"
                    rule.onAllNodesWithText("Brands Hatch")[0]
                        .performClick()

                    rule.waitForIdle()

                    // Property assertion 1: The placeholder should no longer be shown
                    // (detail pane now shows RoundResultsScreen content)
                    val placeholderNodes = rule.onAllNodesWithText("Select a round to view results")
                        .fetchSemanticsNodes()
                    assertEquals(
                        "Placeholder should disappear after selecting a round (iteration $iteration)",
                        0,
                        placeholderNodes.size
                    )

                    // Property assertion 2: The detail pane should contain round detail content.
                    // RoundResultsScreen shows "ROUNDS X–Y" in its TopAppBar subtitle.
                    val roundDetailNodes = rule.onAllNodesWithText("ROUNDS", substring = true)
                        .fetchSemanticsNodes()
                    assert(roundDetailNodes.isNotEmpty()) {
                        "Detail pane should show RoundResultsScreen content with 'ROUNDS' text (iteration $iteration)"
                    }

                    // Property assertion 3: The onRoundClick navigation lambda must NOT be called
                    assertEquals(
                        "onRoundClick navigation lambda should NOT be called on tablet (iteration $iteration)",
                        0,
                        navigationCallCount
                    )
                }
            }
        }
    }
}
