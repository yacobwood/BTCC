package com.btccfanhub.ui.calendar

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.btccfanhub.data.model.LapRecord
import com.btccfanhub.data.model.Race
import com.btccfanhub.data.model.RaceSession
import com.btccfanhub.data.model.TrackInfo
import com.btccfanhub.data.repository.ScheduleRepository
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

private val dateFormat = DateTimeFormatter.ofPattern("d MMM yyyy")
private val shortDateFormat = DateTimeFormatter.ofPattern("d MMM")

// ─────────────────────────────────────────────────────────────────────────────
// Track data
// ─────────────────────────────────────────────────────────────────────────────

private val trackInfoMap: Map<Int, TrackInfo> = listOf(
    TrackInfo(
        round = 1,
        venue = "Donington Park",
        location = "Castle Donington, Leicestershire",
        country = "England",
        lengthMiles = "1.957 mi",
        lengthKm = "3.149 km",
        corners = 9,
        about = "One of Britain's most historic circuits, dating back to 1931. The National layout features the infamous Craner Curves — a sweeping downhill chicane that rewards commitment — alongside the Old Hairpin and the fast Schwantz Curve. The circuit also hosted a famous Formula 1 European Grand Prix in 1993, remembered for Ayrton Senna's extraordinary opening lap.",
        btccFact = "Donington opens the BTCC season almost every year, meaning the winner of the first race here is often considered the early championship favourite.",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/04/Start-0H5A6101-scaled.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/2-Donington-Park-1.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/04/start-0H5A1735-scaled-e1745785780179.jpg",
            "https://btcc.net/wp-content/uploads/2025/04/sutton-0H5A6349-scaled-e1745765754484.jpg",
            "https://btcc.net/wp-content/uploads/2025/04/Cammish-0Q3A6409-scaled-e1745684861454.jpg",
            "https://btcc.net/wp-content/uploads/2025/04/podium0H5A5174-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/04/Cammish-0Q3A5960-scaled.jpg",
        ),
        firstBtccYear = 1977,
        qualifyingRecord = LapRecord("Ash Sutton", "1:07.570", "106.39 mph", 2023),
        raceRecord      = LapRecord("Ash Sutton", "1:08.011", "104.75 mph", 2025),
    ),
    TrackInfo(
        round = 2,
        venue = "Brands Hatch Indy",
        location = "Fawkham, Kent",
        country = "England",
        lengthMiles = "1.208 mi",
        lengthKm = "1.944 km",
        corners = 9,
        about = "The short, intense Indy loop of the legendary Brands Hatch circuit. Paddock Hill Bend is one of the most famous corners in British motorsport — blind, downhill, and off-camber — providing spectacular action on the opening lap. The tight Druids hairpin and Clark Curve create close-quarters racing throughout the field.",
        btccFact = "The BTCC visits Brands Hatch twice each season — on the shorter Indy circuit in spring and the full Grand Prix layout for the season finale in October.",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Brands-Hatch1.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/750x625.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/05/Cook-0H5A4404-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Doble-0H5A4021-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Cook-0H5A5155-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Hill-0Q3A1643-scaled-e1748079457751.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Cammish-0H5A8317-scaled-e1748620603557.jpg",
        ),
        firstBtccYear = 1958,
        qualifyingRecord = LapRecord("Jake Hill",   "46.493s",   "94.54 mph", 2025),
        raceRecord       = LapRecord("Tom Ingram",  "47.157s",   "92.53 mph", 2025),
    ),
    TrackInfo(
        round = 3,
        venue = "Snetterton",
        location = "Attleborough, Norfolk",
        country = "England",
        lengthMiles = "2.969 mi",
        lengthKm = "4.779 km",
        corners = 11,
        about = "Built on a former Second World War airfield in the flat Norfolk countryside, Snetterton is one of the longest circuits on the BTCC calendar. The Bentley Straight offers tyre-testing high-speed running, while technical sections like the Senna Chicane and Coram Corner reward smooth, committed driving. Setup compromise between straight-line speed and mechanical grip is key.",
        btccFact = "Snetterton's long straights mean it's one of the circuits where power advantage makes the biggest difference — teams running higher-powered cars often shine here.",
        imageUrl = "https://btcc.net/wp-content/uploads/2023/05/Snetterton-BTCC.net-750x340-1.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/6-Snetterton.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/05/Doble-0Q3A8800-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Morgan-33-0H5A8454-scaled-e1748081530691.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Doble-0H5A4603-scaled-e1748201877564.jpg",
            "https://btcc.net/wp-content/uploads/2025/05/Hill-0H5A1809-scaled-e1748426133523.jpg",
            "https://btcc.net/wp-content/uploads/2025/04/NAPA_Snetterton_Testing-2-scaled.jpg",
        ),
        firstBtccYear = 1959,
        qualifyingRecord = LapRecord("Dan Cammish", "1:53.750", "94.62 mph", 2025),
        raceRecord       = LapRecord("Ash Sutton",  "1:54.871", "91.06 mph", 2023),
    ),
    TrackInfo(
        round = 4,
        venue = "Oulton Park",
        location = "Little Budworth, Cheshire",
        country = "England",
        lengthMiles = "2.231 mi",
        lengthKm = "3.590 km",
        corners = 13,
        about = "A consistent driver favourite. Set in the rolling Cheshire countryside, Oulton Park combines sweeping fast corners with elevation changes that put the car through its paces. Cascades is a breathtaking flat-out downhill right-hander, while the Knickerbrook complex and the Lodge chicane reward precision. It's the type of track that exposes both talent and machinery.",
        btccFact = "Oulton Park has produced some of the most memorable BTCC moments of recent seasons, with its undulating nature leading to unpredictable results and dramatic incidents.",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Oulton-Park-2.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/4-Oulton-Park-1.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/07/Ingram-0Q3A3136-scaled-e1753783962919.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/Jelley-0Q3A9321-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/DeLeon-0H5A1821-1-e1752251919622.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/Smiley-Morgan-Deleon-Sutton-0H5A2139-scaled-e1752223838566.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/Hill-0Q3A9688-scaled-e1752051499535.jpg",
        ),
        firstBtccYear = 1960,
        qualifyingRecord = LapRecord("Tom Ingram", "1:23.856", "96.72 mph", 2025),
        raceRecord       = LapRecord("Tom Ingram", "1:24.052", "95.57 mph", 2025),
    ),
    TrackInfo(
        round = 5,
        venue = "Thruxton",
        location = "Andover, Hampshire",
        country = "England",
        lengthMiles = "2.356 mi",
        lengthKm = "3.792 km",
        corners = 9,
        about = "Britain's fastest circuit, built on a wartime airfield in Hampshire. Wide, fast, and almost entirely flat, Thruxton is a circuit where bravery is rewarded. The sweeping Cobb–Noble–Church complex is taken at high speed in a single flowing line, while Campbell/Coppice is among the most demanding high-speed sequences in domestic racing.",
        btccFact = "Average lap speeds at Thruxton are the highest of any BTCC venue, regularly exceeding 120 mph. It's a true driver's circuit where mechanical sympathy under sustained high loads is paramount.",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/06/Thruxton-0Q3A4321-scaled-e1749317843966.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/3-Thruxton.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/07/Cook-0H5A7560-scaled-e1753397162433.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/Ingram-0H5A6509-1.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/doble-0Q3A9324-1.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/Rainford-0Q3A4157-1-e1752682089797.jpg",
            "https://btcc.net/wp-content/uploads/2025/07/sutton-0Q3A9385-scaled-e1751448841991.jpg",
        ),
        firstBtccYear = 1968,
        qualifyingRecord = LapRecord("Dan Cammish", "1:15.201", "112.79 mph", 2020),
        raceRecord       = LapRecord("Ash Sutton",  "1:15.254", "112.71 mph", 2025),
    ),
    TrackInfo(
        round = 6,
        venue = "Knockhill",
        location = "Dunfermline, Fife",
        country = "Scotland",
        lengthMiles = "1.270 mi",
        lengthKm = "2.045 km",
        corners = 13,
        about = "Scotland's National Motorsport Centre, tucked into the Fife hills. Compact and technically demanding, Knockhill is unlike any other circuit on the calendar — the undulating gradient means cars are constantly loaded and unloaded through corners, making the rear of a touring car particularly lively. The blind crest at Clark's Corner demands total commitment.",
        btccFact = "The Knockhill crowd is famously passionate, and the circuit's compact nature means fans can see virtually the entire lap from the hillside spectator banks — making it a fantastic atmosphere for a race meeting.",
        imageUrl = "https://btcc.net/wp-content/uploads/2025/08/Knockhill-0Q3A7021-scaled-e1755340971797.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/knockhill-2020-03.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/08/Release_start-0Q3A1361-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Ingram-0H5A8227-scaled-e1756658215859.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Osborne-0Q3A7340-scaled-e1756654415631.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Cammish-0H5A6429-scaled-e1756648705691.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Action-0H5A3520-scaled.jpg",
        ),
        firstBtccYear = 1992,
        qualifyingRecord = LapRecord("Rory Butcher",   "50.451s", "90.40 mph", 2019),
        raceRecord       = LapRecord("Ashley Sutton",  "50.876s", "89.65 mph", 2020),
    ),
    TrackInfo(
        round = 7,
        venue = "Donington Park GP",
        location = "Castle Donington, Leicestershire",
        country = "England",
        lengthMiles = "2.500 mi",
        lengthKm = "4.023 km",
        corners = 12,
        about = "The full Grand Prix layout extends the National circuit with the Melbourne Loop and the Foggy/Goddards complex, significantly increasing lap length and introducing additional technical challenge. The extra section adds meaningful overtaking opportunities and changes the strategic picture for tyre management. It last hosted a Formula 1 race in 1993.",
        btccFact = "Donington GP provides a fascinating contrast with Round 1 at the same venue — drivers who struggled on the National loop earlier in the season can find the extra GP section suits their driving style far better.",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Donington-DG5_2477-1.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2022/11/Donington-GP-detailed-map-1.png",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/08/Chilton-0Q3A4225-scaled-e1756572398593.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Ingram-0Q3A7130-scaled-e1756567883972.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Proctor-0Q3A6761-scaled-e1756548987153.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Hill-1-0H5A7167-scaled-e1756474426795.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Chilton-0H5A4432.jpg",
        ),
        firstBtccYear = 1986,
        qualifyingRecord = LapRecord("Ashley Sutton", "1:33.154", "96.12 mph", 2023),
        raceRecord       = LapRecord("Tom Ingram",    "1:33.621", "95.64 mph", 2025),
    ),
    TrackInfo(
        round = 8,
        venue = "Croft",
        location = "Dalton-on-Tees, North Yorkshire",
        country = "England",
        lengthMiles = "2.127 mi",
        lengthKm = "3.424 km",
        corners = 13,
        about = "A classic British club circuit with roots going back to the 1960s, built on a former RAF airfield in North Yorkshire. Croft combines fast sections with tight chicanes and the iconic Tower Hairpin — one of the best overtaking spots on the calendar. Its relative geographical isolation gives it a distinct, grassroots motorsport atmosphere.",
        btccFact = "Tower Hairpin at Croft is consistently one of the best places for late-braking overtakes in the BTCC, and it regularly produces race-defining moments.",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Croft-A27I9730-1-scaled.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/5-Croft-1.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/09/Plato-0H5A4492-scaled-e1758724319601.jpg",
            "https://btcc.net/wp-content/uploads/2025/09/Hill-0Q3A4314-scaled-e1758718770643.jpg",
            "https://btcc.net/wp-content/uploads/2025/09/Cosworth-0Q3A0458-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/08/Goodyear-0H5A4463-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2024/07/Croft-A27I9730-scaled.jpg",
        ),
        firstBtccYear = 1968,
        qualifyingRecord = LapRecord("Tom Ingram", "1:20.522", "95.85 mph", 2025),
        raceRecord       = LapRecord("Tom Ingram", "1:21.374", "94.24 mph", 2025),
    ),
    TrackInfo(
        round = 9,
        venue = "Silverstone",
        location = "Towcester, Northamptonshire",
        country = "England",
        lengthMiles = "3.666 mi",
        lengthKm = "5.891 km",
        corners = 18,
        about = "The home of British motorsport. Silverstone's Grand Prix circuit is the longest and fastest on the BTCC calendar, demanding aerodynamic efficiency and high-speed confidence throughout its many quick corners. Maggotts–Becketts–Chapel is one of the great sequences in world motorsport, taken flat in qualifying trim. Abbey, The Loop, and Village provide overtaking opportunities.",
        btccFact = "Silverstone is where championship battles are frequently decided. The points available at this penultimate round mean that going into the Brands Hatch finale with a significant lead — or deficit — can completely shape the outcome.",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/9-Silverstone.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/9-Silverstone.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/10/Rainford-0Q3A3688-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/10/DeLeon-0H5A1979-scaled-e1760521629921.jpg",
            "https://btcc.net/wp-content/uploads/2025/10/Doble-0H5A3840-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/09/Hill-0Q3A4314-scaled-e1758718770643.jpg",
            "https://btcc.net/wp-content/uploads/2024/03/9-Silverstone.jpg",
        ),
        firstBtccYear = 1959,
        qualifyingRecord = LapRecord("Daryl DeLeon", "56.734s", "105.43 mph", 2025),
        raceRecord       = LapRecord("Tom Ingram",   "56.875s", "105.43 mph", 2025),
    ),
    TrackInfo(
        round = 10,
        venue = "Brands Hatch GP",
        location = "Fawkham, Kent",
        country = "England",
        lengthMiles = "2.430 mi",
        lengthKm = "3.908 km",
        corners = 11,
        about = "The season finale. The full Grand Prix circuit adds Hawthorns, Westfield, Dingle Dell, and Stirlings to the Indy loop, creating one of the most spectacular circuits in Britain. Paddock Hill Bend on the opening lap of the finale race has been the scene of some of the most dramatic championship-deciding moments in BTCC history.",
        btccFact = "A Brands Hatch GP BTCC finale is one of the highlights of the British motorsport calendar. With reverse-grid races and three separate races across the weekend, the championship result is rarely decided until the very last lap.",
        imageUrl = "https://btcc.net/wp-content/uploads/2024/03/Brands-Hatch1-2.jpg",
        layoutImageUrl = "https://btcc.net/wp-content/uploads/2024/03/10-Brands-GP.jpg",
        raceImages = listOf(
            "https://btcc.net/wp-content/uploads/2025/10/Doble-0H5A4603-scaled-e1760695111593.jpg",
            "https://btcc.net/wp-content/uploads/2025/10/DeLeon-0Q3A1132-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/10/Rainford-00Q3A3662-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/10/doble-0H5A6139-scaled.jpg",
            "https://btcc.net/wp-content/uploads/2025/10/DeLeon-0H5A1821-scaled.jpg",
        ),
        firstBtccYear = 1960,
        qualifyingRecord = LapRecord("Charles Rainford", "1:28.919", "99.41 mph", 2025),
        raceRecord       = LapRecord("Ashley Sutton",    "1:30.244", "97.06 mph", 2023),
    ),
).associateBy { it.round }

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

