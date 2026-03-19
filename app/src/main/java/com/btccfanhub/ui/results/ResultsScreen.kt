package com.btccfanhub.ui.results

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import com.btccfanhub.data.Analytics
import com.btccfanhub.data.DriverSeasonStats
import com.btccfanhub.data.FavouriteDriverStore
import com.btccfanhub.data.ChampionshipProgressionComputer
import com.btccfanhub.data.SeasonStatsComputer
import com.btccfanhub.data.Standings2026
import com.btccfanhub.data.SeasonData
import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.RoundResult
import com.btccfanhub.data.model.TeamStanding
import com.btccfanhub.Constants
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.RaceResultsRepository
import com.btccfanhub.data.repository.SeasonRepository
import com.btccfanhub.data.repository.StandingsRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccTextSecondary
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class, ExperimentalComposeUiApi::class)
@Composable
fun ResultsScreen(onRoundClick: (year: Int, round: Int) -> Unit = { _, _ -> }) {
    val context  = LocalContext.current
    val isTablet = LocalConfiguration.current.screenWidthDp >= 600

    // Single source of truth for 2004–2025: from MSS/Excel (assets/data/season_YYYY.json)
    var seasonData by remember { mutableStateOf<SeasonData?>(null) }

    // Live 2026 data fetched from the network
    var liveDrivers  by remember { mutableStateOf<List<DriverStanding>?>(null) }
    var liveTeams    by remember { mutableStateOf<List<TeamStanding>?>(null) }
    var liveRound    by remember { mutableIntStateOf(0) }
    var isRefreshing    by remember { mutableStateOf(false) }
    var loadFailed      by remember { mutableStateOf(false) }
    var refreshFailed   by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    var currentRaceResults by remember { mutableStateOf<List<RoundResult>>(emptyList()) }
    var resultsLoading     by remember { mutableStateOf(false) }

    // Season start date from remote config (fallback: 2026-04-18)
    var seasonStartDate by remember { mutableStateOf(LocalDate.of(2026, 4, 18)) }

    val today         = LocalDate.now()
    val seasonStarted = today >= seasonStartDate
    var selectedYear  by rememberSaveable { mutableIntStateOf(if (today >= LocalDate.of(2026, 4, 18)) 2026 else 2025) }
    val pagerState    = rememberPagerState(pageCount = { 5 })
    val scope         = rememberCoroutineScope()

    suspend fun refresh(invalidate: Boolean = false) {
        isRefreshing = true
        if (invalidate) StandingsRepository.invalidateCache()
        val live = StandingsRepository.getStandings()
        if (live != null && live.drivers.isNotEmpty()) {
            liveDrivers = live.drivers
            liveTeams   = live.teams.ifEmpty { null }
            liveRound   = live.round
            loadFailed  = false
        } else if (liveDrivers == null) {
            loadFailed = true
        } else {
            refreshFailed = true
        }
        isRefreshing = false
    }

    suspend fun loadResultsForYear(year: Int): List<RoundResult> =
        RaceResultsRepository.getResults(year)

    suspend fun refreshResults(invalidate: Boolean = false) {
        resultsLoading = true
        if (selectedYear in 2004..2025) {
            if (invalidate) SeasonRepository.invalidateCache()
            val data = SeasonRepository.getSeason(context, selectedYear)
            seasonData = data
            currentRaceResults = data?.rounds ?: emptyList()
        } else {
            if (invalidate) RaceResultsRepository.invalidateCache()
            currentRaceResults = loadResultsForYear(selectedYear)
        }
        resultsLoading = false
    }

    // Fetch season start date + live data on first composition
    LaunchedEffect(Unit) {
        seasonStartDate = CalendarRepository.getCalendarData().seasonStartDate
        if (today >= seasonStartDate) refresh()
    }

    LaunchedEffect(refreshFailed) {
        if (refreshFailed) {
            snackbarHostState.showSnackbar("Couldn't refresh — showing last known standings")
            refreshFailed = false
        }
    }

    // Load results whenever selected year changes: 2004–2025 from assets, else network
    LaunchedEffect(selectedYear) {
        resultsLoading = true
        if (selectedYear in 2004..2025) {
            val data = SeasonRepository.getSeason(context, selectedYear)
            seasonData = data
            currentRaceResults = data?.rounds ?: emptyList()
        } else {
            seasonData = null
            currentRaceResults = loadResultsForYear(selectedYear)
        }
        resultsLoading = false
    }

    // 2004–2025: single source of truth = season asset only (no Kotlin/network fallback)
    val histDrivers = when {
        seasonData != null -> seasonData!!.drivers
        selectedYear == 2026 -> Standings2026.drivers // 2026 before live load
        else -> emptyList()
    }
    val histTeams = when {
        seasonData != null -> seasonData!!.teams.ifEmpty { null }
        selectedYear == 2026 -> Standings2026.teams.ifEmpty { null }
        else -> null
    }?.ifEmpty { null }

    val show2026Drivers = selectedYear == 2026 && seasonStarted && liveDrivers != null
    val show2026Teams   = selectedYear == 2026 && seasonStarted && liveTeams != null

    Box(modifier = Modifier.fillMaxSize()) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TopAppBar(
            windowInsets = WindowInsets(0),
            title = {
                Text(
                    "STANDINGS",
                    fontWeight    = FontWeight.Black,
                    fontSize      = 18.sp,
                    letterSpacing = 1.sp,
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        // Year selector — arrow navigation
        Row(
            modifier = Modifier
                .then(if (isTablet) Modifier else Modifier.widthIn(max = 680.dp))
                .fillMaxWidth()
                .background(BtccSurface)
                .padding(horizontal = 8.dp, vertical = 2.dp),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            val canGoOlder = selectedYear > 2004
            val canGoNewer = selectedYear < 2026
            IconButton(
                onClick  = {
                    if (canGoOlder) { selectedYear -= 1; Analytics.resultsYearChanged(selectedYear) }
                },
                enabled  = canGoOlder,
            ) {
                Icon(
                    Icons.Default.KeyboardArrowLeft,
                    contentDescription = "Older season",
                    modifier = Modifier.size(28.dp),
                    tint = if (canGoOlder) MaterialTheme.colorScheme.onBackground else BtccOutline,
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "$selectedYear",
                    fontWeight    = FontWeight.Black,
                    fontSize      = 22.sp,
                    letterSpacing = 1.sp,
                    color         = BtccYellow,
                )
                Text(
                    "SEASON",
                    style         = MaterialTheme.typography.labelSmall,
                    color         = BtccTextSecondary,
                    fontWeight    = FontWeight.ExtraBold,
                    letterSpacing = 2.sp,
                )
            }
            IconButton(
                onClick  = {
                    if (canGoNewer) {
                        selectedYear += 1
                        Analytics.resultsYearChanged(selectedYear)
                        if (selectedYear == 2026 && seasonStarted && liveDrivers == null) {
                            scope.launch { refresh() }
                        }
                    }
                },
                enabled  = canGoNewer,
            ) {
                Icon(
                    Icons.Default.KeyboardArrowRight,
                    contentDescription = "Newer season",
                    modifier = Modifier.size(28.dp),
                    tint = if (canGoNewer) MaterialTheme.colorScheme.onBackground else BtccOutline,
                )
            }
        }

        // Tab row: fixed-width (fills screen) on tablet, scrollable on phone
        val tabScrollState = rememberScrollState()
        val canScrollLeft  = tabScrollState.value > 0
        val canScrollRight = tabScrollState.maxValue > 0 && tabScrollState.value < tabScrollState.maxValue
        val tabNames  = listOf("drivers", "teams", "results", "stats", "chart")
        val tabLabels = listOf("DRIVERS", "TEAMS", "RESULTS", "STATS", "CHART")
        Box(
            modifier = Modifier
                .then(if (isTablet) Modifier else Modifier.widthIn(max = 680.dp))
                .fillMaxWidth()
                .height(48.dp),
        ) {
            val useFixedTabs = LocalConfiguration.current.screenWidthDp >= 400
            if (useFixedTabs) {
                PrimaryTabRow(
                    selectedTabIndex = pagerState.currentPage,
                    containerColor   = BtccSurface,
                    contentColor     = BtccYellow,
                    modifier         = Modifier.fillMaxWidth(),
                ) {
                    tabLabels.forEachIndexed { index, label ->
                        Tab(
                            selected = pagerState.currentPage == index,
                            onClick  = {
                                Analytics.resultsTabChanged(selectedYear, tabNames[index])
                                scope.launch { pagerState.animateScrollToPage(index) }
                            },
                            text = {
                                Text(
                                    label,
                                    fontWeight    = FontWeight.ExtraBold,
                                    fontSize      = 12.sp,
                                    letterSpacing = 1.sp,
                                    color = if (pagerState.currentPage == index) BtccYellow else BtccTextSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            },
                        )
                    }
                }
            } else {
                PrimaryScrollableTabRow(
                    selectedTabIndex = pagerState.currentPage,
                    containerColor   = BtccSurface,
                    contentColor     = BtccYellow,
                    edgePadding      = 0.dp,
                    scrollState      = tabScrollState,
                ) {
                    tabLabels.forEachIndexed { index, label ->
                        Tab(
                            selected = pagerState.currentPage == index,
                            onClick  = {
                                Analytics.resultsTabChanged(selectedYear, tabNames[index])
                                scope.launch { pagerState.animateScrollToPage(index) }
                            },
                            text = {
                                Text(
                                    label,
                                    fontWeight    = FontWeight.ExtraBold,
                                    fontSize      = 12.sp,
                                    letterSpacing = 1.sp,
                                    color = if (pagerState.currentPage == index) BtccYellow else BtccTextSecondary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            },
                        )
                    }
                }
                if (canScrollLeft) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .width(32.dp)
                            .fillMaxHeight()
                            .background(
                                Brush.horizontalGradient(
                                    colorStops = arrayOf(
                                        0f to BtccBackground,
                                        1f to Color.Transparent,
                                    ),
                                ),
                            )
                            .pointerInteropFilter { false },
                    )
                }
                if (canScrollRight) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .width(32.dp)
                            .fillMaxHeight()
                            .background(
                                Brush.horizontalGradient(
                                    colorStops = arrayOf(
                                        0f to Color.Transparent,
                                        1f to BtccBackground,
                                    ),
                                ),
                            )
                            .pointerInteropFilter { false },
                    )
                }
            }
        }

        val isLiveLoading = selectedYear == 2026 && isRefreshing && liveDrivers == null
        val isLiveFailed  = selectedYear == 2026 && loadFailed && liveDrivers == null

        Box(modifier = Modifier.weight(1f).then(if (isTablet) Modifier else Modifier.widthIn(max = 680.dp)).fillMaxWidth()) {
            PullToRefreshBox(
                isRefreshing = isRefreshing || resultsLoading,
                onRefresh    = {
                    scope.launch {
                        if (pagerState.currentPage in 2..4) {
                            refreshResults(invalidate = true)
                        } else if (selectedYear == 2026) {
                            refresh(invalidate = true)
                        }
                    }
                },
                modifier     = Modifier.fillMaxSize(),
            ) {
                HorizontalPager(
                state    = pagerState,
                modifier = Modifier.fillMaxSize(),
            ) { page ->
                val isHistorical = selectedYear in 2004..2025
                when {
                    // --- Loading / error states (live only) ---
                    isLiveLoading ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = BtccYellow)
                        }
                    isLiveFailed ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "Could not load standings.\nPull down to retry.",
                                color     = BtccTextSecondary,
                                textAlign = TextAlign.Center,
                            )
                        }

                    // --- Historical seasons (2004–2025) ---
                    page == 0 && isHistorical ->
                        DriverStandingsList(histDrivers, showLiveRound = 0, showPastBanner = false, bannerYear = selectedYear)
                    page == 1 && isHistorical && histTeams != null ->
                        TeamStandingsList(histTeams, showPastBanner = false, bannerYear = selectedYear)
                    page == 1 && isHistorical ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Team standings not available.", color = BtccTextSecondary, textAlign = TextAlign.Center)
                        }

                    // --- 2026 live ---
                    page == 0 && show2026Drivers ->
                        DriverStandingsList(liveDrivers!!, showLiveRound = liveRound, showPastBanner = false)
                    page == 0 && selectedYear == 2026 && !seasonStarted ->
                        SeasonNotStarted(seasonStartDate)
                    page == 0 && selectedYear == 2026 ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = BtccYellow)
                        }
                    page == 1 && show2026Teams ->
                        TeamStandingsList(liveTeams!!, showPastBanner = false)
                    page == 1 && selectedYear == 2026 ->
                        SeasonNotStarted(seasonStartDate)

                    // --- Race results ---
                    page == 2 ->
                        RaceResultsTab(
                            year            = selectedYear,
                            results         = currentRaceResults,
                            loading         = resultsLoading,
                            seasonStartDate = seasonStartDate,
                            onRoundClick    = { round -> onRoundClick(selectedYear, round) },
                        )

                    // --- Season stats ---
                    page == 3 -> {
                        val stats = if (selectedYear in 2004..2025 && !seasonData?.driverStats.isNullOrEmpty())
                            seasonData!!.driverStats
                        else
                            remember(currentRaceResults) { SeasonStatsComputer.compute(currentRaceResults) }
                        SeasonStatsTab(
                            stats           = stats,
                            loading         = resultsLoading,
                            year            = selectedYear,
                            seasonStartDate = seasonStartDate,
                        )
                    }

                    // --- Championship progression chart ---
                    page == 4 -> ProgressionTab(
                        results         = currentRaceResults,
                        loading         = resultsLoading,
                        year            = selectedYear,
                        seasonStartDate = seasonStartDate,
                        progression     = seasonData?.progression,
                    )

                    else ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = BtccYellow)
                        }
                }
            }
            }
        }
    }
    SnackbarHost(
        hostState = snackbarHostState,
        modifier  = Modifier.align(Alignment.BottomCenter),
    )
    } // end Box
}

