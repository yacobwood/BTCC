package com.btccfanhub.ui.merch.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.btccfanhub.data.model.MerchItem

@Composable
fun TeamInlineCard(
    teamName: String,
    items: List<MerchItem>,
    onItemTap: (MerchItem) -> Unit,
    modifier: Modifier = Modifier
) {
    if (items.isEmpty()) return

    Column(modifier = modifier) {
        SectionHeader("Shop $teamName Kit")
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp)
        ) {
            items(items.take(4)) { item ->
                MerchItemCard(
                    item = item,
                    onBuyClick = { onItemTap(item) }
                )
            }
        }
    }
}
