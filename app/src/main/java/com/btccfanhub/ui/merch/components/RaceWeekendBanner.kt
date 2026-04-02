package com.btccfanhub.ui.merch.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.btccfanhub.ui.theme.BtccNavy
import com.btccfanhub.ui.theme.BtccYellow

@Composable
fun RaceWeekendBanner(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Surface(
        color = BtccYellow,
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
    ) {
        Row(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "🏁 Race Weekend Picks →",
                style = MaterialTheme.typography.titleSmall,
                color = BtccNavy,
                fontWeight = FontWeight.Bold
            )
        }
    }
}
