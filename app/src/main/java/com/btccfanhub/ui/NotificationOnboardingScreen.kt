package com.btccfanhub.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.ui.theme.*

@Composable
fun NotificationOnboardingScreen(
    onEnableNotifications: () -> Unit,
    onSkip: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BtccBackground),
    ) {
        // Red accent bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .background(Color(0xFFE3000B)),
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            // Bell icon
            Icon(
                imageVector        = Icons.Default.Notifications,
                contentDescription = null,
                tint               = BtccYellow,
                modifier           = Modifier.size(56.dp),
            )

            Spacer(Modifier.height(20.dp))

            Text(
                "Stay in the loop",
                fontWeight    = FontWeight.Black,
                fontSize      = 26.sp,
                color         = MaterialTheme.colorScheme.onBackground,
                letterSpacing = 0.sp,
            )

            Spacer(Modifier.height(8.dp))

            Text(
                "BTCC Hub can notify you about the things that matter. You'll choose what to allow next.",
                style     = MaterialTheme.typography.bodyMedium,
                color     = BtccTextSecondary,
                lineHeight = 22.sp,
            )

            Spacer(Modifier.height(28.dp))

            // Notification type cards
            NotifBullet(
                icon     = Icons.Default.NotificationsActive,
                label    = "Race session reminders",
                sublabel = "Qualifying, Race 1, Race 2, Race 3",
            )
            Spacer(Modifier.height(10.dp))
            NotifBullet(
                icon     = Icons.Default.Article,
                label    = "Breaking BTCC news",
                sublabel = "Latest headlines from btcc.net",
            )
            Spacer(Modifier.height(10.dp))
            NotifBullet(
                icon     = Icons.Default.EmojiEvents,
                label    = "New round results",
                sublabel = "Know when race results are published",
            )

            Spacer(Modifier.height(40.dp))

            // CTA
            Button(
                onClick  = onEnableNotifications,
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(12.dp),
                colors   = ButtonDefaults.buttonColors(
                    containerColor = BtccYellow,
                    contentColor   = BtccNavy,
                ),
            ) {
                Text(
                    "Continue",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize   = 15.sp,
                    modifier   = Modifier.padding(vertical = 4.dp),
                )
            }

            Spacer(Modifier.height(4.dp))

            TextButton(
                onClick  = onSkip,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    "Maybe later",
                    color      = BtccTextSecondary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize   = 14.sp,
                )
            }
        }
    }
}

@Composable
private fun NotifBullet(icon: ImageVector, label: String, sublabel: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BtccCard, RoundedCornerShape(12.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment     = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Icon(
            imageVector        = icon,
            contentDescription = null,
            tint               = BtccYellow,
            modifier           = Modifier.size(24.dp),
        )
        Column {
            Text(
                label,
                style      = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                color      = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                sublabel,
                style = MaterialTheme.typography.labelSmall,
                color = BtccTextSecondary,
            )
        }
    }
}
