package com.btccfanhub.ui.results

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.data.season.DriverSeasonStats
import com.btccfanhub.data.store.FavouriteDriverStore
import com.btccfanhub.data.ChampionshipProgressionComputer
import com.btccfanhub.data.season.SeasonStatsComputer
import com.btccfanhub.data.season.Standings2026
import com.btccfanhub.data.season.SeasonData
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

    LaunchedEffect(Unit) { Analytics.screen("results") }

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
    var firstRoundVenue by remember { mutableStateOf("") }

    val today         = LocalDate.now()
    val seasonStarted = today >= seasonStartDate
    var selectedYear  by rememberSaveable { mutableIntStateOf(if (today >= LocalDate.of(2026, 4, 18)) 2026 else 2025) }
    val driversListState  = rememberSaveable(selectedYear, saver = LazyListState.Saver) { LazyListState() }
    val teamsListState    = rememberSaveable(selectedYear, saver = LazyListState.Saver) { LazyListState() }
    val resultsListState  = rememberSaveable(selectedYear, saver = LazyListState.Saver) { LazyListState() }
    val statsListState    = rememberSaveable(selectedYear, saver = LazyListState.Saver) { LazyListState() }
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
        val cal = CalendarRepository.getCalendarData()
        seasonStartDate = cal.seasonStartDate
        firstRoundVenue = cal.rounds.minByOrNull { it.round }?.venue ?: ""
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
                    fontSize      = if (isTablet) 22.sp else 18.sp,
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
                    fontSize      = if (isTablet) 28.sp else 22.sp,
                    letterSpacing = 1.sp,
                    color         = BtccYellow,
                )
                Text(
                    "SEASON",
                    style         = MaterialTheme.typography.labelSmall,
                    fontSize      = if (isTablet) 13.sp else 11.sp,
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
                .height(if (isTablet) 64.dp else 48.dp),
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
                                    fontSize      = if (isTablet) 16.sp else 11.sp,
                                    letterSpacing = 0.sp,
                                    color = if (pagerState.currentPage == index) BtccYellow else BtccTextSecondary,
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
                                    fontSize      = if (isTablet) 16.sp else 12.sp,
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
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            DriverStandingsList(
                                histDrivers,
                                showLiveRound = 0,
                                showPastBanner = false,
                                bannerYear = selectedYear,
                                state = driversListState,
                                modifier = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }
                    page == 1 && isHistorical && histTeams != null ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            TeamStandingsList(
                                histTeams,
                                showPastBanner = false,
                                bannerYear = selectedYear,
                                state = teamsListState,
                                modifier = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }
                    page == 1 && isHistorical ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Team standings not available.", color = BtccTextSecondary, textAlign = TextAlign.Center)
                        }

                    // --- 2026 live ---
                    page == 0 && show2026Drivers ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            DriverStandingsList(
                                liveDrivers!!,
                                showLiveRound = liveRound,
                                showPastBanner = false,
                                state = driversListState,
                                modifier = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }
                    page == 0 && selectedYear == 2026 && !seasonStarted ->
                        SeasonNotStarted(seasonStartDate, firstRoundVenue)
                    page == 0 && selectedYear == 2026 ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = BtccYellow)
                        }
                    page == 1 && show2026Teams ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            TeamStandingsList(
                                liveTeams!!,
                                showPastBanner = false,
                                state = teamsListState,
                                modifier = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }
                    page == 1 && selectedYear == 2026 ->
                        SeasonNotStarted(seasonStartDate, firstRoundVenue)

                    // --- Race results ---
                    page == 2 ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            RaceResultsTab(
                                year = selectedYear,
                                results = currentRaceResults,
                                loading = resultsLoading,
                                seasonStartDate = seasonStartDate,
                                onRoundClick = { round -> onRoundClick(selectedYear, round) },
                                state = resultsListState,
                                modifier = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }

                    // --- Season stats ---
                    page == 3 -> {
                        // Always compute from rounds so poles + fastest laps are populated.
                        // Fall back to JSON driverStats only if rounds data is empty.
                        val stats = remember(currentRaceResults, seasonData) {
                            val computed = SeasonStatsComputer.compute(currentRaceResults)
                            if (computed.isNotEmpty()) computed
                            else seasonData?.driverStats ?: emptyList()
                        }
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            SeasonStatsTab(
                                stats = stats,
                                loading = resultsLoading,
                                year = selectedYear,
                                seasonStartDate = seasonStartDate,
                                state = statsListState,
                                modifier = Modifier.widthIn(max = if (isTablet) 800.dp else Dp.Unspecified)
                            )
                        }
                    }

                    // --- Championship progression chart ---
                    page == 4 -> 
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                            ProgressionTab(
                                results = currentRaceResults,
                                loading = resultsLoading,
                                year = selectedYear,
                                seasonStartDate = seasonStartDate,
                                progression = seasonData?.progression,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

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
    modifier: Modifier = Modifier,
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
                modifier = modifier
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
    state: LazyListState = rememberLazyListState(),
    modifier: Modifier = Modifier,
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
                    state               = state,
                    modifier            = modifier,
                    contentPadding      = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(completedRounds, key = { it.round }) { round ->
                        RoundResultCard(round = round, onClick = { onRoundClick(round.round) })
                    }
                }
            }
        }
    }
}

