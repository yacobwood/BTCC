package com.btccfanhub.ui.merch.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.btccfanhub.data.model.Seller
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccTextPrimary
import com.btccfanhub.ui.theme.BtccYellow

@Composable
fun SellerCard(seller: Seller, onDiscountCodeTap: (Seller) -> Unit, modifier: Modifier = Modifier) {
    Surface(
        color = BtccCard,
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AsyncImage(
                    model = seller.logoUrl,
                    contentDescription = seller.displayName,
                    placeholder = ColorPainter(BtccSurface),
                    error = ColorPainter(BtccSurface),
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(48.dp)
                )
                Text(
                    text = seller.displayName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = BtccTextPrimary,
                    modifier = Modifier.padding(start = 12.dp)
                )
            }

            if (seller.discountCode != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clickable { onDiscountCodeTap(seller) }
                        .padding(top = 8.dp)
                ) {
                    Text(
                        text = "Use code: ${seller.discountCode}",
                        style = MaterialTheme.typography.bodySmall,
                        color = BtccYellow,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(
                        onClick = { onDiscountCodeTap(seller) },
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = "Copy discount code",
                            tint = BtccYellow
                        )
                    }
                }
            }
        }
    }
}
