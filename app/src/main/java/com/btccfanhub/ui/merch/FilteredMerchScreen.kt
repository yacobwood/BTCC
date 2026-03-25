package com.btccfanhub.ui.merch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridItemSpan
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.btccfanhub.ui.merch.components.MerchItemCard
import com.btccfanhub.ui.merch.components.SellerCard
import com.btccfanhub.ui.theme.BtccBackground

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilteredMerchScreen(
    title: String,
    filterType: String,
    filterValue: String,
    viewModel: MerchViewModel = viewModel(),
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    val allItems = when (state) {
        is MerchUiState.Success, is MerchUiState.Error -> viewModel.getAllItems()
        else -> emptyList()
    }
    val allSellers = when (state) {
        is MerchUiState.Success, is MerchUiState.Error -> viewModel.getAllSellers()
        else -> emptyList()
    }

    val items = when (filterType) {
        "team" -> allItems.filter { it.teamIds.contains(filterValue) }
        "driver" -> {
            val driverId = filterValue.toIntOrNull() ?: 0
            allItems.filter { it.driverIds.contains(driverId) }
        }
        else -> emptyList()
    }

    val sellers = when (filterType) {
        "team" -> allSellers.filter { it.displayName == filterValue || it.id == filterValue }.distinctBy { it.id }
        else -> emptyList()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground)
            .statusBarsPadding(),
    ) {
        TopAppBar(
            title = { Text(title, fontWeight = FontWeight.Bold, fontSize = 18.sp) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        LazyVerticalStaggeredGrid(
            columns = StaggeredGridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalItemSpacing = 8.dp,
        ) {
            sellers.filter { it.discountCode != null }.forEach { seller ->
                item(span = StaggeredGridItemSpan.FullLine) {
                    SellerCard(
                        seller = seller,
                        onDiscountCodeTap = { viewModel.discountCodeCopied(it, context) },
                    )
                }
            }
            items(items) { merchItem ->
                MerchItemCard(
                    item = merchItem,
                    onBuyClick = { viewModel.itemTapped(merchItem, context) },
                )
            }
        }
    }
}