@Composable
private fun RoundResultCard(round: RoundResult, onClick: () -> Unit) {
    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(if (isTablet) 14.dp else 10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = if (isTablet) 20.dp else 14.dp, vertical = if (isTablet) 18.dp else 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Round badge
        val startRound = Constants.firstRaceNumberForRound(round.round)
        val endRound   = startRound + 2
        Box(
            modifier = Modifier
                .width(if (isTablet) 96.dp else 72.dp)
                .background(BtccYellow.copy(alpha = 0.15f), RoundedCornerShape(if (isTablet) 10.dp else 8.dp))
                .border(1.dp, BtccYellow.copy(alpha = 0.4f), RoundedCornerShape(if (isTablet) 10.dp else 8.dp))
                .padding(vertical = if (isTablet) 10.dp else 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "R$startRound–$endRound",
                fontWeight    = FontWeight.Black,
                fontSize      = if (isTablet) 15.sp else 12.sp,
                color         = BtccYellow,
                letterSpacing = 0.5.sp,
            )
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(
                round.venue,
                fontWeight = FontWeight.Bold,
                style = if (isTablet) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                round.date,
                style = MaterialTheme.typography.bodySmall,
                fontSize = if (isTablet) 14.sp else 12.sp,
                color = BtccTextSecondary
            )
        }

    }
}

private val SEASON_DATE_FMT = DateTimeFormatter.ofPattern("d MMMM yyyy")

