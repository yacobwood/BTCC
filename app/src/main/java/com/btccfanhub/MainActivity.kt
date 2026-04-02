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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import android.widget.Toast
import com.btccfanhub.data.ArticleHolder
import com.btccfanhub.data.ConnectivityObserver
import com.btccfanhub.data.store.FeatureFlagsStore
import com.btccfanhub.data.store.FavouriteDriverStore
import com.btccfanhub.data.store.OnboardingStore
import com.btccfanhub.data.store.ReviewPromptStore
import com.btccfanhub.data.store.WhatsNewStore
import com.btccfanhub.data.network.RssParser
import com.btccfanhub.ui.onboarding.NotificationOnboardingScreen
import com.btccfanhub.ui.onboarding.WhatsNewDialog
import com.btccfanhub.navigation.AppNavHost
import com.btccfanhub.navigation.Screen
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.btccfanhub.ui.ads.AdmobBanner
import com.btccfanhub.ui.theme.BTCCFanHubTheme
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.worker.NewsCheckWorker
import com.btccfanhub.worker.RaceNotificationWorker
import com.btccfanhub.worker.ResultsCheckWorker
import com.btccfanhub.receiver.TuesdayStandingsReceiver
import com.btccfanhub.receiver.WeekendPreviewReceiver
import com.btccfanhub.receiver.WeekendPreviewScheduler
import com.btccfanhub.widget.CountdownWidget
import com.google.android.gms.ads.MobileAds
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import com.google.android.play.core.review.ReviewManagerFactory
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* no-op */ }

    private val pendingArticleId   = mutableStateOf<Int?>(null)
    private val pendingArticleSlug = mutableStateOf<String?>(null)
    private val pendingOpenResults = mutableIntStateOf(0)
    private val pendingResultsRound = mutableIntStateOf(0)
    private val pendingResultsTab = mutableIntStateOf(0)
    private val pendingLiveTimingEventId = mutableStateOf<Int?>(null)
    private val pendingOpenTrack = mutableStateOf<Int?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val consentParams = ConsentRequestParameters.Builder().build()
        val consentInfo = UserMessagingPlatform.getConsentInformation(this)
        consentInfo.requestConsentInfoUpdate(this, consentParams,
            {
                if (consentInfo.isConsentFormAvailable &&
                    consentInfo.consentStatus == ConsentInformation.ConsentStatus.REQUIRED
                ) {
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) {
                        MobileAds.initialize(this)
                    }
                } else {
                    MobileAds.initialize(this)
                }
            },
            { MobileAds.initialize(this) }
        )
        FeatureFlagsStore.init(this)
        lifecycleScope.launch(Dispatchers.IO) {
            while (true) {
                FeatureFlagsStore.fetchRemote()
                delay(60_000)
            }
        }
        FavouriteDriverStore.init(this)
        createNewsNotificationChannel()
        createRaceNotificationChannel()
        createQualifyingNotificationChannel()
        createFreePracticeNotificationChannel()
        if (FeatureFlagsStore.resultsNotifications.value) {
            createResultsNotificationChannel()
            scheduleResultsCheck()
        }
        cancelLegacyRaceWorker()
        scheduleNewsCheck()
        scheduleWeekendPreview() // also schedules race session + Tuesday standings alarms
        handleNotificationIntent(intent)
        enableEdgeToEdge()
        ReviewPromptStore.recordLaunch(this)
        maybeRequestInAppReview()
        setContent {
            BTCCFanHubTheme {
                MainScreen(
                    pendingArticleId    = pendingArticleId.value,
                    onArticleIdConsumed = { pendingArticleId.value = null },
                    pendingArticleSlug  = pendingArticleSlug.value,
                    onArticleSlugConsumed = { pendingArticleSlug.value = null },
                    pendingOpenResults  = pendingOpenResults.intValue,
                    pendingResultsRound = pendingResultsRound.intValue,
                    pendingResultsTab   = pendingResultsTab.intValue,
                    onResultsConsumed   = { },
                    pendingLiveTimingEventId = pendingLiveTimingEventId.value,
                    onLiveTimingConsumed     = { pendingLiveTimingEventId.value = null },
                    pendingOpenTrack         = pendingOpenTrack.value,
                    onTrackConsumed          = { pendingOpenTrack.value = null },
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
            pendingResultsTab.intValue = intent?.getIntExtra(ResultsCheckWorker.EXTRA_RESULTS_TAB, 0) ?: 0
            pendingOpenResults.intValue++
        }
        // Deep link: btccfanhub://article/some-slug  OR  https://…vercel.app/news/some-slug
        if (intent?.action == Intent.ACTION_VIEW) {
            val uri = intent.data
            // btccfanhub://standings/{round} — fires the Tuesday standings notification immediately (for testing)
            if (uri?.scheme == "btccfanhub" && uri.host == "standings") {
                val round = uri.pathSegments.firstOrNull()?.toIntOrNull()
                if (round != null) {
                    val testIntent = Intent(this, TuesdayStandingsReceiver::class.java).apply {
                        putExtra(TuesdayStandingsReceiver.EXTRA_ROUND, round)
                    }
                    sendBroadcast(testIntent)
                }
            }
            // btccfanhub://preview/{round} — fires the weekend preview notification immediately (for testing)
            if (uri?.scheme == "btccfanhub" && uri.host == "preview") {
                val round = uri.pathSegments.firstOrNull()?.toIntOrNull()
                if (round != null) {
                    val testIntent = Intent(this, com.btccfanhub.receiver.WeekendPreviewReceiver::class.java).apply {
                        putExtra(com.btccfanhub.receiver.WeekendPreviewReceiver.EXTRA_ROUND, round)
                    }
                    lifecycleScope.launch(Dispatchers.IO) {
                        val calData = runCatching { com.btccfanhub.data.repository.CalendarRepository.getCalendarData() }.getOrNull()
                        val venue = calData?.rounds?.firstOrNull { it.round == round }?.venue ?: "Unknown"
                        testIntent.putExtra(com.btccfanhub.receiver.WeekendPreviewReceiver.EXTRA_VENUE, venue)
                        sendBroadcast(testIntent)
                    }
                }
            }
            val slug = when {
                uri?.scheme == "btccfanhub" && uri.host == "article" ->
                    uri.pathSegments.firstOrNull()
                uri?.scheme == "https" && uri.pathSegments.size >= 2 && uri.pathSegments[0] == Constants.SHARE_NEWS_PATH ->
                    uri.pathSegments[1]
                else -> null
            }
            if (!slug.isNullOrBlank()) pendingArticleSlug.value = slug
        }
        // Weekend preview notification → open track detail
        val openTrack = intent?.getBooleanExtra(WeekendPreviewReceiver.EXTRA_OPEN_TRACK, false) == true
        if (openTrack) {
            val round = intent?.getIntExtra(WeekendPreviewReceiver.EXTRA_TRACK_ROUND, -1) ?: -1
            if (round != -1) pendingOpenTrack.value = round
        }
        // Widget tap during race weekend → open live timing
        val liveTimingId = intent?.getIntExtra(CountdownWidget.EXTRA_LIVE_TIMING_EVENT_ID, -1) ?: -1
        if (liveTimingId != -1) pendingLiveTimingEventId.value = liveTimingId
    }

    private fun maybeRequestInAppReview() {
        if (!ReviewPromptStore.shouldRequestReview(this)) return
        val manager = ReviewManagerFactory.create(this)
        manager.requestReviewFlow().addOnCompleteListener { task ->
            if (task.isSuccessful) {
                ReviewPromptStore.markReviewRequested(this)
                manager.launchReviewFlow(this, task.result)
            }
        }
    }

    private fun createNewsNotificationChannel() {
        val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
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
        val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(RaceNotificationWorker.KEY_RACE_NOTIF_ENABLED, true)) return
        val channel = NotificationChannel(
            RaceNotificationWorker.CHANNEL_ID,
            "Race Alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when BTCC race sessions are about to start"
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun createQualifyingNotificationChannel() {
        val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(RaceNotificationWorker.KEY_QUALIFYING_NOTIF_ENABLED, true)) return
        val channel = NotificationChannel(
            RaceNotificationWorker.CHANNEL_ID_QUALIFYING,
            "Qualifying Alerts",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Notifications when BTCC qualifying is about to start"
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

    private fun createFreePracticeNotificationChannel() {
        val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(RaceNotificationWorker.KEY_FREE_PRACTICE_NOTIF_ENABLED, true)) return
        val channel = NotificationChannel(
            RaceNotificationWorker.CHANNEL_ID_FREE_PRACTICE,
            "Free Practice Alerts",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Notifications when BTCC free practice is about to start"
        }
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun createResultsNotificationChannel() {
        val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
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

    private fun cancelLegacyRaceWorker() {
        // RaceNotificationWorker was replaced by exact alarms in WeekendPreviewScheduler.
        // Cancel any still-running WorkManager job from older installs to prevent duplicates.
        val prefs = getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("legacy_race_worker_cancelled", false)) {
            WorkManager.getInstance(this).cancelUniqueWork(RaceNotificationWorker.WORK_NAME)
            prefs.edit().putBoolean("legacy_race_worker_cancelled", true).apply()
        }
    }

    private fun scheduleWeekendPreview() {
        lifecycleScope.launch {
            WeekendPreviewScheduler.schedule(this@MainActivity)
        }
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
    pendingArticleSlug: String? = null,
    onArticleSlugConsumed: () -> Unit = {},
    pendingOpenResults: Int = 0,
    pendingResultsRound: Int = 0,
    pendingResultsTab: Int = 0,
    onResultsConsumed: () -> Unit = {},
    pendingLiveTimingEventId: Int? = null,
    onLiveTimingConsumed: () -> Unit = {},
    pendingOpenTrack: Int? = null,
    onTrackConsumed: () -> Unit = {},
    onRequestPermission: () -> Unit = {},
) {
    val context = LocalContext.current
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    var newsScrollTrigger by remember { mutableIntStateOf(0) }
    var resultsTab by remember { mutableIntStateOf(pendingResultsTab) }
    var showOnboarding by remember { mutableStateOf(OnboardingStore.shouldShow(context)) }
    var showWhatsNew by remember { mutableStateOf(WhatsNewStore.shouldShow(context)) }

    val flagAds by FeatureFlagsStore.adsEnabled.collectAsState()
    val flagWhatsNew by FeatureFlagsStore.whatsNew.collectAsState()
    val isOnline by ConnectivityObserver.isOnline.collectAsState()

    if (showOnboarding) {
        NotificationOnboardingScreen(
            onEnableNotifications = {
                onRequestPermission()
                val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().putBoolean(ResultsCheckWorker.KEY_RESULTS_NOTIF_ENABLED, true).apply()
                val nm =
                    context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
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

    LaunchedEffect(pendingArticleSlug) {
        if (pendingArticleSlug != null) {
            val article = withContext(Dispatchers.IO) {
                RssParser.fetchArticleBySlug(pendingArticleSlug)
            }
            onArticleSlugConsumed()
            if (article != null) {
                ArticleHolder.current = article
                navController.navigate(Screen.Article.route) { launchSingleTop = true }
            } else {
                Toast.makeText(context, "Article not found", Toast.LENGTH_SHORT).show()
            }
        }
    }

    LaunchedEffect(pendingOpenResults) {
        if (pendingOpenResults > 0) {
            resultsTab = pendingResultsTab
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

    LaunchedEffect(pendingLiveTimingEventId) {
        if (pendingLiveTimingEventId != null) {
            onLiveTimingConsumed()
            navController.navigate(Screen.LiveTiming.route(pendingLiveTimingEventId)) {
                launchSingleTop = true
            }
        }
    }

    val isTablet = LocalConfiguration.current.screenWidthDp >= 600

    LaunchedEffect(pendingOpenTrack) {
        if (pendingOpenTrack != null) {
            onTrackConsumed()
            navController.navigate(Screen.Calendar.route) {
                popUpTo(Screen.News.route)
                launchSingleTop = true
            }
            // On tablet the track detail is shown inline in the master-detail panel;
            // navigating to Screen.Track would open a redundant full-screen page.
            if (!isTablet) {
                navController.navigate(Screen.Track.route(pendingOpenTrack)) {
                    launchSingleTop = true
                }
            }
        }
    }

    val showBottomBar = currentRoute == null ||
            (currentRoute != Screen.Article.route &&
                    currentRoute.startsWith("track/") != true &&
                    !currentRoute.startsWith("info_page/") &&
                    currentRoute != Screen.LiveTiming.route)

    val navItems = buildList {
        add(NavItem(Screen.News, "News", Icons.Default.Home))
        add(NavItem(Screen.Calendar, "Calendar", Icons.Default.DateRange))
        add(NavItem(Screen.Drivers, "Grid", Icons.Default.Groups))
        add(NavItem(Screen.Results, "Results", Icons.Default.EmojiEvents))
        add(NavItem(Screen.More, "More", Icons.Default.MoreHoriz))
    }

    val navItemSelected: (NavItem) -> Boolean = { item ->
        when (item.screen) {
            Screen.Calendar -> currentRoute == Screen.Calendar.route || currentRoute == Screen.Track.route
            Screen.Results -> currentRoute == Screen.Results.route || currentRoute == Screen.RoundResults.route
            Screen.More -> currentRoute == Screen.More.route || currentRoute == Screen.Settings.route || currentRoute == Screen.BugReport.route || currentRoute == Screen.FeatureFlags.route
            else -> currentRoute == item.screen.route
        }
    }

    val onNavItemClick: (NavItem) -> Unit = { item ->
        com.btccfanhub.data.analytics.Analytics.navItemClicked(item.label)
        if (item.screen == Screen.News) newsScrollTrigger++
        navController.navigate(item.screen.route) {
            popUpTo(Screen.News.route)
            launchSingleTop = true
        }
    }

    if (showWhatsNew && flagWhatsNew) {
        WhatsNewDialog(
            changes = WhatsNewStore.changes,
            onDismiss = {
                WhatsNewStore.markSeen(context)
                showWhatsNew = false
            },
        )
    }

    val navRailItemColors = NavigationRailItemDefaults.colors(
        selectedIconColor = BtccYellow,
        selectedTextColor = BtccYellow,
        indicatorColor = BtccYellow.copy(alpha = 0.12f),
        unselectedIconColor = BtccTextSecondary,
        unselectedTextColor = BtccTextSecondary,
    )

    val navItemColors = NavigationBarItemDefaults.colors(
        selectedIconColor = BtccYellow,
        selectedTextColor = BtccYellow,
        indicatorColor = BtccYellow.copy(alpha = 0.12f),
        unselectedIconColor = BtccTextSecondary,
        unselectedTextColor = BtccTextSecondary,
    )

    if (isTablet) {
        // Tablet: side NavigationRail + content
        Box(modifier = Modifier.fillMaxSize().background(BtccSurface)) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding(),
            ) {
                NavigationRail(
                    containerColor = BtccSurface,
                    modifier = Modifier.fillMaxHeight(),
                ) {
                Spacer(modifier = Modifier.weight(1f))
                navItems.forEach { item ->
                    NavigationRailItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = {
                            Text(
                                item.label,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 10.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Clip,
                            )
                        },
                        selected = navItemSelected(item),
                        colors = navRailItemColors,
                        onClick = { onNavItemClick(item) },
                    )
                }
                Spacer(modifier = Modifier.weight(1f))
            }
            Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                if (!isOnline) {
                    Box(
                        modifier = Modifier.fillMaxWidth().background(Color(0xFF444444)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "No internet connection",
                            modifier = Modifier.padding(vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                        )
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    AppNavHost(
                        navController = navController,
                        newsScrollToTopTrigger = newsScrollTrigger,
                        initialResultsTab = resultsTab,
                    )
                }
                if (flagAds) AdmobBanner()
            }
        }
        } // end Box
    } else {
        // Phone: bottom NavigationBar
        Scaffold(
            bottomBar = {
                if (showBottomBar) {
                    Column(modifier = Modifier.navigationBarsPadding()) {
                        if (flagAds) AdmobBanner()
                        NavigationBar(
                            containerColor = BtccSurface,
                            tonalElevation = 0.dp,
                        ) {
                            navItems.forEach { item ->
                                NavigationBarItem(
                                    icon = { Icon(item.icon, contentDescription = item.label) },
                                    label = {
                                        Text(
                                            item.label,
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 10.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Clip,
                                        )
                                    },
                                    selected = navItemSelected(item),
                                    colors = navItemColors,
                                    onClick = { onNavItemClick(item) },
                                )
                            }
                        }
                    }
                }
            }
        ) { innerPadding ->
            Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                if (!isOnline) {
                    Box(
                        modifier = Modifier.fillMaxWidth().background(Color(0xFF444444)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "No internet connection",
                            modifier = Modifier.padding(vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                        )
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    AppNavHost(
                        navController = navController,
                        newsScrollToTopTrigger = newsScrollTrigger,
                        initialResultsTab = resultsTab,
                    )
                }
            }
        }
    }
}
