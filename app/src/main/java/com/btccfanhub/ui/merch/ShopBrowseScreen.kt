package com.btccfanhub.ui.merch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.btccfanhub.data.model.Seller
import com.btccfanhub.ui.merch.components.BrowseTile
import com.btccfanhub.ui.theme.BtccBackground

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShopBrowseScreen(
    browseType: String,          // "drivers" or "teams"
    viewModel: MerchViewModel = viewModel(),
    onDriverClick: (Int) -> Unit = {},
    onTeamClick: (String) -> Unit = {},
    onBack: () -> Unit = {},
) {
    val title = if (browseType == "drivers") "Browse by Driver" else "Browse by Team"
    val sortedDrivers by viewModel.sortedDrivers.collectAsState()
    val sortedTeams   by viewModel.sortedTeams.collectAsState()
    val allSellers    by viewModel.allSellersFlow.collectAsState(initial = emptyList<Seller>())

    androidx.compose.foundation.layout.Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground)
            .statusBarsPadding(),
    ) {
        TopAppBar(
            title = {
                Text(
                    title.uppercase(),
                    fontWeight    = FontWeight.Black,
                    fontSize      = 18.sp,
                    letterSpacing = 1.sp,
                )
            },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(containerColor = BtccBackground),
        )

        if (browseType == "drivers") {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(sortedDrivers) { (driverId, driverName, imageUrl) ->
                    BrowseTile(
                        label = driverName,
                        imageUrl = imageUrl.ifEmpty { null },
                        onClick = { onDriverClick(driverId) },
                        modifier = Modifier.fillMaxWidth().height(180.dp),
                    )
                }
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(sortedTeams) { teamName ->
                    val logoUrl = allSellers.firstOrNull { it.displayName == teamName }?.logoUrl
                    BrowseTile(
                        label = teamName,
                        imageUrl = logoUrl,
                        onClick = { onTeamClick(teamName) },
                        modifier = Modifier.fillMaxWidth().height(180.dp),
                    )
                }
            }
        }
    }
}
