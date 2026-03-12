package com.btcchub.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.btcchub.data.ArticleHolder
import com.btcchub.data.FeatureFlagsStore
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.btcchub.ui.calendar.CalendarScreen
import com.btcchub.ui.calendar.TrackDetailScreen
import com.btcchub.ui.drivers.DriversScreen
import com.btcchub.ui.news.ArticleScreen
import com.btcchub.ui.news.NewsScreen
import com.btcchub.ui.radio.RadioScreen
import com.btcchub.ui.results.ResultsScreen
import com.btcchub.ui.results.RoundResultsScreen
import com.btcchub.ui.more.InfoPageScreen
import com.btcchub.ui.more.MoreScreen
import com.btcchub.ui.settings.BugReportScreen
import com.btcchub.ui.settings.FeatureFlagsScreen
import com.btcchub.ui.settings.SettingsScreen
import com.btcchub.ui.timing.LiveTimingScreen

sealed class Screen(val route: String) {
    object News : Screen("news")
    object Calendar : Screen("calendar")
    object Drivers : Screen("drivers")
    object Results : Screen("results")
    object Radio : Screen("radio")
    object Article : Screen("article")
    object Settings : Screen("settings")
    object Track : Screen("track/{round}") {
        fun route(round: Int) = "track/$round"
    }
    object RoundResults : Screen("round_results/{year}/{round}") {
        fun route(year: Int, round: Int) = "round_results/$year/$round"
    }
    object LiveTiming : Screen("live_timing")
    object FeatureFlags : Screen("feature_flags")
    object BugReport : Screen("bug_report")
    object More : Screen("more")
    object InfoPage : Screen("info_page/{pageId}") {
        fun route(pageId: String) = "info_page/$pageId"
    }
}

@Composable
fun AppNavHost(navController: NavHostController, newsScrollToTopTrigger: Int = 0) {
    NavHost(navController = navController, startDestination = Screen.News.route) {

        composable(Screen.News.route) {
            NewsScreen(
                onArticleClick = { article ->
                    ArticleHolder.current = article
                    navController.navigate(Screen.Article.route)
                },
                scrollToTopTrigger = newsScrollToTopTrigger,
            )
        }

        composable(Screen.Calendar.route) {
            val flagLiveUpdates by FeatureFlagsStore.liveUpdates.collectAsState()
            CalendarScreen(
                onRaceClick = { race ->
                    navController.navigate(Screen.Track.route(race.round))
                },
                onLiveTimingClick = if (flagLiveUpdates) {
                    { navController.navigate(Screen.LiveTiming.route) }
                } else null,
            )
        }

        composable(Screen.Drivers.route) {
            DriversScreen()
        }

        composable(Screen.Results.route) {
            ResultsScreen(onRoundClick = { year, round ->
                navController.navigate(Screen.RoundResults.route(year, round))
            })
        }

        composable(
            route = Screen.RoundResults.route,
            arguments = listOf(
                navArgument("year")  { type = NavType.IntType },
                navArgument("round") { type = NavType.IntType },
            ),
        ) { backStackEntry ->
            val year  = backStackEntry.arguments?.getInt("year")  ?: 2026
            val round = backStackEntry.arguments?.getInt("round") ?: return@composable
            RoundResultsScreen(year = year, round = round, onBack = { navController.popBackStack() })
        }

        composable(Screen.Radio.route) {
            RadioScreen()
        }

        composable(Screen.Article.route) {
            ArticleScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
            )
        }

        composable(Screen.FeatureFlags.route) {
            FeatureFlagsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.BugReport.route) {
            BugReportScreen(
                onBack          = { navController.popBackStack() },
                onReturnToNews  = { navController.popBackStack(Screen.News.route, inclusive = false) },
            )
        }

        composable(
            route = Screen.Track.route,
            arguments = listOf(navArgument("round") { type = NavType.IntType }),
        ) { backStackEntry ->
            val round = backStackEntry.arguments?.getInt("round") ?: return@composable
            val flagLiveUpdates by FeatureFlagsStore.liveUpdates.collectAsState()
            TrackDetailScreen(
                round = round,
                onBack = { navController.popBackStack() },
                onLiveTimingClick = if (flagLiveUpdates) {
                    { navController.navigate(Screen.LiveTiming.route) }
                } else null,
            )
        }

        composable(Screen.LiveTiming.route) {
            LiveTimingScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.More.route) {
            MoreScreen(
                onSettingsClick = { navController.navigate(Screen.Settings.route) },
                onBugReportClick = { navController.navigate(Screen.BugReport.route) },
                onInfoPageClick = { pageId -> navController.navigate(Screen.InfoPage.route(pageId)) },
            )
        }

        composable(
            route = Screen.InfoPage.route,
            arguments = listOf(navArgument("pageId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val pageId = backStackEntry.arguments?.getString("pageId") ?: return@composable
            InfoPageScreen(pageId = pageId, onBack = { navController.popBackStack() })
        }

    }
}
