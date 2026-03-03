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
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccTextSecondary
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

private val dateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")
private val shortDateFormat = DateTimeFormatter.ofPattern("d MMM")

private val races = listOf(
    Race(1,  "Donington Park",    LocalDate.of(2026, 4,  18), LocalDate.of(2026, 4,  19)),
    Race(2,  "Brands Hatch Indy", LocalDate.of(2026, 5,  9),  LocalDate.of(2026, 5,  10)),
    Race(3,  "Snetterton",        LocalDate.of(2026, 5,  23), LocalDate.of(2026, 5,  24)),
    Race(4,  "Oulton Park",       LocalDate.of(2026, 6,  6),  LocalDate.of(2026, 6,  7)),
    Race(5,  "Thruxton",          LocalDate.of(2026, 7,  25), LocalDate.of(2026, 7,  26)),
    Race(6,  "Knockhill",         LocalDate.of(2026, 8,  8),  LocalDate.of(2026, 8,  9)),
    Race(7,  "Donington Park GP", LocalDate.of(2026, 8,  22), LocalDate.of(2026, 8,  23)),
    Race(8,  "Croft",             LocalDate.of(2026, 9,  5),  LocalDate.of(2026, 9,  6)),
    Race(9,  "Silverstone",       LocalDate.of(2026, 9,  26), LocalDate.of(2026, 9,  27)),
    Race(10, "Brands Hatch GP",   LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11)),
)


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(onRaceClick: (Race) -> Unit = {}) {
    val today = LocalDate.now()
    val nextRace = races.firstOrNull { it.endDate >= today }

    Scaffold(
        topBar = {
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
                    containerColor = MaterialTheme.colorScheme.background,
                ),
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 20.dp),
        ) {
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
                Text(
                    "ROUND ${race.round} · NEXT RACE",
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
                    "${race.startDate.format(dateFormat)} – ${race.endDate.format(shortDateFormat)}",
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
                    Text(
                        "Round ${race.round}",
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
                    "${race.startDate.format(dateFormat)} – ${race.endDate.format(shortDateFormat)}",
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
