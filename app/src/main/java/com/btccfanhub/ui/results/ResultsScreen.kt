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
import com.btccfanhub.data.model.DriverStanding
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

private val seasonStartDate = LocalDate.of(2026, 4, 18)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ResultsScreen() {
    var drivers      by remember { mutableStateOf<List<DriverStanding>?>(null) }
    var liveRound    by remember { mutableIntStateOf(0) }
    var isRefreshing by remember { mutableStateOf(false) }
    var loadFailed   by remember { mutableStateOf(false) }

    val today         = LocalDate.now()
    val seasonStarted = today >= seasonStartDate
    var selectedYear  by remember { mutableIntStateOf(if (seasonStarted) 2026 else 2025) }
    val pagerState    = rememberPagerState(pageCount = { 2 })
    val scope         = rememberCoroutineScope()

    suspend fun refresh(invalidate: Boolean = false) {
        isRefreshing = true
        if (invalidate) StandingsRepository.invalidateCache()
        val live = StandingsRepository.getStandings()
        if (live != null && live.drivers.isNotEmpty()) {
            drivers    = live.drivers
            liveRound  = live.round
            loadFailed = false
        } else if (drivers == null) {
            loadFailed = true
        }
        isRefreshing = false
    }

    LaunchedEffect(Unit) { refresh() }

    // What to show per year/tab combination
    val show2025Drivers = selectedYear == 2025 && drivers != null
    val show2026Drivers = selectedYear == 2026 && seasonStarted && drivers != null

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
                    onClick  = { selectedYear = year },
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
            listOf("DRIVERS", "TEAMS").forEachIndexed { index, label ->
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

        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh    = { scope.launch { refresh(invalidate = true) } },
            modifier     = Modifier.fillMaxSize(),
        ) {
            HorizontalPager(
                state    = pagerState,
                modifier = Modifier.fillMaxSize(),
            ) { page ->
                when {
                    isRefreshing && drivers == null ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = BtccYellow)
                        }
                    loadFailed ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "Could not load standings.\nPull down to retry.",
                                color     = BtccTextSecondary,
                                textAlign = TextAlign.Center,
                            )
                        }
                    page == 0 && show2025Drivers ->
                        DriverStandingsList(drivers!!, showLiveRound = 0, showPastBanner = true)
                    page == 0 && show2026Drivers ->
                        DriverStandingsList(drivers!!, showLiveRound = liveRound, showPastBanner = false)
                    page == 0 && selectedYear == 2026 && !seasonStarted ->
                        SeasonNotStarted()
                    page == 1 && selectedYear == 2026 ->
                        SeasonNotStarted()
                    page == 1 ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "Team standings not available.",
                                color     = BtccTextSecondary,
                                textAlign = TextAlign.Center,
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

@Composable
private fun SeasonNotStarted() {
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
            Text(driver.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyLarge)
            if (driver.team.isNotEmpty()) {
                Text(driver.team, style = MaterialTheme.typography.bodySmall, color = BtccTextSecondary)
            }
        }
        Text(
            "${driver.points} pts",
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
