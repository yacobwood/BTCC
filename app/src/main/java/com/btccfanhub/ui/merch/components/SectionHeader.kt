package com.btccfanhub.ui.merch.components

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.btccfanhub.ui.theme.BtccTextSecondary

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier) {
    Text(
        text = title.uppercase(),
        fontWeight = FontWeight.ExtraBold,
        fontSize = 12.sp,
        letterSpacing = 2.sp,
        color = BtccTextSecondary,
        modifier = modifier
            .padding(top = 16.dp, bottom = 6.dp)
    )
}
