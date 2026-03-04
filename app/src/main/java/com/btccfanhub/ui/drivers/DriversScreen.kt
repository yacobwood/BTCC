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
import com.btccfanhub.data.repository.DriverPatch
import com.btccfanhub.data.repository.DriversRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
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

// ─────────────────────────────────────────────────────────────────────────────
// Data models
// ─────────────────────────────────────────────────────────────────────────────

private data class SeasonStat(
    val year: Int,
    val team: String,
    val car: String,
    val pos: Int,
    val points: Int,
    val wins: Int = 0,
    val podiums: Int = 0,
    val poles: Int = 0,
    val isChampion: Boolean = false,
)

private data class Driver(
    val number: Int,
    val name: String,
    val team: String,           // 2026 team, empty = TBD
    val car: String,            // 2026 car, empty = TBD
    val imageUrl: String,
    val nationality: String = "British",
    val bio: String = "",
    val history: List<SeasonStat> = emptyList(),
)

private data class Team(
    val name: String,
    val car: String,
    val entries: Int,
    val drivers: List<Driver>,
    val bio: String = "",
    val standing2025: Int = 0,
    val points2025: Int = 0,
)

// ─────────────────────────────────────────────────────────────────────────────
// Driver roster
// ─────────────────────────────────────────────────────────────────────────────

