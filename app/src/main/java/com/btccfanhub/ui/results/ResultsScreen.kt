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
import com.btccfanhub.data.model.TeamStanding
import com.btccfanhub.data.repository.StandingsRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccTextSecondary
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import kotlinx.coroutines.launch

private val seasonStartDate = LocalDate.of(2026, 4, 18)

// ── 2025 Final Standings ──────────────────────────────────────────────────────
private val driver2025: List<DriverStanding> = listOf(
    DriverStanding(1,  "Tom Ingram",          "Team VERTU",             "Toyota Corolla",     462, wins = 7),
    DriverStanding(2,  "Ashley Sutton",        "NAPA Racing UK",         "Ford Focus",         428, wins = 5),
    DriverStanding(3,  "Dan Cammish",          "NAPA Racing UK",         "Ford Focus",         307, wins = 3),
    DriverStanding(4,  "Jake Hill",            "West Surrey Racing",     "BMW 330i M Sport",   295, wins = 3),
    DriverStanding(5,  "Daniel Rowbottom",     "Restart Racing",         "Honda Civic Type R", 277, wins = 3),
    DriverStanding(6,  "Adam Morgan",          "Ciceley Motorsport",     "Mercedes-AMG A35",   241),
    DriverStanding(7,  "Tom Chilton",          "EXCELR8 Motorsport",     "Hyundai i30 N",      230, wins = 2),
    DriverStanding(8,  "Charles Rainford",     "West Surrey Racing",     "BMW 330i M Sport",   179, wins = 1),
    DriverStanding(9,  "Gordon Shedden",       "Laser Tools Racing",     "Toyota Corolla",     177, wins = 1),
    DriverStanding(10, "Senna Proctor",        "Team VERTU",             "Toyota Corolla",     167),
    DriverStanding(11, "Aiden Moffat",         "EXCELR8 Motorsport",     "Hyundai i30 N",      166),
    DriverStanding(12, "Josh Cook",            "One Motorsport",         "Honda Civic Type R", 160, wins = 1),
    DriverStanding(13, "Daryl DeLeon",         "West Surrey Racing",     "BMW 330i M Sport",   149, wins = 1),
    DriverStanding(14, "Chris Smiley",         "Ciceley Motorsport",     "Mercedes-AMG A35",   140),
    DriverStanding(15, "Daniel Lloyd",         "Restart Racing",         "Honda Civic Type R", 128, wins = 1),
    DriverStanding(16, "Sam Osborne",          "NAPA Racing UK",         "Ford Focus",         108, wins = 1),
    DriverStanding(17, "Árón Taylor-Smith",    "Laser Tools Racing",     "Toyota Corolla",     103),
    DriverStanding(18, "Mikey Doble",          "EXCELR8 Motorsport",     "Hyundai i30 N",      100, wins = 1),
    DriverStanding(19, "James Dorlin",         "Toyota Gazoo Racing UK", "Toyota Corolla",      47),
    DriverStanding(20, "Dexter Patterson",     "Power Maxed Racing",     "Audi S3 Saloon",      42),
    DriverStanding(21, "Ronan Pearson",        "Toyota Gazoo Racing UK", "Toyota Corolla",      29),
    DriverStanding(22, "Max Buxton",           "West Surrey Racing",     "BMW 330i M Sport",     8),
    DriverStanding(23, "Max Hall",             "One Motorsport",         "Honda Civic Type R",   7),
    DriverStanding(24, "Stephen Jelley",       "West Surrey Racing",     "BMW 330i M Sport",     7),
    DriverStanding(25, "Michael Crees",        "Toyota Gazoo Racing UK", "Toyota Corolla",       5),
    DriverStanding(26, "Finn Leslie",          "NAPA Racing UK",         "Ford Focus",           4),
    DriverStanding(27, "Nick Halstead",        "Power Maxed Racing",     "Audi S3 Saloon",       4),
    DriverStanding(28, "Nic Hamilton",         "Un-limited Motorsport",  "BMW 330i M Sport",     0),
    DriverStanding(29, "Ryan Bensley",         "Toyota Gazoo Racing UK", "Toyota Corolla",       0),
)

