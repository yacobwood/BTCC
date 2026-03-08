package com.btccfanhub.ui.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.FeatureFlagsStore
import com.btccfanhub.ui.components.PillToggle
import com.btccfanhub.ui.theme.*
import kotlinx.coroutines.flow.StateFlow

private val FLAG_ITEMS = listOf(
    Triple(FeatureFlagsStore.KEY_RADIO_TAB,    "Radio tab",       "Show the Radio tab in the bottom nav"),
    Triple(FeatureFlagsStore.KEY_ADS,          "Ads banner",      "Show the AdMob banner above the nav bar"),
    Triple(FeatureFlagsStore.KEY_WHATS_NEW,    "What's New",      "Show the What's New dialog on launch"),
    Triple(FeatureFlagsStore.KEY_LIVE_UPDATES, "Live Updates",    "Show live timing buttons during race weekends"),
)

private val FLAG_FLOWS: Map<String, StateFlow<Boolean>> = mapOf(
    FeatureFlagsStore.KEY_RADIO_TAB    to FeatureFlagsStore.radioTab,
    FeatureFlagsStore.KEY_ADS          to FeatureFlagsStore.adsEnabled,
    FeatureFlagsStore.KEY_WHATS_NEW    to FeatureFlagsStore.whatsNew,
    FeatureFlagsStore.KEY_LIVE_UPDATES to FeatureFlagsStore.liveUpdates,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeatureFlagsScreen(onBack: () -> Unit = {}) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "FEATURE FLAGS",
                            fontWeight    = FontWeight.Black,
                            fontSize      = 18.sp,
                            letterSpacing = 1.sp,
                        )
                        Text(
                            "Internal use only",
                            color    = BtccYellow,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
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

            FLAG_ITEMS.forEachIndexed { index, (key, label, description) ->
                val flow = FLAG_FLOWS[key]!!
                val enabled by flow.collectAsState()

                Row(
                    modifier          = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            label,
                            color      = BtccTextPrimary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize   = 15.sp,
                        )
                        Text(
                            description,
                            color    = BtccTextSecondary,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                    PillToggle(
                        options = listOf("On", "Off"),
                        selectedIndex = if (enabled) 0 else 1,
                        onSelectionChanged = { FeatureFlagsStore.set(key, it == 0) },
                    )
                }

                if (index < FLAG_ITEMS.lastIndex) {
                    HorizontalDivider(
                        color    = BtccOutline,
                        modifier = Modifier.padding(vertical = 16.dp),
                    )
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
