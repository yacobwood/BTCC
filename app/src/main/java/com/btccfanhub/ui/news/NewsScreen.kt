package com.btccfanhub.ui.news

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.btccfanhub.R
import com.btccfanhub.data.FavouriteDriverStore
import com.btccfanhub.data.model.Article
import com.btccfanhub.data.Analytics
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccTextSecondary

@Composable
fun NewsScreen(
    onArticleClick: (Article) -> Unit,
    scrollToTopTrigger: Int = 0,
    viewModel: NewsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsState()
    val searchState by viewModel.searchState.collectAsState()
    val favName by FavouriteDriverStore.driver.collectAsState()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var searchActive by remember { mutableStateOf(false) }
    var searchQuery  by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }

    val favSurname = remember(favName) {
        favName?.split(" ")?.lastOrNull()?.lowercase()
    }

    val showScrollToTop by remember { derivedStateOf { listState.firstVisibleItemIndex > 0 } }

    LaunchedEffect(scrollToTopTrigger) {
        if (scrollToTopTrigger > 0) {
            searchActive = false
            searchQuery  = ""
            viewModel.clearSearch()
            listState.animateScrollToItem(0)
        }
    }

    LaunchedEffect(searchActive) {
        if (searchActive) focusRequester.requestFocus()
    }

    LaunchedEffect(searchQuery) {
        viewModel.search(searchQuery)
        if (searchQuery.length >= 3) Analytics.newsSearched(searchQuery)
    }

    // Trigger loadMore when within 4 items of the end (not during search)
    val shouldLoadMore by remember {
        derivedStateOf {
            if (searchQuery.isNotBlank()) return@derivedStateOf false
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            val total = listState.layoutInfo.totalItemsCount
            total > 0 && lastVisible >= total - 4
        }
    }
    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) viewModel.loadMore()
    }

    Box(modifier = Modifier.fillMaxSize().background(BtccBackground)) {
        when (val s = state) {
            is NewsState.Loading -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = BtccYellow, strokeWidth = 2.dp)
                }
            }

            is NewsState.Error -> {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        Text(s.message, color = BtccTextSecondary)
                        Button(
                            onClick = { viewModel.load() },
                            colors = ButtonDefaults.buttonColors(containerColor = BtccYellow, contentColor = BtccNavy),
                            shape = RoundedCornerShape(8.dp),
                        ) { Text("Retry", fontWeight = FontWeight.Bold) }
                    }
                }
            }

            is NewsState.Success -> {
                val articles      = s.articles
                val isLoadingMore = s.isLoadingMore

                Column(modifier = Modifier.fillMaxSize()) {
                    if (searchActive) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(BtccBackground)
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            TextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                placeholder = { Text("Search news…", color = BtccTextSecondary) },
                                singleLine = true,
                                modifier = Modifier.weight(1f).focusRequester(focusRequester),
                                colors = TextFieldDefaults.colors(
                                    focusedContainerColor   = BtccCard,
                                    unfocusedContainerColor = BtccCard,
                                    focusedIndicatorColor   = Color.Transparent,
                                    unfocusedIndicatorColor = Color.Transparent,
                                    cursorColor             = BtccYellow,
                                    focusedTextColor        = Color.White,
                                    unfocusedTextColor      = Color.White,
                                ),
                                shape = RoundedCornerShape(10.dp),
                                leadingIcon = {
                                    Icon(Icons.Default.Search, contentDescription = null, tint = BtccTextSecondary)
                                },
                            )
                            IconButton(onClick = { searchActive = false; searchQuery = ""; viewModel.clearSearch() }) {
                                Icon(Icons.Default.Close, contentDescription = "Close search", tint = BtccTextSecondary)
                            }
                        }
                    }

                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 20.dp),
                    ) {
                        if (searchQuery.isNotBlank()) {
                            // ── Server-side search results ─────────────────────
                            when (val ss = searchState) {
                                is SearchState.Loading -> {
                                    item {
                                        Box(
                                            Modifier.fillMaxWidth().padding(top = 64.dp),
                                            contentAlignment = Alignment.Center,
                                        ) {
                                            CircularProgressIndicator(color = BtccYellow, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
                                        }
                                    }
                                }
                                is SearchState.Results -> {
                                    if (ss.articles.isEmpty()) {
                                        item {
                                            Box(
                                                Modifier.fillMaxWidth().padding(top = 64.dp),
                                                contentAlignment = Alignment.Center,
                                            ) {
                                                Text("No results for \"$searchQuery\"", color = BtccTextSecondary)
                                            }
                                        }
                                    } else {
                                        item { Spacer(Modifier.height(8.dp)) }
                                        items(ss.articles) { article ->
                                            CompactCard(
                                                article = article,
                                                onClick = { Analytics.articleClicked(article.title, "search"); onArticleClick(article) },
                                                favouriteSurname = favSurname,
                                                modifier = Modifier
                                                    .padding(horizontal = 16.dp)
                                                    .padding(bottom = 10.dp),
                                            )
                                        }
                                    }
                                }
                                else -> {}
                            }
                        } else {
                            // ── Normal layout ─────────────────────────────────
                            if (articles.isNotEmpty()) {
                                item {
                                    HeroCard(
                                        article = articles[0],
                                        onRefresh = { viewModel.load() },
                                        onSearchClick = { searchActive = true },
                                        onClick = { Analytics.articleClicked(articles[0].title, "hero"); onArticleClick(articles[0]) },
                                    )
                                }
                            }

                            if (articles.size >= 3) {
                                item {
                                    Spacer(Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.padding(horizontal = 16.dp),
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    ) {
                                        GridCard(
                                            article = articles[1],
                                            onClick = { Analytics.articleClicked(articles[1].title, "grid"); onArticleClick(articles[1]) },
                                            modifier = Modifier.weight(1f),
                                        )
                                        GridCard(
                                            article = articles[2],
                                            onClick = { Analytics.articleClicked(articles[2].title, "grid"); onArticleClick(articles[2]) },
                                            modifier = Modifier.weight(1f),
                                        )
                                    }
                                }
                            }

                            if (articles.size > 3) {
                                item {
                                    Text(
                                        "MORE STORIES",
                                        modifier = Modifier.padding(start = 16.dp, top = 20.dp, bottom = 10.dp),
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = BtccTextSecondary,
                                        letterSpacing = 2.sp,
                                    )
                                }
                            }

                            val remaining = if (articles.size > 3) articles.drop(3) else emptyList()
                            items(remaining) { article ->
                                CompactCard(
                                    article = article,
                                    onClick = { Analytics.articleClicked(article.title, "list"); onArticleClick(article) },
                                    favouriteSurname = favSurname,
                                    modifier = Modifier
                                        .padding(horizontal = 16.dp)
                                        .padding(bottom = 10.dp),
                                )
                            }

                            if (isLoadingMore) {
                                item {
                                    Box(
                                        Modifier.fillMaxWidth().padding(vertical = 16.dp),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        CircularProgressIndicator(
                                            color       = BtccYellow,
                                            strokeWidth = 2.dp,
                                            modifier    = Modifier.size(24.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        AnimatedVisibility(
            visible = showScrollToTop,
            enter = fadeIn() + scaleIn(initialScale = 0.8f),
            exit  = fadeOut() + scaleOut(targetScale = 0.8f),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 16.dp),
        ) {
            SmallFloatingActionButton(
                onClick = { scope.launch { listState.animateScrollToItem(0) } },
                containerColor = BtccYellow,
                contentColor   = BtccNavy,
            ) {
                Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Scroll to top")
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card — full-bleed, 300dp tall, gradient overlay
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun HeroCard(article: Article, onRefresh: () -> Unit, onSearchClick: () -> Unit, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(340.dp)
            .clickable { onClick() },
    ) {
        if (article.imageUrl != null) {
            AsyncImage(
                model = article.imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }

        // Gradient: dark at top (for readability of header) + strong dark at bottom (for title)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = if (article.imageUrl != null) arrayOf(
                            0.0f to Color(0xCC000000),
                            0.2f to Color.Transparent,
                            0.5f to Color.Transparent,
                            0.72f to Color(0xCC000000),
                            1.0f to Color(0xE0000000),
                        ) else arrayOf(
                            0.0f to Color(0xCC000000),
                            0.2f to BtccYellow.copy(alpha = 0.45f),
                            1.0f to BtccBackground,
                        )
                    )
                )
        )

        // ── Floating header at top ────────────────────────────────────
        Row(
            modifier = Modifier
                .align(Alignment.TopStart)
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Image(
                painter = painterResource(R.drawable.logo_long),
                contentDescription = "BTCC",
                modifier = Modifier.height(38.dp),
                contentScale = ContentScale.Fit,
            )
            Spacer(Modifier.weight(1f))
            IconButton(
                onClick = onSearchClick,
                modifier = Modifier.size(36.dp),
            ) {
                Icon(Icons.Default.Search, contentDescription = "Search", tint = Color.White.copy(alpha = 0.7f))
            }
            IconButton(
                onClick = onRefresh,
                modifier = Modifier.size(36.dp),
            ) {
                Icon(Icons.Default.Refresh, contentDescription = "Refresh", tint = Color.White.copy(alpha = 0.7f))
            }
        }

        // ── Article info at bottom ────────────────────────────────────
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(horizontal = 16.dp, vertical = 20.dp),
        ) {
            if (article.category.isNotEmpty()) {
                Text(
                    article.category.uppercase(),
                    color = BtccYellow,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.5.sp,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
            }
            AutoSizeText(
                text = article.title,
                maxFontSize = 28.sp,
                minFontSize = 20.sp,
                maxLines = 3,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                lineHeight = 32.sp,
                style = TextStyle(
                    shadow = Shadow(
                        color = Color.Black,
                        offset = Offset(0f, 1f),
                        blurRadius = 10f,
                    ),
                ),
            )
            Spacer(Modifier.height(8.dp))
            Text(
                article.pubDate,
                style = MaterialTheme.typography.labelMedium,
                color = Color.White.copy(alpha = 0.55f),
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid card — half-width, image on top with gradient title overlay
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun GridCard(article: Article, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .height(180.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
            .clickable { onClick() },
    ) {
        if (article.imageUrl != null) {
            AsyncImage(
                model = article.imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = arrayOf(
                            0.0f to Color.Transparent,
                            0.35f to Color.Transparent,
                            0.7f to Color(0xE6000000),
                            1.0f to Color(0xF5000000),
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(10.dp),
        ) {
            Text(
                article.title,
                style = MaterialTheme.typography.bodySmall.copy(
                    shadow = Shadow(
                        color = Color.Black,
                        offset = Offset(0f, 1f),
                        blurRadius = 6f,
                    ),
                ),
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 18.sp,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                article.pubDate,
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.5f),
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact card — horizontal row, thumbnail left
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun CompactCard(
    article: Article,
    onClick: () -> Unit,
    favouriteSurname: String? = null,
    modifier: Modifier = Modifier,
) {
    val mentionsFav = favouriteSurname != null &&
            article.title.lowercase().contains(favouriteSurname)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
            .then(
                if (mentionsFav) Modifier.border(1.dp, BtccYellow.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                else Modifier
            )
            .clickable { onClick() }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (article.imageUrl != null) {
            AsyncImage(
                model = article.imageUrl,
                contentDescription = null,
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop,
            )
        } else {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(BtccYellow.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Text("BTCC", color = BtccYellow, fontWeight = FontWeight.Black, fontSize = 11.sp)
            }
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (article.category.isNotEmpty()) {
                    Text(
                        article.category.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = BtccYellow,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 0.5.sp,
                    )
                }
                if (mentionsFav) {
                    Icon(
                        Icons.Filled.Star,
                        contentDescription = "Your driver",
                        tint = BtccYellow,
                        modifier = Modifier.size(12.dp),
                    )
                }
            }
            if (article.category.isNotEmpty() || mentionsFav) Spacer(Modifier.height(3.dp))
            Text(
                article.title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 20.sp,
            )
            Spacer(Modifier.height(5.dp))
            Text(
                article.pubDate,
                style = MaterialTheme.typography.labelSmall,
                color = BtccTextSecondary,
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-sizing text — shrinks font to fit, then ellipsises at the minimum
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun AutoSizeText(
    text: String,
    maxFontSize: TextUnit,
    minFontSize: TextUnit,
    maxLines: Int,
    fontWeight: FontWeight,
    color: Color,
    lineHeight: TextUnit,
    style: TextStyle? = null,
    modifier: Modifier = Modifier,
) {
    var fontSize by remember(text) { mutableStateOf(maxFontSize) }
    var readyToDraw by remember(text) { mutableStateOf(false) }

    Text(
        text = text,
        style = style ?: TextStyle(),
        fontWeight = fontWeight,
        color = color,
        fontSize = fontSize,
        lineHeight = lineHeight * (fontSize.value / maxFontSize.value),
        maxLines = maxLines,
        overflow = if (fontSize <= minFontSize) TextOverflow.Ellipsis else TextOverflow.Clip,
        onTextLayout = { result ->
            if (result.hasVisualOverflow && fontSize > minFontSize) {
                fontSize = (fontSize.value - 1f).coerceAtLeast(minFontSize.value).sp
            } else {
                readyToDraw = true
            }
        },
        modifier = modifier.then(
            if (readyToDraw) Modifier else Modifier.drawWithContent { }
        ),
    )
}
