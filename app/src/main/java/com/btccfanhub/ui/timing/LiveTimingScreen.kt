package com.btccfanhub.ui.timing

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import com.btccfanhub.data.analytics.Analytics
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.repository.TslSession
import com.btccfanhub.data.repository.TslSignalRClient
import com.btccfanhub.ui.theme.*
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveTimingScreen(eventId: Int, onBack: () -> Unit) {
    var navigatingBack by remember { mutableStateOf(false) }
    BackHandler { if (!navigatingBack) { navigatingBack = true; onBack() } }
    val client  = remember(eventId) { TslSignalRClient(eventId) }
    val session by client.session.collectAsState()
    val loading  = session == null

    LaunchedEffect(Unit) {
        Analytics.screen("live_timing:$eventId")
        client.connect()
    }

    val flagColor = flagColor(session?.sessionFlag)

    Scaffold(
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (session != null) flagColor else BtccTextSecondary),
                        )
                        Text(
                            "LIVE TIMING",
                            fontWeight    = FontWeight.Black,
                            fontSize      = 18.sp,
                            letterSpacing = 1.sp,
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
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(BtccBackground),
        ) {
            when {
                loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BtccYellow)
                }

                session == null -> NoSessionPlaceholder()

                else -> {
                    val displayTime by produceState(
                        initialValue = formatMsToTime(parseTimeToGoMs(session!!.timeToGo)),
                        key1 = session!!.timeToGo,
                        key2 = session!!.clockRunning,
                    ) {
                        val baseMs = parseTimeToGoMs(session!!.timeToGo)
                        val baseAt = System.currentTimeMillis()
                        if (!session!!.clockRunning || baseMs <= 0) {
                            value = formatMsToTime(baseMs)
                            return@produceState
                        }
                        while (true) {
                            val remaining = (baseMs - (System.currentTimeMillis() - baseAt)).coerceAtLeast(0)
                            value = formatMsToTime(remaining)
                            delay(500)
                        }
                    }
                    ClassificationTable(session = session!!, flagColor = flagColor, displayTime = displayTime)
                }
            }
        }
    }
}

@Composable
private fun ClassificationTable(session: TslSession, flagColor: Color, displayTime: String) {
    val fastestId = session.fastestLapId
    LazyColumn(modifier = Modifier.fillMaxSize()) {

        // Session info header
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BtccCard)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .background(flagColor.copy(alpha = 0.18f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            flagLabel(session.sessionFlag),
                            color      = flagColor,
                            fontSize   = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 0.8.sp,
                        )
                    }
                    Text(
                        session.series,
                        color      = BtccTextSecondary,
                        fontSize   = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines   = 1,
                        overflow   = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    session.name,
                    color      = Color.White,
                    fontWeight = FontWeight.Black,
                    fontSize   = 15.sp,
                    letterSpacing = 0.3.sp,
                )
                Spacer(Modifier.height(2.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(
                        session.trackName,
                        color    = BtccTextSecondary,
                        fontSize = 12.sp,
                    )
                    if (displayTime.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Icon(
                                Icons.Default.Timer,
                                contentDescription = null,
                                tint     = BtccTextSecondary,
                                modifier = Modifier.size(12.dp),
                            )
                            Text(
                                displayTime,
                                color    = BtccTextSecondary,
                                fontSize = 12.sp,
                            )
                        }
                    }
                }
            }
        }

        // Column header
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BtccBackground)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                HeaderCell("POS", 32.dp, TextAlign.Center)
                HeaderCell("NO",  32.dp, TextAlign.Center)
                Spacer(Modifier.weight(1f))
                HeaderCell("GAP",  80.dp, TextAlign.End)
                HeaderCell("BEST", 72.dp, TextAlign.End)
            }
        }

        itemsIndexed(
            items = session.classification,
            key   = { _, e -> e.id },
        ) { index, entry ->
            val isFL = entry.id == fastestId && entry.fastLapTime.isNotEmpty()
            EntryRow(entry = entry, index = index, isFL = isFL)
            HorizontalDivider(color = BtccOutline, thickness = 0.5.dp)
        }

        item { Spacer(Modifier.height(16.dp)) }
    }
}

