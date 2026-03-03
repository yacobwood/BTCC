package com.btccfanhub.ui.news

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.btccfanhub.data.model.Article
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccYellow
import com.btccfanhub.ui.theme.BtccTextSecondary

@Composable
fun NewsScreen(
    onArticleClick: (Article) -> Unit,
    viewModel: NewsViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsState()

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
                val articles = s.articles
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 20.dp),
                ) {
                    // ── Hero (header floats over it) ─────────────────────────
                    if (articles.isNotEmpty()) {
                        item {
                            HeroCard(
                                article = articles[0],
                                onRefresh = { viewModel.load() },
                                onClick = { onArticleClick(articles[0]) },
                            )
                        }
                    }

                    // ── 2-column grid (articles 1 & 2) ───────────────────────
                    if (articles.size >= 3) {
                        item {
                            Spacer(Modifier.height(10.dp))
                            Row(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                GridCard(
                                    article = articles[1],
                                    onClick = { onArticleClick(articles[1]) },
                                    modifier = Modifier.weight(1f),
                                )
                                GridCard(
                                    article = articles[2],
                                    onClick = { onArticleClick(articles[2]) },
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }

                    // ── Section label ────────────────────────────────────────
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

                    // ── Compact list (articles 3+) ────────────────────────────
                    val remaining = if (articles.size > 3) articles.drop(3) else emptyList()
                    items(remaining) { article ->
                        CompactCard(
                            article = article,
                            onClick = { onArticleClick(article) },
                            modifier = Modifier
                                .padding(horizontal = 16.dp)
                                .padding(bottom = 10.dp),
                        )
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card — full-bleed, 300dp tall, gradient overlay
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun HeroCard(article: Article, onRefresh: () -> Unit, onClick: () -> Unit) {
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

        // Gradient: dark at top (for readability of header) + dark at bottom (for title)
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colorStops = if (article.imageUrl != null) arrayOf(
                            0.0f to Color(0xCC000000),
                            0.25f to Color.Transparent,
                            0.5f to Color.Transparent,
                            1.0f to Color(0xF2000000),
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
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "BTCC",
                fontWeight = FontWeight.Black,
                fontSize = 26.sp,
                color = BtccYellow,
                letterSpacing = (-0.5).sp,
                modifier = Modifier.weight(1f),
            )
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
            Text(
                article.title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 32.sp,
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
                            0.45f to Color.Transparent,
                            1.0f to Color(0xEE000000),
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
                style = MaterialTheme.typography.bodySmall,
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
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(BtccCard)
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
            if (article.category.isNotEmpty()) {
                Text(
                    article.category.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = BtccYellow,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.5.sp,
                    modifier = Modifier.padding(bottom = 3.dp),
                )
            }
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