private val drivers2026 = listOf(
    Driver(
        number = 1, name = "Jake Hill",
        team = "", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Hill-0H5A7162-e1745404489304.png",
        bio = "A consistent BTCC frontrunner since his debut. Scored 3 race wins in 2025 to finish 4th overall with West Surrey Racing.",
        history = listOf(
            SeasonStat(2025, "West Surrey Racing", "BMW 330i M Sport", 4, 295, wins = 3),
        ),
    ),
    Driver(
        number = 2, name = "Daryl DeLeon",
        team = "West Surrey Racing", car = "BMW 330i M Sport",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/DeLeon-0Q3A0465.png",
        bio = "Scored his first BTCC race win in 2025 and retained his West Surrey Racing seat for 2026.",
        history = listOf(
            SeasonStat(2025, "West Surrey Racing", "BMW 330i M Sport", 13, 149, wins = 1),
        ),
    ),
    Driver(
        number = 3, name = "Tom Chilton",
        team = "EXCELR8 Motorsport", car = "Hyundai i30 N",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Chilton-0H5A6995-e1745404581533.png",
        bio = "Highly experienced BTCC campaigner with multiple race wins across his career. Took 2 victories in 2025 with EXCELR8 Motorsport.",
        history = listOf(
            SeasonStat(2025, "EXCELR8 Motorsport", "Hyundai i30 N", 7, 230, wins = 2),
        ),
    ),
    Driver(
        number = 16, name = "Aiden Moffat",
        team = "", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Moffat-0H5A1849-cut-out-e1745924439983.png",
        nationality = "Scottish",
        bio = "Scotland's Aiden Moffat has been a fixture in the BTCC paddock for over a decade, racing with a number of front-running outfits.",
        history = listOf(
            SeasonStat(2025, "EXCELR8 Motorsport", "Hyundai i30 N", 11, 166),
        ),
    ),
    Driver(
        number = 17, name = "Dexter Patterson",
        team = "Power Maxed Racing", car = "Audi S3 Saloon",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Patterson-0H5A6042-e1745404634252.png",
        bio = "An emerging talent in the BTCC, Dexter Patterson campaigns with Power Maxed Racing's Audi programme.",
        history = listOf(
            SeasonStat(2025, "Power Maxed Racing", "Audi S3 Saloon", 20, 42),
        ),
    ),
    Driver(
        number = 18, name = "Senna Proctor",
        team = "", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/05/senna-cut-out.png",
        bio = "A quick and exciting BTCC competitor who has shown strong pace throughout his time in the series.",
        history = listOf(
            SeasonStat(2025, "Team VERTU", "Toyota Corolla GR Sport", 10, 167),
        ),
    ),
    Driver(
        number = 19, name = "Max Buxton",
        team = "", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/08/Buxton-0H5A5290-cut-out.png",
        bio = "Max Buxton joined the BTCC grid during the 2025 season with West Surrey Racing, continuing to develop in 2026.",
        history = listOf(
            SeasonStat(2025, "West Surrey Racing", "BMW 330i M Sport", 22, 8),
        ),
    ),
    Driver(
        number = 25, name = "Chris Smiley",
        team = "", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/04/Smiley-0H5A4657-e1745404716647.png",
        nationality = "Northern Irish",
        bio = "Northern Irish driver Chris Smiley is a tenacious BTCC competitor with several strong seasons in the championship.",
        history = listOf(
            SeasonStat(2025, "Ciceley Motorsport", "Mercedes-AMG A35 Saloon", 14, 140),
        ),
    ),
    Driver(
        number = 27, name = "Dan Cammish",
        team = "NAPA Racing UK", car = "Ford Focus",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Cammish-0H5A6728.png",
        bio = "A multiple race winner and regular title contender. Cammish finished 3rd in the 2025 championship with NAPA Racing UK.",
        history = listOf(
            SeasonStat(2025, "NAPA Racing UK", "Ford Focus Titanium Saloon", 3, 307, wins = 3),
        ),
    ),
    Driver(
        number = 28, name = "Nic Hamilton",
        team = "Un-Limited Motorsport", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Hamilton-0H5A6198.png",
        bio = "Brother of seven-time Formula 1 World Champion Lewis Hamilton, Nic campaigns in the BTCC while raising the profile of disabled drivers in motorsport.",
        history = listOf(
            SeasonStat(2025, "Un-limited Motorsport", "BMW 330i M Sport", 28, 0),
        ),
    ),
    Driver(
        number = 32, name = "Daniel Rowbottom",
        team = "Plato Racing", car = "Mercedes-AMG A35",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Rowbottom-0H5A7475.png",
        bio = "A three-time race winner in 2025 with Restart Racing, Rowbottom joins Plato Racing for the 2026 season.",
        history = listOf(
            SeasonStat(2025, "Restart Racing", "Honda Civic Type R", 5, 277, wins = 3),
        ),
    ),
    Driver(
        number = 33, name = "Adam Morgan",
        team = "Plato Racing", car = "Mercedes-AMG A35 Saloon",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Morgan-0H5A7392-e1745404802430.png",
        bio = "A long-standing BTCC competitor, Adam Morgan joins Plato Racing for 2026, reuniting with the Mercedes-AMG A35 Saloon he raced to 6th in the 2025 championship with Ciceley Motorsport.",
        history = listOf(
            SeasonStat(2025, "Ciceley Motorsport", "Mercedes-AMG A35 Saloon", 6, 241),
        ),
    ),
    Driver(
        number = 40, name = "Árón Taylor-Smith",
        team = "Laser Tools Racing", car = "Toyota Corolla",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/TaylorSmith-0H5A7061.png",
        nationality = "Northern Irish",
        bio = "A Northern Irish driver with over a decade of BTCC experience. Known for his aggressive racecraft and determination throughout the field.",
        history = listOf(
            SeasonStat(2025, "Laser Tools Racing", "Toyota Corolla GR Sport", 17, 103),
        ),
    ),
    Driver(
        number = 50, name = "Nick Halstead",
        team = "Power Maxed Racing", car = "Audi S3 Saloon",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Halstead-Nick-0H5A0744-cut-out-e1747386424389.png",
        bio = "Nick Halstead continues to build his BTCC career with Power Maxed Racing's Audi programme.",
        history = listOf(
            SeasonStat(2025, "Power Maxed Racing", "Audi S3 Saloon", 27, 4),
        ),
    ),
    Driver(
        number = 52, name = "Gordon Shedden",
        team = "Laser Tools Racing", car = "Toyota Corolla",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/04/Shedden-0H5A6436-e1745591902397.png",
        nationality = "Scottish",
        bio = "Three-time BTCC Drivers' Champion with Honda. 'Flash' Gordon returned to the series with Laser Tools Racing and secured a race win in 2025.",
        history = listOf(
            SeasonStat(2025, "Laser Tools Racing",    "Toyota Corolla GR Sport", 9, 177, wins = 1),
            SeasonStat(2016, "Halfords Yuasa Racing", "Honda Civic Type R",      1,   0, isChampion = true),
            SeasonStat(2014, "Halfords Yuasa Racing", "Honda Civic Type R",      1,   0, isChampion = true),
            SeasonStat(2012, "Halfords Yuasa Racing", "Honda Civic Type R",      1,   0, isChampion = true),
        ),
    ),
    Driver(
        number = 66, name = "Josh Cook",
        team = "One Motorsport", car = "Honda Civic Type R",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Josh-Cook-face-on-no-logos.png",
        bio = "A race winner across multiple BTCC seasons, Cook is a consistent performer with One Motorsport's Honda programme.",
        history = listOf(
            SeasonStat(2025, "One Motorsport", "Honda Civic Type R", 12, 160, wins = 1),
        ),
    ),
    Driver(
        number = 77, name = "Sam Osborne",
        team = "NAPA Racing UK", car = "Ford Focus",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Osborne-0H5A7553-e1745404843375.png",
        bio = "Sam Osborne secured his first BTCC race win in 2025 as part of the championship-winning NAPA Racing UK squad.",
        history = listOf(
            SeasonStat(2025, "NAPA Racing UK", "Ford Focus Titanium Saloon", 16, 108, wins = 1),
        ),
    ),
    Driver(
        number = 80, name = "Tom Ingram",
        team = "Speedworks Motorsport", car = "Toyota Corolla",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Ingram-0H5A6913.png",
        bio = "2025 BTCC Drivers' Champion with 7 race wins. Ingram is the benchmark heading into 2026 and a perennial title contender throughout his career.",
        history = listOf(
            SeasonStat(2025, "Team VERTU", "Toyota Corolla GR Sport", 1, 462, wins = 7, isChampion = true),
        ),
    ),
    Driver(
        number = 88, name = "Mikey Doble",
        team = "", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Doble-0H5A6257-e1745404879475.png",
        bio = "Mikey Doble claimed a BTCC race win in 2025 with EXCELR8 Motorsport and is looking to build on that form in 2026.",
        history = listOf(
            SeasonStat(2025, "EXCELR8 Motorsport", "Hyundai i30 N", 18, 100, wins = 1),
        ),
    ),
    Driver(
        number = 99, name = "Charles Rainford",
        team = "West Surrey Racing", car = "BMW 330i M Sport",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/04/Rainford-0H5A1348-cut-out-e1745936759683.png",
        bio = "Charles Rainford secured his first BTCC race win in 2025 and has earned a full-season role with West Surrey Racing for 2026.",
        history = listOf(
            SeasonStat(2025, "West Surrey Racing", "BMW 330i M Sport", 8, 179, wins = 1),
        ),
    ),
    Driver(
        number = 116, name = "Ashley Sutton",
        team = "NAPA Racing UK", car = "Ford Focus",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Sutton-0H5A6649-e1745404951693.png",
        bio = "Two-time BTCC Drivers' Champion (2017 and 2024). Sutton mounted a strong title challenge in 2025, falling just short behind Tom Ingram.",
        history = listOf(
            SeasonStat(2025, "NAPA Racing UK",            "Ford Focus Titanium Saloon", 2, 428, wins = 5),
            SeasonStat(2024, "NAPA Racing UK",            "Ford Focus Titanium Saloon", 1,   0, isChampion = true),
            SeasonStat(2017, "Adrian Flux Subaru Racing", "Subaru Levorg",              1,   0, isChampion = true),
        ),
    ),
    Driver(
        number = 123, name = "Daniel Lloyd",
        team = "Restart Racing", car = "",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Lloyd-0H5A4818-e1745404985176.png",
        nationality = "Welsh",
        bio = "Welsh BTCC veteran Daniel Lloyd claimed a race win in 2025 and is a tenacious front-midfield competitor.",
        history = listOf(
            SeasonStat(2025, "Restart Racing", "Honda Civic Type R", 15, 128, wins = 1),
        ),
    ),
)

