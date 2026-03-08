package com.btccfanhub.ui.calendar

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.btccfanhub.data.model.LapRecord
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.model.TrackInfo
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.ScheduleRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.worker.NewsCheckWorker
import androidx.compose.ui.platform.LocalContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

private val dateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")
private val shortDateFormat = DateTimeFormatter.ofPattern("d MMM")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackDetailScreen(round: Int, onBack: () -> Unit, onLiveTimingClick: (() -> Unit)? = null) {
    val today = LocalDate.now()
    val context = LocalContext.current

    var info by remember { mutableStateOf<TrackInfo?>(null) }
    var race by remember { mutableStateOf<Race?>(null) }
    var sessions by remember { mutableStateOf<List<RaceSession>>(emptyList()) }

    LaunchedEffect(round) {
        val cal = CalendarRepository.getCalendarData()
        info = cal.trackInfoMap[round]
        race = cal.rounds.find { it.round == round }
        val schedule = ScheduleRepository.getSchedule()
        sessions = schedule[round] ?: emptyList()
    }

    if (info == null || race == null) {
        Box(Modifier.fillMaxSize().background(com.btccfanhub.ui.theme.BtccBackground), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = BtccYellow)
        }
        return
    }

    val trackInfo = info!!
    val currentRace = race!!
    val daysUntil = ChronoUnit.DAYS.between(today, currentRace.startDate)

    val useKm = remember {
        val prefs = context.getSharedPreferences(NewsCheckWorker.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.getString(NewsCheckWorker.KEY_UNIT_SYSTEM, NewsCheckWorker.UNIT_MILES) == NewsCheckWorker.UNIT_KM
    }

    val lightboxIndex = remember { mutableStateOf<Int?>(null) }
    // hero image is index 0, race images follow
    val allImages = remember(trackInfo) {
        buildList {
            if (trackInfo.imageUrl.isNotEmpty()) add(trackInfo.imageUrl)
            addAll(trackInfo.raceImages)
        }
    }

    Box(Modifier.fillMaxSize().background(BtccBackground)) {
        Column(modifier = Modifier.fillMaxSize()) {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "ROUNDS ${(round - 1) * 3 + 1}–${round * 3}",
                            style = MaterialTheme.typography.labelSmall,
                            color = BtccYellow,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.5.sp,
                        )
                        Text(
                            trackInfo.venue,
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp,
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

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
            ) {
                // ── Hero circuit image ─────────────────────────────────────────
                if (trackInfo.imageUrl.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .clickable { lightboxIndex.value = 0 },
                    ) {
                        AsyncImage(
                            model = trackInfo.imageUrl,
                            contentDescription = trackInfo.venue,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                        // Gradient fade to background at the bottom
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(100.dp)
                                .align(Alignment.BottomCenter)
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Color.Transparent, BtccBackground),
                                    )
                                )
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .padding(top = if (trackInfo.imageUrl.isEmpty()) 12.dp else 0.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {

                // ── Event date card ────────────────────────────────────────────
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(listOf(BtccYellow.copy(alpha = 0.15f), Color.Transparent)),
                            RoundedCornerShape(16.dp),
                        )
                        .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "${currentRace.startDate.format(dateFormat)} – ${currentRace.endDate.format(shortDateFormat)}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onBackground,
                            )
                            Text(
                                "${trackInfo.location} · ${trackInfo.country}",
                                style = MaterialTheme.typography.bodySmall,
                                color = BtccTextSecondary,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                        when {
                            daysUntil < 0 -> Surface(color = BtccOutline, shape = RoundedCornerShape(20.dp)) {
                                Text("DONE", modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.ExtraBold,
                                    color = MaterialTheme.colorScheme.onBackground)
                            }
                            daysUntil == 0L -> Text("TODAY", fontWeight = FontWeight.Black,
                                fontSize = 16.sp, color = BtccYellow)
                            daysUntil == 1L -> Text("TMW", fontWeight = FontWeight.Black,
                                fontSize = 16.sp, color = BtccYellow)
                            else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$daysUntil", style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onBackground, lineHeight = 36.sp)
                                Text("DAYS", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, color = BtccTextSecondary)
                            }
                        }
                    }
                }

                // ── Live timing (race weekend only) ────────────────────────────
                if (!today.isBefore(currentRace.startDate) && !today.isAfter(currentRace.endDate) && onLiveTimingClick != null) {
                    LiveTimingButton(onLiveTimingClick)
                }

                // ── Stats row ──────────────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    val miNum   = trackInfo.lengthMiles.substringBefore(' ').toDoubleOrNull() ?: 0.0
                    val kmNum   = trackInfo.lengthKm.substringBefore(' ').toDoubleOrNull() ?: 0.0
                    val miValue = "%.2f".format(miNum)
                    val kmValue = "%.2f".format(kmNum)

                    StatChip(
                        label    = "LENGTH",
                        value    = if (useKm) kmValue else miValue,
                        sub      = if (useKm) "km" else "mi",
                        modifier = Modifier.weight(1f)
                    )
                    StatChip(label = "CORNERS", value = "${trackInfo.corners}",   sub = "",        modifier = Modifier.weight(1f))
                    if (trackInfo.firstBtccYear != null) {
                        StatChip(label = "FIRST RACED", value = "${trackInfo.firstBtccYear}", sub = "", modifier = Modifier.weight(1f))
                    }
                }

                // ── Lap records ────────────────────────────────────────────────
                val lapRecords = buildList {
                    trackInfo.qualifyingRecord?.let { add(it) }
                    trackInfo.raceRecord?.let { add(it) }
                }
                if (lapRecords.isNotEmpty()) {
                    LapRecordsCard(lapRecords, useKm)
                }

                // ── Weekend timetable ──────────────────────────────────────────
                if (sessions.isNotEmpty()) {
                    TimetableCard(sessions = sessions, raceStartDate = currentRace.startDate)
                }

                // ── Circuit layout ─────────────────────────────────────────────
                if (trackInfo.layoutImageUrl.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "CIRCUIT LAYOUT",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = BtccTextSecondary,
                            letterSpacing = 1.5.sp,
                        )
                        AsyncImage(
                            model = trackInfo.layoutImageUrl,
                            contentDescription = "${trackInfo.venue} circuit layout",
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(BtccCard, RoundedCornerShape(12.dp))
                                .clip(RoundedCornerShape(12.dp)),
                        )
                    }
                }

                // ── Race photo gallery ─────────────────────────────────────────
                if (trackInfo.raceImages.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "RACE PHOTOS",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = BtccTextSecondary,
                            letterSpacing = 1.5.sp,
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            itemsIndexed(trackInfo.raceImages) { index, url ->
                                // hero is index 0 in allImages, race photos start at 1
                                val lightboxIdx = if (trackInfo.imageUrl.isNotEmpty()) index + 1 else index
                                AsyncImage(
                                    model = url,
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .width(220.dp)
                                        .height(130.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .clickable { lightboxIndex.value = lightboxIdx },
                                )
                            }
                        }
                    }
                }

                // ── About ──────────────────────────────────────────────────────
                InfoCard(title = "ABOUT THE CIRCUIT", body = trackInfo.about)

                // ── BTCC fact ──────────────────────────────────────────────────
                InfoCard(title = "BTCC AT ${trackInfo.venue.uppercase()}", body = trackInfo.btccFact, highlight = true)

                Spacer(Modifier.height(8.dp))
                } // end inner Column
            }
        }

        // ── Lightbox overlay ───────────────────────────────────────────────────
        val idx = lightboxIndex.value
        if (idx != null && allImages.isNotEmpty()) {
            BackHandler { lightboxIndex.value = null }
            ImageLightbox(
                images = allImages,
                initialIndex = idx.coerceIn(0, allImages.lastIndex),
                onDismiss = { lightboxIndex.value = null },
            )
        }
    }
}

