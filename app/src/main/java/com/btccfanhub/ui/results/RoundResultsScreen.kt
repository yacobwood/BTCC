package com.btccfanhub.ui.results

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.ui.viewinterop.AndroidView
import com.btccfanhub.data.model.DriverResult
import com.btccfanhub.data.model.RaceEntry
import com.btccfanhub.data.repository.RaceResultsRepository
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

    LaunchedEffect(year, round) {
        loading = true
        val results = if (year == 2025) {
            RaceResultsRepository.getResults2025()
        } else {
            RaceResultsRepository.getResults()
        }
        roundResult = results.find { it.round == round }
        loading = false
    }

    val races = roundResult?.races ?: emptyList()
    val pageCount = races.size.coerceAtLeast(1)
    val pagerState = rememberPagerState(pageCount = { pageCount })

    Scaffold(
        containerColor = BtccBackground,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            roundResult?.venue ?: "Round $round",
                            fontWeight    = FontWeight.Black,
                            fontSize      = 17.sp,
                            letterSpacing = 0.5.sp,
                        )
                        Text(
                            "ROUND $round · ${roundResult?.date ?: ""}",
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
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                loading -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = BtccYellow)
                    }
                }
                races.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            "No results available for this round.",
                            color     = BtccTextSecondary,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
                else -> {
                    val context = LocalContext.current
                    
                    var selectedVideoType by remember { mutableStateOf<String?>(null) }
                    val highlightsUrl = roundResult?.highlightsUrl
                    val fullRacesUrl = roundResult?.fullRacesUrl
                    
                    val activeUrl = when (selectedVideoType) {
                        "full_races" -> fullRacesUrl
                        "highlights" -> highlightsUrl
                        else -> null
                    }
                    
                    if (highlightsUrl != null || fullRacesUrl != null) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (highlightsUrl != null) {
                                VideoToggleButton(
                                    text = "HIGHLIGHTS",
                                    icon = Icons.Default.PlayCircle,
                                    isSelected = selectedVideoType == "highlights",
                                    onClick = { selectedVideoType = "highlights" },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                            if (fullRacesUrl != null) {
                                VideoToggleButton(
                                    text = "FULL RACES",
                                    icon = Icons.Default.PlayCircle,
                                    isSelected = selectedVideoType == "full_races",
                                    onClick = { selectedVideoType = "full_races" },
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        
                        if (activeUrl != null) {
                            val videoId = extractYouTubeVideoId(activeUrl)
                            if (videoId != null) {
                                YouTubePlayer(
                                    videoId  = videoId,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .aspectRatio(16f / 9f)
                                        .padding(horizontal = 16.dp)
                                        .background(Color.Black, RoundedCornerShape(10.dp))
                                )
                            } else {
                                // fallback: open externally
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 16.dp, vertical = 8.dp)
                                        .background(Color(0xFF1A0000), RoundedCornerShape(10.dp))
                                        .border(1.dp, Color(0xFFFF0000).copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                                        .clickable {
                                            context.startActivity(
                                                Intent(Intent.ACTION_VIEW, Uri.parse(activeUrl))
                                            )
                                        }
                                        .padding(horizontal = 16.dp, vertical = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                ) {
                                    Icon(
                                        Icons.Default.PlayCircle,
                                        contentDescription = null,
                                        tint     = Color(0xFFFF0000),
                                        modifier = Modifier.size(24.dp),
                                    )
                                    Text(
                                        if (activeUrl == fullRacesUrl) "WATCH FULL RACES" else "WATCH HIGHLIGHTS",
                                        fontWeight    = FontWeight.ExtraBold,
                                        fontSize      = 13.sp,
                                        letterSpacing = 1.sp,
                                        color         = Color.White,
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
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))

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
                        RaceResultsList(races[page])
                    }
                }
            }
        }
    }
}

/** Extracts the YouTube video ID from a watch or short URL. */
private fun extractYouTubeVideoId(url: String): String? {
    // Handles: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    val patterns = listOf(
        Regex("""[?&]v=([a-zA-Z0-9_-]{11})"""),
        Regex("""youtu\.be/([a-zA-Z0-9_-]{11})"""),
        Regex("""youtube\.com/embed/([a-zA-Z0-9_-]{11})"""),
    )
    for (pattern in patterns) {
        val match = pattern.find(url)
        if (match != null) return match.groupValues[1]
    }
    return null
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
private fun YouTubePlayer(videoId: String, modifier: Modifier = Modifier) {
    val embedHtml = """
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <style>
              body, html { margin: 0; padding: 0; background-color: #000; height: 100%; width: 100%; overflow: hidden; }
              iframe { width: 100%; height: 100%; border: none; }
            </style>
          </head>
          <body>
            <iframe
              src="https://www.youtube.com/embed/${'$'}videoId?autoplay=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=https://www.youtube.com"
              allow="autoplay; encrypted-media"
              allowfullscreen>
            </iframe>
          </body>
        </html>
    """.trimIndent()

    AndroidView(
        modifier = modifier,
        factory  = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled    = true
                settings.loadWithOverviewMode = true
                settings.useWideViewPort      = true
                settings.domStorageEnabled    = true
                settings.mediaPlaybackRequiresUserGesture = false
                webViewClient   = WebViewClient()
                webChromeClient = WebChromeClient()
                loadDataWithBaseURL("https://www.youtube.com", embedHtml, "text/html", "utf-8", null)
            }
        },
        update = { webView ->
            webView.loadDataWithBaseURL("https://www.youtube.com", embedHtml, "text/html", "utf-8", null)
        },
    )
}

