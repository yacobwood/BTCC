package com.btccfanhub.ui.radio

import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import com.btccfanhub.data.analytics.Analytics
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Radio
import androidx.compose.material3.*
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.repository.RadioRepository
import com.btccfanhub.data.repository.RadioStation
import com.btccfanhub.service.RadioService
import com.btccfanhub.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RadioScreen(onBack: () -> Unit = {}) {
    val context        = LocalContext.current
    val isPlaying      by RadioService.isPlaying.collectAsState()
    val currentStation by RadioService.currentStation.collectAsState()
    var stations by remember { mutableStateOf<List<RadioStation>>(emptyList()) }
    var navigatingBack by remember { mutableStateOf(false) }
    BackHandler { if (!navigatingBack) { navigatingBack = true; onBack() } }
    LaunchedEffect(Unit) { stations = RadioRepository.getStations() }
    LaunchedEffect(Unit) { Analytics.screen("radio") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            windowInsets = WindowInsets(0),
            title = {
                Text(
                    "RADIO",
                    fontWeight    = FontWeight.Black,
                    fontSize      = 18.sp,
                    letterSpacing = 1.sp,
                )
            },
            navigationIcon = {
                IconButton(onClick = {
                    if (!navigatingBack) { navigatingBack = true; onBack() }
                }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Now playing banner
            if (isPlaying) {
                NowPlayingBanner(stationName = currentStation)
            }

            Text(
                "LIVE STATIONS",
                fontSize      = 11.sp,
                fontWeight    = FontWeight.ExtraBold,
                letterSpacing = 1.5.sp,
                color         = BtccTextSecondary,
                modifier      = Modifier.padding(top = 4.dp, bottom = 2.dp),
            )

            stations.forEach { station ->
                val stationActive = isPlaying && currentStation == station.name
                StationCard(
                    station     = station,
                    isPlaying   = stationActive,
                    onToggle    = {
                        if (stationActive) stopRadio(context)
                        else playRadio(context, station)
                    },
                )
            }

            Spacer(Modifier.height(8.dp))

            // Info note
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BtccCard, RoundedCornerShape(10.dp))
                    .padding(14.dp),
            ) {
                Text(
                    "talkSPORT and talkSPORT 2 carry live BTCC race coverage on race weekends. " +
                    "Streams are usually active 24/7 — check the BTCC calendar for upcoming race dates.",
                    style = MaterialTheme.typography.bodySmall,
                    color = BtccTextSecondary,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

@Composable
private fun NowPlayingBanner(stationName: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF0D1F0D), RoundedCornerShape(10.dp))
            .border(1.dp, Color(0xFF4CAF50).copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment    = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(Color(0xFF4CAF50), CircleShape),
        )
        Text(
            "NOW PLAYING · $stationName",
            fontSize      = 11.sp,
            fontWeight    = FontWeight.ExtraBold,
            letterSpacing = 1.sp,
            color         = Color(0xFF4CAF50),
        )
    }
}

@Composable
private fun StationCard(
    station   : RadioStation,
    isPlaying : Boolean,
    onToggle  : () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .border(
                1.dp,
                if (isPlaying) BtccYellow.copy(alpha = 0.5f) else BtccOutline.copy(alpha = 0.3f),
                RoundedCornerShape(12.dp),
            )
            .padding(14.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Station icon
        Box(
            modifier = Modifier
                .size(52.dp)
                .background(
                    if (isPlaying) BtccYellow.copy(alpha = 0.12f) else BtccSurface,
                    RoundedCornerShape(10.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Default.Radio,
                contentDescription = null,
                tint     = if (isPlaying) BtccYellow else BtccTextSecondary,
                modifier = Modifier.size(28.dp),
            )
        }

        // Info
        Column(modifier = Modifier.weight(1f)) {
            Text(
                station.name,
                fontWeight = FontWeight.ExtraBold,
                fontSize   = 15.sp,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                station.tagline,
                fontSize = 11.sp,
                color    = BtccTextSecondary,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                station.coverage,
                fontSize   = 11.sp,
                color      = BtccYellow.copy(alpha = 0.85f),
                fontWeight = FontWeight.Medium,
            )
        }

        // Play / pause button
        IconButton(
            onClick  = onToggle,
            modifier = Modifier
                .size(50.dp)
                .background(
                    if (isPlaying) BtccYellow else BtccSurface,
                    CircleShape,
                ),
        ) {
            Icon(
                if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                contentDescription = if (isPlaying) "Stop" else "Play",
                tint     = if (isPlaying) BtccNavy else BtccYellow,
                modifier = Modifier.size(30.dp),
            )
        }
    }
}

private fun playRadio(context: Context, station: RadioStation) {
    context.startForegroundService(
        Intent(context, RadioService::class.java).apply {
            action = RadioService.ACTION_PLAY
            putExtra(RadioService.EXTRA_STREAM_URL,   station.streamUrl)
            putExtra(RadioService.EXTRA_STATION_NAME, station.name)
        }
    )
}

private fun stopRadio(context: Context) {
    context.startService(
        Intent(context, RadioService::class.java).apply {
            action = RadioService.ACTION_STOP
        }
    )
}