@Composable
private fun SeasonNotStarted(seasonStartDate: LocalDate, firstRoundVenue: String = "") {
    val testOverride by com.btccfanhub.data.store.FeatureFlagsStore.testDateTimeOverride.collectAsState()
    val today = remember(testOverride) { com.btccfanhub.data.TestClock.today() }
    val daysUntil = ChronoUnit.DAYS.between(today, seasonStartDate).coerceAtLeast(0)
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
                    .size(if (LocalConfiguration.current.screenWidthDp >= 600) 140.dp else 96.dp)
                    .background(
                        Brush.radialGradient(listOf(BtccYellow.copy(alpha = 0.2f), Color.Transparent)),
                        shape = RoundedCornerShape(if (LocalConfiguration.current.screenWidthDp >= 600) 70.dp else 48.dp),
                    )
                    .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(if (LocalConfiguration.current.screenWidthDp >= 600) 70.dp else 48.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = null,
                    tint     = BtccYellow,
                    modifier = Modifier.size(if (LocalConfiguration.current.screenWidthDp >= 600) 64.dp else 44.dp),
                )
            }

            Spacer(Modifier.height(28.dp))

            Text(
                "NO STANDINGS YET",
                fontWeight    = FontWeight.Black,
                fontSize      = if (LocalConfiguration.current.screenWidthDp >= 600) 26.sp else 20.sp,
                color         = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 0.5.sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "The season kicks off at",
                style     = MaterialTheme.typography.bodyMedium,
                fontSize  = if (LocalConfiguration.current.screenWidthDp >= 600) 18.sp else 14.sp,
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
                    if (firstRoundVenue.isNotEmpty()) {
                        Text(
                            "ROUND 1 · ${firstRoundVenue.uppercase()}",
                            style         = MaterialTheme.typography.labelSmall,
                            color         = BtccYellow,
                            fontWeight    = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                        )
                        Spacer(Modifier.height(6.dp))
                    }
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
    val testOverride by com.btccfanhub.data.store.FeatureFlagsStore.testDateTimeOverride.collectAsState()
    val today = remember(testOverride) { com.btccfanhub.data.TestClock.today() }
    val daysUntil = ChronoUnit.DAYS.between(today, seasonStartDate).coerceAtLeast(0)
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
                    .size(if (LocalConfiguration.current.screenWidthDp >= 600) 140.dp else 96.dp)
                    .background(
                        Brush.radialGradient(listOf(BtccYellow.copy(alpha = 0.2f), Color.Transparent)),
                        shape = RoundedCornerShape(if (LocalConfiguration.current.screenWidthDp >= 600) 70.dp else 48.dp),
                    )
                    .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(if (LocalConfiguration.current.screenWidthDp >= 600) 70.dp else 48.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = null,
                    tint     = BtccYellow,
                    modifier = Modifier.size(if (LocalConfiguration.current.screenWidthDp >= 600) 64.dp else 44.dp),
                )
            }

            Spacer(Modifier.height(28.dp))

            Text(
                "NO RESULTS YET",
                fontWeight    = FontWeight.Black,
                fontSize      = if (LocalConfiguration.current.screenWidthDp >= 600) 26.sp else 20.sp,
                color         = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 0.5.sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                if (year != 2026) "Results will appear after each race weekend" else "The season kicks off at",
                style     = MaterialTheme.typography.bodyMedium,
                fontSize  = if (LocalConfiguration.current.screenWidthDp >= 600) 18.sp else 14.sp,
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
    state: LazyListState = rememberLazyListState(),
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        state               = state,
        modifier            = modifier,
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
    state: LazyListState = rememberLazyListState(),
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        state               = state,
        modifier            = modifier,
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
            fontSize      = if (LocalConfiguration.current.screenWidthDp >= 600) 14.sp else 11.sp,
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

    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = if (isTablet) 80.dp else 64.dp)
            .background(BtccCard, RoundedCornerShape(if (isTablet) 14.dp else 10.dp))
            .then(
                if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(if (isTablet) 14.dp else 10.dp))
                else Modifier
            )
            .padding(horizontal = if (isTablet) 20.dp else 14.dp, vertical = if (isTablet) 18.dp else 12.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "${driver.position}",
            style      = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = positionColor,
            modifier   = Modifier.width(if (isTablet) 40.dp else 24.dp),
            textAlign  = TextAlign.Center,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                driver.name,
                fontWeight = FontWeight.Bold,
                style      = if (isTablet) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.bodyLarge,
                color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            if (driver.team.isNotEmpty()) {
                Text(
                    driver.displayTeam,
                    style    = MaterialTheme.typography.bodySmall,
                    fontSize = if (isTablet) 15.sp else 12.sp,
                    color    = BtccTextSecondary,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.Center) {
            Text(
                "${driver.points} pts",
                style      = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
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
            modifier = Modifier.size(if (isTablet) 40.dp else 32.dp),
        ) {
            Icon(
                imageVector = if (isFavourite) Icons.Filled.Star else Icons.Outlined.Star,
                contentDescription = if (isFavourite) "Remove favourite" else "Set as favourite",
                tint     = if (isFavourite) BtccYellow else BtccTextSecondary,
                modifier = Modifier.size(if (isTablet) 24.dp else 18.dp),
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
            modifier = Modifier.size(if (LocalConfiguration.current.screenWidthDp >= 600) 14.dp else 11.dp),
        )
        Text(
            "$count",
            style      = MaterialTheme.typography.labelSmall,
            fontSize   = if (LocalConfiguration.current.screenWidthDp >= 600) 13.sp else 11.sp,
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

    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = if (isTablet) 80.dp else 64.dp)
            .background(BtccCard, RoundedCornerShape(if (isTablet) 14.dp else 10.dp))
            .padding(horizontal = if (isTablet) 20.dp else 14.dp, vertical = if (isTablet) 18.dp else 12.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text(
            "${team.position}",
            style      = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = positionColor,
            modifier   = Modifier.width(if (isTablet) 40.dp else 24.dp),
            textAlign  = TextAlign.Center,
        )
        Text(
            team.name,
            fontWeight = FontWeight.Bold,
            style      = if (isTablet) MaterialTheme.typography.headlineSmall else MaterialTheme.typography.bodyLarge,
            color      = MaterialTheme.colorScheme.onBackground,
            modifier   = Modifier.weight(1f),
        )
        Text(
            "${team.points} pts",
            style      = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.ExtraBold,
            color      = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun RoundBanner(label: String) {
    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(if (isTablet) 12.dp else 10.dp))
            .border(1.dp, Color(0xFF4CAF50).copy(alpha = 0.4f), RoundedCornerShape(if (isTablet) 12.dp else 10.dp))
            .padding(horizontal = if (isTablet) 20.dp else 14.dp, vertical = if (isTablet) 14.dp else 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            fontWeight    = FontWeight.ExtraBold,
            fontSize      = if (isTablet) 14.sp else 11.sp,
            letterSpacing = 1.5.sp,
            color         = Color(0xFF4CAF50),
        )
    }
    Spacer(Modifier.height(if (isTablet) 8.dp else 4.dp))
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
    state: LazyListState = rememberLazyListState(),
    modifier: Modifier = Modifier,
) {
    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    when {
        loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = BtccYellow)
        }
        stats.isEmpty() -> ResultsNotStarted(year = year, seasonStartDate = seasonStartDate)
        else -> {
            val showPoles = stats.any { it.poles > 0 }
            val showFastestLaps = stats.any { it.fastestLaps > 0 }
            Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
            LazyColumn(
                state               = state,
                modifier            = Modifier.widthIn(max = if (isTablet) 900.dp else Dp.Unspecified).fillMaxWidth(),
                contentPadding      = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(if (isTablet) 10.dp else 6.dp),
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
                            fontSize      = if (isTablet) 14.sp else 11.sp,
                            color         = BtccTextSecondary,
                            fontWeight    = FontWeight.ExtraBold,
                            letterSpacing = 1.sp,
                            modifier      = Modifier.weight(1f),
                        )
                        val cols = buildList {
                            add("W"); add("POD")
                            if (showPoles) add("POL")
                            if (showFastestLaps) add("FL")
                            add("DNF")
                        }
                        cols.forEach { col ->
                            val cellWidth = if (isTablet) 48.dp else 36.dp
                            Text(
                                col,
                                style         = MaterialTheme.typography.labelSmall,
                                fontSize      = if (isTablet) 13.sp else 11.sp,
                                color         = BtccTextSecondary,
                                fontWeight    = FontWeight.ExtraBold,
                                letterSpacing = 0.5.sp,
                                textAlign     = TextAlign.Center,
                                modifier      = Modifier.width(cellWidth),
                            )
                        }
                    }
                }
                itemsIndexed(stats) { index, stat ->
                    DriverStatsRow(rank = index + 1, stat = stat, showPoles = showPoles, showFastestLaps = showFastestLaps)
                }
            }
            } // end Box
        }
    }
}

