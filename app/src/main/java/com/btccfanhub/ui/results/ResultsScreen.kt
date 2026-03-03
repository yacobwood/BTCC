package com.btccfanhub.ui.results

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.model.DriverStanding
import com.btccfanhub.data.repository.StandingsRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccTextSecondary
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ResultsScreen() {
    var drivers      by remember { mutableStateOf<List<DriverStanding>?>(null) }
    var liveRound    by remember { mutableIntStateOf(0) }
    var isRefreshing by remember { mutableStateOf(false) }
    var loadFailed   by remember { mutableStateOf(false) }

    val pagerState = rememberPagerState(pageCount = { 2 })
    val scope      = rememberCoroutineScope()

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
                    page == 0 && drivers != null ->
                        DriverStandingsList(drivers!!, liveRound)
                    page == 1 ->
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text(
                                "Team standings coming\nonce the season starts.",
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
private fun DriverStandingsList(standings: List<DriverStanding>, showLiveRound: Int) {
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (showLiveRound > 0) {
            item { RoundBanner("ROUND $showLiveRound STANDINGS") }
        }
        itemsIndexed(standings) { _, driver ->
            DriverRow(driver)
        }
    }
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
