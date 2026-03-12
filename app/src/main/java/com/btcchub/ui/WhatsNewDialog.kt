package com.btcchub.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NewReleases
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.btcchub.ui.theme.*

@Composable
fun WhatsNewDialog(
    changes: List<String>,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(BtccCard, RoundedCornerShape(16.dp))
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Header
            Row(
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    Icons.Default.NewReleases,
                    contentDescription = null,
                    tint     = BtccYellow,
                    modifier = Modifier.size(26.dp),
                )
                Column {
                    Text(
                        "WHAT'S NEW",
                        fontWeight    = FontWeight.Black,
                        fontSize      = 16.sp,
                        letterSpacing = 1.sp,
                        color         = BtccYellow,
                    )
                    Text(
                        "Latest update",
                        style = MaterialTheme.typography.labelSmall,
                        color = BtccTextSecondary,
                    )
                }
            }

            HorizontalDivider(color = BtccOutline.copy(alpha = 0.5f))

            // Change list
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                changes.forEach { change ->
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            "•",
                            color      = BtccYellow,
                            fontWeight = FontWeight.Bold,
                            fontSize   = 14.sp,
                            modifier   = Modifier.padding(top = 1.dp),
                        )
                        Text(
                            change,
                            style     = MaterialTheme.typography.bodySmall,
                            color     = MaterialTheme.colorScheme.onBackground,
                            lineHeight = 19.sp,
                        )
                    }
                }
            }

            // Dismiss button
            Button(
                onClick  = onDismiss,
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(10.dp),
                colors   = ButtonDefaults.buttonColors(
                    containerColor = BtccYellow,
                    contentColor   = BtccNavy,
                ),
            ) {
                Text(
                    "GOT IT",
                    fontWeight    = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                )
            }
        }
    }
}