@Composable
private fun ProgressionTab(
    results: List<RoundResult>,
    loading: Boolean,
    year: Int,
    seasonStartDate: LocalDate,
    progression: List<com.btccfanhub.data.DriverProgressionSeries>? = null,
) {
    when {
        loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = BtccYellow)
        }
        results.none { r -> r.races.any { it.results.isNotEmpty() } } && progression.isNullOrEmpty() -> ResultsNotStarted(year, seasonStartDate)
        else -> {
            val series = if (!progression.isNullOrEmpty())
                progression.sortedByDescending { it.cumulativePointsByRound.lastOrNull() ?: 0 }
            else
                remember(results) {
                    ChampionshipProgressionComputer.compute(results)
                        .sortedByDescending { it.cumulativePointsByRound.lastOrNull() ?: 0 }
                }
            val scrollState = androidx.compose.foundation.rememberScrollState()
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ChampionshipProgressionChart(
                    series = series,
                    roundLabels = remember(results) {
                        if (results.isNotEmpty()) results.sortedBy { it.round }.map { it.venue }
                        else List(series.maxOfOrNull { it.cumulativePointsByRound.size } ?: 0) { "R${it + 1}" }
                    },
                )
            }
        }
    }
}

@Composable
private fun RaceResultsTab(
    year: Int,
    results: List<RoundResult>,
    loading: Boolean,
    seasonStartDate: LocalDate,
    onRoundClick: (Int) -> Unit,
) {
    when {
        loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = BtccYellow)
        }
        else -> {
            val completedRounds = results.filter { r -> r.races.any { it.results.isNotEmpty() } }
            if (completedRounds.isEmpty()) {
                ResultsNotStarted(year, seasonStartDate)
            } else {
                LazyColumn(
                    contentPadding      = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    itemsIndexed(completedRounds) { _, round ->
                        RoundResultCard(round = round, onClick = { onRoundClick(round.round) })
                    }
                }
            }
        }
    }
}

