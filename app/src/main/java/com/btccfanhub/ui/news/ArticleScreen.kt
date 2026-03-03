package com.btccfanhub.ui.news

import android.graphics.Color as AndroidColor
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import com.btccfanhub.data.ArticleHolder

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArticleScreen(onBack: () -> Unit) {
    val article = ArticleHolder.current
    val lightboxIndex = remember { mutableStateOf<Int?>(null) }
    val imageUrls = remember { mutableStateOf<List<String>>(emptyList()) }

    Box(Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Text(
                            text = article?.title ?: "",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.background,
                    ),
                )
            }
        ) { padding ->
            AndroidView(
                modifier = Modifier.fillMaxSize().padding(padding),
                factory = { context ->
                    WebView(context).apply {
                        webViewClient = object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView,
                                request: WebResourceRequest,
                            ): Boolean {
                                val uri = request.url
                                if (uri?.scheme == "app-image") {
                                    lightboxIndex.value = uri.host?.toIntOrNull() ?: 0
                                    return true
                                }
                                return false
                            }
                        }
                        settings.javaScriptEnabled = false
                        settings.useWideViewPort = true
                        settings.loadWithOverviewMode = false
                        setBackgroundColor(AndroidColor.parseColor("#0B0C0F"))

                        val sanitised = article?.let { sanitiseContent(it.content) } ?: ""
                        val (processedContent, urls) = prepareImages(sanitised)
                        imageUrls.value = urls

                        val html = if (article != null) {
                            buildHtml(article.title, article.pubDate, processedContent)
                        } else {
                            "<html><body style='background:#0B0C0F;color:#fff;padding:16px'>No content available.</body></html>"
                        }

                        loadDataWithBaseURL("https://www.btcc.net", html, "text/html", "UTF-8", null)
                    }
                }
            )
        }

        val idx = lightboxIndex.value
        if (idx != null) {
            BackHandler { lightboxIndex.value = null }
            ImageLightbox(
                images = imageUrls.value,
                initialIndex = idx,
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

// Extract image URLs and wrap each <img> with an app-image:// link so taps open the lightbox
private fun prepareImages(sanitised: String): Pair<String, List<String>> {
    val urls = mutableListOf<String>()
    val processed = Regex("""<img\b([^>]*)>""", setOf(RegexOption.IGNORE_CASE)).replace(sanitised) { match ->
        val attrs = match.groupValues[1]
        val src = Regex("""src="([^"]+)"""").find(attrs)?.groupValues?.get(1)
            ?: Regex("""src='([^']+)'""").find(attrs)?.groupValues?.get(1)
        if (src != null) {
            val resolved = if (src.startsWith("http")) src else "https://www.btcc.net$src"
            urls.add(resolved)
            """<a href="app-image://${urls.size - 1}">${match.value}</a>"""
        } else {
            match.value
        }
    }
    return processed to urls
}

// Remove WordPress embedded styles, inline styles, and sizing attributes that cause overflow
private fun sanitiseContent(html: String): String =
    html
        .replace(Regex("<style[^>]*>.*?</style>", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)), "")
        .replace(Regex("""\s+style="[^"]*""""), "")
        .replace(Regex("""\s+style='[^']*'"""), "")
        .replace(Regex("""\s+(?:width|height|srcset|sizes)="[^"]*""""), "")
        .replace(Regex("""\s+(?:width|height|srcset|sizes)='[^']*'"""), "")

private fun buildHtml(title: String, pubDate: String, content: String): String = """
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html { overflow-x: hidden; max-width: 100vw; }
        * { box-sizing: border-box; margin: 0; padding: 0; max-width: 100% !important; }
        body {
          background-color: #0B0C0F;
          color: #FFFFFF;
          font-family: -apple-system, sans-serif;
          font-size: 16px;
          line-height: 1.7;
          padding: 16px;
          overflow-x: hidden;
        }
        h1.article-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 6px;
          line-height: 1.3;
        }
        .article-date {
          font-size: 13px;
          color: #8B949E;
          margin-bottom: 20px;
        }
        .divider {
          height: 2px;
          background: #E3000B;
          margin-bottom: 20px;
          border-radius: 2px;
        }
        img {
          width: 100% !important;
          height: auto !important;
          border-radius: 8px;
          margin: 12px 0;
          display: block;
        }
        figure { width: 100% !important; }
        .wp-block-image, .wp-block-embed, .wp-block-gallery { width: 100% !important; }
        p { margin-bottom: 14px; }
        h2, h3, h4 { margin: 20px 0 8px; color: #FFFFFF; }
        a { color: #E3000B; text-decoration: none; }
        a[href^="app-image://"] { display: block; color: inherit; }
        blockquote {
          border-left: 3px solid #E3000B;
          padding-left: 14px;
          margin: 16px 0;
          color: #8B949E;
          font-style: italic;
        }
        figcaption { font-size: 12px; color: #8B949E; margin-top: 4px; }
        figure { margin: 12px 0; }
        .wp-block-image, .wp-block-embed { margin: 16px 0; }
        iframe { display: none; }
      </style>
    </head>
    <body>
      <h1 class="article-title">$title</h1>
      <p class="article-date">$pubDate</p>
      <div class="divider"></div>
      $content
    </body>
    </html>
""".trimIndent()