@Composable
private fun VideoToggleButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bgColor = if (isSelected) Color(0xFFFF0000) else Color(0xFF1A0000)
    val contentColor = if (isSelected) Color.White else Color(0xFFFF0000).copy(alpha = 0.7f)
    val borderColor = if (isSelected) Color(0xFFFF0000) else Color(0xFFFF0000).copy(alpha = 0.3f)

    Row(
        modifier = modifier
            .background(bgColor, RoundedCornerShape(8.dp))
            .border(1.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text,
            color = contentColor,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 11.sp,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
private fun RaceResultsList(race: RaceEntry) {
    if (race.results.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No results available.", color = BtccTextSecondary)
        }
        return
    }
    LazyColumn(
        contentPadding      = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        items(race.results) { result ->
            DriverResultRow(result)
        }
    }
}

@Composable
private fun DriverResultRow(result: DriverResult) {
    val posColor = when (result.position) {
        1    -> Color(0xFFFFD700)
        2    -> Color(0xFFC0C0C0)
        3    -> Color(0xFFCD7F32)
        else -> BtccOutline
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Position
        Text(
            if (result.position > 0) "${result.position}" else "DNF",
            style      = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Black,
            color      = posColor,
            modifier   = Modifier.width(32.dp),
            textAlign  = TextAlign.Center,
        )

        // Driver + team
        Column(modifier = Modifier.weight(1f)) {
            Text(
                result.driver,
                fontWeight = FontWeight.Bold,
                style      = MaterialTheme.typography.bodyMedium,
            )
            Text(
                result.team,
                style = MaterialTheme.typography.bodySmall,
                color = BtccTextSecondary,
            )
        }

        // Gap / time + points
        Column(horizontalAlignment = Alignment.End) {
            Text(
                result.gap ?: result.time,
                fontWeight = FontWeight.ExtraBold,
                fontSize   = 13.sp,
                color      = if (result.gap == null) BtccYellow else MaterialTheme.colorScheme.onBackground,
            )
            if (result.points > 0) {
                Text(
                    "+${result.points} pts",
                    style = MaterialTheme.typography.labelSmall,
                    color = BtccTextSecondary,
                )
            }
        }
    }
}
