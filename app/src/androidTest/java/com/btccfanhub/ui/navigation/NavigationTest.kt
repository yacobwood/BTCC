package com.btccfanhub.ui.navigation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.navigation.compose.rememberNavController
import androidx.navigation.testing.TestNavHostController
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.remember
import androidx.navigation.compose.ComposeNavigator
import com.btccfanhub.navigation.AppNavHost
import com.btccfanhub.navigation.Screen
import com.btccfanhub.ui.setThemedContent
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class NavigationTest {

    @get:Rule
    val rule = createComposeRule()

    @Test
    fun startDestinationIsNews() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.waitForIdle()
        assertEquals(Screen.News.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToCalendar() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.Calendar.route)
        }
        rule.waitForIdle()
        assertEquals(Screen.Calendar.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToDrivers() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.Drivers.route)
        }
        rule.waitForIdle()
        assertEquals(Screen.Drivers.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToResults() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.Results.route)
        }
        rule.waitForIdle()
        assertEquals(Screen.Results.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToMore() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.More.route)
        }
        rule.waitForIdle()
        assertEquals(Screen.More.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToSettingsFromMore() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.More.route)
        }
        rule.waitForIdle()
        rule.runOnUiThread {
            navController.navigate(Screen.Settings.route)
        }
        rule.waitForIdle()
        assertEquals(Screen.Settings.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToTrackDetail() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.Track.route(1))
        }
        rule.waitForIdle()
        assertEquals(Screen.Track.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToRoundResults() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.RoundResults.route(2025, 1))
        }
        rule.waitForIdle()
        assertEquals(Screen.RoundResults.route, navController.currentDestination?.route)
    }

    @Test
    fun navigateToInfoPage() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.InfoPage.route("new-to-btcc"))
        }
        rule.waitForIdle()
        assertEquals(Screen.InfoPage.route, navController.currentDestination?.route)
    }

    @Test
    fun backFromSettingsReturnsToMore() {
        lateinit var navController: TestNavHostController
        rule.setThemedContent {
            navController = TestNavHostController(LocalContext.current).apply {
                navigatorProvider.addNavigator(ComposeNavigator())
            }
            AppNavHost(navController = navController)
        }
        rule.runOnUiThread {
            navController.navigate(Screen.More.route)
            navController.navigate(Screen.Settings.route)
        }
        rule.waitForIdle()
        rule.runOnUiThread {
            navController.popBackStack(Screen.More.route, inclusive = false)
        }
        rule.waitForIdle()
        assertEquals(Screen.More.route, navController.currentDestination?.route)
    }
}
