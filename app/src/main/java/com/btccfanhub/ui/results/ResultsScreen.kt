package com.btccfanhub.ui.results

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.clickable
import com.btccfanhub.data.Standings2025
import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.model.RoundResult
import com.btccfanhub.data.model.TeamStanding
import com.btccfanhub.data.repository.CalendarRepository
import com.btccfanhub.data.repository.RaceResultsRepository
import com.btccfanhub.data.repository.StandingsRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccTextSecondary
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ResultsScreen(onRoundClick: (year: Int, round: Int) -> Unit = { _, _ -> }) {
    // Live 2026 data fetched from the network
    var liveDrivers  by remember { mutableStateOf<List<DriverStanding>?>(null) }
    var liveTeams    by remember { mutableStateOf<List<TeamStanding>?>(null) }
    var liveRound    by remember { mutableIntStateOf(0) }
    var isRefreshing by remember { mutableStateOf(false) }
    var loadFailed   by remember { mutableStateOf(false) }

    var raceResults     by remember { mutableStateOf<List<RoundResult>>(emptyList()) }
    var raceResults2025 by remember { mutableStateOf<List<RoundResult>>(emptyList()) }
    var resultsLoading  by remember { mutableStateOf(false) }

    // Season start date from remote config (fallback: 2026-04-18)
    var seasonStartDate by remember { mutableStateOf(LocalDate.of(2026, 4, 18)) }

    val today         = LocalDate.now()
    val seasonStarted = today >= seasonStartDate
    var selectedYear  by remember(seasonStartDate) { mutableIntStateOf(if (today >= seasonStartDate) 2026 else 2025) }
    val pagerState    = rememberPagerState(pageCount = { 3 })
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
        }
        isRefreshing = false
    }

    suspend fun refreshResults(invalidate: Boolean = false) {
        resultsLoading = true
        if (invalidate) RaceResultsRepository.invalidateCache()
        raceResults = RaceResultsRepository.getResults()
        resultsLoading = false
    }

    // Fetch season start date + live data on first composition
    LaunchedEffect(Unit) {
        seasonStartDate = CalendarRepository.getCalendarData().seasonStartDate
        if (today >= seasonStartDate) refresh()
        refreshResults()
        raceResults2025 = RaceResultsRepository.getResults2025()
    }

    // Resolve what to display for each year
    val drivers2025 = Standings2025.drivers
    val teams2025   = Standings2025.teams.ifEmpty { null }

    val show2026Drivers = selectedYear == 2026 && seasonStarted && liveDrivers != null
    val show2026Teams   = selectedYear == 2026 && seasonStarted && liveTeams != null

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
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

        // Year selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BtccSurface)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(2025, 2026).forEach { year ->
                FilterChip(
                    selected = selectedYear == year,
                    onClick  = {
                        selectedYear = year
                        if (year == 2026 && seasonStarted && liveDrivers == null) {
                            scope.launch { refresh() }
                        }
                    },
                    label = {
                        Text(
                            "$year",
                            fontWeight    = FontWeight.ExtraBold,
                            fontSize      = 12.sp,
                            letterSpacing = 1.sp,
                        )
                    },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = BtccYellow,
                        selectedLabelColor     = BtccNavy,
                        containerColor         = BtccCard,
                        labelColor             = BtccTextSecondary,
                    ),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled             = true,
                        selected            = selectedYear == year,
                        borderColor         = BtccOutline,
                        selectedBorderColor = BtccYellow,
                    ),
                )
            }
        }

        TabRow(
            selectedTabIndex = pagerState.currentPage,
            containerColor   = BtccSurface,
            contentColor     = BtccYellow,
        ) {
            listOf("DRIVERS", "TEAMS", "RESULTS").forEachIndexed { index, label ->
                Tab(
                    selected = pagerState.currentPage == index,
                    onClick  = { scope.launch { pagerState.animateScrollToPage(index) } },
                    text = {
                        Text(
                            label,
                            fontWeight    = FontWeight.ExtraBold,
                            fontSize      = 12.sp,
                            letterSpacing = 1.sp,
                            color = if (pagerState.currentPage == index) BtccYellow else BtccTextSecondary,
                        )
                    },
                )
            }
        }

        val isLiveLoading = selectedYear == 2026 && isRefreshing && liveDrivers == null
        val isLiveFailed  = selectedYear == 2026 && loadFailed && liveDrivers == null

        PullToRefreshBox(
            isRefreshing = isRefreshing || resultsLoading,
            onRefresh    = {
                scope.launch {
                    if (pagerState.currentPage == 2) {
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

                    // --- 2025 (hardcoded) ---
                    page == 0 && selectedYear == 2025 ->
                        DriverStandingsList(drivers2025, showLiveRound = 0, showPastBanner = true)
                    page == 1 && selectedYear == 2025 && teams2025 != null ->
                        TeamStandingsList(teams2025, showPastBanner = true)
                    page == 1 && selectedYear == 2025 ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "Team standings not available.",
                                color     = BtccTextSecondary,
                                textAlign = TextAlign.Center,
                            )
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
                            results         = if (selectedYear == 2025) raceResults2025 else raceResults,
                            loading         = resultsLoading,
                            seasonStartDate = seasonStartDate,
                            onRoundClick    = { round -> onRoundClick(selectedYear, round) },
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
        results.isEmpty() -> ResultsNotStarted(year, seasonStartDate)
        else -> LazyColumn(
            contentPadding      = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            itemsIndexed(results) { _, round ->
                RoundResultCard(round = round, onClick = { onRoundClick(round.round) })
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
        Box(
            modifier = Modifier
                .background(BtccYellow.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                .border(1.dp, BtccYellow.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                .padding(horizontal = 10.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "R${round.round}",
                    fontWeight    = FontWeight.Black,
                    fontSize      = 14.sp,
                    color         = BtccYellow,
                    letterSpacing = 0.5.sp,
                )
            }
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(round.venue, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
            Text(round.date,  style = MaterialTheme.typography.bodySmall, color = BtccTextSecondary)
        }

    }
}

@Composable
private fun SeasonNotStarted(seasonStartDate: LocalDate) {
    val daysUntil = ChronoUnit.DAYS.between(LocalDate.now(), seasonStartDate).coerceAtLeast(0)

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
                        "18 April 2026",
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
                if (year == 2025) "Results will appear after each race weekend" else "The season kicks off at",
                style     = MaterialTheme.typography.bodyMedium,
                color     = BtccTextSecondary,
                textAlign = TextAlign.Center,
            )

            if (year == 2026) {
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
                            "18 April 2026",
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
) {
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            when {
                showLiveRound > 0 -> RoundBanner("ROUND $showLiveRound STANDINGS")
                showPastBanner    -> SeasonBanner()
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
) {
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            if (showPastBanner) SeasonBanner()
        }
        itemsIndexed(standings) { _, team ->
            TeamRow(team)
        }
    }
}

@Composable
private fun SeasonBanner() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .border(1.dp, BtccYellow.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "2025 FINAL STANDINGS",
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
            )
            if (driver.team.isNotEmpty()) {
                Text(
                    driver.team,
                    style    = MaterialTheme.typography.bodySmall,
                    color    = BtccTextSecondary,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                "${driver.points} pts",
                style      = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                if (driver.wins > 0) "${driver.wins}W" else "0W",
                style         = MaterialTheme.typography.labelSmall,
                fontWeight    = FontWeight.ExtraBold,
                color         = if (driver.wins > 0) BtccYellow else Color.Transparent,
                letterSpacing = 0.5.sp,
            )
        }
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
