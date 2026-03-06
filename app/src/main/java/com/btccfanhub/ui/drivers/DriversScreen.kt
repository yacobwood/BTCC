package com.btccfanhub.ui.drivers

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.*
import com.btccfanhub.data.model.Driver
import com.btccfanhub.data.model.GridData
import com.btccfanhub.data.model.SeasonStat
import com.btccfanhub.data.model.Team
import com.btccfanhub.data.repository.DriversRepository
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import com.btccfanhub.ui.theme.*
import androidx.compose.ui.platform.LocalContext

// Driver, Team, SeasonStat, GridData defined in data/model/GridData.kt

// ─────────────────────────────────────────────────────────────────────────────
// Top-level screen — fetches grid data from GitHub JSON
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriversScreen() {
    val context = LocalContext.current
    var gridData by remember { mutableStateOf<GridData?>(null) }
    var loading  by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        gridData = DriversRepository.fetchGrid()
        loading  = false
    }

    val drivers = gridData?.drivers ?: emptyList()
    val teams   = gridData?.teams   ?: emptyList()

    LaunchedEffect(drivers) {
        if (drivers.isEmpty()) return@LaunchedEffect
        drivers.forEach { driver ->
            if (driver.imageUrl.isNotEmpty()) {
                context.imageLoader.enqueue(
                    ImageRequest.Builder(context).data(driver.imageUrl).size(116).build()
                )
                context.imageLoader.enqueue(
                    ImageRequest.Builder(context).data(driver.imageUrl).size(200).build()
                )
            }
        }
    }

    var selectedDriver by remember { mutableStateOf<Driver?>(null) }
    var selectedTeam   by remember { mutableStateOf<Team?>(null) }

    when {
        selectedDriver != null -> {
            BackHandler { selectedDriver = null }
            DriverDetailScreen(driver = selectedDriver!!, onBack = { selectedDriver = null })
        }
        selectedTeam != null -> {
            BackHandler { selectedTeam = null }
            TeamDetailScreen(team = selectedTeam!!, onBack = { selectedTeam = null })
        }
        loading -> {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(BtccBackground),
            ) {
                TopAppBar(
                    title  = { Text("2026 GRID", fontWeight = FontWeight.Black, fontSize = 18.sp, letterSpacing = 1.sp) },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
                )
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BtccYellow)
                }
            }
        }
        else -> {
            GridTabs(
                drivers       = drivers,
                teams         = teams,
                onDriverClick = { selectedDriver = it },
                onTeamClick   = { selectedTeam = it },
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid tabs (Drivers / Teams)
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
private fun GridTabs(
    drivers: List<Driver>,
    teams: List<Team>,
    onDriverClick: (Driver) -> Unit,
    onTeamClick: (Team) -> Unit,
) {
    val pagerState = rememberPagerState(pageCount = { 2 })
    val scope      = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        Column {
            TopAppBar(
                title = {
                    Text(
                        "2026 GRID",
                        fontWeight    = FontWeight.Black,
                        fontSize      = 18.sp,
                        letterSpacing = 1.sp,
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
            )
            TabRow(
                selectedTabIndex = pagerState.currentPage,
                containerColor   = BtccBackground,
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
        }
        HorizontalPager(
            state    = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            when (page) {
                0 -> DriversList(PaddingValues(0.dp), drivers, onDriverClick)
                1 -> TeamsList(PaddingValues(0.dp), teams, onTeamClick)
                else -> Unit
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drivers list tab
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun DriversList(padding: PaddingValues, drivers: List<Driver>, onDriverClick: (Driver) -> Unit) {
    LazyColumn(
        modifier        = Modifier.fillMaxSize().padding(padding),
        contentPadding  = PaddingValues(start = 16.dp, end = 16.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item {
            Text(
                "${drivers.size} CONFIRMED",
                style      = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.ExtraBold,
                color      = BtccTextSecondary,
                letterSpacing = 2.sp,
                modifier   = Modifier.padding(bottom = 4.dp, top = 12.dp),
            )
        }
        items(drivers) { DriverCard(it, onClick = { onDriverClick(it) }) }
        item {
            Text(
                "Full entry list published April 2026 · btcc.net",
                style    = MaterialTheme.typography.labelSmall,
                color    = BtccOutline,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Teams list tab
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun TeamsList(padding: PaddingValues, teams: List<Team>, onTeamClick: (Team) -> Unit) {
    LazyColumn(
        modifier        = Modifier.fillMaxSize().padding(padding),
        contentPadding  = PaddingValues(start = 16.dp, end = 16.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                "${teams.size} TEAMS",
                style      = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.ExtraBold,
                color      = BtccTextSecondary,
                letterSpacing = 2.sp,
                modifier   = Modifier.padding(bottom = 4.dp, top = 12.dp),
            )
        }
        items(teams) { TeamCard(it, onClick = { onTeamClick(it) }) }
        item {
            Text(
                "Full entry list published April 2026 · btcc.net",
                style    = MaterialTheme.typography.labelSmall,
                color    = BtccOutline,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver card (list item)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun DriverCard(driver: Driver, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
            .clickable { onClick() }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        DriverAvatarWithNumber(
            imageUrl      = driver.imageUrl,
            name          = driver.name,
            number        = driver.number,
            teamConfirmed = driver.team.isNotEmpty(),
            avatarSize    = 58,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                driver.name,
                style      = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            if (driver.team.isNotEmpty()) {
                Text(
                    driver.team,
                    style = MaterialTheme.typography.bodySmall,
                    color = BtccTextSecondary,
                )
            }
            if (driver.car.isNotEmpty()) {
                Spacer(Modifier.height(6.dp))
                Surface(
                    shape    = RoundedCornerShape(6.dp),
                    color    = Color.Transparent,
                    modifier = Modifier.border(1.dp, BtccOutline, RoundedCornerShape(6.dp)),
                ) {
                    Text(
                        driver.car,
                        modifier   = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        style      = MaterialTheme.typography.labelSmall,
                        color      = BtccTextSecondary,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Team card (list item)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun TeamCard(team: Team, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
            .clickable { onClick() }
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier          = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    team.name,
                    style      = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.ExtraBold,
                    color      = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    if (team.car.isNotEmpty()) team.car else "Car TBC",
                    style    = MaterialTheme.typography.bodySmall,
                    color    = if (team.car.isNotEmpty()) BtccTextSecondary else BtccOutline,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            Surface(shape = RoundedCornerShape(20.dp), color = BtccSurface) {
                Text(
                    "${team.entries} ${if (team.entries == 1) "car" else "cars"}",
                    modifier   = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    style      = MaterialTheme.typography.labelSmall,
                    color      = BtccTextSecondary,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        HorizontalDivider(color = BtccOutline.copy(alpha = 0.5f))

        val tbc = team.entries - team.drivers.size
        team.drivers.forEach { TeamDriverRow(it) }
        repeat(tbc) { TbcDriverRow() }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Driver detail screen
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DriverDetailScreen(driver: Driver, onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            title = {
                Text(
                    driver.name,
                    fontWeight    = FontWeight.Black,
                    fontSize      = 17.sp,
                    letterSpacing = 0.5.sp,
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )
        LazyColumn(
            modifier       = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Header ──────────────────────────────────────────────────────
            item {
                Column(
                    modifier            = Modifier.fillMaxWidth().padding(top = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    DriverAvatarWithNumber(
                        imageUrl      = driver.imageUrl,
                        name          = driver.name,
                        number        = driver.number,
                        teamConfirmed = driver.team.isNotEmpty(),
                        avatarSize    = 100,
                    )
                    Text(
                        driver.name,
                        fontWeight    = FontWeight.Black,
                        fontSize      = 22.sp,
                        letterSpacing = 0.5.sp,
                        color         = MaterialTheme.colorScheme.onBackground,
                    )
                    // Chips row
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        InfoChip(driver.nationality)
                        if (driver.team.isNotEmpty()) InfoChip(driver.team)
                        if (driver.car.isNotEmpty())  InfoChip(driver.car)
                    }
                }
            }

            // ── Bio ─────────────────────────────────────────────────────────
            if (driver.bio.isNotEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(BtccCard, RoundedCornerShape(10.dp))
                            .padding(14.dp),
                    ) {
                        Text(
                            driver.bio,
                            style      = MaterialTheme.typography.bodyMedium,
                            color      = BtccTextSecondary,
                            lineHeight = 22.sp,
                        )
                    }
                }
            }

            // ── Season history ───────────────────────────────────────────────
            if (driver.history.isNotEmpty()) {
                item {
                    Text(
                        "SEASON HISTORY",
                        style         = MaterialTheme.typography.labelSmall,
                        fontWeight    = FontWeight.ExtraBold,
                        color         = BtccTextSecondary,
                        letterSpacing = 2.sp,
                        modifier      = Modifier.padding(top = 4.dp),
                    )
                }
                items(driver.history.sortedByDescending { it.year }) { stat ->
                    SeasonStatRow(stat)
                }
                item {
                    Text(
                        "Source: btcc.net",
                        style    = MaterialTheme.typography.labelSmall,
                        color    = BtccOutline,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Team detail screen
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TeamDetailScreen(team: Team, onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            title = {
                Text(
                    team.name,
                    fontWeight    = FontWeight.Black,
                    fontSize      = 16.sp,
                    letterSpacing = 0.5.sp,
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )
        LazyColumn(
            modifier       = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // ── Header ──────────────────────────────────────────────────────
            item {
                Column(
                    modifier            = Modifier.fillMaxWidth().padding(top = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    // Big team name
                    Text(
                        team.name,
                        fontWeight    = FontWeight.Black,
                        fontSize      = 24.sp,
                        letterSpacing = 0.5.sp,
                        color         = MaterialTheme.colorScheme.onBackground,
                    )
                    // Car + entries chips
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (team.car.isNotEmpty()) InfoChip(team.car)
                        InfoChip("${team.entries} cars")
                    }
                }
            }

            // ── Bio ─────────────────────────────────────────────────────────
            if (team.bio.isNotEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(BtccCard, RoundedCornerShape(10.dp))
                            .padding(14.dp),
                    ) {
                        Text(
                            team.bio,
                            style      = MaterialTheme.typography.bodyMedium,
                            color      = BtccTextSecondary,
                            lineHeight = 22.sp,
                        )
                    }
                }
            }

            // ── 2025 result ──────────────────────────────────────────────────
            if (team.standing2025 > 0) {
                item {
                    Text(
                        "2025 SEASON",
                        style         = MaterialTheme.typography.labelSmall,
                        fontWeight    = FontWeight.ExtraBold,
                        color         = BtccTextSecondary,
                        letterSpacing = 2.sp,
                        modifier      = Modifier.padding(top = 4.dp),
                    )
                }
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(BtccCard, RoundedCornerShape(10.dp))
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment     = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text(
                                "Teams' Championship",
                                style = MaterialTheme.typography.bodySmall,
                                color = BtccTextSecondary,
                            )
                            Text(
                                "P${team.standing2025}",
                                fontWeight = FontWeight.Black,
                                fontSize   = 28.sp,
                                color      = if (team.standing2025 == 1) BtccYellow else MaterialTheme.colorScheme.onBackground,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "Points",
                                style = MaterialTheme.typography.bodySmall,
                                color = BtccTextSecondary,
                            )
                            Text(
                                "${team.points2025}",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize   = 22.sp,
                                color      = MaterialTheme.colorScheme.onBackground,
                            )
                        }
                        if (team.standing2025 == 1) {
                            Icon(
                                Icons.Default.EmojiEvents,
                                contentDescription = "Champions",
                                tint     = BtccYellow,
                                modifier = Modifier.size(36.dp),
                            )
                        }
                    }
                }
            }

            // ── 2026 drivers ─────────────────────────────────────────────────
            item {
                Text(
                    "2026 DRIVERS",
                    style         = MaterialTheme.typography.labelSmall,
                    fontWeight    = FontWeight.ExtraBold,
                    color         = BtccTextSecondary,
                    letterSpacing = 2.sp,
                    modifier      = Modifier.padding(top = 4.dp),
                )
            }
            item {
                Column(
                    modifier            = Modifier
                        .fillMaxWidth()
                        .background(BtccCard, RoundedCornerShape(10.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    val tbc = team.entries - team.drivers.size
                    team.drivers.forEach { TeamDriverRow(it) }
                    repeat(tbc) { TbcDriverRow() }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Season stat row (used in driver detail)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun SeasonStatRow(stat: SeasonStat) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Year
        Text(
            stat.year.toString(),
            fontWeight = FontWeight.Black,
            fontSize   = 16.sp,
            color      = BtccYellow,
            modifier   = Modifier.width(42.dp),
        )

        // Team + car
        Column(modifier = Modifier.weight(1f)) {
            Text(
                stat.team,
                style      = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            if (stat.car.isNotEmpty()) {
                Text(
                    stat.car,
                    style = MaterialTheme.typography.labelSmall,
                    color = BtccTextSecondary,
                )
            }
        }

        // Stats / champion badge
        if (stat.isChampion) {
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = "Champion",
                    tint     = BtccYellow,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    "CHAMPION",
                    fontWeight    = FontWeight.ExtraBold,
                    fontSize      = 11.sp,
                    letterSpacing = 0.5.sp,
                    color         = BtccYellow,
                )
            }
        } else {
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "P${stat.pos}",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize   = 14.sp,
                    color      = MaterialTheme.colorScheme.onBackground,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "${stat.points} pts",
                        style = MaterialTheme.typography.labelSmall,
                        color = BtccTextSecondary,
                    )
                    if (stat.wins > 0) {
                        Text(
                            "${stat.wins}W",
                            style      = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color      = BtccYellow,
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Info chip
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun InfoChip(label: String) {
    Surface(
        shape    = RoundedCornerShape(20.dp),
        color    = BtccSurface,
    ) {
        Text(
            label,
            modifier   = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style      = MaterialTheme.typography.labelSmall,
            color      = BtccTextSecondary,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-composables
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun TeamDriverRow(driver: Driver) {
    Row(
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        DriverAvatarWithNumber(
            imageUrl      = driver.imageUrl,
            name          = driver.name,
            number        = driver.number,
            teamConfirmed = driver.team.isNotEmpty(),
            avatarSize    = 40,
        )
        Text(
            driver.name,
            style      = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color      = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun TbcDriverRow() {
    Row(
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.size(48.dp)) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(BtccOutline.copy(alpha = 0.3f))
                    .align(Alignment.BottomStart),
                contentAlignment = Alignment.Center,
            ) {
                Text("?", fontWeight = FontWeight.Black, fontSize = 16.sp, color = BtccOutline)
            }
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .height(18.dp)
                    .widthIn(min = 18.dp)
                    .background(BtccOutline, RoundedCornerShape(4.dp))
                    .padding(horizontal = 3.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("?", fontWeight = FontWeight.Black, fontSize = 9.sp, lineHeight = 9.sp, color = Color.White.copy(alpha = 0.3f))
            }
        }
        Text("Driver TBC", style = MaterialTheme.typography.bodyMedium, color = BtccOutline)
    }
}

@Composable
private fun DriverAvatarWithNumber(
    imageUrl: String,
    name: String,
    number: Int,
    teamConfirmed: Boolean,
    avatarSize: Int,
) {
    val badgeH  = (avatarSize * 0.30f).toInt().coerceAtLeast(12).coerceAtMost(22)
    val overhang = 4
    Box(modifier = Modifier.size((avatarSize + overhang).dp)) {
        DriverAvatar(
            imageUrl = imageUrl,
            name     = name,
            size     = avatarSize,
            modifier = Modifier.align(Alignment.Center),
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .height(badgeH.dp)
                .widthIn(min = badgeH.dp)
                .background(
                    if (teamConfirmed) BtccYellow else BtccOutline,
                    RoundedCornerShape(5.dp),
                )
                .padding(horizontal = 3.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "#$number",
                fontWeight    = FontWeight.Black,
                fontSize      = (badgeH * 0.55f).sp,
                lineHeight    = (badgeH * 0.55f).sp,
                color         = if (teamConfirmed) BtccNavy else Color.White.copy(alpha = 0.4f),
                letterSpacing = (-0.3).sp,
            )
        }
    }
}

@Composable
private fun DriverAvatar(imageUrl: String, name: String, size: Int, modifier: Modifier = Modifier) {
    val initials = name.split(" ")
        .filter { it.isNotEmpty() }
        .take(2)
        .joinToString("") { it.first().uppercase() }
    Box(
        modifier = modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(BtccOutline.copy(alpha = 0.5f)),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials, fontWeight = FontWeight.ExtraBold, fontSize = (size * 0.3f).sp, color = BtccTextSecondary)
        if (imageUrl.isNotEmpty()) {
            val displaySize = if (size > 80) 200 else 116
            AsyncImage(
                model              = ImageRequest.Builder(LocalContext.current)
                    .data(imageUrl)
                    .size(displaySize)
                    .build(),
                contentDescription = name,
                modifier           = Modifier.fillMaxSize(),
                contentScale       = ContentScale.Crop,
                alignment          = Alignment.TopCenter,
            )
        }
    }
}
