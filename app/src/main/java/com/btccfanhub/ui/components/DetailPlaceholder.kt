package com.btccfanhub.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.btccfanhub.ui.theme.BtccBackground
import com.btccfanhub.ui.theme.BtccTextSecondary

@Composable
fun DetailPlaceholder(message: String) {
    Box(
        modifier = Modifier.fillMaxSize().background(BtccBackground),
        contentAlignment = Alignment.Center,
    ) {
        Text(message, color = BtccTextSecondary, style = MaterialTheme.typography.bodyLarge)
    }
}