private val races2026 = listOf(
    Race(1,  "Donington Park",    LocalDate.of(2026, 4,  18), LocalDate.of(2026, 4,  19)),
    Race(2,  "Brands Hatch Indy", LocalDate.of(2026, 5,  9),  LocalDate.of(2026, 5,  10)),
    Race(3,  "Snetterton",        LocalDate.of(2026, 5,  23), LocalDate.of(2026, 5,  24)),
    Race(4,  "Oulton Park",       LocalDate.of(2026, 6,  6),  LocalDate.of(2026, 6,  7)),
    Race(5,  "Thruxton",          LocalDate.of(2026, 7,  25), LocalDate.of(2026, 7,  26)),
    Race(6,  "Knockhill",         LocalDate.of(2026, 8,  8),  LocalDate.of(2026, 8,  9)),
    Race(7,  "Donington Park GP", LocalDate.of(2026, 8,  22), LocalDate.of(2026, 8,  23)),
    Race(8,  "Croft",             LocalDate.of(2026, 9,  5),  LocalDate.of(2026, 9,  6)),
    Race(9,  "Silverstone",       LocalDate.of(2026, 9,  26), LocalDate.of(2026, 9,  27)),
    Race(10, "Brands Hatch GP",   LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11)),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackDetailScreen(round: Int, onBack: () -> Unit) {
    val info = trackInfoMap[round] ?: return
    val race = races2026.find { it.round == round } ?: return
    val today = LocalDate.now()
    val daysUntil = ChronoUnit.DAYS.between(today, race.startDate)

    var sessions by remember { mutableStateOf<List<RaceSession>>(emptyList()) }
    LaunchedEffect(round) {
        val schedule = ScheduleRepository.getSchedule()
        sessions = schedule[round] ?: emptyList()
    }

    val lightboxIndex = remember { mutableStateOf<Int?>(null) }
    // hero image is index 0, race images follow
    val allImages = remember(info) {
        buildList {
            if (info.imageUrl.isNotEmpty()) add(info.imageUrl)
            addAll(info.raceImages)
        }
    }

    Box(Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                "ROUND $round",
                                style = MaterialTheme.typography.labelSmall,
                                color = BtccYellow,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 1.5.sp,
                            )
                            Text(
                                info.venue,
                                fontWeight = FontWeight.Black,
                                fontSize = 18.sp,
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = MaterialTheme.colorScheme.onBackground,
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
                )
            },
            containerColor = BtccBackground,
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            ) {
                // ── Hero circuit image ─────────────────────────────────────────
                if (info.imageUrl.isNotEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .clickable { lightboxIndex.value = 0 },
                    ) {
                        AsyncImage(
                            model = info.imageUrl,
                            contentDescription = info.venue,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                        // Gradient fade to background at the bottom
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(100.dp)
                                .align(Alignment.BottomCenter)
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Color.Transparent, BtccBackground),
                                    )
                                )
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .padding(horizontal = 16.dp)
                        .padding(top = if (info.imageUrl.isEmpty()) 12.dp else 0.dp, bottom = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {

                // ── Event date card ────────────────────────────────────────────
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            Brush.linearGradient(listOf(BtccYellow.copy(alpha = 0.15f), Color.Transparent)),
                            RoundedCornerShape(16.dp),
                        )
                        .border(1.dp, BtccYellow.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                        .padding(16.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "${race.startDate.format(dateFormat)} – ${race.endDate.format(shortDateFormat)}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onBackground,
                            )
                            Text(
                                "${info.location} · ${info.country}",
                                style = MaterialTheme.typography.bodySmall,
                                color = BtccTextSecondary,
                                modifier = Modifier.padding(top = 3.dp),
                            )
                        }
                        when {
                            daysUntil < 0 -> Surface(color = BtccOutline, shape = RoundedCornerShape(20.dp)) {
                                Text("DONE", modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.ExtraBold,
                                    color = MaterialTheme.colorScheme.onBackground)
                            }
                            daysUntil == 0L -> Text("TODAY", fontWeight = FontWeight.Black,
                                fontSize = 16.sp, color = BtccYellow)
                            daysUntil == 1L -> Text("TMW", fontWeight = FontWeight.Black,
                                fontSize = 16.sp, color = BtccYellow)
                            else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$daysUntil", style = MaterialTheme.typography.headlineMedium,
                                    fontWeight = FontWeight.Black,
                                    color = MaterialTheme.colorScheme.onBackground, lineHeight = 36.sp)
                                Text("DAYS", style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold, color = BtccTextSecondary)
                            }
                        }
                    }
                }

                // ── Stats row ──────────────────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    StatChip(label = "LENGTH",  value = info.lengthKm.substringBefore(' '), sub = "km · ${info.lengthMiles}", modifier = Modifier.weight(1f))
                    StatChip(label = "CORNERS", value = "${info.corners}",   sub = "corners",        modifier = Modifier.weight(1f))
                    if (info.firstBtccYear != null) {
                        StatChip(label = "BTCC SINCE", value = "${info.firstBtccYear}", sub = "first race", modifier = Modifier.weight(1f))
                    }
                }

                // ── Lap records ────────────────────────────────────────────────
                if (info.qualifyingRecord != null || info.raceRecord != null) {
                    LapRecordCard(qualifying = info.qualifyingRecord, race = info.raceRecord)
                }

                // ── Weekend timetable ──────────────────────────────────────────
                if (sessions.isNotEmpty()) {
                    TimetableCard(sessions = sessions, raceStartDate = race.startDate)
                }

                // ── Circuit layout ─────────────────────────────────────────────
                if (info.layoutImageUrl.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "CIRCUIT LAYOUT",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = BtccTextSecondary,
                            letterSpacing = 1.5.sp,
                        )
                        AsyncImage(
                            model = info.layoutImageUrl,
                            contentDescription = "${info.venue} circuit layout",
                            contentScale = ContentScale.FillWidth,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(BtccCard, RoundedCornerShape(12.dp))
                                .clip(RoundedCornerShape(12.dp)),
                        )
                    }
                }

                // ── Race photo gallery ─────────────────────────────────────────
                if (info.raceImages.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            "RACE PHOTOS",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color = BtccTextSecondary,
                            letterSpacing = 1.5.sp,
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            itemsIndexed(info.raceImages) { index, url ->
                                // hero is index 0 in allImages, race photos start at 1
                                val lightboxIdx = if (info.imageUrl.isNotEmpty()) index + 1 else index
                                AsyncImage(
                                    model = url,
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .width(220.dp)
                                        .height(130.dp)
                                        .clip(RoundedCornerShape(10.dp))
                                        .clickable { lightboxIndex.value = lightboxIdx },
                                )
                            }
                        }
                    }
                }

                // ── About ──────────────────────────────────────────────────────
                InfoCard(title = "ABOUT THE CIRCUIT", body = info.about)

                // ── BTCC fact ──────────────────────────────────────────────────
                InfoCard(title = "BTCC AT ${info.venue.uppercase()}", body = info.btccFact, highlight = true)

                Spacer(Modifier.height(8.dp))
                } // end inner Column
            }
        }

        // ── Lightbox overlay ───────────────────────────────────────────────────
        val idx = lightboxIndex.value
        if (idx != null && allImages.isNotEmpty()) {
            BackHandler { lightboxIndex.value = null }
            ImageLightbox(
                images = allImages,
                initialIndex = idx.coerceIn(0, allImages.lastIndex),
                onDismiss = { lightboxIndex.value = null },
            )
        }
    }
}

