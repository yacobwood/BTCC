package com.btccfanhub.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

val LocalDarkTheme = staticCompositionLocalOf { true }

private val DarkColorScheme = darkColorScheme(
    primary              = BtccYellow,
    onPrimary            = BtccNavy,
    primaryContainer     = BtccYellowDark,
    onPrimaryContainer   = BtccTextPrimary,
    background           = BtccBackground,
    onBackground         = BtccTextPrimary,
    surface              = BtccSurface,
    onSurface            = BtccTextPrimary,
    surfaceVariant       = BtccCard,
    onSurfaceVariant     = BtccTextSecondary,
    outline              = BtccOutline,
)

private val LightColorScheme = lightColorScheme(
    primary              = BtccNavy,
    onPrimary            = BtccYellow,
    primaryContainer     = BtccYellow,
    onPrimaryContainer   = BtccNavy,
    background           = BtccBackgroundLight,
    onBackground         = BtccTextPrimaryLight,
    surface              = BtccSurfaceLight,
    onSurface            = BtccTextPrimaryLight,
    surfaceVariant       = BtccCardLight,
    onSurfaceVariant     = BtccTextSecondaryLight,
    outline              = BtccOutlineLight,
)

@Composable
fun BTCCFanHubTheme(
    darkTheme: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    CompositionLocalProvider(LocalDarkTheme provides darkTheme) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography  = Typography,
            content     = content,
        )
    }
}
