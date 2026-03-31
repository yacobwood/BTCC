package com.btccfanhub.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.data.ArticleHolder
import com.btccfanhub.data.store.FeatureFlagsStore
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.btccfanhub.ui.calendar.CalendarScreen
import com.btccfanhub.ui.calendar.TrackDetailScreen
import com.btccfanhub.ui.drivers.DriversScreen
import com.btccfanhub.ui.news.ArticleScreen
import com.btccfanhub.ui.news.NewsScreen
import com.btccfanhub.ui.radio.RadioScreen
import com.btccfanhub.ui.results.ResultsScreen
import com.btccfanhub.ui.results.RoundResultsScreen
import com.btccfanhub.ui.more.InfoPageScreen
import com.btccfanhub.ui.more.MoreScreen
import com.btccfanhub.ui.settings.BugReportScreen
import com.btccfanhub.ui.settings.FeatureFlagsScreen
import com.btccfanhub.ui.settings.SettingsScreen
import com.btccfanhub.ui.merch.ShopTheGridScreen
import com.btccfanhub.ui.merch.ShopBrowseScreen
import com.btccfanhub.ui.merch.FilteredMerchScreen
import com.btccfanhub.ui.timing.LiveTimingScreen

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
    object LiveTiming : Screen("live_timing/{eventId}") {
        fun route(eventId: Int) = "live_timing/$eventId"
    }
    object FeatureFlags : Screen("feature_flags")
    object BugReport : Screen("bug_report")
    object More : Screen("more")
    object Shop : Screen("shop")
    object ShopBrowse : Screen("shop_browse/{browseType}") {
        fun route(browseType: String) = "shop_browse/$browseType"
    }
    object ShopFiltered : Screen("shop/{filterType}/{filterValue}") {
        fun route(filterType: String, filterValue: String) = "shop/$filterType/${Uri.encode(filterValue)}"
    }
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
                onShopClick = { navController.navigate(Screen.Shop.route) { popUpTo(Screen.News.route); launchSingleTop = true } },
            )
        }

        composable(Screen.Calendar.route) {
            val flagLiveUpdates by FeatureFlagsStore.liveUpdates.collectAsState()
            CalendarScreen(
                onRaceClick = { race ->
                    navController.navigate(Screen.Track.route(race.round))
                },
                onLiveTimingClick = if (flagLiveUpdates) {
                    { eventId -> navController.navigate(Screen.LiveTiming.route(eventId)) }
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
            LaunchedEffect(year, round) { Analytics.roundResultsViewed(year, round) }
            RoundResultsScreen(year = year, round = round, onBack = { navController.popBackStack(Screen.Results.route, inclusive = false) })
        }

        composable(Screen.Radio.route) {
            RadioScreen(onBack = { navController.popBackStack(Screen.More.route, inclusive = false) })
        }

        composable(Screen.Article.route) {
            ArticleScreen(onBack = { navController.popBackStack(Screen.News.route, inclusive = false) })
        }

        composable(Screen.Settings.route) {
            SettingsScreen(
                onBack = { navController.popBackStack(Screen.More.route, inclusive = false) },
                onFeatureFlagsClick = { navController.navigate(Screen.FeatureFlags.route) },
            )
        }

        composable(Screen.FeatureFlags.route) {
            FeatureFlagsScreen(onBack = { navController.popBackStack(Screen.Settings.route, inclusive = false) })
        }

        composable(Screen.BugReport.route) {
            BugReportScreen(
                onBack          = { navController.popBackStack(Screen.More.route, inclusive = false) },
                onReturnToNews  = { navController.popBackStack(Screen.News.route, inclusive = false) },
            )
        }

        composable(
            route = Screen.Track.route,
            arguments = listOf(navArgument("round") { type = NavType.IntType }),
        ) { backStackEntry ->
            val round = backStackEntry.arguments?.getInt("round") ?: return@composable
            LaunchedEffect(round) { Analytics.trackDetailViewed(round, "") }
            val flagLiveUpdates by FeatureFlagsStore.liveUpdates.collectAsState()
            TrackDetailScreen(
                round = round,
                onBack = { navController.popBackStack(Screen.Calendar.route, inclusive = false) },
                onLiveTimingClick = if (flagLiveUpdates) {
                    { eventId -> navController.navigate(Screen.LiveTiming.route(eventId)) }
                } else null,
            )
        }

        composable(
            route = Screen.LiveTiming.route,
            arguments = listOf(navArgument("eventId") { type = NavType.IntType }),
        ) { backStackEntry ->
            val eventId = backStackEntry.arguments?.getInt("eventId") ?: return@composable
            LaunchedEffect(eventId) { Analytics.liveTimingOpened(eventId) }
            LiveTimingScreen(eventId = eventId, onBack = { navController.popBackStack(Screen.Calendar.route, inclusive = false) })
        }

        composable(Screen.More.route) {
            MoreScreen(
                onSettingsClick  = { navController.navigate(Screen.Settings.route) },
                onBugReportClick = { navController.navigate(Screen.BugReport.route) },
                onRadioClick     = { navController.navigate(Screen.Radio.route) },
                onInfoPageClick  = { pageId -> navController.navigate(Screen.InfoPage.route(pageId)) },
            )
        }

        composable(
            route = Screen.InfoPage.route,
            arguments = listOf(navArgument("pageId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val pageId = backStackEntry.arguments?.getString("pageId") ?: return@composable
            LaunchedEffect(pageId) { Analytics.infoPageViewed(pageId) }
            InfoPageScreen(
                pageId = pageId,
                onBack = { navController.popBackStack(Screen.More.route, inclusive = false) },
                onPageClick = { targetId -> navController.navigate(Screen.InfoPage.route(targetId)) },
            )
        }

        composable(Screen.Shop.route) {
            ShopTheGridScreen(
                onBrowseDriversClick = { navController.navigate(Screen.ShopBrowse.route("drivers")) },
                onBrowseTeamsClick   = { navController.navigate(Screen.ShopBrowse.route("teams")) },
                onTeamClick   = { teamName     -> navController.navigate(Screen.ShopFiltered.route("team", teamName)) },
                onDriverClick = { driverNumber -> navController.navigate(Screen.ShopFiltered.route("driver", driverNumber.toString())) },
            )
        }

        composable(
            route = Screen.ShopBrowse.route,
            arguments = listOf(navArgument("browseType") { type = NavType.StringType }),
        ) { backStackEntry ->
            val browseType = backStackEntry.arguments?.getString("browseType") ?: "drivers"
            ShopBrowseScreen(
                browseType = browseType,
                onDriverClick = { driverNumber -> navController.navigate(Screen.ShopFiltered.route("driver", driverNumber.toString())) },
                onTeamClick   = { teamName     -> navController.navigate(Screen.ShopFiltered.route("team", teamName)) },
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.ShopFiltered.route,
            arguments = listOf(
                navArgument("filterType") { type = NavType.StringType },
                navArgument("filterValue") { type = NavType.StringType },
            ),
        ) { backStackEntry ->
            val filterType = backStackEntry.arguments?.getString("filterType") ?: return@composable
            val filterValue = backStackEntry.arguments?.getString("filterValue") ?: return@composable
            val title = if (filterType == "driver") "Driver #$filterValue Gear" else filterValue
            FilteredMerchScreen(
                title = title,
                filterType = filterType,
                filterValue = filterValue,
                onBack = { navController.popBackStack() },
            )
        }

    }
}