private val team2025: List<TeamStanding> = listOf(
    TeamStanding(1,  "NAPA Racing UK",         775),
    TeamStanding(2,  "Team VERTU",             773),
    TeamStanding(3,  "West Surrey Racing",     462),
    TeamStanding(4,  "Restart Racing",         386),
    TeamStanding(5,  "Laser Tools Racing",     319),
    TeamStanding(6,  "Toyota Gazoo Racing UK", 266),
    TeamStanding(7,  "WSR",                    215),
    TeamStanding(8,  "Power Maxed Racing",     190),
    TeamStanding(9,  "One Motorsport",         156),
    TeamStanding(10, "Un-limited Motorsport",  144),
    TeamStanding(11, "Ciceley Motorsport",      32),
)

// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ResultsScreen() {
    val today = LocalDate.now()
    val seasonStarted = today >= seasonStartDate

    var selectedYear by remember { mutableIntStateOf(if (seasonStarted) 2026 else 2025) }
    val pagerState   = rememberPagerState(pageCount = { 2 })

    // Live 2026 data from Gist
    var liveDrivers  by remember { mutableStateOf<List<DriverStanding>?>(null) }
    var liveTeams    by remember { mutableStateOf<List<TeamStanding>?>(null) }
    var liveRound    by remember { mutableIntStateOf(0) }
    var isRefreshing by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()

    suspend fun refresh(invalidate: Boolean = false) {
        isRefreshing = true
        if (invalidate) StandingsRepository.invalidateCache()
        val live = StandingsRepository.getStandings()
        if (live != null && live.round > 0) {
            liveDrivers = live.drivers
            liveTeams   = live.teams
            liveRound   = live.round
        }
        isRefreshing = false
    }

    LaunchedEffect(Unit) { refresh() }

    val drivers       = if (selectedYear == 2025) driver2025 else (liveDrivers ?: emptyList())
    val teams         = if (selectedYear == 2025) team2025   else (liveTeams   ?: emptyList())
    val showPast      = selectedYear == 2025
    val showLiveRound = if (selectedYear == 2026) liveRound else 0

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            title = {
                Text(
                    "STANDINGS",
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    letterSpacing = 1.sp,
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        // Season selector
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
                            fontWeight = FontWeight.ExtraBold,
                            fontSize   = 12.sp,
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
            onRefresh    = { if (selectedYear == 2026) scope.launch { refresh(invalidate = true) } },
            modifier     = Modifier.fillMaxSize(),
        ) {
            HorizontalPager(
                state    = pagerState,
                modifier = Modifier.fillMaxSize(),
            ) { page ->
                when {
                    page == 0 && drivers.isNotEmpty() ->
                        DriverStandingsList(drivers, showPastBanner = showPast, showLiveRound = showLiveRound)
                    page == 1 && teams.isNotEmpty() ->
                        TeamStandingsList(teams, showPastBanner = showPast, showLiveRound = showLiveRound)
                    else -> SeasonNotStarted(today = today)
                }
            }
        }
    }
}

@Composable
private fun SeasonNotStarted(today: LocalDate) {
    val daysUntil = ChronoUnit.DAYS.between(today, seasonStartDate).coerceAtLeast(0)

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
private fun DriverStandingsList(standings: List<DriverStanding>, showPastBanner: Boolean, showLiveRound: Int) {
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
private fun DriverRow(driver: DriverStanding) {
    val positionColor = when (driver.position) {
        1    -> Color(0xFFFFD700) // gold
        2    -> Color(0xFFC0C0C0) // silver
        3    -> Color(0xFFCD7F32) // bronze
        else -> BtccOutline
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment    = Alignment.CenterVertically,
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
            Text(driver.team, style = MaterialTheme.typography.bodySmall, color = BtccTextSecondary)
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
private fun SeasonBanner() {
    BannerBox("2025 FINAL STANDINGS", BtccYellow)
}

@Composable
private fun RoundBanner(label: String) {
    BannerBox(label, Color(0xFF4CAF50))
}

@Composable
private fun BannerBox(text: String, tint: Color) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .border(1.dp, tint.copy(alpha = 0.4f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text,
            fontWeight    = FontWeight.ExtraBold,
            fontSize      = 11.sp,
            letterSpacing = 1.5.sp,
            color         = tint,
        )
    }
    Spacer(Modifier.height(4.dp))
}

@Composable
private fun TeamStandingsList(standings: List<TeamStanding>, showPastBanner: Boolean, showLiveRound: Int) {
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
        itemsIndexed(standings) { _, team ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BtccCard, RoundedCornerShape(10.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Text(
                    "${team.position}",
                    style      = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Black,
                    color      = BtccOutline,
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
    }
}