@Composable
private fun RoundResultCard(round: RoundResult, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Round badge
        val startRound = Constants.firstRaceNumberForRound(round.round)
        val endRound   = startRound + 2
        Box(
            modifier = Modifier
                .width(72.dp)
                .background(BtccYellow.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                .border(1.dp, BtccYellow.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                .padding(vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "R$startRound–$endRound",
                fontWeight    = FontWeight.Black,
                fontSize      = 12.sp,
                color         = BtccYellow,
                letterSpacing = 0.5.sp,
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(round.venue, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
            Text(round.date,  style = MaterialTheme.typography.bodySmall, color = BtccTextSecondary)
        }

    }
}

private val SEASON_DATE_FMT = DateTimeFormatter.ofPattern("d MMMM yyyy")

@Composable
private fun SeasonNotStarted(seasonStartDate: LocalDate) {
    val daysUntil = ChronoUnit.DAYS.between(LocalDate.now(), seasonStartDate).coerceAtLeast(0)
    val seasonDateLabel = seasonStartDate.format(SEASON_DATE_FMT)

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .background(
                        Brush.radialGradient(listOf(BtccYellow.copy(alpha = 0.2f), Color.Transparent)),
                        shape = RoundedCornerShape(48.dp),
                    )
                    .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(48.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = null,
                    tint     = BtccYellow,
                    modifier = Modifier.size(44.dp),
                )
            }

            Spacer(Modifier.height(28.dp))

            Text(
                "NO STANDINGS YET",
                fontWeight    = FontWeight.Black,
                fontSize      = 20.sp,
                color         = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 0.5.sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "The season kicks off at",
                style     = MaterialTheme.typography.bodyMedium,
                color     = BtccTextSecondary,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(16.dp))

            Box(
                modifier = Modifier
                    .background(BtccCard, RoundedCornerShape(12.dp))
                    .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                    .padding(horizontal = 24.dp, vertical = 16.dp),
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "ROUND 1 · DONINGTON PARK",
                        style         = MaterialTheme.typography.labelSmall,
                        color         = BtccYellow,
                        fontWeight    = FontWeight.ExtraBold,
                        letterSpacing = 1.sp,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        seasonDateLabel,
                        style      = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color      = MaterialTheme.colorScheme.onBackground,
                    )
                    if (daysUntil > 0) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "$daysUntil days away",
                            style = MaterialTheme.typography.bodySmall,
                            color = BtccTextSecondary,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultsNotStarted(year: Int, seasonStartDate: LocalDate) {
    val daysUntil = ChronoUnit.DAYS.between(LocalDate.now(), seasonStartDate).coerceAtLeast(0)
    val seasonDateLabel = seasonStartDate.format(SEASON_DATE_FMT)

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .background(
                        Brush.radialGradient(listOf(BtccYellow.copy(alpha = 0.2f), Color.Transparent)),
                        shape = RoundedCornerShape(48.dp),
                    )
                    .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(48.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = null,
                    tint     = BtccYellow,
                    modifier = Modifier.size(44.dp),
                )
            }

            Spacer(Modifier.height(28.dp))

            Text(
                "NO RESULTS YET",
                fontWeight    = FontWeight.Black,
                fontSize      = 20.sp,
                color         = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 0.5.sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                if (year != 2026) "Results will appear after each race weekend" else "The season kicks off at",
                style     = MaterialTheme.typography.bodyMedium,
                color     = BtccTextSecondary,
                textAlign = TextAlign.Center,
            )

            if (year == 2026) { // only show countdown for the upcoming season
                Spacer(Modifier.height(16.dp))

                Box(
                    modifier = Modifier
                        .background(BtccCard, RoundedCornerShape(12.dp))
                        .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            "ROUND 1 · DONINGTON PARK",
                            style         = MaterialTheme.typography.labelSmall,
                            color         = BtccYellow,
                            fontWeight    = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            seasonDateLabel,
                            style      = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            color      = MaterialTheme.colorScheme.onBackground,
                        )
                        if (daysUntil > 0) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "$daysUntil days away",
                                style = MaterialTheme.typography.bodySmall,
                                color = BtccTextSecondary,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DriverStandingsList(
    standings: List<DriverStanding>,
    showLiveRound: Int,
    showPastBanner: Boolean,
    bannerYear: Int = 2025,
) {
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            when {
                showLiveRound > 0 -> RoundBanner("ROUND $showLiveRound STANDINGS")
                showPastBanner    -> SeasonBanner(bannerYear)
            }
        }
        itemsIndexed(standings) { _, driver ->
            DriverRow(driver)
        }
    }
}

@Composable
private fun TeamStandingsList(
    standings: List<TeamStanding>,
    showPastBanner: Boolean,
    bannerYear: Int = 2025,
) {
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            if (showPastBanner) SeasonBanner(bannerYear)
        }
        itemsIndexed(standings) { _, team ->
            TeamRow(team)
        }
    }
}

