package com.btcchub

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
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Radio

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.btcchub.data.ArticleHolder
import com.btcchub.data.FeatureFlagsStore
import com.btcchub.data.FavouriteDriverStore
import com.btcchub.data.OnboardingStore
import com.btcchub.data.WhatsNewStore
import com.btcchub.data.network.RssParser
import com.btcchub.ui.NotificationOnboardingScreen
import com.btcchub.ui.WhatsNewDialog
import com.btcchub.navigation.AppNavHost
import com.btcchub.navigation.Screen
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.btcchub.ui.ads.AdmobBanner
import com.btcchub.ui.theme.BTCCFanHubTheme
import com.btcchub.ui.theme.BtccNavy
import com.btcchub.ui.theme.BtccSurface
import com.btcchub.ui.theme.BtccTextSecondary
import com.btcchub.ui.theme.BtccYellow
import com.btcchub.worker.NewsCheckWorker
import com.btcchub.worker.RaceNotificationWorker
import com.btcchub.worker.ResultsCheckWorker
import com.google.android.gms.ads.MobileAds
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    private val pendingArticleId = mutableStateOf<Int?>(null)
    private val pendingOpenResults = mutableIntStateOf(0)
    private val pendingResultsRound = mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MobileAds.initialize(this)
        FeatureFlagsStore.init(this)
        lifecycleScope.launch(Dispatchers.IO) { FeatureFlagsStore.fetchRemote() }
        FavouriteDriverStore.init(this)
        createNewsNotificationChannel()
        createRaceNotificationChannel()
        if (FeatureFlagsStore.resultsNotifications.value) {
            createResultsNotificationChannel()
            scheduleResultsCheck()
        }
        scheduleNewsCheck()
        scheduleRaceNotifications()
        handleNotificationIntent(intent)
        enableEdgeToEdge()
        setContent {
            BTCCFanHubTheme {
                MainScreen(
                    pendingArticleId    = pendingArticleId.value,
                    onArticleIdConsumed = { pendingArticleId.value = null },
                    pendingOpenResults  = pendingOpenResults.intValue,
                    pendingResultsRound = pendingResultsRound.intValue,
                    onResultsConsumed   = { },
                    onRequestPermission = { requestNewsNotificationPermission() },
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
        val openResults = intent?.getBooleanExtra(ResultsCheckWorker.EXTRA_OPEN_RESULTS, false) == true
        if (openResults) {
            val round = intent?.getIntExtra(ResultsCheckWorker.EXTRA_RESULTS_ROUND, 0) ?: 0
            pendingResultsRound.intValue = round
            pendingOpenResults.intValue++
        }
    }

    private fun createNewsNotificationChannel() {
        val prefs = getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(NewsCheckWorker.KEY_NOTIF_ENABLED, true)) return
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

    private fun createRaceNotificationChannel() {
        val channel = NotificationChannel(
            RaceNotificationWorker.CHANNEL_ID,
            "Race Alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when BTCC sessions are about to start"
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun scheduleNewsCheck() {
        val wm = WorkManager.getInstance(this)
        val periodic = PeriodicWorkRequestBuilder<NewsCheckWorker>(15, TimeUnit.MINUTES).build()
        wm.enqueueUniquePeriodicWork(
            NewsCheckWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodic,
        )
    }

    private fun scheduleRaceNotifications() {
        val wm = WorkManager.getInstance(this)
        val periodic = PeriodicWorkRequestBuilder<RaceNotificationWorker>(15, TimeUnit.MINUTES).build()
        wm.enqueueUniquePeriodicWork(
            RaceNotificationWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            periodic,
        )
    }

    private fun createResultsNotificationChannel() {
        val prefs = getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(ResultsCheckWorker.KEY_RESULTS_NOTIF_ENABLED, true)) return
        val channel = NotificationChannel(
            ResultsCheckWorker.CHANNEL_ID,
            "Results Alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when new BTCC round results are published"
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun scheduleResultsCheck() {
        val wm = WorkManager.getInstance(this)
        val periodic = PeriodicWorkRequestBuilder<ResultsCheckWorker>(15, TimeUnit.MINUTES).build()
        wm.enqueueUniquePeriodicWork(
            ResultsCheckWorker.WORK_NAME,
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
private fun MainScreen(
    pendingArticleId: Int? = null,
    onArticleIdConsumed: () -> Unit = {},
    pendingOpenResults: Int = 0,
    pendingResultsRound: Int = 0,
    onResultsConsumed: () -> Unit = {},
    onRequestPermission: () -> Unit = {},
) {
    val context       = LocalContext.current
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    var newsScrollTrigger by remember { mutableIntStateOf(0) }
    var showOnboarding by remember { mutableStateOf(OnboardingStore.shouldShow(context)) }
    var showWhatsNew by remember { mutableStateOf(WhatsNewStore.shouldShow(context)) }

    val flagRadio   by FeatureFlagsStore.radioTab.collectAsState()
    val flagAds     by FeatureFlagsStore.adsEnabled.collectAsState()
    val flagWhatsNew by FeatureFlagsStore.whatsNew.collectAsState()

    if (showOnboarding) {
        NotificationOnboardingScreen(
            onEnableNotifications = {
                onRequestPermission()
                val prefs = context.getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putBoolean(ResultsCheckWorker.KEY_RESULTS_NOTIF_ENABLED, true).apply()
                val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.createNotificationChannel(
                    NotificationChannel(
                        ResultsCheckWorker.CHANNEL_ID,
                        "Results Alerts",
                        NotificationManager.IMPORTANCE_HIGH,
                    ).apply {
                        description = "Notifications when new BTCC round results are published"
                    }
                )
                OnboardingStore.markComplete(context)
                WhatsNewStore.markSeen(context)
                showOnboarding = false
                showWhatsNew = false
            },
            onSkip = {
                OnboardingStore.markComplete(context)
                WhatsNewStore.markSeen(context)
                showOnboarding = false
                showWhatsNew = false
            },
        )
        return
    }

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

    LaunchedEffect(pendingOpenResults) {
        if (pendingOpenResults > 0) {
            if (pendingResultsRound > 0) {
                navController.navigate(Screen.RoundResults.route(2026, pendingResultsRound)) {
                    popUpTo(Screen.News.route)
                    launchSingleTop = true
                }
            } else {
                navController.navigate(Screen.Results.route) {
                    popUpTo(Screen.News.route)
                    launchSingleTop = true
                }
            }
        }
    }

    val showBottomBar = currentRoute != Screen.Article.route &&
            currentRoute?.startsWith("track/") != true &&
            currentRoute?.startsWith("info_page/") != true &&
            currentRoute != Screen.LiveTiming.route

    val navItems = buildList {
        add(NavItem(Screen.News,     "News",     Icons.Default.Home))
        add(NavItem(Screen.Calendar, "Calendar", Icons.Default.DateRange))
        add(NavItem(Screen.Drivers,  "Grid",     Icons.Default.Groups))
        add(NavItem(Screen.Results,  "Results",  Icons.Default.EmojiEvents))
        if (flagRadio) add(NavItem(Screen.Radio, "Radio", Icons.Default.Radio))
        add(NavItem(Screen.More,     "More",     Icons.Default.MoreHoriz))
    }

    val navItemColors = NavigationBarItemDefaults.colors(
        selectedIconColor = BtccYellow,
        selectedTextColor = BtccYellow,
        indicatorColor = BtccYellow.copy(alpha = 0.12f),
        unselectedIconColor = BtccTextSecondary,
        unselectedTextColor = BtccTextSecondary,
    )

    if (showWhatsNew && flagWhatsNew) {
        WhatsNewDialog(
            changes   = WhatsNewStore.changes,
            onDismiss = {
                WhatsNewStore.markSeen(context)
                showWhatsNew = false
            },
        )
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                Column {
                    if (flagAds) AdmobBanner()
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
                                    Screen.More     -> currentRoute == Screen.More.route || currentRoute == Screen.Settings.route || currentRoute == Screen.BugReport.route || currentRoute == Screen.FeatureFlags.route
                                    else            -> currentRoute == item.screen.route
                                },
                                colors = navItemColors,
                                onClick = {
                                    if (item.screen == Screen.News) newsScrollTrigger++
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
            AppNavHost(navController = navController, newsScrollToTopTrigger = newsScrollTrigger)
        }
    }
}