@Composable
private fun ImageLightbox(images: List<String>, initialIndex: Int, onDismiss: () -> Unit) {
    val pagerState = rememberPagerState(initialPage = initialIndex) { images.size }
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black)
            .systemBarsPadding()
    ) {
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize(),
        ) { page ->
            AsyncImage(
                model = images[page],
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }

        if (images.size > 1) {
            Surface(
                modifier = Modifier
                    .align(Alignment.TopCenter)
                    .padding(top = 16.dp),
                color = Color.Black.copy(alpha = 0.55f),
                shape = MaterialTheme.shapes.small,
            ) {
                Text(
                    text = "${pagerState.currentPage + 1} / ${images.size}",
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
        }

        IconButton(
            onClick = onDismiss,
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(8.dp),
        ) {
            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
        }
    }
}

@Composable
private fun LapRecordCard(qualifying: LapRecord?, race: LapRecord?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "LAP RECORDS",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.ExtraBold,
            color = BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )
        if (qualifying != null) {
            LapRecordRow(label = "QUALIFYING", record = qualifying)
        }
        if (qualifying != null && race != null) {
            HorizontalDivider(color = BtccOutline)
        }
        if (race != null) {
            LapRecordRow(label = "RACE", record = race)
        }
    }
}

@Composable
private fun LapRecordRow(label: String, record: LapRecord) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                label,
                style = MaterialTheme.typography.labelSmall,
                color = BtccYellow,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.sp,
            )
            Text(
                record.driver,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                "${record.speed} · ${record.year}",
                style = MaterialTheme.typography.bodySmall,
                color = BtccTextSecondary,
            )
        }
        Text(
            record.time,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Black,
            color = MaterialTheme.colorScheme.onBackground,
        )
    }
}