// ─────────────────────────────────────────────────────────────────────────────
// Team roster
// ─────────────────────────────────────────────────────────────────────────────

private val teams2026 = listOf(
    Team(
        name = "NAPA Racing UK", car = "Ford Focus Titanium Saloon", entries = 4,
        drivers = drivers2026.filter { it.team == "NAPA Racing UK" },
        bio = "The 2025 BTCC Teams' Champions. NAPA Racing UK house two-time champion Ashley Sutton alongside multiple race winners in a highly competitive Ford-powered squad.",
        standing2025 = 1, points2025 = 775,
    ),
    Team(
        name = "EXCELR8 Motorsport", car = "Hyundai i30 N", entries = 4,
        drivers = drivers2026.filter { it.team == "EXCELR8 Motorsport" },
        bio = "Running the Hyundai i30 N, EXCELR8 operate one of the largest entries in the BTCC paddock and are a consistent top-half team.",
    ),
    Team(
        name = "Speedworks Motorsport", car = "Toyota Corolla GR Sport", entries = 4,
        drivers = drivers2026.filter { it.team == "Speedworks Motorsport" },
        bio = "Home to 2025 Drivers' Champion Tom Ingram. Speedworks' Toyota Corollas finished 2nd in the 2025 Teams' Championship — racing as 'Team VERTU' that season.",
        standing2025 = 2, points2025 = 773,
    ),
    Team(
        name = "West Surrey Racing", car = "BMW 330i M Sport", entries = 3,
        drivers = drivers2026.filter { it.team == "West Surrey Racing" },
        bio = "One of BTCC's most storied outfits with decades of championship history. WSR run BMW 330i M Sport machinery and have produced multiple series champions.",
        standing2025 = 3, points2025 = 462,
    ),
    Team(
        name = "Power Maxed Racing", car = "Audi S3 Saloon", entries = 3,
        drivers = drivers2026.filter { it.team == "Power Maxed Racing" },
        bio = "Power Maxed Racing campaign with the Audi S3 Saloon as part of the growing Audi BTCC programme.",
        standing2025 = 8, points2025 = 190,
    ),
    Team(
        name = "Laser Tools Racing", car = "Toyota Corolla GR Sport", entries = 2,
        drivers = drivers2026.filter { it.team == "Laser Tools Racing" },
        bio = "Scottish-backed team running Toyota Corolla GR Sport machinery. House three-time champion Gordon Shedden alongside Árón Taylor-Smith.",
        standing2025 = 5, points2025 = 319,
    ),
    Team(
        name = "Plato Racing", car = "Mercedes-AMG A35 Saloon", entries = 2,
        drivers = drivers2026.filter { it.team == "Plato Racing" },
        bio = "Jason Plato's own team, running Mercedes-AMG A35 Saloon machinery for 2026. Daniel Rowbottom and Adam Morgan form the confirmed line-up.",
    ),
    Team(
        name = "One Motorsport", car = "Honda Civic Type R", entries = 2,
        drivers = drivers2026.filter { it.team == "One Motorsport" },
        bio = "Running Honda Civic Type R machinery, One Motorsport are a consistent presence in the BTCC with race-winning pace.",
        standing2025 = 9, points2025 = 156,
    ),
    Team(
        name = "Un-Limited Motorsport", car = "", entries = 2,
        drivers = drivers2026.filter { it.team == "Un-Limited Motorsport" },
        bio = "Notable for running Nic Hamilton, brother of F1 legend Lewis Hamilton, Un-Limited Motorsport are part of the diverse BTCC paddock.",
        standing2025 = 10, points2025 = 144,
    ),
    Team(
        name = "Restart Racing", car = "", entries = 2,
        drivers = drivers2026.filter { it.team == "Restart Racing" },
        bio = "Formerly known as BTC Racing, Restart Racing run Honda Civic Type R machinery and enjoyed a strong 2025 season with multiple race wins.",
        standing2025 = 4, points2025 = 386,
    ),
    Team(
        name = "Alliance Racing", car = "", entries = 4,
        drivers = emptyList(),
        bio = "New team joining the BTCC grid for the 2026 season.",
    ),
)

