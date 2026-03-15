package com.btccfanhub.ui.results

import android.content.Intent
import android.net.Uri
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
import com.btccfanhub.data.FavouriteDriverStore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.repository.RaceResultsRepository
import com.btccfanhub.data.repository.SeasonRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun RoundResultsScreen(year: Int = 2026, round: Int, onBack: () -> Unit) {
    var roundResult by remember { mutableStateOf<com.btccfanhub.data.model.RoundResult?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(year, round) {
        loading = true
        roundResult = if (year in 2014..2025) {
            SeasonRepository.getSeason(context, year)?.rounds?.find { it.round == round }
        } else {
            val results = when (year) {
                2014 -> RaceResultsRepository.getResults2014()
                2015 -> RaceResultsRepository.getResults2015()
                2016 -> RaceResultsRepository.getResults2016()
                2017 -> RaceResultsRepository.getResults2017()
                2018 -> RaceResultsRepository.getResults2018()
                2019 -> RaceResultsRepository.getResults2019()
                2020 -> RaceResultsRepository.getResults2020()
                2021 -> RaceResultsRepository.getResults2021()
                2022 -> RaceResultsRepository.getResults2022()
                2023 -> RaceResultsRepository.getResults2023()
                2024 -> RaceResultsRepository.getResults2024()
                2025 -> RaceResultsRepository.getResults2025()
                else -> RaceResultsRepository.getResults()
            }
            results.find { it.round == round }
        }
        loading = false
    }

    val races = roundResult?.races ?: emptyList()
    val pageCount = races.size.coerceAtLeast(1)
    val pagerState = rememberPagerState(pageCount = { pageCount })

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
                        fontSize      = 17.sp,
                        letterSpacing = 0.5.sp,
                    )
                    val startRound = (round - 1) * 3 + 1
                    val endRound   = startRound + 2
                    Text(
                        "ROUNDS $startRound–$endRound · ${roundResult?.date ?: ""}",
                        style         = MaterialTheme.typography.labelSmall,
                        color         = BtccYellow,
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
                            Tab(
                                selected = pagerState.currentPage == index,
                                onClick  = { scope.launch { pagerState.animateScrollToPage(index) } },
                                text = {
                                    Text(
                                        race.label.uppercase(),
                                        fontWeight    = FontWeight.ExtraBold,
                                        fontSize      = 12.sp,
                                        letterSpacing = 1.sp,
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
                        RaceResultsList(
                            race      = races[page],
                            roundDate = roundResult?.date ?: "",
                        )
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
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    Row(
        modifier = modifier
            .background(Color(0xFF1A0000), RoundedCornerShape(10.dp))
            .border(1.dp, Color(0xFFFF0000).copy(alpha = 0.5f), RoundedCornerShape(10.dp))
            .clickable { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .padding(horizontal = 16.dp, vertical = 12.dp),
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
            fontSize      = 13.sp,
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
private fun RaceResultsList(race: RaceEntry, roundDate: String) {
    if (race.results.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No results available.", color = BtccTextSecondary)
        }
        return
    }
    val displayDate = race.date ?: roundDate
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (displayDate.isNotEmpty()) {
            item {
                Text(
                    displayDate.uppercase(),
                    style         = MaterialTheme.typography.labelSmall,
                    color         = BtccTextSecondary,
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
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                )
            }
        }
        items(race.results) { result ->
            DriverResultRow(result)
        }
    }
}

@Composable
private fun DriverResultRow(result: DriverResult) {
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == result.driver

    val posColor = when (result.position) {
        1    -> Color(0xFFFFD700)
        2    -> Color(0xFFC0C0C0)
        3    -> Color(0xFFCD7F32)
        else -> BtccOutline
    }

    val isLeader = result.position == 1
    val displayTime = if (result.displayTime.isNotEmpty()) {
        result.displayTime
    } else {
        when {
            isLeader -> result.time.takeIf { it.isNotEmpty() } ?: result.bestLap.takeIf { it.isNotEmpty() } ?: "—"
            else     -> result.gap?.let { if (it.startsWith("+")) it else "+$it" } ?: "—"
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .then(if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(10.dp)) else Modifier)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            if (result.position > 0) "${result.position}" else "DNF",
            style      = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = posColor,
            modifier   = Modifier.width(32.dp),
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
                        modifier = Modifier.size(12.dp),
                    )
                }
                Text(
                    result.driver,
                    fontWeight = FontWeight.Bold,
                    style      = MaterialTheme.typography.bodyMedium,
                    color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
                )
            }
            Text(
                result.team,
                style = MaterialTheme.typography.bodySmall,
                color = BtccTextSecondary,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                displayTime,
                fontWeight = FontWeight.ExtraBold,
                fontSize   = 13.sp,
                color      = if (isLeader) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            Text(
                if (result.points > 0) "+${result.points} pts" else "0 pts",
                style = MaterialTheme.typography.labelSmall,
                color = BtccTextSecondary,
            )
        }
    }
}
