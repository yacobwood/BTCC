package com.btccfanhub.ui.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

private val dayFmt       = DateTimeFormatter.ofPattern("d")
private val monthYearFmt = DateTimeFormatter.ofPattern("MMM yyyy")

private fun formatDateRange(start: java.time.LocalDate, end: java.time.LocalDate) =
    "${start.format(dayFmt)} - ${end.format(dayFmt)} ${end.format(monthYearFmt)}"


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(onRaceClick: (Race) -> Unit = {}, onLiveTimingClick: (() -> Unit)? = null) {
    val today = LocalDate.now()
    var races by remember { mutableStateOf<List<Race>>(emptyList()) }
    var liveTimingEnabled by remember { mutableStateOf(true) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        val cal = CalendarRepository.getCalendarData()
        races = cal.rounds
        liveTimingEnabled = cal.liveTimingEnabled
        loading = false
    }
    val nextRace = races.firstOrNull { it.endDate >= today }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            title = {
                Text(
                    "2026 SEASON",
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    letterSpacing = 1.sp,
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = BtccBackground,
            ),
        )
        if (loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BtccYellow)
            }
            return@Column
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 20.dp),
        ) {
            val isRaceWeekend = liveTimingEnabled && onLiveTimingClick != null && nextRace != null && today >= nextRace.startDate
            if (isRaceWeekend) {
                item {
                    LiveTimingCard(onClick = onLiveTimingClick)
                    Spacer(Modifier.height(12.dp))
                }
            }
            if (nextRace != null) {
                item {
                    CountdownCard(race = nextRace, today = today, onClick = { onRaceClick(nextRace) })
                    Spacer(Modifier.height(24.dp))
                    Text(
                        "ALL ROUNDS",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.ExtraBold,
                        color = BtccTextSecondary,
                        letterSpacing = 2.sp,
                        modifier = Modifier.padding(bottom = 12.dp),
                    )
                }
            }

            itemsIndexed(races) { index, race ->
                TimelineRaceRow(
                    race = race,
                    isNext = race == nextRace,
                    isPast = race.endDate < today,
                    isLast = index == races.lastIndex,
                    onClick = { onRaceClick(race) },
                )
            }
        }
    }
}

@Composable
private fun CountdownCard(race: Race, today: LocalDate, onClick: () -> Unit = {}) {
    val daysUntil = ChronoUnit.DAYS.between(today, race.startDate)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable { onClick() }
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        BtccYellow.copy(alpha = 0.18f),
                        Color.Transparent,
                    )
                )
            )
            .border(1.dp, BtccYellow.copy(alpha = 0.35f), RoundedCornerShape(16.dp))
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                val startRound = (race.round - 1) * 3 + 1
                val endRound   = startRound + 2
                Text(
                    "ROUNDS $startRound–$endRound · NEXT RACE",
                    style = MaterialTheme.typography.labelSmall,
                    color = BtccYellow,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    race.venue,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    formatDateRange(race.startDate, race.endDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = BtccTextSecondary,
                )
            }

            Spacer(Modifier.width(16.dp))

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                when (daysUntil) {
                    0L -> {
                        Text("TODAY", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, color = BtccYellow)
                    }
                    1L -> {
                        Text("TMW", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, color = BtccYellow)
                    }
                    else -> {
                        Text(
                            "$daysUntil",
                            style = MaterialTheme.typography.displayMedium,
                            fontWeight = FontWeight.Black,
                            color = MaterialTheme.colorScheme.onBackground,
                            lineHeight = 56.sp,
                        )
                        Text(
                            "DAYS\nTO GO",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = BtccTextSecondary,
                            textAlign = TextAlign.Center,
                            letterSpacing = 0.5.sp,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TimelineRaceRow(
    race: Race,
    isNext: Boolean,
    isPast: Boolean,
    isLast: Boolean,
    onClick: () -> Unit = {},
) {
    val dotColor = when {
        isNext -> BtccYellow
        isPast -> BtccOutline
        else -> MaterialTheme.colorScheme.surfaceVariant
    }
    val textAlpha = if (isPast) 0.4f else 1f

    Row(modifier = Modifier.fillMaxWidth().clickable { onClick() }) {
        // Timeline column
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.width(36.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(dotColor)
                    .then(
                        if (isNext) Modifier.border(2.dp, BtccYellow, CircleShape)
                        else Modifier
                    )
            )
            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(64.dp)
                        .background(BtccOutline.copy(alpha = 0.5f))
                )
            }
        }

        // Content
        Row(
            modifier = Modifier
                .weight(1f)
                .padding(start = 4.dp)
                .padding(bottom = if (isLast) 0.dp else 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val rStart = (race.round - 1) * 3 + 1
                    val rEnd   = rStart + 2
                    Text(
                        "Rounds $rStart–$rEnd",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isNext) BtccYellow else BtccTextSecondary.copy(alpha = textAlpha),
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp,
                    )
                    if (isNext) {
                        Spacer(Modifier.width(6.dp))
                        Surface(
                            color = BtccYellow,
                            shape = RoundedCornerShape(20.dp),
                        ) {
                            Text(
                                "NEXT",
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.ExtraBold,
                                color = BtccNavy,
                                letterSpacing = 0.5.sp,
                            )
                        }
                    }
                }
                Text(
                    race.venue,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = textAlpha),
                )
                Text(
                    formatDateRange(race.startDate, race.endDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = BtccTextSecondary.copy(alpha = textAlpha),
                )
            }

            // Chevron
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForwardIos,
                contentDescription = "View details",
                tint = BtccTextSecondary.copy(alpha = textAlpha),
                modifier = Modifier
                    .padding(start = 4.dp)
                    .size(14.dp),
            )
        }
    }
}

@Composable
private fun LiveTimingCard(onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFF0D0A00))
            .border(1.dp, BtccYellow.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
            .clickable { onClick() }
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Pulsing live dot
        Box(
            modifier = Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(BtccYellow),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "LIVE TIMING",
                fontWeight    = FontWeight.ExtraBold,
                fontSize      = 14.sp,
                letterSpacing = 1.sp,
                color         = BtccYellow,
            )
            Text(
                "Race weekend is live · btcc.net",
                style = MaterialTheme.typography.labelSmall,
                color = BtccYellow.copy(alpha = 0.6f),
            )
        }
        Icon(
            Icons.Default.SignalCellularAlt,
            contentDescription = null,
            tint     = BtccYellow,
            modifier = Modifier.size(20.dp),
        )
    }
}
