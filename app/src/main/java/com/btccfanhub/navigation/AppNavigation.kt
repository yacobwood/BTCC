package com.btccfanhub.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.btccfanhub.data.ArticleHolder
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
import com.btccfanhub.ui.settings.SettingsScreen

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
}

@Composable
fun AppNavHost(navController: NavHostController) {
    NavHost(navController = navController, startDestination = Screen.News.route) {

        composable(Screen.News.route) {
            NewsScreen(
                onArticleClick = { article ->
                    ArticleHolder.current = article
                    navController.navigate(Screen.Article.route)
                },
                onSettingsClick = { navController.navigate(Screen.Settings.route) },
            )
        }

        composable(Screen.Calendar.route) {
            CalendarScreen(
                onRaceClick = { race ->
                    navController.navigate(Screen.Track.route(race.round))
                }
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
            SettingsScreen(onBack = { navController.popBackStack() })
        }

        composable(
            route = Screen.Track.route,
            arguments = listOf(navArgument("round") { type = NavType.IntType }),
        ) { backStackEntry ->
            val round = backStackEntry.arguments?.getInt("round") ?: return@composable
            TrackDetailScreen(round = round, onBack = { navController.popBackStack() })
        }

    }
}
