package com.btccfanhub.ui.merch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.btccfanhub.data.analytics.Analytics
import com.btccfanhub.data.model.MerchItem
import com.btccfanhub.data.model.SellerType
import com.btccfanhub.ui.merch.components.BrowseTile
import com.btccfanhub.ui.merch.components.FeaturedBanner
import com.btccfanhub.ui.merch.components.MerchItemCard
import com.btccfanhub.ui.merch.components.SectionHeader
import com.btccfanhub.ui.merch.components.SellerCard
import com.btccfanhub.ui.merch.components.SkeletonLoader
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccTextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopTheGridScreen(
    viewModel: MerchViewModel = viewModel(),
    onItemTap: (MerchItem) -> Unit = {},
    onTeamClick: (String) -> Unit = {},
    onDriverClick: (Int) -> Unit = {},
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsState()
    val isRefreshing by viewModel.isRefreshing.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.screen("shop_the_grid")
    }

    // Pre-compute carousel data outside LazyColumn (composable context)
    val successState = state as? MerchUiState.Success
    val allFeedItems = viewModel.getAllItems()
    val allFeedSellers = viewModel.getAllSellers()
    val sortedTeamNames by viewModel.sortedTeams.collectAsState()
    val sortedDriverEntries by viewModel.sortedDrivers.collectAsState()

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = { viewModel.refresh() },
        modifier = Modifier.fillMaxWidth().background(BtccBackground),
    ) {
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        when (val s = state) {
            is MerchUiState.Loading -> {
                item { SkeletonLoader() }
            }

            is MerchUiState.Success -> {
                if (s.showFeaturedBanner) {
                    item { FeaturedBanner() }
                }

                // Shop by Team carousel
                if (sortedTeamNames.isNotEmpty()) {
                    item { SectionHeader("Shop by Team") }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(sortedTeamNames) { teamName ->
                                val teamSeller = allFeedSellers
                                    .firstOrNull { it.displayName == teamName }
                                BrowseTile(
                                    label = teamName,
                                    imageUrl = teamSeller?.logoUrl,
                                    onClick = { onTeamClick(teamName) },
                                )
                            }
                        }
                    }
                }

                // Shop by Driver carousel
                if (sortedDriverEntries.isNotEmpty()) {
                    item { SectionHeader("Shop by Driver") }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(sortedDriverEntries) { (driverId, driverName, driverImageUrl) ->
                                BrowseTile(
                                    label = driverName,
                                    imageUrl = driverImageUrl.ifEmpty { null },
                                    onClick = { onDriverClick(driverId) },
                                )
                            }
                        }
                    }
                }

                // Existing sections
                s.sections.forEach { section ->
                    item { SectionHeader(section.title) }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(section.items) { merchItem ->
                                MerchItemCard(
                                    item = merchItem,
                                    modifier = Modifier.width(170.dp),
                                    onBuyClick = {
                                        viewModel.itemTapped(merchItem, context)
                                        onItemTap(merchItem)
                                    },
                                )
                            }
                        }
                    }
                    val sellersWithCode = section.sellers.filter { it.discountCode != null }
                    if (sellersWithCode.isNotEmpty()) {
                        item {
                            sellersWithCode.forEach { seller ->
                                SellerCard(
                                    seller = seller,
                                    onDiscountCodeTap = { viewModel.discountCodeCopied(it, context) },
                                )
                            }
                        }
                    }
                }
            }

            is MerchUiState.Error -> {
                item {
                    Surface(
                        color = BtccCard,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = "Could not load merch. Showing cached results.",
                            color = BtccTextPrimary,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
            }
        }
    }
    } // PullToRefreshBox
}
