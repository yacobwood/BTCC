package com.btccfanhub.ui.settings

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
import com.btccfanhub.ui.theme.*
import com.btccfanhub.worker.NewsCheckWorker

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
                Switch(
                    checked = notificationsEnabled,
                    onCheckedChange = {
                        notificationsEnabled = it
                        prefs.edit().putBoolean(NewsCheckWorker.KEY_NOTIF_ENABLED, it).apply()
                    },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor   = BtccTextPrimary,
                        checkedTrackColor   = BtccYellow,
                        uncheckedThumbColor = BtccTextSecondary,
                        uncheckedTrackColor = BtccOutline,
                    ),
                )
            }

            HorizontalDivider(
                color    = BtccOutline,
                modifier = Modifier.padding(vertical = 20.dp),
            )
        }
    }
}