@Composable
private fun DriverStatsRow(rank: Int, stat: DriverSeasonStats, showPoles: Boolean = true, showFastestLaps: Boolean = false) {
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == stat.driver

    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(if (isTablet) 14.dp else 10.dp))
            .then(if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(if (isTablet) 14.dp else 10.dp)) else Modifier)
            .padding(horizontal = if (isTablet) 20.dp else 14.dp, vertical = if (isTablet) 18.dp else 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "$rank",
            style      = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Black,
            fontSize   = if (isTablet) 15.sp else 12.sp,
            color      = BtccTextSecondary,
            modifier   = Modifier.width(if (isTablet) 36.dp else 24.dp),
            textAlign  = TextAlign.Center,
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stat.driver,
                fontWeight = FontWeight.Bold,
                style      = if (isTablet) MaterialTheme.typography.titleLarge else MaterialTheme.typography.bodyMedium,
                color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            Text(
                stat.team,
                style = MaterialTheme.typography.labelSmall,
                fontSize = if (isTablet) 13.sp else 11.sp,
                color = BtccTextSecondary,
            )
        }
        val cellWidth = if (isTablet) 48.dp else 36.dp
        StatCell(value = stat.wins,    highlight = stat.wins > 0,    highlightColor = BtccYellow, width = cellWidth)
        StatCell(value = stat.podiums, highlight = false, width = cellWidth)
        if (showPoles) {
            StatCell(value = stat.poles, highlight = stat.poles > 0, highlightColor = Color(0xFFC0C0C0), width = cellWidth)
        }
        if (showFastestLaps) {
            StatCell(value = stat.fastestLaps, highlight = stat.fastestLaps > 0, highlightColor = Color(0xFF9B59B6), width = cellWidth)
        }
        StatCell(value = stat.dnfs,    highlight = stat.dnfs > 0,    highlightColor = Color(0xFFE3000B), width = cellWidth)
    }
}

@Composable
private fun StatCell(value: Int, highlight: Boolean, highlightColor: Color = BtccYellow, width: Dp = 36.dp) {
    val isTablet = LocalConfiguration.current.screenWidthDp >= 600
    Text(
        if (value > 0) "$value" else "—",
        style      = MaterialTheme.typography.bodySmall,
        fontSize   = if (isTablet) 15.sp else 12.sp,
        fontWeight = if (highlight) FontWeight.ExtraBold else FontWeight.Normal,
        color      = if (highlight) highlightColor else BtccTextSecondary,
        textAlign  = TextAlign.Center,
        modifier   = Modifier.width(width),
    )
}

