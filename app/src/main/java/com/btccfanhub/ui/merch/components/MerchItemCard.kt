package com.btccfanhub.ui.merch.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.ColorPainter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.btccfanhub.data.model.MerchItem
import com.btccfanhub.ui.theme.BtccCard
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccSurface
import com.btccfanhub.ui.theme.BtccTextPrimary
import com.btccfanhub.ui.theme.BtccTextSecondary
import com.btccfanhub.ui.theme.BtccYellow

@Composable
fun MerchItemCard(item: MerchItem, onBuyClick: () -> Unit, modifier: Modifier = Modifier) {
    val cardWidth = 170.dp

    Surface(
        color = BtccCard,
        shape = RoundedCornerShape(8.dp),
        modifier = modifier.width(cardWidth).height(310.dp)
    ) {
        Column(modifier = Modifier.padding(8.dp).fillMaxHeight()) {
            AsyncImage(
                model = item.imageUrl,
                contentDescription = "${item.title} by ${item.sellerName}",
                placeholder = ColorPainter(BtccSurface),
                error = ColorPainter(BtccSurface),
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
            )

            if (item.sponsored) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    Surface(
                        color = BtccYellow,
                        shape = RoundedCornerShape(4.dp)
                    ) {
                        Text(
                            text = "Featured",
                            style = MaterialTheme.typography.labelSmall,
                            color = BtccNavy,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                    Text(
                        text = " Ad",
                        style = MaterialTheme.typography.labelSmall,
                        color = BtccTextSecondary,
                        modifier = Modifier.padding(start = 4.dp)
                    )
                }
            }

            Text(
                text = item.title,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodyMedium,
                color = BtccTextPrimary,
                modifier = Modifier.padding(top = 4.dp)
            )

            Text(
                text = "${item.price} · ${item.sellerName}",
                style = MaterialTheme.typography.bodySmall,
                color = BtccTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp)
            )

            Spacer(modifier = Modifier.weight(1f))

            Button(
                onClick = onBuyClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .padding(top = 8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = BtccYellow,
                    contentColor = BtccNavy
                )
            ) {
                Text("Buy")
            }
        }
    }
}
