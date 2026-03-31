package com.btccfanhub.ui.settings

import androidx.activity.compose.BackHandler
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.BuildConfig
import com.btccfanhub.Constants
import com.btccfanhub.data.store.FeatureFlagsStore
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.ui.components.PillToggle
import com.btccfanhub.ui.theme.*
import com.btccfanhub.worker.NewsCheckWorker
import com.btccfanhub.worker.RaceNotificationWorker
import com.btccfanhub.worker.ResultsCheckWorker

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit = {}, onFeatureFlagsClick: () -> Unit = {}) {
    var navigatingBack by remember { mutableStateOf(false) }
    BackHandler { if (!navigatingBack) { navigatingBack = true; onBack() } }
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
    }
    val testModeEnabled by FeatureFlagsStore.widgetRaceWeekendTest.collectAsState()
    var versionTapCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) { Analytics.screen("settings") }
    var notificationsEnabled by remember {
        mutableStateOf(prefs.getBoolean(NewsCheckWorker.KEY_NOTIF_ENABLED, true))
    }
    var raceEnabled by remember {
        mutableStateOf(prefs.getBoolean(RaceNotificationWorker.KEY_RACE_NOTIF_ENABLED, true))
    }
    var qualifyingEnabled by remember {
        mutableStateOf(prefs.getBoolean(RaceNotificationWorker.KEY_QUALIFYING_NOTIF_ENABLED, true))
    }
    var resultsEnabled by remember {
        mutableStateOf(prefs.getBoolean(ResultsCheckWorker.KEY_RESULTS_NOTIF_ENABLED, true))
    }

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Text(
                        "SETTINGS",
                        fontWeight    = FontWeight.Black,
                        fontSize      = 18.sp,
                        letterSpacing = 1.sp,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onBackground,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
            )
        },
        containerColor = BtccBackground,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
        ) {
            Spacer(Modifier.height(8.dp))

            Text(
                "NOTIFICATIONS",
                style         = MaterialTheme.typography.labelSmall,
                fontWeight    = FontWeight.ExtraBold,
                color         = BtccTextSecondary,
                letterSpacing = 2.sp,
                modifier      = Modifier.padding(bottom = 12.dp),
            )

            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "News alerts",
                        color      = BtccTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize   = 15.sp,
                    )
                    Text(
                        "Get notified when a new BTCC article is published",
                        color    = BtccTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                PillToggle(
                    options = listOf("On", "Off"),
                    selectedIndex = if (notificationsEnabled) 0 else 1,
                    onSelectionChanged = {
                        notificationsEnabled = it == 0
                        Analytics.notificationTypeToggled("news", it == 0)
                        prefs.edit().putBoolean(NewsCheckWorker.KEY_NOTIF_ENABLED, it == 0).apply()
                        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                        if (it == 0) {
                            nm.createNotificationChannel(
                                NotificationChannel(
                                    NewsCheckWorker.CHANNEL_ID,
                                    "News Alerts",
                                    NotificationManager.IMPORTANCE_DEFAULT,
                                )
                            )
                        }
                    },
                )
            }

            Spacer(Modifier.height(16.dp))

            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Race alerts",
                        color      = BtccTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize   = 15.sp,
                    )
                    Text(
                        "Get notified when a race session is about to start",
                        color    = BtccTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                PillToggle(
                    options = listOf("On", "Off"),
                    selectedIndex = if (raceEnabled) 0 else 1,
                    onSelectionChanged = {
                        raceEnabled = it == 0
                        Analytics.notificationTypeToggled("race", it == 0)
                        prefs.edit().putBoolean(RaceNotificationWorker.KEY_RACE_NOTIF_ENABLED, it == 0).apply()
                        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                        if (it == 0) {
                            nm.createNotificationChannel(
                                NotificationChannel(
                                    RaceNotificationWorker.CHANNEL_ID,
                                    "Race Alerts",
                                    NotificationManager.IMPORTANCE_HIGH,
                                )
                            )
                        }
                    },
                )
            }

            Spacer(Modifier.height(16.dp))

            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Qualifying alerts",
                        color      = BtccTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize   = 15.sp,
                    )
                    Text(
                        "Get notified when qualifying is about to start",
                        color    = BtccTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                PillToggle(
                    options = listOf("On", "Off"),
                    selectedIndex = if (qualifyingEnabled) 0 else 1,
                    onSelectionChanged = {
                        qualifyingEnabled = it == 0
                        Analytics.notificationTypeToggled("qualifying", it == 0)
                        prefs.edit().putBoolean(RaceNotificationWorker.KEY_QUALIFYING_NOTIF_ENABLED, it == 0).apply()
                        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                        if (it == 0) {
                            nm.createNotificationChannel(
                                NotificationChannel(
                                    RaceNotificationWorker.CHANNEL_ID_QUALIFYING,
                                    "Qualifying Alerts",
                                    NotificationManager.IMPORTANCE_HIGH,
                                )
                            )
                        }
                    },
                )
            }

            val flagResultsNotifs by FeatureFlagsStore.resultsNotifications.collectAsState()

            if (flagResultsNotifs) {
                Spacer(Modifier.height(16.dp))

                Row(
                    modifier          = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Results alerts",
                            color      = BtccTextPrimary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize   = 15.sp,
                        )
                        Text(
                            "Get notified when new round results are published",
                            color    = BtccTextSecondary,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    PillToggle(
                        options = listOf("On", "Off"),
                        selectedIndex = if (resultsEnabled) 0 else 1,
                        onSelectionChanged = {
                            resultsEnabled = it == 0
                            Analytics.notificationTypeToggled("results", it == 0)
                            prefs.edit().putBoolean(ResultsCheckWorker.KEY_RESULTS_NOTIF_ENABLED, it == 0).apply()
                            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                            if (it == 0) {
                                nm.createNotificationChannel(
                                    NotificationChannel(
                                        ResultsCheckWorker.CHANNEL_ID,
                                        "Results Alerts",
                                        NotificationManager.IMPORTANCE_HIGH,
                                    )
                                )
                            }
                        },
                    )
                }

            }

            HorizontalDivider(
                color    = BtccOutline,
                modifier = Modifier.padding(vertical = 20.dp),
            )

            Text(
                "UNIT DISPLAY",
                style         = MaterialTheme.typography.labelSmall,
                fontWeight    = FontWeight.ExtraBold,
                color         = BtccTextSecondary,
                letterSpacing = 2.sp,
                modifier      = Modifier.padding(bottom = 12.dp),
            )

            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Distance",
                        color      = BtccTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize   = 15.sp,
                    )
                    Text(
                        "Unit used for circuit distances",
                        color    = BtccTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                var useKm by remember {
                    mutableStateOf(prefs.getString(NewsCheckWorker.KEY_UNIT_SYSTEM, NewsCheckWorker.UNIT_MILES) == NewsCheckWorker.UNIT_KM)
                }
                PillToggle(
                    options = listOf("km", "miles"),
                    selectedIndex = if (useKm) 0 else 1,
                    onSelectionChanged = { index ->
                        useKm = index == 0
                        Analytics.unitSystemChanged(if (index == 0) "km" else "miles")
                        prefs.edit().putString(
                            NewsCheckWorker.KEY_UNIT_SYSTEM,
                            if (index == 0) NewsCheckWorker.UNIT_KM else NewsCheckWorker.UNIT_MILES
                        ).apply()
                    },
                )
            }

            HorizontalDivider(
                color    = BtccOutline,
                modifier = Modifier.padding(vertical = 20.dp),
            )

            Text(
                "Version ${BuildConfig.VERSION_NAME}",
                color    = BtccTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (testModeEnabled || BuildConfig.DEBUG) Modifier.clickable {
                            versionTapCount++
                            if (versionTapCount >= 5) {
                                versionTapCount = 0
                                onFeatureFlagsClick()
                            }
                        } else Modifier
                    )
                    .padding(vertical = 12.dp),
            )
        }
    }
}
