package com.btccfanhub

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Radio

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.btccfanhub.data.ArticleHolder
import com.btccfanhub.data.network.RssParser
import com.btccfanhub.navigation.AppNavHost
import com.btccfanhub.navigation.Screen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.btccfanhub.ui.ads.AdmobBanner
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.worker.NewsCheckWorker
import com.google.android.gms.ads.MobileAds
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    private val pendingArticleId = mutableStateOf<Int?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MobileAds.initialize(this)
        createNewsNotificationChannel()
        scheduleNewsCheck()
        requestNewsNotificationPermission()
        handleNotificationIntent(intent)
        enableEdgeToEdge()
        setContent {
            BTCCFanHubTheme {
                MainScreen(
                    pendingArticleId = pendingArticleId.value,
                    onArticleIdConsumed = { pendingArticleId.value = null },
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    private fun handleNotificationIntent(intent: Intent?) {
        val id = intent?.getIntExtra(NewsCheckWorker.EXTRA_ARTICLE_ID, -1) ?: -1
        if (id != -1) pendingArticleId.value = id
    }

    private fun createNewsNotificationChannel() {
        val channel = NotificationChannel(
            NewsCheckWorker.CHANNEL_ID,
            "News Alerts",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Notifications for new BTCC news articles"
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun scheduleNewsCheck() {
        val wm = WorkManager.getInstance(this)

        // Periodic background check (production)
        val periodic = PeriodicWorkRequestBuilder<NewsCheckWorker>(15, TimeUnit.MINUTES).build()
        wm.enqueueUniquePeriodicWork(
            NewsCheckWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodic,
        )

    }

    private fun requestNewsNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
        ) {
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}

private data class NavItem(
    val screen: Screen,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

@Composable
private fun MainScreen(pendingArticleId: Int? = null, onArticleIdConsumed: () -> Unit = {}) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    LaunchedEffect(pendingArticleId) {
        if (pendingArticleId != null) {
            val article = withContext(Dispatchers.IO) {
                RssParser.fetchArticleById(pendingArticleId)
            }
            onArticleIdConsumed()
            if (article != null) {
                ArticleHolder.current = article
                navController.navigate(Screen.Article.route) { launchSingleTop = true }
            }
        }
    }

    val showBottomBar = currentRoute != Screen.Article.route &&
            currentRoute?.startsWith("track/") != true &&
            currentRoute != Screen.LiveTiming.route

    val navItems = listOf(
        NavItem(Screen.News, "News", Icons.Default.Home),
        NavItem(Screen.Calendar, "Calendar", Icons.Default.DateRange),
        NavItem(Screen.Drivers, "Grid", Icons.Default.Groups),
        NavItem(Screen.Results, "Results", Icons.Default.EmojiEvents),
        NavItem(Screen.Radio, "Radio", Icons.Default.Radio),
    )

    val navItemColors = NavigationBarItemDefaults.colors(
        selectedIconColor = BtccYellow,
        selectedTextColor = BtccYellow,
        indicatorColor = BtccYellow.copy(alpha = 0.12f),
        unselectedIconColor = BtccTextSecondary,
        unselectedTextColor = BtccTextSecondary,
    )

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                Column {
                    AdmobBanner()
                    NavigationBar(
                        containerColor = BtccSurface,
                        tonalElevation = 0.dp,
                    ) {
                        navItems.forEach { item ->
                            NavigationBarItem(
                                icon = { Icon(item.icon, contentDescription = item.label) },
                                label = { Text(item.label, fontWeight = FontWeight.SemiBold, fontSize = 11.sp) },
                                selected = when (item.screen) {
                                    Screen.Calendar -> currentRoute == Screen.Calendar.route || currentRoute == Screen.Track.route
                                    Screen.Results  -> currentRoute == Screen.Results.route || currentRoute == Screen.RoundResults.route
                                    else            -> currentRoute == item.screen.route
                                },
                                colors = navItemColors,
                                onClick = {
                                    navController.navigate(item.screen.route) {
                                        popUpTo(Screen.News.route)
                                        launchSingleTop = true
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding)) {
            AppNavHost(navController = navController)
        }
    }
}
