package com.btccfanhub.ui.merch

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.data.model.FeaturedPartner
import com.btccfanhub.data.model.MerchItem
import com.btccfanhub.data.store.FeatureFlagsStore
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccOutline
import com.btccfanhub.ui.theme.BtccTextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopTheGridScreen(
    viewModel: MerchViewModel = viewModel(),
    onItemTap: (MerchItem) -> Unit = {},
    onBrowseDriversClick: () -> Unit = {},
    onBrowseTeamsClick: () -> Unit = {},
    onTeamClick: (String) -> Unit = {},
    onDriverClick: (Int) -> Unit = {},
) {
    val context = LocalContext.current
    val sortedDrivers     by viewModel.sortedDrivers.collectAsState()
    val sortedTeams       by viewModel.sortedTeams.collectAsState()
    val adSlots           by viewModel.adSlots.collectAsState()
    val premiumAdEnabled  by FeatureFlagsStore.shopPremiumAd.collectAsState(initial = false)
    val standardAdEnabled by FeatureFlagsStore.shopStandardAd.collectAsState(initial = false)

    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.screen("shop_the_grid")
    }

    val topAd    = if (premiumAdEnabled) adSlots.getOrNull(0) else null
    val bottomAd = if (standardAdEnabled) adSlots.getOrNull(1) else null
    val openUrl: (String) -> Unit = { url ->
        context.startActivity(
            Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        TopAppBar(
            windowInsets = WindowInsets(0),
            title = {
                Text("SHOP", fontWeight = FontWeight.Black, fontSize = 18.sp, letterSpacing = 1.sp)
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        Row(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .fillMaxSize()
                .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
        ) {
            // Left column: premium ad on top (when enabled), Drivers tile fills rest
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f).fillMaxHeight(),
            ) {
                if (premiumAdEnabled) {
                    AdSlot(
                        partner = topAd,
                        placeholderLabel = "PREMIUM AD SLOT",
                        placeholderSub = "Contact us to advertise here",
                        modifier = Modifier.fillMaxWidth().height(110.dp),
                        onTap = openUrl,
                    )
                }
                CategoryTile(
                    label = "DRIVERS",
                    sublabel = if (sortedDrivers.isNotEmpty()) "${sortedDrivers.size} drivers" else "Shop by driver",
                    imageUrl = sortedDrivers.firstOrNull()?.third?.ifEmpty { null },
                    gradient = listOf(BtccNavy, Color(0xFF05053A)),
                    onClick = onBrowseDriversClick,
                    modifier = Modifier.fillMaxWidth().weight(1f),
                )
            }

            // Right column: Teams tile fills most, standard ad on bottom (when enabled)
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.weight(1f).fillMaxHeight(),
            ) {
                CategoryTile(
                    label = "TEAMS",
                    sublabel = if (sortedTeams.isNotEmpty()) "${sortedTeams.size} teams" else "Shop by team",
                    imageUrl = null,
                    gradient = listOf(Color(0xFFE3000B), Color(0xFF5C0004)),
                    onClick = onBrowseTeamsClick,
                    modifier = Modifier.fillMaxWidth().weight(1f),
                )
                if (standardAdEnabled) {
                    AdSlot(
                        partner = bottomAd,
                        placeholderLabel = "STANDARD AD SLOT",
                        placeholderSub = "Contact us to advertise here",
                        modifier = Modifier.fillMaxWidth().height(90.dp),
                        onTap = openUrl,
                    )
                }
            }
        }
    }
}

@Composable
private fun AdSlot(
    partner: FeaturedPartner?,
    placeholderLabel: String,
    placeholderSub: String,
    onTap: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (partner != null) {
        AsyncImage(
            model = partner.bannerImageUrl.ifBlank { partner.logoUrl },
            contentDescription = partner.name,
            contentScale = ContentScale.Crop,
            modifier = modifier
                .clip(RoundedCornerShape(12.dp))
                .background(BtccCard)
                .clickable { onTap(partner.linkUrl) },
        )
    } else {
        Box(
            modifier = modifier
                .clip(RoundedCornerShape(12.dp))
                .border(1.dp, BtccOutline, RoundedCornerShape(12.dp))
                .background(BtccCard.copy(alpha = 0.5f)),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = placeholderLabel,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                    color = BtccTextSecondary,
                )
                Text(
                    text = placeholderSub,
                    fontSize = 11.sp,
                    color = BtccTextSecondary.copy(alpha = 0.5f),
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun CategoryTile(
    label: String,
    sublabel: String,
    imageUrl: String?,
    gradient: List<Color>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Brush.verticalGradient(gradient))
            .clickable { onClick() },
    ) {
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.TopCenter,
                modifier = Modifier
                    .fillMaxSize()
                    .drawWithContent {
                        drawContent()
                        drawRect(
                            Brush.verticalGradient(
                                colorStops = arrayOf(
                                    0.3f to Color.Transparent,
                                    1.0f to Color.Black.copy(alpha = 0.95f),
                                )
                            )
                        )
                    },
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(14.dp),
        ) {
            Text(
                text = label,
                fontWeight = FontWeight.Black,
                fontSize = 22.sp,
                letterSpacing = 1.sp,
                color = Color.White,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = sublabel,
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.65f),
            )
        }
    }
}
