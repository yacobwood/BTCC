package com.btccfanhub.ui.timing

import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveTimingScreen(onBack: () -> Unit) {
    var loading by remember { mutableStateOf(true) }
    var hasContent by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        if (hasContent) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(BtccYellow),
                            )
                        }
                        Text(
                            "LIVE TIMING",
                            fontWeight    = FontWeight.Black,
                            fontSize      = 18.sp,
                            letterSpacing = 1.sp,
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
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { context ->
                    WebView(context).apply {
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView, url: String) {
                                // Delay to let JS render before checking content
                                Handler(Looper.getMainLooper()).postDelayed({
                                    view.evaluateJavascript(
                                        "(function(){ return document.body ? document.body.innerText.trim().length : 0; })()"
                                    ) { result ->
                                        val len = result?.trim('"')?.toIntOrNull() ?: 0
                                        hasContent = len > 20
                                        loading = false
                                    }
                                }, 2000)
                            }
                        }
                        settings.javaScriptEnabled    = true
                        settings.domStorageEnabled    = true
                        settings.useWideViewPort      = true
                        settings.loadWithOverviewMode = true
                        settings.userAgentString      = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                        val html = """
                            <!DOCTYPE html><html><head>
                            <meta name="viewport" content="width=device-width,initial-scale=1">
                            <style>*{margin:0;padding:0}body{background:#1a1a1a}
                            iframe{width:100%;height:100vh;border:none;display:block}</style>
                            </head><body>
                            <iframe src="https://livetiming.tsl-timing.com/TOCA"
                                allow="fullscreen" scrolling="no"></iframe>
                            </body></html>
                        """.trimIndent()
                        loadDataWithBaseURL(
                            "https://www.btcc.net", html, "text/html", "UTF-8", null
                        )
                    }
                }
            )

            // Loading spinner
            if (loading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(BtccBackground),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = BtccYellow)
                }
            }

            // No session placeholder
            if (!loading && !hasContent) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(BtccBackground),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .size(72.dp)
                                .background(BtccCard, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Default.SignalCellularAlt,
                                contentDescription = null,
                                tint     = BtccTextSecondary,
                                modifier = Modifier.size(36.dp),
                            )
                        }
                        Spacer(Modifier.height(20.dp))
                        Text(
                            "NO LIVE SESSION",
                            fontWeight    = FontWeight.ExtraBold,
                            fontSize      = 16.sp,
                            letterSpacing = 1.sp,
                            color         = MaterialTheme.colorScheme.onBackground,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "Live timing is only available during\nrace weekend sessions.",
                            style     = MaterialTheme.typography.bodySmall,
                            color     = BtccTextSecondary,
                            textAlign = TextAlign.Center,
                            lineHeight = 20.sp,
                        )
                    }
                }
            }
        }
    }
}