// ─────────────────────────────────────────────────────────────────────────────
// Top-level screen — local navigation state
// ─────────────────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriversScreen() {
    val context = LocalContext.current
    var patches by remember { mutableStateOf<Map<Int, DriverPatch>>(emptyMap()) }
    LaunchedEffect(Unit) {
        val p = withContext(Dispatchers.IO) { DriversRepository.fetch() }
        if (p != null) patches = p
    }

    val drivers = remember(patches) {
        if (patches.isEmpty()) drivers2026
        else drivers2026.map { d ->
            val p = patches[d.number] ?: return@map d
            d.copy(team = p.team ?: d.team, car = p.car ?: d.car, bio = p.bio ?: d.bio)
        }
    }

    LaunchedEffect(drivers) {
        if (drivers.isEmpty()) return@LaunchedEffect
        drivers.forEach { driver ->
            if (driver.imageUrl.isNotEmpty()) {
                // Prefetch list size (58dp * 2)
                val listReq = ImageRequest.Builder(context)
                    .data(driver.imageUrl)
                    .size(116)
                    .build()
                context.imageLoader.enqueue(listReq)

                // Prefetch detail size (100dp * 2)
                val detailReq = ImageRequest.Builder(context)
                    .data(driver.imageUrl)
                    .size(200)
                    .build()
                context.imageLoader.enqueue(detailReq)
            }
        }
    }
    val teams = remember(drivers) {
        teams2026.map { t -> t.copy(drivers = drivers.filter { it.team == t.name }) }
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

    Scaffold(
        topBar = {
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
        },
        containerColor = BtccBackground,
    ) { padding ->
        HorizontalPager(
            state    = pagerState,
            modifier = Modifier.fillMaxSize().padding(padding),
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
        Column(modifier = Modifier.weight(1f)) {
            Text(
                driver.name,
                style      = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                if (driver.team.isNotEmpty()) driver.team else "Team TBC",
                style = MaterialTheme.typography.bodySmall,
                color = if (driver.team.isNotEmpty()) BtccTextSecondary else BtccOutline,
            )
        }
        if (driver.car.isNotEmpty()) {
            Surface(
                shape    = RoundedCornerShape(6.dp),
                color    = Color.Transparent,
                modifier = Modifier.border(1.dp, BtccOutline, RoundedCornerShape(6.dp)),
            ) {
                Text(
                    driver.car,
                    modifier   = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style      = MaterialTheme.typography.labelSmall,
                    color      = BtccTextSecondary,
                    fontWeight = FontWeight.SemiBold,
                )
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
    Scaffold(
        topBar = {
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
        },
        containerColor = BtccBackground,
    ) { padding ->
        LazyColumn(
            modifier       = Modifier.fillMaxSize().padding(padding),
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
    Scaffold(
        topBar = {
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
        },
        containerColor = BtccBackground,
    ) { padding ->
        LazyColumn(
            modifier       = Modifier.fillMaxSize().padding(padding),
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
            modifier = Modifier.align(Alignment.BottomStart),
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
