package com.btccfanhub.ui.settings

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import androidx.compose.foundation.layout.*
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
import com.btccfanhub.data.FeatureFlagsStore
import com.btccfanhub.ui.components.PillToggle
import com.btccfanhub.ui.theme.*
import com.btccfanhub.worker.NewsCheckWorker
import com.btccfanhub.worker.RaceNotificationWorker
import com.btccfanhub.worker.ResultsCheckWorker

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit = {}) {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
    }
    var notificationsEnabled by remember {
        mutableStateOf(prefs.getBoolean(NewsCheckWorker.KEY_NOTIF_ENABLED, true))
    }
    var raceEnabled by remember {
        mutableStateOf(prefs.getBoolean(RaceNotificationWorker.KEY_RACE_NOTIF_ENABLED, true))
    }
    var resultsEnabled by remember {
        mutableStateOf(prefs.getBoolean(ResultsCheckWorker.KEY_RESULTS_NOTIF_ENABLED, true))
    }

    Scaffold(
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
                .padding(horizontal = 16.dp),
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
                        } else {
                            nm.deleteNotificationChannel(NewsCheckWorker.CHANNEL_ID)
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
                        } else {
                            nm.deleteNotificationChannel(RaceNotificationWorker.CHANNEL_ID)
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
                            } else {
                                nm.deleteNotificationChannel(ResultsCheckWorker.CHANNEL_ID)
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
                modifier = Modifier.padding(vertical = 4.dp),
            )
        }
    }
}
