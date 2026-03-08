package com.btccfanhub.ui.settings

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.BuildConfig
import com.btccfanhub.ui.components.PillToggle
import com.btccfanhub.ui.theme.*
import com.btccfanhub.worker.NewsCheckWorker

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit = {}, onBugReport: () -> Unit = {}) {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
    }
    var notificationsEnabled by remember {
        mutableStateOf(prefs.getBoolean(NewsCheckWorker.KEY_NOTIF_ENABLED, true))
    }

    Scaffold(
        topBar = {
            TopAppBar(
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
                    },
                )
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
                "SUPPORT",
                style         = MaterialTheme.typography.labelSmall,
                fontWeight    = FontWeight.ExtraBold,
                color         = BtccTextSecondary,
                letterSpacing = 2.sp,
                modifier      = Modifier.padding(bottom = 12.dp),
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onBugReport)
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Raise a bug",
                        color      = BtccTextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize   = 15.sp,
                    )
                    Text(
                        "Report an issue with the app",
                        color    = BtccTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = BtccTextSecondary,
                )
            }

            HorizontalDivider(
                color    = BtccOutline,
                modifier = Modifier.padding(vertical = 20.dp),
            )

            Text(
                BuildConfig.VERSION_NAME,
                color    = BtccTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.padding(vertical = 4.dp),
            )
        }
    }
}
