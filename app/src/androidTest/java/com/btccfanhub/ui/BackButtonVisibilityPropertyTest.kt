package com.btccfanhub.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.btccfanhub.data.ArticleHolder
import com.btccfanhub.data.model.Article
import com.btccfanhub.data.model.Driver
import com.btccfanhub.data.model.Team
import com.btccfanhub.ui.drivers.DriverDetailScreen
import com.btccfanhub.ui.drivers.TeamDetailScreen
import com.btccfanhub.ui.news.ArticleScreen
import com.btccfanhub.ui.results.RoundResultsScreen
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import io.kotest.property.Arb
import io.kotest.property.PropTestConfig
import io.kotest.property.arbitrary.boolean
import io.kotest.property.arbitrary.enum
import io.kotest.property.checkAll
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

// Feature: tablet-master-detail, Property 5: Back button visibility controlled by showBackButton parameter

/**
 * **Validates: Requirements 6.1, 6.2**
 *
 * Property 5: For any detail screen (RoundResultsScreen, DriverDetailScreen,
 * TeamDetailScreen, ArticleScreen), when rendered with showBackButton = false
 * the back navigation button shall not be displayed, and when rendered with
 * showBackButton = true the back navigation button shall be displayed.
 */
class BackButtonVisibilityPropertyTest {

    @get:Rule
    val rule = createComposeRule()

    enum class DetailScreenType {
        RoundResults,
        DriverDetail,
        TeamDetail,
        Article,
    }

    private val testDriver = Driver(
        number = 1,
        name = "Test Driver",
        team = "Test Team",
        car = "Test Car",
        imageUrl = "",
        nationality = "British",
    )

    private val testTeam = Team(
        name = "Test Team",
        car = "Test Car",
        entries = 2,
        drivers = listOf(testDriver),
    )

    private val testArticle = Article(
        id = 1,
        title = "Test Article",
        link = "https://example.com/test",
        description = "Test description",
        pubDate = "Mon, 01 Jan 2026 12:00:00 GMT",
        imageUrl = null,
        category = "News",
        content = "<p>Test content</p>",
    )

    @Test
    fun backButtonVisibilityControlledByShowBackButton() {
        // Use mutable state so we can drive the composable across iterations
        // without calling setContent more than once.
        var showBack by mutableStateOf(true)
        var screenType by mutableStateOf(DetailScreenType.RoundResults)

        ArticleHolder.current = testArticle

        rule.setContent {
            BTCCFanHubTheme {
                when (screenType) {
                    DetailScreenType.RoundResults ->
                        RoundResultsScreen(
                            year = 2025,
                            round = 1,
                            onBack = {},
                            showBackButton = showBack,
                        )
                    DetailScreenType.DriverDetail ->
                        DriverDetailScreen(
                            driver = testDriver,
                            onBack = {},
                            showBackButton = showBack,
                        )
                    DetailScreenType.TeamDetail ->
                        TeamDetailScreen(
                            team = testTeam,
                            onBack = {},
                            showBackButton = showBack,
                        )
                    DetailScreenType.Article ->
                        ArticleScreen(
                            onBack = {},
                            showBackButton = showBack,
                        )
                }
            }
        }

        runBlocking {
            checkAll(PropTestConfig(iterations = 100), Arb.boolean(), Arb.enum<DetailScreenType>()) { showBackArg, screenTypeArg ->
                showBack = showBackArg
                screenType = screenTypeArg
                rule.waitForIdle()

                val backNode = rule.onNodeWithContentDescription("Back")
                if (showBackArg) {
                    backNode.assertIsDisplayed()
                } else {
                    backNode.assertDoesNotExist()
                }
            }
        }
    }
}
