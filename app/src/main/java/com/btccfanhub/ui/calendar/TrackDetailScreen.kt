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
import com.btccfanhub.Constants
import com.btccfanhub.data.FeatureFlagsStore
import com.btccfanhub.ui.components.ImageLightbox
import com.btccfanhub.data.model.DayForecast
import com.btccfanhub.data.model.Corner
import com.btccfanhub.data.model.LapRecord
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.model.Sector
import com.btccfanhub.data.model.TrackInfo
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.ScheduleRepository
import com.btccfanhub.data.repository.WeatherRepository
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
fun TrackDetailScreen(round: Int, onBack: () -> Unit, onLiveTimingClick: ((Int) -> Unit)? = null) {
    val today = LocalDate.now()
    val context = LocalContext.current

    var info by remember { mutableStateOf<TrackInfo?>(null) }
    var race by remember { mutableStateOf<Race?>(null) }
    var sessions by remember { mutableStateOf<List<RaceSession>>(emptyList()) }
    var forecast by remember { mutableStateOf<List<DayForecast>?>(null) }
    var forecastLoading by remember { mutableStateOf(false) }

    LaunchedEffect(round) {
        val cal = CalendarRepository.getCalendarData()
        info = cal.trackInfoMap[round]
        race = cal.rounds.find { it.round == round }
        val schedule = ScheduleRepository.getSchedule()
        sessions = schedule[round] ?: emptyList()

        val ti = cal.trackInfoMap[round]
        val r = cal.rounds.find { it.round == round }
        if (ti != null && r != null && ti.lat != 0.0 && FeatureFlagsStore.trackWeather.value) {
            forecastLoading = true
            forecast = WeatherRepository.getForecast(round, ti.lat, ti.lng, r.startDate, r.endDate)
            forecastLoading = false
        }
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
        val prefs = context.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)
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
                windowInsets = WindowInsets(0),
                title = {
                    Column {
                        Text(
                            "ROUNDS ${Constants.firstRaceNumberForRound(round)}–${round * 3}",
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
                if (!today.isBefore(currentRace.startDate) && !today.isAfter(currentRace.endDate) && onLiveTimingClick != null && currentRace.tslEventId != 0) {
                    LiveTimingButton { onLiveTimingClick(currentRace.tslEventId) }
                }

                // ── Weather forecast ─────────────────────────────────────────
                if (forecastLoading) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(BtccCard, RoundedCornerShape(14.dp))
                            .padding(24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = BtccYellow, modifier = Modifier.size(24.dp))
                    }
                } else if (!forecast.isNullOrEmpty()) {
                    WeatherCard(forecast!!, currentRace.startDate, useKm)
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

                // ── Track guide ─────────────────────────────────────────────────
                if (trackInfo.trackGuide.isNotEmpty()) {
                    TrackGuideCard(trackInfo.trackGuide)
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

// ─────────────────────────────────────────────────────────────────────────────
// Track guide — corners grouped by sector
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun TrackGuideCard(sectors: List<Sector>) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "TRACK GUIDE",
            style         = MaterialTheme.typography.labelSmall,
            fontWeight    = FontWeight.ExtraBold,
            color         = BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )

        sectors.forEachIndexed { sectorIndex, sector ->
            Text(
                sector.name.uppercase(),
                style         = MaterialTheme.typography.labelSmall,
                fontWeight    = FontWeight.ExtraBold,
                letterSpacing = 1.sp,
                color         = BtccYellow,
            )

            sector.corners.forEach { corner ->
                CornerRow(corner)
            }

            if (sectorIndex < sectors.lastIndex) {
                HorizontalDivider(color = BtccOutline.copy(alpha = 0.5f))
            }
        }
    }
}

@Composable
private fun CornerRow(corner: Corner) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            corner.number,
            style      = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Black,
            color      = BtccYellow.copy(alpha = 0.7f),
            maxLines   = 1,
            modifier   = Modifier.widthIn(min = 36.dp),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    corner.name,
                    style      = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color      = MaterialTheme.colorScheme.onBackground,
                )
                if (corner.overtaking) {
                    Surface(
                        color = Color(0xFF4CAF50).copy(alpha = 0.2f),
                        shape = RoundedCornerShape(4.dp),
                    ) {
                        Text(
                            "OVERTAKING",
                            modifier      = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style         = MaterialTheme.typography.labelSmall,
                            fontWeight    = FontWeight.ExtraBold,
                            fontSize      = 8.sp,
                            letterSpacing = 0.5.sp,
                            color         = Color(0xFF4CAF50),
                        )
                    }
                }
            }
            if (corner.description.isNotEmpty()) {
                Text(
                    corner.description,
                    style      = MaterialTheme.typography.bodySmall,
                    color      = BtccTextSecondary,
                    lineHeight = 18.sp,
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Weather forecast card
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun WeatherCard(days: List<DayForecast>, raceStart: LocalDate, useKm: Boolean) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "RACE WEEKEND FORECAST",
            style         = MaterialTheme.typography.labelSmall,
            fontWeight    = FontWeight.ExtraBold,
            color         = BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            days.forEach { day ->
                val dayLabel = if (day.date == raceStart) "SAT" else "SUN"
                WeatherDayColumn(day, dayLabel, useKm, modifier = Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun WeatherDayColumn(day: DayForecast, label: String, useKm: Boolean, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(BtccBackground.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            label,
            fontWeight    = FontWeight.ExtraBold,
            fontSize      = 12.sp,
            letterSpacing = 1.sp,
            color         = BtccYellow,
        )
        Text(
            weatherDescription(day.weatherCode),
            fontSize  = 22.sp,
        )
        Text(
            weatherLabel(day.weatherCode),
            style      = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color      = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            "${day.tempMax.toInt()}° / ${day.tempMin.toInt()}°",
            fontWeight = FontWeight.Bold,
            fontSize   = 15.sp,
            color      = MaterialTheme.colorScheme.onBackground,
        )
        if (day.precipitationProbability > 0) {
            Text(
                "${day.precipitationProbability}% rain",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF64B5F6),
                fontWeight = FontWeight.SemiBold,
            )
        }
        val windDisplay = if (useKm) {
            "${day.windSpeedMax.toInt()} km/h"
        } else {
            "${(day.windSpeedMax / 1.60934).toInt()} mph"
        }
        Text(
            windDisplay,
            style = MaterialTheme.typography.labelSmall,
            color = BtccTextSecondary,
        )
    }
}

private fun weatherDescription(code: Int): String = when (code) {
    0    -> "☀️"
    1    -> "🌤️"
    2    -> "⛅"
    3    -> "☁️"
    in 45..48 -> "🌫️"
    in 51..57 -> "🌦️"
    in 61..67 -> "🌧️"
    in 71..77 -> "🌨️"
    in 80..82 -> "🌧️"
    in 85..86 -> "🌨️"
    in 95..99 -> "⛈️"
    else -> "🌤️"
}

private fun weatherLabel(code: Int): String = when (code) {
    0    -> "Clear"
    1    -> "Mostly clear"
    2    -> "Partly cloudy"
    3    -> "Overcast"
    in 45..48 -> "Fog"
    in 51..55 -> "Drizzle"
    in 56..57 -> "Freezing drizzle"
    in 61..65 -> "Rain"
    in 66..67 -> "Freezing rain"
    in 71..75 -> "Snow"
    in 77..77 -> "Snow grains"
    in 80..82 -> "Showers"
    in 85..86 -> "Snow showers"
    in 95..99 -> "Thunderstorm"
    else -> "Unknown"
}
