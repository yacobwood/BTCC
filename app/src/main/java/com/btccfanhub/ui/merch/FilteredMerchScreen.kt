package com.btccfanhub.ui.merch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
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
import com.btccfanhub.ui.theme.BtccYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FilteredMerchScreen(
    title: String,
    filterType: String, // "team" or "driver"
    filterValue: String, // team name or driver number
    viewModel: MerchViewModel = viewModel(),
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    // Derive items reactively — re-evaluated whenever state changes
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

    androidx.compose.foundation.layout.Column(
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

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            // Show seller card with discount code at top if available
            sellers.filter { it.discountCode != null }.forEach { seller ->
                item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(2) }) {
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
                    modifier = Modifier,
                )
            }
        }
    }
}