@Composable
private fun EntryRow(entry: com.btccfanhub.data.repository.TslEntry, index: Int, isFL: Boolean) {
    val rowBg = if (index % 2 == 0) BtccBackground else BtccCard.copy(alpha = 0.4f)
    val posColor = when (entry.position) {
        1 -> Color(0xFFFFD700)  // gold
        2 -> Color(0xFFC0C0C0)  // silver
        3 -> Color(0xFFCD7F32)  // bronze
        else -> BtccTextSecondary
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(rowBg)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Position
        Text(
            text      = if (entry.position > 0) entry.position.toString() else "—",
            color     = posColor,
            fontWeight = FontWeight.ExtraBold,
            fontSize   = 14.sp,
            textAlign  = TextAlign.Center,
            modifier   = Modifier.width(32.dp),
        )

        // Car number
        Box(
            modifier = Modifier
                .width(32.dp)
                .padding(horizontal = 2.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text       = entry.no,
                color      = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize   = 13.sp,
                textAlign  = TextAlign.Center,
            )
        }

        // Driver name + team
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 6.dp),
        ) {
            Text(
                text      = entry.name,
                color     = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize   = 13.sp,
                maxLines   = 1,
                overflow   = TextOverflow.Ellipsis,
            )
            if (entry.team.isNotEmpty()) {
                Text(
                    text     = entry.team,
                    color    = BtccTextSecondary,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        // Gap / race time
        val gapDisplay = when {
            entry.position == 1    -> ""
            entry.gap.isNotEmpty() -> "+${entry.gap}"
            else                   -> "—"
        }
        Text(
            text       = gapDisplay,
            color      = Color.White,
            fontSize   = 12.sp,
            fontWeight = FontWeight.Medium,
            textAlign  = TextAlign.End,
            modifier   = Modifier.width(80.dp),
            maxLines   = 1,
            overflow   = TextOverflow.Ellipsis,
        )

        // Best lap
        Text(
            text       = entry.fastLapTime.ifEmpty { "—" },
            color      = if (isFL) Color(0xFFBB44FF) else BtccTextSecondary,
            fontSize   = 12.sp,
            fontWeight = if (isFL) FontWeight.Bold else FontWeight.Normal,
            textAlign  = TextAlign.End,
            modifier   = Modifier.width(72.dp),
            maxLines   = 1,
        )
    }
}

@Composable
private fun HeaderCell(label: String, width: androidx.compose.ui.unit.Dp, align: TextAlign) {
    Text(
        text          = label,
        color         = BtccTextSecondary,
        fontSize      = 10.sp,
        fontWeight    = FontWeight.ExtraBold,
        letterSpacing = 0.8.sp,
        textAlign     = align,
        modifier      = Modifier.width(width),
    )
}

@Composable
private fun NoSessionPlaceholder() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(BtccCard, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.SignalCellularAlt,
                    contentDescription = null,
                    tint     = BtccTextSecondary,
                    modifier = Modifier.size(36.dp),
                )
            }
            Spacer(Modifier.height(20.dp))
            Text(
                "NO LIVE SESSION",
                fontWeight    = FontWeight.ExtraBold,
                fontSize      = 16.sp,
                letterSpacing = 1.sp,
                color         = Color.White,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Live timing is only available during\nrace weekend sessions.",
                style      = MaterialTheme.typography.bodySmall,
                color      = BtccTextSecondary,
                textAlign  = TextAlign.Center,
                lineHeight = 20.sp,
            )
        }
    }
}

private fun flagLabel(flag: String): String = when (flag.lowercase()) {
    "finish", "finished", "chequered" -> "FINISHED"
    "safety car", "sc"                -> "SAFETY CAR"
    else                              -> flag.uppercase()
}

private fun flagColor(flag: String?): Color = when (flag?.lowercase()) {
    "green"                         -> Color(0xFF00C853)
    "yellow", "safety car", "sc"    -> Color(0xFFFEBD02)
    "red"                           -> Color(0xFFE3000B)
    "chequered", "finish", "finished" -> Color.White
    else                            -> Color(0xFF00C853)
}

/** "00:02:43.989..." → milliseconds */
private fun parseTimeToGoMs(timeToGo: String): Long {
    val clean = timeToGo.substringBefore(".").trim()
    val parts = clean.split(":")
    if (parts.size != 3) return 0L
    val h = parts[0].toLongOrNull() ?: return 0L
    val m = parts[1].toLongOrNull() ?: return 0L
    val s = parts[2].toLongOrNull() ?: return 0L
    return h * 3_600_000L + m * 60_000L + s * 1_000L
}

/** Milliseconds → "2:43" or "1:02:43" */
private fun formatMsToTime(ms: Long): String {
    if (ms <= 0) return ""
    val h = ms / 3_600_000L
    val m = (ms % 3_600_000L) / 60_000L
    val s = (ms % 60_000L) / 1_000L
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
