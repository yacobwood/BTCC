package com.btcchub.ui.news

import android.graphics.Color as AndroidColor
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import com.btcchub.data.ArticleHolder
import com.btcchub.data.network.RssParser
import com.btcchub.ui.theme.BtccBackground
import com.btcchub.ui.theme.BtccYellow
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun ArticleScreen(onBack: () -> Unit) {
    val article = ArticleHolder.current
    val lightboxIndex = remember { mutableStateOf<Int?>(null) }
    val imageUrls = remember { mutableStateOf<List<String>>(emptyList()) }
    var htmlToLoad by remember { mutableStateOf<String?>(null) }
    val loadGuard = remember { object { var loaded: String? = null } }

    LaunchedEffect(article) {
        if (article == null) {
            htmlToLoad = "<html><body style='background:#0B0C0F;color:#fff;padding:16px'>No content available.</body></html>"
            return@LaunchedEffect
        }

        val sanitised = sanitiseContent(article.content)

        val finalUrls: List<String>
        val finalContent: String

        val nggScriptImages = extractNggScriptImages(sanitised)

        if (nggScriptImages.isNotEmpty()) {
            val stripped = sanitised
                .replace(Regex("""<noscript\b[^>]*>.*?</noscript>""",
                    setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)), "")
                .replace(Regex("""<img\b[^>]*>""", RegexOption.IGNORE_CASE), "")
            finalUrls = nggScriptImages
            finalContent = stripped + nggScriptImages.mapIndexed { i, url ->
                """<a href="app-image://$i"><img src="$url"></a>"""
            }.joinToString("\n")
        } else {
            val (processedContent, urls) = prepareImages(sanitised)

            if (urls.isEmpty()) {
                val attachmentUrls = if (article.id != 0) {
                    withContext(Dispatchers.IO) { RssParser.fetchGalleryImages(article.id) }
                } else emptyList()
                val galleryUrls = attachmentUrls.ifEmpty {
                    withContext(Dispatchers.IO) { RssParser.fetchPageImages(article.link) }
                }
                val dedupedGalleryUrls = deduplicateNggImages(galleryUrls)
                if (dedupedGalleryUrls.isNotEmpty()) {
                    finalUrls = dedupedGalleryUrls
                    finalContent = processedContent + dedupedGalleryUrls.mapIndexed { i, url ->
                        """<a href="app-image://$i"><img src="$url"></a>"""
                    }.joinToString("\n")
                } else {
                    finalUrls = emptyList()
                    finalContent = processedContent
                }
            } else {
                finalUrls = urls
                finalContent = processedContent
            }
        }

        val withPosters = if (article.imageUrl != null) {
            addVideoPoster(finalContent, article.imageUrl)
        } else finalContent

        imageUrls.value = finalUrls
        htmlToLoad = buildHtml(article.title, article.pubDate, withPosters, article.imageUrl)
    }

    Box(Modifier.fillMaxSize().background(BtccBackground)) {
        if (htmlToLoad == null) {
            CircularProgressIndicator(
                color = BtccYellow,
                modifier = Modifier.size(36.dp).align(Alignment.Center),
            )
        }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
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
                    settings.javaScriptEnabled = true
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = false
                    setBackgroundColor(AndroidColor.parseColor("#0B0C0F"))
                }
            },
            update = { webView ->
                val html = htmlToLoad ?: return@AndroidView
                if (html != loadGuard.loaded) {
                    loadGuard.loaded = html
                    webView.loadDataWithBaseURL("https://www.btcc.net", html, "text/html", "UTF-8", null)
                }
            }
        )

        IconButton(
            onClick = onBack,
            modifier = Modifier
                .statusBarsPadding()
                .padding(4.dp)
                .background(Color.Black.copy(alpha = 0.4f), CircleShape),
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
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

// Extract image URLs and wrap each <img> with an app-image:// link so taps open the lightbox.
// Handles WordPress lazy-loading where the real URL is in data-src / data-lazy-src and src
// is a base64 placeholder.
private fun prepareImages(sanitised: String): Pair<String, List<String>> {
    val urls = mutableListOf<String>()
    val seenUrls = mutableSetOf<String>()
    val seenNggIds = mutableSetOf<String>()
    val nggIdRegex = Regex("""nggid(\d+)""", RegexOption.IGNORE_CASE)

    val processed = Regex("""<img\b([^>]*)>""", setOf(RegexOption.IGNORE_CASE)).replace(sanitised) { match ->
        val attrs = match.groupValues[1]

        fun attr(name: String) = Regex("""$name="([^"]+)"""").find(attrs)?.groupValues?.get(1)
            ?: Regex("""$name='([^']+)'""").find(attrs)?.groupValues?.get(1)

        val rawSrc = attr("src")
        val dataSrc = attr("data-src") ?: attr("data-lazy-src") ?: attr("data-original")
        val src = when {
            dataSrc != null                               -> dataSrc
            rawSrc != null && !rawSrc.startsWith("data:") -> rawSrc
            else                                          -> null
        }

        if (src != null) {
            val resolved = if (src.startsWith("http")) src else "https://www.btcc.net$src"
            if (!seenUrls.add(resolved)) return@replace ""  // exact duplicate

            // NGG "thumbs" variant (.../thumbs/thumbs-image.jpg) — original comes separately, skip
            if ("/thumbs/thumbs-" in resolved) return@replace ""

            val nggId = nggIdRegex.find(resolved)?.groupValues?.get(1)
            if (nggId != null) {
                // NGG cached image (nggid format): deduplicate by nggid, upgrade to full-size original.
                // Cached path: .../gallery/slug/cache/image.jpg-nggid001-ngg0dyn-0xHHH-...jpg
                // Original path: .../gallery/slug/image.jpg
                if (!seenNggIds.add(nggId)) return@replace ""
                val cacheIdx = resolved.indexOf("/cache/")
                val finalUrl = if (cacheIdx >= 0) {
                    val filename = resolved.substringAfterLast("/")
                    val nggIdx = filename.lowercase().indexOf("-nggid")
                    if (nggIdx >= 0) "${resolved.substring(0, cacheIdx)}/${filename.substring(0, nggIdx)}"
                    else resolved
                } else resolved
                urls.add(finalUrl)
                """<a href="app-image://${urls.size - 1}"><img src="$finalUrl"></a>"""
            } else {
                urls.add(resolved)
                """<a href="app-image://${urls.size - 1}"><img src="$resolved"></a>"""
            }
        } else {
            match.value
        }
    }
    return processed to urls
}

// Extract image URLs from NextGEN Gallery 3.x inline <script> JSON blocks.
// NGG renders a placeholder <div> + a <script> with image data rather than <img> tags.
private fun extractNggScriptImages(html: String): List<String> {
    val seen = linkedSetOf<String>()
    val imageExtRegex = Regex("""\.(?:jpe?g|png|webp|gif)\b""", RegexOption.IGNORE_CASE)
    for (scriptMatch in Regex(
        """<script\b[^>]*>(.*?)</script>""",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    ).findAll(html)) {
        val body = scriptMatch.groupValues[1]
        if (!body.contains("ngg", ignoreCase = true) &&
            !body.contains("gallery", ignoreCase = true)) continue
        for (m in Regex(""""([^"]+\.(?:jpe?g|png|webp|gif)[^"]*)"""", RegexOption.IGNORE_CASE).findAll(body)) {
            val v = m.groupValues[1].replace("\\/", "/")
            if (!v.startsWith("data:") &&
                (v.contains("wp-content/gallery") || v.contains("nggid")) &&
                imageExtRegex.containsMatchIn(v)) {
                val resolved = if (v.startsWith("http")) v
                               else if (v.startsWith("//")) "https:$v"
                               else "https://www.btcc.net$v"
                seen.add(resolved)
            }
        }
    }
    return deduplicateNggImages(seen.toList())
}

// Each NGG image appears at multiple cached resolutions AND as an original.
// Strategy: prefer original files (not in /cache/ subdirectory); if only cached exist, keep one per nggid.
private fun deduplicateNggImages(urls: List<String>): List<String> {
    // Always discard NGG thumbnail variants — originals (.../gallery/slug/image.jpg) come separately
    val withoutThumbs = urls.filter { "/thumbs/thumbs-" !in it }
    val originals = withoutThumbs.filter { "/cache/" !in it && "ngg0dyn" !in it }
    if (originals.isNotEmpty()) {
        // Deduplicate originals by lowercase filename (strips query strings too)
        return originals.distinctBy { it.substringAfterLast("/").substringBefore("?").lowercase() }
    }
    // All cached — keep one per nggid, or by filename if no nggid present
    val byKey = linkedMapOf<String, String>()
    val nggIdRegex = Regex("""nggid(\d+)""", RegexOption.IGNORE_CASE)
    for (url in withoutThumbs) {
        val key = nggIdRegex.find(url)?.groupValues?.get(1)
            ?: url.substringAfterLast("/").substringBefore("?").lowercase()
        if (key !in byKey) byKey[key] = url
    }
    return byKey.values.toList()
}

private fun addVideoPoster(html: String, posterUrl: String): String =
    Regex("""<video\b([^>]*)>""", RegexOption.IGNORE_CASE).replace(html) { match ->
        if (match.groupValues[1].contains("poster", ignoreCase = true)) match.value
        else "<video poster=\"$posterUrl\"${match.groupValues[1]}>"
    }

// Remove WordPress embedded styles, inline styles, sizing, and lazy-load attributes
private fun sanitiseContent(html: String): String =
    html
        .replace(Regex("<style[^>]*>.*?</style>", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)), "")
        .replace(Regex("""\s+style="[^"]*""""), "")
        .replace(Regex("""\s+style='[^']*'"""), "")
        .replace(Regex("""\s+(?:width|height|srcset|sizes|loading|decoding|fetchpriority)="[^"]*""""), "")
        .replace(Regex("""\s+(?:width|height|srcset|sizes|loading|decoding|fetchpriority)='[^']*'"""), "")

private fun buildHtml(title: String, pubDate: String, content: String, heroImageUrl: String? = null): String {
    val heroSection = if (heroImageUrl != null) """
        <div class="hero" style="background-image: url('$heroImageUrl');">
          <div class="hero-gradient"></div>
          <div class="hero-text">
            <h1 class="article-title">$title</h1>
            <p class="article-date">$pubDate</p>
          </div>
        </div>
    """ else """
        <div style="padding: 80px 16px 0;">
          <h1 class="article-title">$title</h1>
          <p class="article-date">$pubDate</p>
        </div>
    """

    return """
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
          overflow-x: hidden;
        }
        .hero {
          position: relative;
          width: 100%;
          min-height: 340px;
          background-size: cover;
          background-position: center;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .hero-gradient {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,0.7) 0%,
            transparent 30%,
            transparent 50%,
            rgba(11,12,15,0.95) 100%
          );
        }
        .hero-text {
          position: relative;
          z-index: 1;
          padding: 0 16px 20px;
        }
        .article-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 6px;
          line-height: 1.3;
        }
        .article-date {
          font-size: 13px;
          color: #8B949E;
        }
        .divider {
          height: 2px;
          background: #FEBD02;
          margin: 0 16px 20px;
          border-radius: 2px;
        }
        .content { padding: 0 16px 16px; }
        ul, ol {
          padding-left: 1.5em;
          background: rgba(255,255,255,0.05);
          border-left: 3px solid #FEBD02;
          border-radius: 6px;
          padding: 14px 14px 14px 28px;
          margin: 16px 0;
        }
        li { margin-bottom: 8px; color: #ccc; }
        li:last-child { margin-bottom: 0; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        img {
          width: 100% !important;
          height: auto !important;
          border-radius: 8px;
          margin: 12px 0;
          display: block;
          min-height: 120px;
          background: linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        img.loaded { min-height: 0; background: none; animation: none; }
        figure { width: 100% !important; }
        .wp-block-image, .wp-block-embed, .wp-block-gallery { width: 100% !important; }
        p { margin-bottom: 14px; }
        h2, h3, h4 { margin: 20px 0 8px; color: #FFFFFF; }
        a { color: #FEBD02; text-decoration: none; }
        a[href^="app-image://"] { display: block; color: inherit; }
        blockquote {
          border-left: 3px solid #FEBD02;
          padding-left: 14px;
          margin: 16px 0;
          color: #8B949E;
          font-style: italic;
        }
        figcaption { font-size: 12px; color: #8B949E; margin-top: 4px; }
        figure { margin: 12px 0; }
        .wp-block-image, .wp-block-embed { margin: 16px 0; }
        video {
          width: 100% !important;
          height: auto !important;
          border-radius: 8px;
          margin: 12px 0;
          display: block;
          background: #1a1a1a;
        }
        table {
          width: 100% !important;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
          overflow-x: auto;
          display: block;
        }
        th, td {
          border: 1px solid #333;
          padding: 6px 8px;
          text-align: center;
          white-space: nowrap;
        }
        th {
          background: rgba(255,255,255,0.1);
          font-weight: 700;
        }
        tr:nth-child(even) { background: rgba(255,255,255,0.04); }
        iframe { width: 100% !important; max-width: 100% !important; border: none; }
      </style>
    </head>
    <body>
      $heroSection
      <div class="divider"></div>
      <div class="content">
        $content
      </div>
      <script>
        document.querySelectorAll('img').forEach(function(img) {
          if (img.complete) { img.classList.add('loaded'); }
          else { img.addEventListener('load', function() { img.classList.add('loaded'); }); }
        });
      </script>
    </body>
    </html>
    """.trimIndent()
}
