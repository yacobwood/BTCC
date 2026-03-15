package com.btccfanhub.ui.drivers

import androidx.activity.compose.BackHandler
import java.time.LocalDate
import java.time.Period
import java.time.format.DateTimeFormatter
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.*
import com.btccfanhub.data.FavouriteDriverStore
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.*
import com.btccfanhub.data.model.Driver
import com.btccfanhub.data.model.GridData
import com.btccfanhub.data.model.SeasonStat
import com.btccfanhub.data.model.Team
import com.btccfanhub.data.model.TeamSeasonStat
import com.btccfanhub.data.repository.DriversRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.imageLoader
import coil.request.ImageRequest
import com.btccfanhub.ui.theme.*
import androidx.compose.ui.platform.LocalContext
import android.content.Context
import java.io.File

// Driver, Team, SeasonStat, GridData defined in data/model/GridData.kt

/** Prefer bundled WebP from filesDir (from assets); fall back to network URL. */
private fun driverImageData(context: Context, number: Int, imageUrl: String): String {
    if (imageUrl.isEmpty()) return ""
    val file = File(context.filesDir, "driver_images/$number.webp")
    return if (file.exists()) file.absolutePath else imageUrl
}

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

    // Prefetch driver images (bundled file or network URL) in batches
    LaunchedEffect(drivers) {
        if (drivers.isEmpty()) return@LaunchedEffect
        val withImages = drivers.filter { it.imageUrl.isNotEmpty() }
        val batchSize = 10
        withImages.chunked(batchSize).forEachIndexed { index, batch ->
            if (index > 0) delay(400)
            batch.forEach { driver ->
                val data = driverImageData(context, driver.number, driver.imageUrl)
                if (data.isEmpty()) return@forEach
                context.imageLoader.enqueue(
                    ImageRequest.Builder(context).data(data).size(116).build()
                )
                context.imageLoader.enqueue(
                    ImageRequest.Builder(context).data(data).size(200).build()
                )
            }
        }
    }

    val gridPagerState = rememberPagerState(pageCount = { 2 })
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
                    windowInsets = WindowInsets(0),
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
                pagerState    = gridPagerState,
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
    pagerState: PagerState,
    drivers: List<Driver>,
    teams: List<Team>,
    onDriverClick: (Driver) -> Unit,
    onTeamClick: (Team) -> Unit,
) {
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        Column {
            TopAppBar(
                windowInsets = WindowInsets(0),
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
    val context     = LocalContext.current
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == driver.name

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
            .then(if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(12.dp)) else Modifier)
            .clickable { onClick() }
            .padding(start = 12.dp, top = 10.dp, bottom = 10.dp, end = 4.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        DriverAvatarWithNumber(
            imageUrl      = driverImageData(LocalContext.current, driver.number, driver.imageUrl),
            name          = driver.name,
            number        = driver.number,
            teamConfirmed = driver.team.isNotEmpty(),
            avatarSize    = 58,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.Center
        ) {
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (isFavourite) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = null,
                        tint     = BtccYellow,
                        modifier = Modifier.size(13.dp),
                    )
                }
                Text(
                    driver.name,
                    style      = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
                )
            }
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
        IconButton(
            onClick  = { FavouriteDriverStore.toggle(context, driver.name) },
            modifier = Modifier.size(40.dp),
        ) {
            Icon(
                imageVector = if (isFavourite) Icons.Filled.Star else Icons.Outlined.StarOutline,
                contentDescription = if (isFavourite) "Unstar" else "Star",
                tint     = if (isFavourite) BtccYellow else BtccTextSecondary,
                modifier = Modifier.size(20.dp),
            )
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
    val context     = LocalContext.current
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == driver.name

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            modifier = Modifier.height(56.dp),
            title = {},
            navigationIcon = {
                IconButton(
                    onClick   = onBack,
                    modifier  = Modifier.size(48.dp),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        modifier = Modifier.size(28.dp),
                    )
                }
            },
            actions = {
                IconButton(
                    onClick   = { FavouriteDriverStore.toggle(context, driver.name) },
                    modifier  = Modifier.size(48.dp),
                ) {
                    Icon(
                        imageVector       = if (isFavourite) Icons.Filled.Star else Icons.Outlined.StarOutline,
                        contentDescription = if (isFavourite) "Unstar" else "Star",
                        tint              = if (isFavourite) BtccYellow else BtccTextSecondary,
                        modifier         = Modifier.size(28.dp),
                    )
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
                        imageUrl      = driverImageData(LocalContext.current, driver.number, driver.imageUrl),
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

            // ── Personal stats ───────────────────────────────────────────────
            val hasDob        = driver.dateOfBirth.isNotEmpty()
            val hasBirthplace = driver.birthplace.isNotEmpty()
            if (hasDob || hasBirthplace) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(BtccCard, RoundedCornerShape(10.dp))
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        if (hasDob) {
                            val dob    = LocalDate.parse(driver.dateOfBirth)
                            val age    = Period.between(dob, LocalDate.now()).years
                            val dobFmt = dob.format(DateTimeFormatter.ofPattern("d MMM yyyy"))
                            PersonalStatRow(label = "Age", value = "$age  ·  $dobFmt")
                        }
                        if (hasDob && hasBirthplace) {
                            HorizontalDivider(color = BtccOutline.copy(alpha = 0.4f), thickness = 0.5.dp)
                        }
                        if (hasBirthplace) {
                            PersonalStatRow(label = "Birthplace", value = driver.birthplace)
                        }
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
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        LazyColumn(
            modifier    = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            // ── Car image banner ─────────────────────────────────────────────
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(if (team.carImageUrl.isNotEmpty()) 200.dp else 130.dp)
                        .background(BtccCard),
                ) {
                    if (team.carImageUrl.isNotEmpty()) {
                        AsyncImage(
                            model              = ImageRequest.Builder(LocalContext.current)
                                .data(team.carImageUrl)
                                .build(),
                            contentDescription = team.car,
                            modifier           = Modifier.fillMaxSize(),
                            contentScale       = ContentScale.Fit,
                        )
                    }
                    // Gradient fade to background at bottom
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp)
                            .align(Alignment.BottomCenter)
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color.Transparent, BtccBackground)
                                )
                            )
                    )
                    // Car name chip bottom-left
                    if (team.car.isNotEmpty()) {
                        Surface(
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(12.dp),
                            shape  = RoundedCornerShape(6.dp),
                            color  = BtccCard.copy(alpha = 0.9f),
                        ) {
                            Text(
                                team.car,
                                modifier   = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                style      = MaterialTheme.typography.labelSmall,
                                color      = BtccTextSecondary,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }

            // ── Team name header ─────────────────────────────────────────────
            item {
                Text(
                    team.name,
                    fontWeight    = FontWeight.Black,
                    fontSize      = 20.sp,
                    letterSpacing = 0.5.sp,
                    color         = MaterialTheme.colorScheme.onBackground,
                    modifier      = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 2.dp),
                )
            }

            // ── Drivers ──────────────────────────────────────────────────────
            item {
                Text(
                    "2026 DRIVERS",
                    style         = MaterialTheme.typography.labelSmall,
                    fontWeight    = FontWeight.ExtraBold,
                    color         = BtccTextSecondary,
                    letterSpacing = 2.sp,
                    modifier      = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 10.dp),
                )
            }
            item {
                val tbc = team.entries - team.drivers.size
                val totalSlots = team.drivers.size + tbc
                if (totalSlots >= 2) {
                    // Side-by-side for 2+ total slots (confirmed or TBC)
                    val avatarSize = if (totalSlots >= 3) 56 else 72
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        team.drivers.forEach { driver ->
                            TeamDriverCard(driver = driver, avatarSize = avatarSize, modifier = Modifier.weight(1f))
                        }
                        repeat(tbc) {
                            TbcDriverCard(avatarSize = avatarSize, modifier = Modifier.weight(1f))
                        }
                    }
                } else {
                    Column(
                        modifier            = Modifier.padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        team.drivers.forEach { driver ->
                            TeamDriverCard(driver = driver, modifier = Modifier.fillMaxWidth())
                        }
                        repeat(tbc) {
                            TbcDriverCard(modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            }

            // ── Team info stats ───────────────────────────────────────────────
            if (team.founded > 0 || team.base.isNotEmpty() || team.driversChampionships > 0 || team.teamsChampionships > 0) {
                item {
                    Text(
                        "TEAM INFO",
                        style         = MaterialTheme.typography.labelSmall,
                        fontWeight    = FontWeight.ExtraBold,
                        color         = BtccTextSecondary,
                        letterSpacing = 2.sp,
                        modifier      = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 10.dp),
                    )
                }
                item {
                    Row(
                        modifier            = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (team.founded > 0) {
                            TeamInfoChip(label = "FOUNDED", value = "${team.founded}")
                        }
                        if (team.base.isNotEmpty()) {
                            TeamInfoChip(label = "BASE", value = team.base, modifier = Modifier.weight(1f))
                        }
                    }
                }
                if (team.driversChampionships > 0 || team.teamsChampionships > 0) {
                    item {
                        Row(
                            modifier            = Modifier
                                .fillMaxWidth()
                                .padding(start = 16.dp, end = 16.dp, top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            if (team.driversChampionships > 0) {
                                TeamInfoChip(
                                    label    = "DRIVERS' TITLES",
                                    value    = "${team.driversChampionships}",
                                    highlight = true,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            if (team.teamsChampionships > 0) {
                                TeamInfoChip(
                                    label    = "TEAMS' TITLES",
                                    value    = "${team.teamsChampionships}",
                                    highlight = true,
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }
            }

            // ── Bio ──────────────────────────────────────────────────────────
            if (team.bio.isNotEmpty()) {
                item {
                    Text(
                        "ABOUT",
                        style         = MaterialTheme.typography.labelSmall,
                        fontWeight    = FontWeight.ExtraBold,
                        color         = BtccTextSecondary,
                        letterSpacing = 2.sp,
                        modifier      = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 10.dp),
                    )
                }
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .background(BtccCard, RoundedCornerShape(12.dp))
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

            // ── Season history ────────────────────────────────────────────────
            if (team.history.isNotEmpty()) {
                item {
                    Text(
                        "SEASON HISTORY",
                        style         = MaterialTheme.typography.labelSmall,
                        fontWeight    = FontWeight.ExtraBold,
                        color         = BtccTextSecondary,
                        letterSpacing = 2.sp,
                        modifier      = Modifier.padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 10.dp),
                    )
                }
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp)
                            .background(BtccCard, RoundedCornerShape(12.dp)),
                    ) {
                        team.history.sortedByDescending { it.year }.forEachIndexed { index, stat ->
                            if (index > 0) HorizontalDivider(
                                color     = BtccOutline.copy(alpha = 0.3f),
                                thickness = 0.5.dp,
                                modifier  = Modifier.padding(horizontal = 14.dp),
                            )
                            TeamSeasonStatRow(stat)
                        }
                    }
                }
            }
        }
        // Back button overlaid top-left
        IconButton(
            onClick  = onBack,
            modifier = Modifier
                .align(Alignment.TopStart)
                .statusBarsPadding()
                .padding(start = 8.dp, top = 8.dp)
                .size(40.dp)
                .background(Color.Black.copy(alpha = 0.45f), CircleShape),
        ) {
            Icon(
                Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint     = Color.White,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

@Composable
private fun TeamSeasonStatRow(stat: TeamSeasonStat) {
    val posColor = when (stat.pos) {
        1    -> Color(0xFFFFD700)
        2    -> Color(0xFFC0C0C0)
        3    -> Color(0xFFCD7F32)
        else -> MaterialTheme.colorScheme.onBackground
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Year
        Text(
            stat.year.toString(),
            fontWeight = FontWeight.ExtraBold,
            fontSize   = 14.sp,
            color      = BtccTextSecondary,
            modifier   = Modifier.width(46.dp),
        )
        // Position (large, coloured)
        Row(
            modifier              = Modifier.weight(1f),
            verticalAlignment     = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            if (stat.pos == 1) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = null,
                    tint     = BtccYellow,
                    modifier = Modifier.size(14.dp),
                )
            }
            Text(
                "P${stat.pos}",
                fontWeight = FontWeight.Black,
                fontSize   = 16.sp,
                color      = posColor,
            )
        }
        // Points (right-aligned, muted)
        Text(
            "${stat.points} pts",
            style  = MaterialTheme.typography.bodySmall,
            color  = BtccTextSecondary,
        )
    }
}

@Composable
private fun TeamInfoChip(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    highlight: Boolean = false,
) {
    Column(
        modifier = modifier
            .background(BtccCard, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
    ) {
        Text(
            label,
            style         = MaterialTheme.typography.labelSmall,
            color         = BtccTextSecondary,
            letterSpacing = 1.sp,
            fontSize      = 9.sp,
        )
        Spacer(Modifier.height(2.dp))
        Text(
            value,
            fontWeight = FontWeight.ExtraBold,
            fontSize   = 18.sp,
            color      = if (highlight) BtccYellow else MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun TeamDriverCard(driver: Driver, avatarSize: Int = 72, modifier: Modifier = Modifier) {
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == driver.name

    Column(
        modifier = modifier
            .background(BtccCard, RoundedCornerShape(12.dp))
            .then(if (isFavourite) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.5f), RoundedCornerShape(12.dp)) else Modifier)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        DriverAvatarWithNumber(
            imageUrl      = driverImageData(LocalContext.current, driver.number, driver.imageUrl),
            name          = driver.name,
            number        = driver.number,
            teamConfirmed = driver.team.isNotEmpty(),
            avatarSize    = avatarSize,
        )
        Text(
            driver.name,
            style      = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
            textAlign  = TextAlign.Center,
        )
        if (driver.nationality.isNotEmpty()) {
            Text(
                driver.nationality,
                style  = MaterialTheme.typography.labelSmall,
                color  = BtccTextSecondary,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun TbcDriverCard(avatarSize: Int = 72, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(avatarSize.dp)
                .clip(CircleShape)
                .background(BtccOutline.copy(alpha = 0.3f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Person,
                contentDescription = null,
                tint     = BtccOutline,
                modifier = Modifier.size((avatarSize * 0.65f).dp),
            )
        }
        Text(
            "Driver TBC",
            style     = MaterialTheme.typography.bodyMedium,
            color     = BtccOutline,
            textAlign = TextAlign.Center,
        )
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
            .heightIn(min = 60.dp)
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
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.Center) {
            if (stat.team.isNotEmpty()) {
                Text(
                    stat.team,
                    style      = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color      = MaterialTheme.colorScheme.onBackground,
                )
            }
            if (stat.car.isNotEmpty()) {
                Text(
                    stat.car,
                    style      = MaterialTheme.typography.labelSmall,
                    fontWeight = if (stat.team.isEmpty()) FontWeight.SemiBold else FontWeight.Normal,
                    color      = if (stat.team.isEmpty()) MaterialTheme.colorScheme.onBackground else BtccTextSecondary,
                )
            }
        }

        // Stats / champion badge
        Column(horizontalAlignment = Alignment.End) {
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
                Text(
                    "P${stat.pos}",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize   = 14.sp,
                    color      = MaterialTheme.colorScheme.onBackground,
                )
            }
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
                if (stat.podiums > 0) {
                    Text(
                        "${stat.podiums}P",
                        style      = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color      = Color(0xFFC0C0C0),
                    )
                }
                if (stat.fastestLaps > 0) {
                    Text(
                        "${stat.fastestLaps}FL",
                        style      = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color      = Color(0xFF9C27B0),
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Personal stat row
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun PersonalStatRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style      = MaterialTheme.typography.bodySmall,
            color      = BtccTextSecondary,
            fontWeight = FontWeight.Medium,
        )
        Text(
            value,
            style      = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color      = MaterialTheme.colorScheme.onBackground,
        )
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
    val favourite   by FavouriteDriverStore.driver.collectAsState()
    val isFavourite = favourite == driver.name

    Row(
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        DriverAvatarWithNumber(
            imageUrl      = driverImageData(LocalContext.current, driver.number, driver.imageUrl),
            name          = driver.name,
            number        = driver.number,
            teamConfirmed = driver.team.isNotEmpty(),
            avatarSize    = 40,
        )
        if (isFavourite) {
            Icon(
                Icons.Filled.Star,
                contentDescription = null,
                tint     = BtccYellow,
                modifier = Modifier.size(12.dp),
            )
        }
        Text(
            driver.name,
            style      = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color      = if (isFavourite) BtccYellow else MaterialTheme.colorScheme.onBackground,
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
                Icon(
                    Icons.Filled.Person,
                    contentDescription = null,
                    tint     = BtccOutline,
                    modifier = Modifier.size(26.dp),
                )
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