@Composable
private fun SeasonBanner(year: Int = 2025) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .border(1.dp, BtccYellow.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "$year FINAL STANDINGS",
            fontWeight    = FontWeight.ExtraBold,
            fontSize      = 11.sp,
            letterSpacing = 1.5.sp,
            color         = BtccYellow,
        )
    }
    Spacer(Modifier.height(4.dp))
}

@Composable
private fun DriverRow(driver: DriverStanding) {
    val context     = LocalContext.current
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == driver.name

    val positionColor = when (driver.position) {
        1    -> Color(0xFFFFD700)
        2    -> Color(0xFFC0C0C0)
        3    -> Color(0xFFCD7F32)
        else -> BtccOutline
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .background(BtccCard, RoundedCornerShape(10.dp))
            .then(
                if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                else Modifier
            )
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "${driver.position}",
            style      = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = positionColor,
            modifier   = Modifier.width(24.dp),
            textAlign  = TextAlign.Center,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                driver.name,
                fontWeight = FontWeight.Bold,
                style      = MaterialTheme.typography.bodyLarge,
                color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            if (driver.team.isNotEmpty()) {
                Text(
                    driver.displayTeam,
                    style    = MaterialTheme.typography.bodySmall,
                    color    = BtccTextSecondary,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.Center) {
            Text(
                "${driver.points} pts",
                style      = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            if (driver.wins > 0 || driver.seconds > 0 || driver.thirds > 0) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (driver.wins > 0) TrophyCount(driver.wins, Color(0xFFFFD700))
                    if (driver.seconds > 0) TrophyCount(driver.seconds, Color(0xFFC0C0C0))
                    if (driver.thirds > 0) TrophyCount(driver.thirds, Color(0xFFCD7F32))
                }
            }
        }
        IconButton(
            onClick  = { FavouriteDriverStore.toggle(context, driver.name) },
            modifier = Modifier.size(32.dp),
        ) {
            Icon(
                imageVector = if (isFavourite) Icons.Filled.Star else Icons.Outlined.Star,
                contentDescription = if (isFavourite) "Remove favourite" else "Set as favourite",
                tint     = if (isFavourite) BtccYellow else BtccTextSecondary,
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun TrophyCount(count: Int, tint: Color) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        Icon(
            Icons.Filled.EmojiEvents,
            contentDescription = null,
            tint     = tint,
            modifier = Modifier.size(11.dp),
        )
        Text(
            "$count",
            style      = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.ExtraBold,
            color      = tint,
        )
    }
}

@Composable
private fun TeamRow(team: TeamStanding) {
    val positionColor = when (team.position) {
        1    -> Color(0xFFFFD700)
        2    -> Color(0xFFC0C0C0)
        3    -> Color(0xFFCD7F32)
        else -> BtccOutline
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 64.dp)
            .background(BtccCard, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "${team.position}",
            style      = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = positionColor,
            modifier   = Modifier.width(24.dp),
            textAlign  = TextAlign.Center,
        )
        Text(
            team.name,
            fontWeight = FontWeight.Bold,
            style      = MaterialTheme.typography.bodyLarge,
            modifier   = Modifier.weight(1f),
        )
        Text(
            "${team.points} pts",
            style      = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.ExtraBold,
            color      = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun RoundBanner(label: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .border(1.dp, Color(0xFF4CAF50).copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontWeight    = FontWeight.ExtraBold,
            fontSize      = 11.sp,
            letterSpacing = 1.5.sp,
            color         = Color(0xFF4CAF50),
        )
    }
    Spacer(Modifier.height(4.dp))
}

// ─────────────────────────────────────────────────────────────────────────────
// Season stats tab
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SeasonStatsTab(
    stats: List<DriverSeasonStats>,
    loading: Boolean,
    year: Int = 2026,
    seasonStartDate: LocalDate = LocalDate.of(2026, 4, 18),
) {
    when {
        loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = BtccYellow)
        }
        stats.isEmpty() -> ResultsNotStarted(year = year, seasonStartDate = seasonStartDate)
        else -> {
            val showPoles = stats.any { it.poles > 0 }
            LazyColumn(
                contentPadding      = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Spacer(Modifier.width(24.dp))
                        Spacer(Modifier.width(12.dp))
                        Text(
                            "DRIVER",
                            style         = MaterialTheme.typography.labelSmall,
                            color         = BtccTextSecondary,
                            fontWeight    = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                            modifier      = Modifier.weight(1f),
                        )
                        val cols = if (showPoles) listOf("W", "POD", "POL", "DNF") else listOf("W", "POD", "DNF")
                        cols.forEach { col ->
                            Text(
                                col,
                                style         = MaterialTheme.typography.labelSmall,
                                color         = BtccTextSecondary,
                                fontWeight    = FontWeight.ExtraBold,
                                letterSpacing = 0.5.sp,
                                textAlign     = TextAlign.Center,
                                modifier      = Modifier.width(36.dp),
                            )
                        }
                    }
                }
                itemsIndexed(stats) { index, stat ->
                    DriverStatsRow(rank = index + 1, stat = stat, showPoles = showPoles)
                }
            }
        }
    }
}