@Composable
private fun ImageLightbox(images: List<String>, initialIndex: Int, onDismiss: () -> Unit) {
    val pagerState = rememberPagerState(initialPage = initialIndex) { images.size }
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .systemBarsPadding()
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            AsyncImage(
                model = images[page],
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }

        if (images.size > 1) {
            Surface(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 16.dp),
                color = Color.Black.copy(alpha = 0.55f),
                shape = MaterialTheme.shapes.small,
            ) {
                Text(
                    text = "${pagerState.currentPage + 1} / ${images.size}",
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }

        IconButton(
            onClick = onDismiss,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(8.dp),
        ) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
        }
    }
}

@Composable
private fun LapRecordsCard(records: List<LapRecord>, useKm: Boolean) {
    if (records.isEmpty()) return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "LAP RECORDS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.ExtraBold,
            color = BtccTextSecondary,
            letterSpacing = 1.sp,
        )
        records.forEachIndexed { index, record ->
            LapRecordRow(
                label = if (index == 0) "QUALIFYING" else "RACE",
                record = record,
                useKm = useKm
            )
            if (index < records.size - 1) {
                HorizontalDivider(color = BtccOutline.copy(alpha = 0.5f))
            }
        }
    }
}

@Composable
private fun LapRecordRow(label: String, record: LapRecord, useKm: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = BtccYellow,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.sp,
            )
            Text(
                record.driver,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground,
            )

            val speedNum = record.speed.substringBefore(' ').toDoubleOrNull() ?: 0.0
            val speedDisplay = if (useKm) {
                "%.2f km/h".format(speedNum * 1.60934)
            } else {
                "${"%.2f".format(speedNum)} mph"
            }

            Text(
                "$speedDisplay avg · ${record.year}",
                style = MaterialTheme.typography.bodySmall,
                color = BtccTextSecondary,
            )
        }
        Text(
            record.time,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun TimetableCard(sessions: List<RaceSession>, raceStartDate: LocalDate) {
    // SAT = raceStartDate - 1, SUN = raceStartDate
    val today = LocalDate.now()
    val satDate = raceStartDate.minusDays(1)
    val sunDate = raceStartDate

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "WEEKEND TIMETABLE",
            style         = MaterialTheme.typography.labelSmall,
            fontWeight    = FontWeight.ExtraBold,
            color         = BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )

        val grouped = sessions.groupBy { it.day }
        listOf("SAT" to satDate, "SUN" to sunDate).forEach { (dayKey, date) ->
            val daySessions = grouped[dayKey] ?: return@forEach
            val isToday = today == date

            // Day header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    dayKey,
                    style         = MaterialTheme.typography.labelSmall,
                    fontWeight    = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    color         = if (isToday) BtccYellow else BtccTextSecondary,
                )
                Text(
                    date.format(shortDateFormat),
                    style  = MaterialTheme.typography.labelSmall,
                    color  = BtccTextSecondary,
                )
                if (isToday) {
                    Box(
                        modifier = Modifier
                            .background(BtccYellow, RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            "TODAY",
                            style      = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color      = androidx.compose.ui.graphics.Color.Black,
                            fontSize   = 9.sp,
                        )
                    }
                }
            }

            // Sessions for this day
            daySessions.forEach { session ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        session.name,
                        style    = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                        color    = MaterialTheme.colorScheme.onBackground,
                    )
                    Text(
                        session.time,
                        style      = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color      = if (session.time == "TBA") BtccTextSecondary else MaterialTheme.colorScheme.onBackground,
                    )
                }
            }

            if (dayKey == "SAT" && grouped.containsKey("SUN")) {
                HorizontalDivider(color = BtccOutline)
            }
        }
    }
}

@Composable
private fun StatChip(label: String, value: String, sub: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(vertical = 14.dp, horizontal = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = BtccTextSecondary,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.sp,
        )
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Black,
            color = BtccYellow,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(
            sub,
            style = MaterialTheme.typography.labelSmall,
            color = BtccTextSecondary,
        )
    }
}

@Composable
private fun InfoCard(title: String, body: String, highlight: Boolean = false) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .then(
                if (highlight) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                else Modifier
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            title,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.ExtraBold,
            color = if (highlight) BtccYellow else BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.85f),
            lineHeight = 22.sp,
        )
    }
}

@Composable
private fun LiveTimingButton(onClick: () -> Unit) {
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