@Composable
private fun TimetableCard(sessions: List<RaceSession>, raceStartDate: LocalDate) {
    // SAT = raceStartDate - 1, SUN = raceStartDate
    val today = LocalDate.now()
    val satDate = raceStartDate.minusDays(1)
    val sunDate = raceStartDate

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "WEEKEND TIMETABLE",
            style         = MaterialTheme.typography.labelSmall,
            fontWeight    = FontWeight.ExtraBold,
            color         = BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )

        val grouped = sessions.groupBy { it.day }
        listOf("SAT" to satDate, "SUN" to sunDate).forEach { (dayKey, date) ->
            val daySessions = grouped[dayKey] ?: return@forEach
            val isToday = today == date

            // Day header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    dayKey,
                    style         = MaterialTheme.typography.labelSmall,
                    fontWeight    = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    color         = if (isToday) BtccYellow else BtccTextSecondary,
                )
                Text(
                    date.format(shortDateFormat),
                    style  = MaterialTheme.typography.labelSmall,
                    color  = BtccTextSecondary,
                )
                if (isToday) {
                    Box(
                        modifier = Modifier
                            .background(BtccYellow, RoundedCornerShape(4.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp),
                    ) {
                        Text(
                            "TODAY",
                            style      = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.ExtraBold,
                            color      = androidx.compose.ui.graphics.Color.Black,
                            fontSize   = 9.sp,
                        )
                    }
                }
            }

            // Sessions for this day
            daySessions.forEach { session ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        session.name,
                        style    = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                        color    = MaterialTheme.colorScheme.onBackground,
                    )
                    Text(
                        session.time,
                        style      = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Bold,
                        color      = if (session.time == "TBA") BtccTextSecondary else MaterialTheme.colorScheme.onBackground,
                    )
                }
            }

            if (dayKey == "SAT" && grouped.containsKey("SUN")) {
                HorizontalDivider(color = BtccOutline)
            }
        }
    }
}

@Composable
private fun StatChip(label: String, value: String, sub: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(vertical = 14.dp, horizontal = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = BtccTextSecondary,
            fontWeight = FontWeight.ExtraBold,
            letterSpacing = 1.sp,
        )
        Text(
            value,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Black,
            color = BtccYellow,
            modifier = Modifier.padding(top = 4.dp),
        )
        Text(
            sub,
            style = MaterialTheme.typography.labelSmall,
            color = BtccTextSecondary,
        )
    }
}

@Composable
private fun InfoCard(title: String, body: String, highlight: Boolean = false) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .then(
                if (highlight) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
                else Modifier
            )
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            title,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.ExtraBold,
            color = if (highlight) BtccYellow else BtccTextSecondary,
            letterSpacing = 1.5.sp,
        )
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.85f),
            lineHeight = 22.sp,
        )
    }
}
