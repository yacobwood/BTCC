package com.btccfanhub.ui.results

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Star
import com.btccfanhub.Constants
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.data.store.FavouriteDriverStore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.repository.RaceResultsRepository
import com.btccfanhub.data.repository.SeasonRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun RoundResultsScreen(year: Int = 2026, round: Int, onBack: () -> Unit) {
    var navigatingBack by remember { mutableStateOf(false) }
    BackHandler { if (!navigatingBack) { navigatingBack = true; onBack() } }
    var roundResult by remember { mutableStateOf<com.btccfanhub.data.model.RoundResult?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val isTablet = configuration.screenWidthDp >= 600

    LaunchedEffect(year, round) {
        Analytics.screen("round_results:$year:$round")
        loading = true
        loadError = false
        try {
            roundResult = if (year in 2004..2025) {
                SeasonRepository.getSeason(context, year)?.rounds?.find { it.round == round }
            } else {
                RaceResultsRepository.getResults(year).find { it.round == round }
            }
        } catch (e: Exception) {
            loadError = true
        }
        loading = false
    }

    val races = (roundResult?.races ?: emptyList()).filter { it.results.isNotEmpty() }
    val pageCount = races.size.coerceAtLeast(1)
    var savedPage by rememberSaveable { mutableIntStateOf(0) }
    val pagerState = rememberPagerState(initialPage = savedPage, pageCount = { pageCount })
    LaunchedEffect(pagerState.currentPage) { savedPage = pagerState.currentPage }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            windowInsets = WindowInsets(0),
            title = {
                Column {
                    Text(
                        roundResult?.venue ?: "Round $round",
                        fontWeight    = FontWeight.Black,
                        fontSize      = if (isTablet) 22.sp else 17.sp,
                        letterSpacing = 0.5.sp,
                    )
                    val startRound = Constants.firstRaceNumberForRound(round)
                    val endRound   = startRound + 2
                    Text(
                        "ROUNDS $startRound–$endRound · ${roundResult?.date ?: ""}",
                        style         = MaterialTheme.typography.labelSmall,
                        color         = BtccYellow,
                        fontSize      = if (isTablet) 14.sp else 11.sp,
                        fontWeight    = FontWeight.ExtraBold,
                        letterSpacing = 1.sp,
                    )
                }
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        Column(modifier = Modifier.fillMaxSize()) {
            when {
                loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BtccYellow)
                }
                loadError -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Text("Failed to load results.", color = BtccTextSecondary, textAlign = TextAlign.Center)
                        Button(
                            onClick = {
                                scope.launch {
                                    loading = true
                                    loadError = false
                                    try {
                                        roundResult = if (year in 2004..2025) {
                                            SeasonRepository.getSeason(context, year)?.rounds?.find { it.round == round }
                                        } else {
                                            RaceResultsRepository.getResults(year).find { it.round == round }
                                        }
                                    } catch (e: Exception) {
                                        loadError = true
                                    }
                                    loading = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = BtccYellow,
                                contentColor   = BtccNavy,
                            ),
                            shape = RoundedCornerShape(8.dp),
                        ) { Text("Retry", fontWeight = FontWeight.Bold) }                    }
                }
                races.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "No results available for this round.",
                        color     = BtccTextSecondary,
                        textAlign = TextAlign.Center,
                    )
                }
                else -> {
                    TabRow(
                        selectedTabIndex = pagerState.currentPage,
                        containerColor   = BtccBackground,
                        contentColor     = BtccYellow,
                    ) {
                        races.forEachIndexed { index, race ->
                            val tabLabel = when {
                                race.label.equals("Qualifying Race", ignoreCase = true) -> "QUALI RACE"
                                else -> race.label.uppercase()
                            }
                            Tab(
                                selected = pagerState.currentPage == index,
                                onClick  = {
                                    Analytics.raceTabClicked(roundResult?.venue ?: "Round $round", race.label)
                                    scope.launch { pagerState.animateScrollToPage(index) }
                                },
                                text = {
                                    Text(
                                        tabLabel,
                                        fontWeight    = FontWeight.ExtraBold,
                                        fontSize      = if (isTablet) 18.sp else 12.sp,
                                        letterSpacing = 0.sp,
                                        color = if (pagerState.currentPage == index) BtccYellow else BtccTextSecondary,
                                    )
                                },
                            )
                        }
                    }

                    HorizontalPager(
                        state    = pagerState,
                        modifier = Modifier.fillMaxSize(),
                    ) { page ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            RaceResultsList(
                                race      = races[page],
                                roundDate = roundResult?.date ?: "",
                                venue     = roundResult?.venue ?: "",
                                modifier  = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun VideoExternalButton(
    text: String,
    url: String,
    venue: String = "",
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    Row(
        modifier = modifier
            .background(Color(0xFF1A0000), RoundedCornerShape(10.dp))
            .border(1.dp, Color(0xFFFF0000).copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .clickable {
                Analytics.raceVideoClicked(venue, text)
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
            .padding(horizontal = 16.dp, vertical = if (LocalConfiguration.current.screenWidthDp >= 600) 16.dp else 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            Icons.Default.PlayCircle,
            contentDescription = null,
            tint     = Color(0xFFFF0000),
            modifier = Modifier.size(20.dp),
        )
        Text(
            text,
            color         = Color.White,
            fontWeight    = FontWeight.ExtraBold,
            fontSize      = if (LocalConfiguration.current.screenWidthDp >= 600) 15.sp else 13.sp,
            letterSpacing = 1.sp,
            modifier      = Modifier.weight(1f),
        )
        Text(
            "YouTube",
            style         = MaterialTheme.typography.labelSmall,
            color         = Color(0xFFFF0000),
            fontWeight    = FontWeight.Bold,
            letterSpacing = 0.5.sp,
        )
    }
}

@Composable
private fun RaceResultsList(race: RaceEntry, roundDate: String, venue: String = "", modifier: Modifier = Modifier) {
    val isQualifyingRace = race.label.equals("Qualifying Race", ignoreCase = true)
    if (race.results.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No results available.", color = BtccTextSecondary)
        }
        return
    }
    val context = LocalContext.current
    val useKm by com.btccfanhub.data.FeatureFlagsStore.useKm.collectAsState()
    val maxAvgSpeedKmh = remember(race) {
        race.results.mapNotNull { it.avgLapSpeed?.toDoubleOrNull() }.maxOrNull()
    }

    val displayDate = race.date ?: roundDate
    val configuration = LocalConfiguration.current
    val isTablet = configuration.screenWidthDp >= 600

    LazyColumn(
        modifier            = modifier,
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(if (isTablet) 10.dp else 6.dp),
    ) {
        if (displayDate.isNotEmpty()) {
            item {
                Text(
                    displayDate.uppercase(),
                    style         = MaterialTheme.typography.labelSmall,
                    color         = BtccTextSecondary,
                    fontSize      = if (isTablet) 14.sp else 11.sp,
                    fontWeight    = FontWeight.Bold,
                    letterSpacing = 1.sp,
                    modifier      = Modifier.padding(bottom = 4.dp),
                )
            }
        }
        if (race.fullRaceUrl != null) {
            item {
                VideoExternalButton(
                    text     = "WATCH FULL RACE",
                    url      = race.fullRaceUrl,
                    venue    = venue,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                )
            }
        }
        items(race.results) { result ->
            DriverResultRow(result, useKm = useKm, maxAvgSpeedKmh = maxAvgSpeedKmh, isTablet = isTablet)
        }
        item {
            Row(
                modifier            = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val legendItems = if (isQualifyingRace)
                    listOf("BL" to "Best lap time")
                else
                    listOf("FL" to "Fastest lap", "L" to "Led a lap", "P" to "Pole position", "BL" to "Best lap time")
                legendItems.forEach { (badge, label) ->
                    Row(
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            badge,
                            fontSize   = 9.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color      = BtccYellow,
                            modifier   = Modifier
                                .background(BtccYellow.copy(alpha = 0.15f), RoundedCornerShape(3.dp))
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                        Text(
                            label,
                            style = MaterialTheme.typography.labelSmall,
                            fontSize = if (isTablet) 14.sp else 11.sp,
                            color = BtccTextSecondary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DriverResultRow(
    result: DriverResult,
    useKm: Boolean = true,
    maxAvgSpeedKmh: Double? = null,
    isTablet: Boolean = false,
) {
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == result.driver

    val posColor = when (result.position) {
        1    -> Color(0xFFFFD700)
        2    -> Color(0xFFC0C0C0)
        3    -> Color(0xFFCD7F32)
        else -> BtccOutline
    }

    val isLeader = result.position == 1
    // Normalise bestLap: btcc.net older data omits the "0:" prefix for sub-minute laps
    val bestLapDisplay = result.bestLap.let { if (it.isNotEmpty() && !it.contains(':')) "0:$it" else it }
    val displayTime = if (result.displayTime.isNotEmpty()) {
        result.displayTime
    } else {
        when {
            isLeader -> result.time.takeIf { it.isNotEmpty() } ?: result.bestLap.takeIf { it.isNotEmpty() } ?: "—"
            else     -> result.gap?.let { if (it.startsWith("+")) it else "+$it" } ?: "—"
        }
    }

    val speedKmh       = result.avgLapSpeed?.toDoubleOrNull()
    val isTopSpeed     = speedKmh != null && maxAvgSpeedKmh != null && speedKmh == maxAvgSpeedKmh
    val speedDisplay   = speedKmh?.let {
        if (useKm) "%.2f km/h".format(it) else "%.2f mph".format(it * 0.621371)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(if (isTablet) 14.dp else 10.dp))
            .then(if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(if (isTablet) 14.dp else 10.dp)) else Modifier)
            .padding(horizontal = if (isTablet) 20.dp else 12.dp, vertical = if (isTablet) 16.dp else 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (isTablet) 20.dp else 12.dp),
    ) {
        Text(
            if (result.position > 0) "${result.position}" else "DNF",
            style      = if (isTablet) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = posColor,
            modifier   = Modifier.width(if (isTablet) 48.dp else 32.dp),
            textAlign  = TextAlign.Center,
        )
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (isFavourite) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = null,
                        tint     = BtccYellow,
                        modifier = Modifier.size(if (isTablet) 16.dp else 12.dp),
                    )
                }
                Text(
                    result.driver,
                    fontWeight = FontWeight.Bold,
                    fontSize   = if (isTablet) 18.sp else 15.sp,
                    style      = MaterialTheme.typography.bodyMedium,
                    color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
                )
            }
            Text(
                result.team,
                style = MaterialTheme.typography.bodySmall,
                fontSize = if (isTablet) 14.sp else 12.sp,
                color = BtccTextSecondary,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                displayTime,
                fontWeight = FontWeight.ExtraBold,
                fontSize   = if (isTablet) 16.sp else 13.sp,
                color      = if (isLeader) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            if (bestLapDisplay.isNotEmpty()) {
                Text(
                    "BL $bestLapDisplay",
                    style    = MaterialTheme.typography.labelSmall,
                    color    = if (result.fastestLap) BtccYellow else BtccTextSecondary,
                    fontSize = if (isTablet) 12.sp else 10.sp,
                )
            }
            if (speedDisplay != null) {
                Text(
                    speedDisplay,
                    style    = MaterialTheme.typography.labelSmall,
                    color    = if (isTopSpeed) BtccYellow else BtccTextSecondary,
                    fontSize = if (isTablet) 12.sp else 10.sp,
                )
            }
            val bonuses = buildList {
                if (result.fastestLap) add("FL")
                if (result.leadLap)    add("L")
                if (result.pole)       add("P")
            }
            if (bonuses.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    bonuses.forEach { badge ->
                        Text(
                            badge,
                            fontSize = 9.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color    = BtccYellow,
                            modifier = Modifier
                                .background(BtccYellow.copy(alpha = 0.15f), RoundedCornerShape(3.dp))
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                }
            }
            Text(
                if (result.points > 0) "+${result.points} pts" else "0 pts",
                style = MaterialTheme.typography.labelSmall,
                color = BtccTextSecondary,
            )
        }
    }
}
