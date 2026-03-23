package com.btccfanhub.ui.more

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.btccfanhub.data.Analytics
import com.btccfanhub.data.model.ContentBlock
import com.btccfanhub.data.model.InfoPage
import com.btccfanhub.data.repository.PagesRepository
import com.btccfanhub.ui.theme.BtccYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoPageScreen(pageId: String, onBack: () -> Unit, onPageClick: (String) -> Unit = {}) {
    val context = LocalContext.current
    var page by remember { mutableStateOf<InfoPage?>(null) }
    var loading by remember { mutableStateOf(true) }
    var segments by remember { mutableStateOf<List<Any>>(emptyList()) }

    LaunchedEffect(pageId) {
        Analytics.screen("info_page:$pageId")
        page = PagesRepository.getPage(pageId)
        if (page == null) {
            PagesRepository.getPagesFromAssets(context)
            page = PagesRepository.getPage(pageId)
        }
        // Pre-process sections off the composition thread
        val sections = page?.sections ?: emptyList()
        segments = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            val result = mutableListOf<Any>()
            var i = 0
            while (i < sections.size) {
                val block = sections[i]
                if (block.type == "group-start") {
                    val group = mutableListOf<com.btccfanhub.data.model.ContentBlock>()
                    i++
                    while (i < sections.size && sections[i].type != "group-end") {
                        group.add(sections[i])
                        i++
                    }
                    result.add(group.toList())
                } else if (block.type != "group-end") {
                    result.add(block)
                }
                i++
            }
            result.toList()
        }
        loading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                windowInsets = WindowInsets(0),
                title = {
                    Text(
                        page?.title?.uppercase() ?: "",
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        letterSpacing = 1.sp,
                    )
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        if (loading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BtccYellow, modifier = Modifier.size(36.dp))
            }
            return@Scaffold
        }

        val info = page
        if (info == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("Page not found", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            return@Scaffold
        }

        // Pre-process: collect group-start..group-end ranges into sublists
        // (computed off the composition thread in LaunchedEffect above)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            HorizontalDivider(
                color = BtccYellow,
                thickness = 2.dp,
                modifier = Modifier.padding(bottom = 20.dp),
            )

            segments.forEach { segment ->
                when (segment) {
                    is ContentBlock -> BlockContent(segment, pageId, onPageClick)
                    is List<*> -> {
                        @Suppress("UNCHECKED_CAST")
                        val group = segment as List<ContentBlock>
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 4.dp, bottom = 8.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.background),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                            shape = RoundedCornerShape(8.dp),
                        ) {
                            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                                group.forEach { block -> BlockContent(block, pageId, onPageClick) }
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun BlockContent(block: ContentBlock, pageId: String, onPageClick: (String) -> Unit) {
    when (block.type) {
        "heading" -> {
            Text(
                block.body,
                color = BtccYellow,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
            )
        }
        "subheading" -> {
            Text(
                block.body,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                letterSpacing = 0.8.sp,
                modifier = Modifier.padding(top = 16.dp, bottom = 6.dp),
            )
        }
        "image" -> {
            if (block.url.isNotEmpty()) {
                AsyncImage(
                    model = block.url,
                    contentDescription = null,
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 12.dp),
                )
            }
        }
        "link" -> {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { Analytics.infoPageLinkClicked(pageId, block.url); onPageClick(block.url) }
                    .padding(vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    block.body,
                    color = MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        }
        else -> {
            Text(
                block.body,
                color = MaterialTheme.colorScheme.onBackground,
                fontSize = 15.sp,
                lineHeight = 24.sp,
                modifier = Modifier.padding(bottom = 12.dp),
            )
        }
    }
}
