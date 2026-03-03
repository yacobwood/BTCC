package com.btccfanhub.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val BtccColorScheme = darkColorScheme(
    primary = BtccYellow,
    onPrimary = BtccNavy,
    primaryContainer = BtccYellowDark,
    onPrimaryContainer = BtccTextPrimary,
    background = BtccBackground,
    onBackground = BtccTextPrimary,
    surface = BtccSurface,
    onSurface = BtccTextPrimary,
    surfaceVariant = BtccCard,
    onSurfaceVariant = BtccTextSecondary,
    outline = BtccOutline,
)

@Composable
fun BTCCFanHubTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BtccColorScheme,
        typography = Typography,
        content = content
    )
}