@Composable
private fun DriverStatsRow(rank: Int, stat: DriverSeasonStats, showPoles: Boolean = true) {
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == stat.driver

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .then(if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(10.dp)) else Modifier)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "$rank",
            style      = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Black,
            color      = BtccTextSecondary,
            modifier   = Modifier.width(24.dp),
            textAlign  = TextAlign.Center,
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stat.driver,
                fontWeight = FontWeight.Bold,
                style      = MaterialTheme.typography.bodyMedium,
                color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            Text(
                stat.team,
                style = MaterialTheme.typography.labelSmall,
                color = BtccTextSecondary,
            )
        }
        StatCell(value = stat.wins,    highlight = stat.wins > 0,    highlightColor = BtccYellow)
        StatCell(value = stat.podiums, highlight = false)
        if (showPoles) {
            StatCell(value = stat.poles, highlight = stat.poles > 0, highlightColor = Color(0xFFC0C0C0))
        }
        StatCell(value = stat.dnfs,    highlight = stat.dnfs > 0,    highlightColor = Color(0xFFE3000B))
    }
}

@Composable
private fun StatCell(value: Int, highlight: Boolean, highlightColor: Color = BtccYellow) {
    Text(
        if (value > 0) "$value" else "—",
        style      = MaterialTheme.typography.bodySmall,
        fontWeight = if (highlight) FontWeight.ExtraBold else FontWeight.Normal,
        color      = if (highlight) highlightColor else BtccTextSecondary,
        textAlign  = TextAlign.Center,
        modifier   = Modifier.width(36.dp),
    )
}
