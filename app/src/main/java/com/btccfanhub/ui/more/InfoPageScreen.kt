package com.btccfanhub.ui.more

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import com.btccfanhub.data.model.InfoPage
import com.btccfanhub.data.repository.PagesRepository
import com.btccfanhub.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InfoPageScreen(pageId: String, onBack: () -> Unit, onPageClick: (String) -> Unit = {}) {
    val context = LocalContext.current
    var page by remember { mutableStateOf<InfoPage?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(pageId) {
        page = PagesRepository.getPage(pageId)
        if (page == null) {
            PagesRepository.getPagesFromAssets(context)
            page = PagesRepository.getPage(pageId)
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
            )
        },
        containerColor = BtccBackground,
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
                Text("Page not found", color = BtccTextSecondary)
            }
            return@Scaffold
        }

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

            info.sections.forEach { block ->
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
                            color = BtccTextSecondary,
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
                                .clickable { onPageClick(block.url) }
                                .padding(vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                block.body,
                                color = BtccTextPrimary,
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                modifier = Modifier.weight(1f),
                            )
                            Icon(
                                Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = null,
                                tint = BtccTextSecondary,
                            )
                        }
                        HorizontalDivider(color = BtccOutline)
                    }
                    else -> {
                        Text(
                            block.body,
                            color = BtccTextPrimary,
                            fontSize = 15.sp,
                            lineHeight = 24.sp,
                            modifier = Modifier.padding(bottom = 12.dp),
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}
